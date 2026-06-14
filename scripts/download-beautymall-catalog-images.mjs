#!/usr/bin/env node
/**
 * Télécharge les photos BeautyMall en local (catalog/images/) — sauvegarde hors Supabase.
 *
 * Phase 1 du plan d’indépendance BeautyMall :
 *   1. Ce script → fichiers locaux {slug}.{ext}
 *   2. Tests app → URLs BeautyMall en base (inchangé)
 *   3. Prod → attach-catalog-images.mjs ou import-products-catalog.mjs
 *
 * Sources :
 *   --source supabase (défaut) — produits avec photo_url beautymall.ma
 *   --source csv — scripts/products_final.csv (url_image_valide + url_produit)
 *
 * Usage :
 *   node scripts/download-beautymall-catalog-images.mjs --dry-run
 *   node scripts/download-beautymall-catalog-images.mjs --dry-run --limit 10
 *   node --use-system-ca scripts/download-beautymall-catalog-images.mjs --limit 50
 *   node --use-system-ca scripts/download-beautymall-catalog-images.mjs
 *   node --use-system-ca scripts/download-beautymall-catalog-images.mjs --source csv
 *
 * Options :
 *   --out catalog/images     Dossier cible
 *   --limit N                Traiter au plus N produits
 *   --concurrency N          Téléchargements parallèles (défaut 3)
 *   --delay MS               Pause entre lots (défaut 300)
 *   --force                  Re-télécharger même si le fichier existe
 *   --csv chemin             CSV pour --source csv
 */

