#!/usr/bin/env node
/**
 * Importe products_final.csv dans public.products (Supabase).
 *
 * Règles (pilote juin 2026) :
 *   - Tout en parapharmacie
 *   - price_pph = sale_price, price_ppv = regular_price
 *   - photo_url = url_image_valide (BeautyMall) uniquement ; sinon null → icône Package dans l'app
 *   - full_description = description HTML WooCommerce
 *   - laboratory = null
 *   - category = beautymall_catalog
 *   - subcategory = slug BeautyMall (depuis url_produit)
 *
 * Prérequis :
 *   1. supabase/scripts/wipe-catalog-beautymall-import.sql appliqué (catalogue vide)
 *   2. .env.local : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage :
 *   node scripts/import-beautymall-catalog.mjs --dry-run
 *   node --use-system-ca scripts/import-beautymall-catalog.mjs
 *   node scripts/import-beautymall-catalog.mjs --csv scripts/products_final.csv --batch 200
 */

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = path.join(__dirname, "products_final.csv");
const CATEGORY = "beautymall_catalog";
const BATCH_DEFAULT = 200;

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
  let csv = DEFAULT_CSV;
  let batch = BATCH_DEFAULT;
  let dryRun = false;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--csv" && argv[i + 1]) csv = path.resolve(argv[++i]);
    else if (argv[i] === "--batch" && argv[i + 1]) batch = Math.max(50, Number(argv[++i]) || BATCH_DEFAULT);
    else if (argv[i] === "--dry-run") dryRun = true;
  }
  return { csv, batch, dryRun };
}

/** Parse CSV WooCommerce complet (descriptions multilignes, images avec virgules). */
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

function parseRecords(text) {
  const records = parseCsvAll(text.replace(/^\uFEFF/, ""));
  const rows = [];
  for (const rec of records) {
    const name = (rec.name || "").trim();
    if (!name) continue;
    rows.push({
      woo_id: (rec.id || "").trim(),
      name,
      sale_price: rec.sale_price,
      regular_price: rec.regular_price,
      url_produit: (rec.url_produit || "").trim(),
      url_image_valide: (rec.url_image_valide || "").trim(),
      description: (rec.description || "").trim(),
    });
  }
  return rows;
}

function parsePrice(v) {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function slugFromProductUrl(url) {
  const t = (url || "").trim();
  const m = t.match(/beautymall\.ma\/product\/([^/]+)/i);
  return m ? m[1] : null;
}

function pickPhotoUrl(row) {
  const bm = (row.url_image_valide || "").trim();
  if (/^https:\/\/beautymall\.ma\/wp-content\//i.test(bm)) return bm;
  return null;
}

function toDbRow(row) {
  return {
    name: row.name,
    price_pph: parsePrice(row.sale_price),
    price_ppv: parsePrice(row.regular_price),
    product_type: "parapharmacie",
    laboratory: null,
    category: CATEGORY,
    subcategory: slugFromProductUrl(row.url_produit),
    full_description: row.description || null,
    photo_url: pickPhotoUrl(row),
    is_active: true,
  };
}

async function main() {
  await loadEnvLocal();
  const { csv, batch, dryRun } = parseArgs(process.argv);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!url || !key)) {
    console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
    process.exit(1);
  }

  console.log(`CSV : ${csv}`);
  console.log(`Mode : ${dryRun ? "dry-run" : "import"}`);
  console.log("Chargement…");

  const raw = await readFile(csv, "utf8");
  const parsed = parseRecords(raw);
  const dbRows = parsed.map(toDbRow);

  const withPhoto = dbRows.filter((r) => r.photo_url).length;
  const withoutPhoto = dbRows.length - withPhoto;

  console.log(`\n${dbRows.length} produit(s) parsé(s)`);
  console.log(`  avec photo BeautyMall : ${withPhoto}`);
  console.log(`  sans photo (icône UI)  : ${withoutPhoto}`);
  console.log(`  avec description     : ${dbRows.filter((r) => r.full_description).length}`);

  if (dryRun) {
    console.log("\nExemples :");
    for (const r of dbRows.slice(0, 3)) {
      console.log(`  • ${r.name}`);
      console.log(`    PPH=${r.price_pph} PPV=${r.price_ppv} photo=${r.photo_url ? "oui" : "non"}`);
    }
    console.log("\n(dry-run — aucune écriture Supabase)");
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { count: existing, error: countErr } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });
  if (countErr) throw countErr;
  if (existing > 0) {
    console.error(
      `\nLa table products contient encore ${existing} ligne(s).`,
      "\nAppliquez d'abord supabase/scripts/wipe-catalog-beautymall-import.sql dans Supabase SQL Editor."
    );
    process.exit(1);
  }

  let inserted = 0;
  for (let i = 0; i < dbRows.length; i += batch) {
    const slice = dbRows.slice(i, i + batch);
    const { error } = await supabase.from("products").insert(slice);
    if (error) {
      console.error(`\nErreur lot ${i / batch + 1} (lignes ${i + 1}-${i + slice.length}) :`, error.message);
      process.exit(1);
    }
    inserted += slice.length;
    process.stdout.write(`\r  … ${inserted}/${dbRows.length}`);
  }

  console.log(`\n\nTerminé : ${inserted} produit(s) importé(s).`);
  console.log("Vérifiez la recherche catalogue patient / pharmacien sur la preview.");
}

main().catch((e) => {
  console.error("Erreur :", e.message ?? e);
  process.exit(1);
});
