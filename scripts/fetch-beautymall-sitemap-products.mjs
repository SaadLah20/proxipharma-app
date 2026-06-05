#!/usr/bin/env node
/**
 * Exporte les produits BeautyMall depuis les sitemaps XML (sans fusion catalogue).
 *
 * Lit https://beautymall.ma/sitemap_index.xml, parcourt les sitemaps « product-sitemap »,
 * extrait slug, URL produit et URL image (balises image:image / image:loc).
 *
 * Usage (Windows si erreur TLS : ajouter --use-system-ca) :
 *   node scripts/fetch-beautymall-sitemap-products.mjs
 *   node --use-system-ca scripts/fetch-beautymall-sitemap-products.mjs
 *   node scripts/fetch-beautymall-sitemap-products.mjs --out ./catalog/beautymall_sitemap_products.csv
 *
 * Sortie par défaut : scripts/beautymall_sitemap_products.csv
 *
 * Étape suivante (fusion avec votre CSV WooCommerce) :
 *   pip install -r scripts/requirements-beautymall-merge.txt
 *   python scripts/merge_beautymall_products.py
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITEMAP_INDEX_URL = "https://beautymall.ma/sitemap_index.xml";
const USER_AGENT = "ProxiPharma-beautymall-sitemap/1.0 (+catalog import)";
const FETCH_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const SITEMAP_CONCURRENCY = 4;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.join(__dirname, "beautymall_sitemap_products.csv");

function parseArgs(argv) {
  let out = DEFAULT_OUT;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) {
      out = path.resolve(argv[++i]);
      continue;
    }
    if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(`Usage: node scripts/fetch-beautymall-sitemap-products.mjs [--out chemin.csv]`);
      process.exit(0);
    }
  }
  return { out };
}

function decodeXmlEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** Valeurs texte des balises <loc> (insensible à la casse du nom). */
function extractLocTags(xml, localName = "loc") {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`, "gi");
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    const v = decodeXmlEntities(m[1]);
    if (v) out.push(v);
  }
  return out;
}

function extractUrlBlocks(xml) {
  const re = /<url\b[^>]*>([\s\S]*?)<\/url>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(xml)) !== null) blocks.push(m[1]);
  return blocks;
}

function slugFromProductUrl(productUrl) {
  try {
    const u = new URL(productUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    let slug = parts[parts.length - 1];
    if (slug === "product" || slug === "produit" || slug === "shop") {
      slug = parts[parts.length - 2] ?? slug;
    }
    return decodeURIComponent(slug).trim();
  } catch {
    const tail = productUrl.replace(/\/+$/, "").split("/").pop() ?? "";
    return tail.split("?")[0].trim();
  }
}

function firstImageLocInUrlBlock(block) {
  const inImageBlock =
    /<image:image\b[\s\S]*?<image:loc[^>]*>([\s\S]*?)<\/image:loc>[\s\S]*?<\/image:image>/i.exec(block);
  if (inImageBlock) return decodeXmlEntities(inImageBlock[1]);

  const anyImageLoc = /<image:loc[^>]*>([\s\S]*?)<\/image:loc>/i.exec(block);
  if (anyImageLoc) return decodeXmlEntities(anyImageLoc[1]);

  return "";
}

function parseProductSitemapXml(xml) {
  const rows = [];
  for (const block of extractUrlBlocks(xml)) {
    const locs = extractLocTags(block, "loc");
    const productUrl = locs[0] ?? "";
    if (!productUrl) continue;
    const imageUrl = firstImageLocInUrlBlock(block);
    const slug = slugFromProductUrl(productUrl);
    rows.push({ slug, url_produit: productUrl, url_image: imageUrl });
  }
  return rows;
}

async function fetchText(url) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/xml,text/xml,*/*",
        },
        redirect: "follow",
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      const wait = attempt * 2000;
      console.warn(`  ↻ Tentative ${attempt}/${MAX_RETRIES} échouée (${url}) : ${e.message ?? e}`);
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function mapPool(items, concurrency, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  const header = "slug,url_produit,url_image";
  const lines = rows.map((r) =>
    [csvEscape(r.slug), csvEscape(r.url_produit), csvEscape(r.url_image)].join(",")
  );
  return `${header}\n${lines.join("\n")}\n`;
}

async function main() {
  const { out } = parseArgs(process.argv);
  console.log(`Index sitemap : ${SITEMAP_INDEX_URL}`);

  const indexXml = await fetchText(SITEMAP_INDEX_URL);
  const allSitemapLocs = extractLocTags(indexXml, "loc");
  const productSitemapUrls = allSitemapLocs.filter((u) => /product-sitemap/i.test(u));

  if (productSitemapUrls.length === 0) {
    console.error("Aucun sitemap « product-sitemap » trouvé dans l’index.");
    console.error("URLs vues dans l’index :", allSitemapLocs.slice(0, 20).join("\n  "));
    process.exit(1);
  }

  console.log(`Sitemaps produits : ${productSitemapUrls.length}`);
  productSitemapUrls.forEach((u) => console.log(`  · ${u}`));

  const perSitemap = await mapPool(productSitemapUrls, SITEMAP_CONCURRENCY, async (sitemapUrl) => {
    console.log(`→ ${sitemapUrl}`);
    const xml = await fetchText(sitemapUrl);
    const rows = parseProductSitemapXml(xml);
    console.log(`  ${rows.length} URL(s) produit`);
    return rows;
  });

  const byProductUrl = new Map();
  for (const rows of perSitemap) {
    for (const row of rows) {
      if (!row.url_produit) continue;
      const prev = byProductUrl.get(row.url_produit);
      if (!prev) {
        byProductUrl.set(row.url_produit, row);
        continue;
      }
      if (!prev.url_image && row.url_image) byProductUrl.set(row.url_produit, row);
      if (!prev.slug && row.slug) {
        byProductUrl.set(row.url_produit, { ...prev, slug: row.slug });
      }
    }
  }

  const merged = [...byProductUrl.values()].sort((a, b) => a.slug.localeCompare(b.slug, "fr"));
  const withImage = merged.filter((r) => r.url_image.trim().length > 0);

  await writeFile(out, toCsv(merged), "utf8");

  console.log("");
  console.log("Terminé.");
  console.log(`  Fichier CSV : ${out}`);
  console.log(`  Produits trouvés : ${merged.length}`);
  console.log(`  Images trouvées : ${withImage.length}`);
  if (merged.length > withImage.length) {
    console.log(`  Sans image : ${merged.length - withImage.length}`);
  }
}

main().catch((e) => {
  console.error("Erreur :", e instanceof Error ? e.message : e);
  process.exit(1);
});