import { createClient } from "@supabase/supabase-js";
import { access, appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.join("catalog", "images");
const DEFAULT_CSV = path.join(__dirname, "products_final.csv");
const LOG_BASENAME = "beautymall-download-log.jsonl";
const MANIFEST_BASENAME = "beautymall-download-manifest.json";

const USER_AGENT = "Pharmeto-catalog-backup/1.0 (+local image archive)";
const FETCH_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 3;
const MIN_VALID_BYTES = 512;

async function loadEnvLocal() {
  try {
    const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    /* optional */
  }
}

function parseArgs(argv) {
  let source = "supabase";
  let out = DEFAULT_OUT;
  let csv = DEFAULT_CSV;
  let limit = null;
  let concurrency = 3;
  let delayMs = 300;
  let dryRun = false;
  let force = false;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--force") force = true;
    else if (a === "--source" && argv[i + 1]) source = argv[++i];
    else if (a === "--out" && argv[i + 1]) out = path.resolve(argv[++i]);
    else if (a === "--csv" && argv[i + 1]) csv = path.resolve(argv[++i]);
    else if (a === "--limit" && argv[i + 1]) limit = Math.max(1, Number(argv[++i]) || 1);
    else if (a === "--concurrency" && argv[i + 1]) concurrency = Math.max(1, Number(argv[++i]) || 3);
    else if (a === "--delay" && argv[i + 1]) delayMs = Math.max(0, Number(argv[++i]) || 0);
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/download-beautymall-catalog-images.mjs [options]
  --dry-run --limit 10 --source supabase|csv --out catalog/images --force`);
      process.exit(0);
    }
  }

  if (dryRun && limit == null) limit = 10;

  return { source, out, csv, limit, concurrency, delayMs, dryRun, force };
}

function slugFromProductUrl(url) {
  const t = (url || "").trim();
  const m = t.match(/beautymall\.ma\/product\/([^/?#]+)/i);
  if (m) return decodeURIComponent(m[1]).trim();
  try {
    const u = new URL(t);
    const parts = u.pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] ?? "").trim();
  } catch {
    return t.replace(/\/+$/, "").split("/").pop()?.split("?")[0]?.trim() ?? "";
  }
}

function isBeautymallPhotoUrl(url) {
  const t = (url || "").trim();
  return /^https:\/\/beautymall\.ma\/wp-content\//i.test(t);
}

function extFromUrl(url) {
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname).split("?")[0];
    const m = base.match(/\.(jpe?g|png|webp|gif)$/i);
    if (m) return m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return null;
}

function extFromContentType(contentType) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("image/webp")) return "webp";
  if (ct.includes("image/png")) return "png";
  if (ct.includes("image/gif")) return "gif";
  if (ct.includes("image/jpeg") || ct.includes("image/jpg")) return "jpg";
  return null;
}

function sanitizeSlug(slug) {
  return (slug || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 180);
}

/** Parse CSV WooCommerce (multiligne) — même logique que import-beautymall-catalog.mjs */
function parseCsvAll(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
          continue;
        }
        inQuotes = false;
        continue;
      }
      field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\r") continue;
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length < 1) throw new Error("CSV vide");
  const header = rows[0];
  return rows.slice(1).map((cells) => {
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j] ?? `col_${j}`;
      obj[key] = cells[j] ?? "";
    }
    return obj;
  });
}

async function loadFromCsv(csvPath) {
  const raw = await readFile(csvPath, "utf8");
  const records = parseCsvAll(raw.replace(/^\uFEFF/, ""));
  const items = [];
  for (const rec of records) {
    const name = (rec.name || "").trim();
    const photoUrl = (rec.url_image_valide || "").trim();
    if (!name || !isBeautymallPhotoUrl(photoUrl)) continue;
    const slug =
      slugFromProductUrl(rec.url_produit) ||
      sanitizeSlug((rec.url_produit || "").split("/").pop() ?? "");
    if (!slug) continue;
    items.push({
      id: null,
      name,
      slug,
      photo_url: photoUrl,
      source: "csv",
    });
  }
  return items;
}

async function loadFromSupabase(supabase) {
  const pageSize = 1000;
  const items = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,subcategory,photo_url")
      .ilike("photo_url", "https://beautymall.ma/wp-content/%")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const batch = data ?? [];
    for (const row of batch) {
      const photoUrl = (row.photo_url || "").trim();
      if (!isBeautymallPhotoUrl(photoUrl)) continue;
      const slug = sanitizeSlug(row.subcategory) || slugFromProductUrl(photoUrl);
      if (!slug) continue;
      items.push({
        id: row.id,
        name: row.name,
        slug,
        photo_url: photoUrl,
        source: "supabase",
      });
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return items;
}

async function fetchImage(url) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*" },
        redirect: "follow",
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < MIN_VALID_BYTES) throw new Error(`fichier trop petit (${buf.length} o)`);
      const ext = extFromUrl(url) || extFromContentType(res.headers.get("content-type")) || "jpg";
      return { buf, ext, bytes: buf.length };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      const wait = attempt * 1500;
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function fileExistsWithSize(filePath, minBytes = MIN_VALID_BYTES) {
  try {
    const st = await stat(filePath);
    return st.isFile() && st.size >= minBytes;
  } catch {
    return false;
  }
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function appendLog(logPath, entry) {
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

async function main() {
  await loadEnvLocal();
  const opts = parseArgs(process.argv);
  const logPath = path.join(opts.out, LOG_BASENAME);

  console.log("--- Téléchargement photos BeautyMall → disque local ---");
  console.log(`Source     : ${opts.source}`);
  console.log(`Dossier    : ${opts.out}`);
  console.log(`Mode       : ${opts.dryRun ? "dry-run" : "réel"}`);
  if (opts.limit) console.log(`Limite     : ${opts.limit}`);
  console.log(`Parallèle  : ${opts.concurrency} · pause ${opts.delayMs} ms entre lots\n`);

  let items;
  if (opts.source === "csv") {
    console.log(`CSV : ${opts.csv}`);
    items = await loadFromCsv(opts.csv);
  } else if (opts.source === "supabase") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
      console.error("Ou utilisez --source csv si vous avez scripts/products_final.csv");
      process.exit(1);
    }
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    items = await loadFromSupabase(supabase);
  } else {
    console.error(`Source inconnue : ${opts.source}`);
    process.exit(1);
  }

  const bySlug = new Map();
  for (const item of items) {
    if (!bySlug.has(item.slug)) bySlug.set(item.slug, item);
  }
  items = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug, "fr"));

  if (opts.limit) items = items.slice(0, opts.limit);

  console.log(`${items.length} image(s) à traiter\n`);
  if (items.length === 0) {
    console.log("Rien à télécharger.");
    return;
  }

  if (!opts.dryRun) {
    await mkdir(opts.out, { recursive: true });
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  const chunks = [];
  for (let i = 0; i < items.length; i += opts.concurrency) {
    chunks.push(items.slice(i, i + opts.concurrency));
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    const results = await mapPool(chunk, opts.concurrency, async (item) => {
      const extGuess = extFromUrl(item.photo_url) || "jpg";
      const destPath = path.join(opts.out, `${item.slug}.${extGuess}`);

      if (!opts.force && !opts.dryRun) {
        const existing = await fileExistsWithSize(destPath);
        if (existing) {
          const st = await stat(destPath);
          const actualExt = path.extname(destPath).slice(1).toLowerCase();
          await appendLog(logPath, {
            at: new Date().toISOString(),
            status: "skipped",
            slug: item.slug,
            name: item.name,
            file: path.basename(destPath),
            bytes: st.size,
            photo_url: item.photo_url,
          });
          return { status: "skipped", item, file: path.basename(destPath), bytes: st.size };
        }
      }

      if (opts.dryRun) {
        console.log(`[dry] ${item.slug}.${extGuess} ← ${item.name}`);
        console.log(`      ${item.photo_url}`);
        return { status: "dry", item };
      }

      try {
        const { buf, ext, bytes } = await fetchImage(item.photo_url);
        const finalPath = path.join(opts.out, `${item.slug}.${ext}`);
        await writeFile(finalPath, buf);
        await appendLog(logPath, {
          at: new Date().toISOString(),
          status: "ok",
          slug: item.slug,
          name: item.name,
          file: path.basename(finalPath),
          bytes,
          photo_url: item.photo_url,
          product_id: item.id,
        });
        return { status: "ok", item, file: path.basename(finalPath), bytes };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await appendLog(logPath, {
          at: new Date().toISOString(),
          status: "error",
          slug: item.slug,
          name: item.name,
          photo_url: item.photo_url,
          error: msg,
          product_id: item.id,
        });
        return { status: "error", item, error: msg };
      }
    });

    for (const r of results) {
      if (r.status === "ok") {
        ok++;
        console.log(`✓ ${r.file} (${r.bytes} o) — ${r.item.name}`);
      } else if (r.status === "skipped") {
        skipped++;
        if (skipped <= 5 || ok + failed === 0) {
          console.log(`↷ déjà présent : ${r.file}`);
        }
      } else if (r.status === "error") {
        failed++;
        console.error(`✗ ${r.item.slug} — ${r.error}`);
      } else if (r.status === "dry") {
        ok++;
      }
    }

    if (!opts.dryRun && opts.delayMs > 0 && ci < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }

    if (!opts.dryRun) {
      process.stdout.write(`\r  … ${ok + skipped + failed}/${items.length} (ok ${ok}, skip ${skipped}, err ${failed})`);
    }
  }

  if (!opts.dryRun) process.stdout.write("\n");

  const manifest = {
    generated_at: new Date().toISOString(),
    source: opts.source,
    out_dir: opts.out,
    total: items.length,
    downloaded: ok,
    skipped,
    failed,
    dry_run: false,
  };

  if (!opts.dryRun) {
    await writeFile(path.join(opts.out, MANIFEST_BASENAME), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log("\nTerminé.");
  console.log(`  OK        : ${ok}`);
  console.log(`  Ignorés   : ${skipped} (déjà sur disque — relance sans --force)`);
  console.log(`  Erreurs   : ${failed}`);
  if (!opts.dryRun) {
    console.log(`  Journal   : ${logPath}`);
    console.log(`  Manifeste : ${path.join(opts.out, MANIFEST_BASENAME)}`);
    console.log("\nProchaine étape (plus tard, prod) :");
    console.log("  node --use-system-ca scripts/attach-catalog-images.mjs --category beautymall_catalog");
  } else {
    console.log("\n(dry-run — aucun fichier écrit)");
  }

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Erreur :", e instanceof Error ? e.message : e);
  process.exit(1);
});
