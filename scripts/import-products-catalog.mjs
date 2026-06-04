#!/usr/bin/env node
/**
 * Importe / met à jour le catalogue produits + photos Storage.
 *
 * Prépare :
 *   catalog/products.csv
 *   catalog/images/{slug}.webp   (ou .jpg / .png)
 *
 * Source catalogue externe (juin 2026) : après fusion BeautyMall, partir de
 *   scripts/products_final.csv (url_image_valide, url_produit) — voir
 *   fetch-beautymall-sitemap-products.mjs + merge-beautymall-products.mjs
 *   (CAHIER_DES_CHARGES.md §10 session 2026-06-04).
 *
 * CSV (en-tête obligatoire) :
 *   name,price_pph,price_ppv,product_type,laboratory,image_slug
 *   product_type = medicament | parapharmacie
 *   image_slug = nom fichier sans extension (ex. doliprane-1000)
 *
 * Usage :
 *   node scripts/import-products-catalog.mjs
 *   node scripts/import-products-catalog.mjs --dir ./mon-catalogue
 *   node scripts/import-products-catalog.mjs --dry-run
 *
 * .env.local : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * photo_url en BDD = chemin Storage (ex. products/{uuid}/main.webp)
 * Affichage app : resolvePublicMediaUrl() dans lib/storage-media.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFile, access } from "node:fs/promises";
import path from "node:path";

const BUCKET = "public-assets";
const DEFAULT_DIR = "catalog";

async function loadEnvLocal() {
  try {
    const raw = await readFile(".env.local", "utf8");
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

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) throw new Error("CSV vide ou sans données");
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const required = ["name", "price_pph", "price_ppv", "product_type", "laboratory", "image_slug"];
  for (const col of required) {
    if (!header.includes(col)) throw new Error(`Colonne manquante dans CSV : ${col}`);
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    if (parts.length < header.length) continue;
    const row = {};
    header.forEach((h, idx) => {
      row[h] = parts[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

async function findImage(imagesDir, slug) {
  for (const ext of ["webp", "jpg", "jpeg", "png"]) {
    const file = path.join(imagesDir, `${slug}.${ext}`);
    try {
      await access(file);
      return { file, ext: ext === "jpeg" ? "jpg" : ext };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function main() {
  await loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dirIdx = args.indexOf("--dir");
  const baseDir = dirIdx >= 0 ? args[dirIdx + 1] : DEFAULT_DIR;
  const csvPath = path.join(baseDir, "products.csv");
  const imagesDir = path.join(baseDir, "images");

  const csvText = await readFile(csvPath, "utf8");
  const rows = parseCsv(csvText);
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`${rows.length} produit(s) dans ${csvPath}`);
  if (dryRun) console.log("(dry-run — aucune écriture)\n");

  let ok = 0;
  let skip = 0;

  for (const row of rows) {
    const name = row.name?.trim();
    const imageSlug = row.image_slug?.trim();
    const productType = row.product_type?.trim();
    if (!name || !imageSlug) {
      console.warn("Skip ligne incomplète:", row);
      skip++;
      continue;
    }
    if (productType !== "medicament" && productType !== "parapharmacie") {
      console.warn(`Skip type invalide pour « ${name} » : ${productType}`);
      skip++;
      continue;
    }

    const img = await findImage(imagesDir, imageSlug);
    if (!img) {
      console.warn(`Skip (image introuvable) : ${name} → images/${imageSlug}.*`);
      skip++;
      continue;
    }

    const { data: existing } = await supabase.from("products").select("id,photo_url").eq("name", name).maybeSingle();

    let productId = existing?.id ?? null;

    if (dryRun) {
      console.log(`[dry] ${existing ? "UPDATE" : "INSERT"} ${name} ← ${img.file}`);
      ok++;
      continue;
    }

    if (!productId) {
      const { data: inserted, error: insErr } = await supabase
        .from("products")
        .insert({
          name,
          price_pph: Number(row.price_pph) || null,
          price_ppv: Number(row.price_ppv) || null,
          product_type: productType,
          laboratory: row.laboratory?.trim() || null,
          category: "import_catalog",
          photo_url: null,
          is_active: true,
        })
        .select("id")
        .single();
      if (insErr) {
        console.error(`INSERT échoué « ${name} »:`, insErr.message);
        skip++;
        continue;
      }
      productId = inserted.id;
    }

    const objectPath = `products/${productId}/main.${img.ext}`;
    const buf = await readFile(img.file);
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
      upsert: true,
      contentType: `image/${img.ext === "jpg" ? "jpeg" : img.ext}`,
    });
    if (upErr) {
      console.error(`Upload échoué « ${name} »:`, upErr.message);
      skip++;
      continue;
    }

    const { error: updErr } = await supabase
      .from("products")
      .update({ photo_url: objectPath })
      .eq("id", productId);
    if (updErr) {
      console.error(`UPDATE photo_url échoué « ${name} »:`, updErr.message);
      skip++;
      continue;
    }

    const publicUrl = `${url.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${objectPath}`;
    console.log(`OK ${existing ? "↻" : "+"} ${name}`);
    console.log(`   id=${productId}`);
    console.log(`   photo_url=${objectPath}`);
    console.log(`   ${publicUrl}`);
    ok++;
  }

  console.log(`\nTerminé : ${ok} OK, ${skip} ignoré(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
