#!/usr/bin/env node
/**
 * Fusionne le catalogue WooCommerce avec le sitemap BeautyMall (sans Python).
 * Même logique que merge_beautymall_products.py — fuzzy matching, seuil 85 %.
 *
 * Usage :
 *   node scripts/merge-beautymall-products.mjs
 *   node --use-system-ca scripts/merge-beautymall-products.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MAIN = "C:\\Users\\pc\\Downloads\\wp-https___PRODUCTS PARA (1).csv";
const DEFAULT_SITEMAP = path.join(__dirname, "beautymall_sitemap_products.csv");
const DEFAULT_OUT_DIR = __dirname;
const MATCH_THRESHOLD = 85;
const PROGRESS_EVERY = 250;

function parseArgs(argv) {
  let main = DEFAULT_MAIN;
  let sitemap = DEFAULT_SITEMAP;
  let outDir = DEFAULT_OUT_DIR;
  let threshold = MATCH_THRESHOLD;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--main" && argv[i + 1]) main = argv[++i];
    else if (argv[i] === "--sitemap" && argv[i + 1]) sitemap = argv[++i];
    else if (argv[i] === "--out-dir" && argv[i + 1]) outDir = argv[++i];
    else if (argv[i] === "--threshold" && argv[i + 1]) threshold = Number(argv[++i]);
  }
  return { main: path.resolve(main), sitemap: path.resolve(sitemap), outDir: path.resolve(outDir), threshold };
}

/** Parse CSV complet (champs multilignes dans description). */
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
  const records = rows.slice(1).map((cells) => {
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j] ?? `col_${j}`;
      obj[key] = cells[j] ?? "";
    }
    return obj;
  });
  return { header, records };
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(header, records) {
  const lines = [header.map(csvEscape).join(",")];
  for (const rec of records) {
    lines.push(header.map((h) => csvEscape(rec[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function normalizeNameForSlugMatch(text) {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function ratio(a, b) {
  if (!a && !b) return 100;
  if (!a || !b) return 0;
  if (a === b) return 100;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return ((maxLen - dist) / maxLen) * 100;
}

function tokenSetRatio(a, b) {
  const ta = new Set(a.split("-").filter(Boolean));
  const tb = new Set(b.split("-").filter(Boolean));
  if (!ta.size && !tb.size) return 100;
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).sort().join("-");
  const sa = [...ta].sort().join("-");
  const sb = [...tb].sort().join("-");
  return Math.max(ratio(inter, sa), ratio(inter, sb), ratio(sa, sb));
}

function wRatio(a, b) {
  return Math.max(ratio(a, b), tokenSetRatio(a, b));
}

function loadSitemap(sitemapPath) {
  const text = readFile(sitemapPath, "utf8");
  return text.then((raw) => {
    const { records } = parseCsvAll(raw.replace(/^\uFEFF/, ""));
    const slugs = [];
    const bySlug = new Map();
    for (const row of records) {
      const slug = (row.slug ?? "").trim();
      if (!slug) continue;
      slugs.push(slug);
      bySlug.set(slug, {
        slug,
        url_produit: (row.url_produit ?? "").trim(),
        url_image: (row.url_image ?? "").trim(),
      });
    }
    return { slugs, bySlug };
  });
}

function findBestMatch(norm, slugs, bySlug, threshold) {
  if (!norm) return null;
  if (bySlug.has(norm)) return { hit: bySlug.get(norm), score: 100 };

  let bestSlug = null;
  let bestScore = 0;
  const len = norm.length;

  for (const slug of slugs) {
    if (Math.abs(slug.length - len) > Math.max(20, len * 0.45)) continue;
    const score = wRatio(norm, slug);
    if (score > bestScore) {
      bestScore = score;
      bestSlug = slug;
      if (score >= 99.5) break;
    }
  }

  if (!bestSlug || bestScore < threshold) return null;
  return { hit: bySlug.get(bestSlug), score: bestScore };
}

async function main() {
  const { main: mainPath, sitemap: sitemapPath, outDir, threshold } = parseArgs(process.argv);

  console.log(`CSV principal : ${mainPath}`);
  console.log(`Sitemap       : ${sitemapPath}`);
  console.log(`Seuil matching : ${threshold}%`);
  console.log("(Version Node — pas besoin de Python ni pip)\n");

  console.log("Chargement sitemap…");
  const { slugs, bySlug } = await loadSitemap(sitemapPath);
  console.log(`  ${slugs.length} slug(s)`);

  console.log("Chargement catalogue principal (peut prendre 30–60 s)…");
  const mainRaw = await readFile(mainPath, "utf8");
  const { header, records } = parseCsvAll(mainRaw.replace(/^\uFEFF/, ""));
  console.log(`  ${records.length} ligne(s)`);

  const extraCols = ["url_produit", "url_image_valide"];
  const outHeader = [...header, ...extraCols.filter((c) => !header.includes(c))];

  const finalRows = [];
  const unmatchedRows = [];
  let matchedCount = 0;

  for (let i = 0; i < records.length; i++) {
    const row = { ...records[i] };
    const name = (row.name ?? "").trim();
    const norm = normalizeNameForSlugMatch(name);
    const match = findBestMatch(norm, slugs, bySlug, threshold);

    if (match) {
      row.url_produit = match.hit.url_produit;
      row.url_image_valide = match.hit.url_image;
      matchedCount++;
    } else {
      row.url_produit = "";
      row.url_image_valide = "";
      unmatchedRows.push(row);
    }
    finalRows.push(row);

    if ((i + 1) % PROGRESS_EVERY === 0) {
      console.log(`  … ${i + 1}/${records.length} (${matchedCount} correspondances)`);
    }
  }

  const outFinal = path.join(outDir, "products_final.csv");
  const outUnmatched = path.join(outDir, "products_unmatched.csv");
  await writeFile(outFinal, toCsv(outHeader, finalRows), "utf8");
  await writeFile(outUnmatched, toCsv(outHeader, unmatchedRows), "utf8");

  const total = records.length;
  const unmatchedCount = unmatchedRows.length;
  const rate = total ? (matchedCount / total) * 100 : 0;

  console.log("\nTerminé.");
  console.log(`  Fichier fusionné   : ${outFinal}`);
  console.log(`  Sans correspondance : ${outUnmatched}`);
  console.log(`  Produits (CSV principal) : ${total}`);
  console.log(`  Correspondances trouvées : ${matchedCount}`);
  console.log(`  Sans correspondance      : ${unmatchedCount}`);
  console.log(`  Taux de correspondance   : ${rate.toFixed(2)} %`);
}

main().catch((e) => {
  console.error("Erreur :", e.message ?? e);
  process.exit(1);
});
