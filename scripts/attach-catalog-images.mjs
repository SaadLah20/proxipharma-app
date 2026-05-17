#!/usr/bin/env node
/**
 * Branche les photos du dossier catalog/images/ aux produits déjà en base.
 *
 * Prérequis :
 *   - Migration 20260524_003 appliquée (produits category = ma_catalog_photos)
 *   - Fichiers : {slug}.webp OU nom produit exact (ex. Doliprane 1000 mg, 8 comprimés.jpg)
 *   - Bucket public-assets créé (migration 20260524_001)
 *
 * Usage (Windows : erreur certificat TLS → ajouter --use-system-ca) :
 *   node --use-system-ca scripts/attach-catalog-images.mjs
 *   node --use-system-ca scripts/attach-catalog-images.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const BUCKET = "public-assets";
const IMAGES_DIR = path.join("catalog", "images");
const CATALOG_CATEGORY = "ma_catalog_photos";

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

async function main() {
  await loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY dans .env.local");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: products, error: pe } = await supabase
    .from("products")
    .select("id,name,subcategory")
    .eq("category", CATALOG_CATEGORY);
  if (pe) throw pe;

  const bySlug = new Map((products ?? []).map((p) => [p.subcategory, p]));
  const byName = new Map((products ?? []).map((p) => [p.name.trim().toLowerCase(), p]));

  function resolveProduct(file) {
    const stem = path.basename(file, path.extname(file));
    return bySlug.get(stem) ?? byName.get(stem.trim().toLowerCase()) ?? null;
  }

  function fileMatchesProduct(file, p) {
    const stem = path.basename(file, path.extname(file));
    return stem === p.subcategory || stem.trim().toLowerCase() === p.name.trim().toLowerCase();
  }

  let files;
  try {
    files = await readdir(IMAGES_DIR);
  } catch {
    console.error(`Dossier introuvable : ${IMAGES_DIR}`);
    console.error("Créez-le et y déposez vos photos (voir catalog/LISTE_PHOTOS.md).");
    process.exit(1);
  }

  const images = files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  console.log(`${images.length} fichier(s) dans ${IMAGES_DIR} — ${bySlug.size} produit(s) en base\n`);

  let ok = 0;
  let miss = 0;

  for (const file of images) {
    const ext = path.extname(file).slice(1).toLowerCase();
    const product = resolveProduct(file);
    if (!product) {
      console.warn(`⚠ Aucun produit pour le fichier : ${file} (slug ou nom produit exact attendu)`);
      miss++;
      continue;
    }

    const objectPath = `products/${product.id}/main.${ext === "jpeg" ? "jpg" : ext}`;

    if (dryRun) {
      console.log(`[dry] ${file} → ${product.name} → ${objectPath}`);
      ok++;
      continue;
    }

    const buf = await readFile(path.join(IMAGES_DIR, file));
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
      upsert: true,
      contentType: `image/${ext === "jpg" || ext === "jpeg" ? "jpeg" : ext}`,
    });
    if (upErr) {
      console.error(`Upload échoué ${file}:`, upErr.message);
      miss++;
      continue;
    }

    const { error: updErr } = await supabase.from("products").update({ photo_url: objectPath }).eq("id", product.id);
    if (updErr) {
      console.error(`UPDATE échoué ${product.name}:`, updErr.message);
      miss++;
      continue;
    }

    console.log(`✓ ${file} → ${product.name}`);
    ok++;
  }

  const missingProducts = (products ?? []).filter((p) => !images.some((f) => fileMatchesProduct(f, p)));
  if (missingProducts.length > 0) {
    console.log("\nPhotos encore manquantes :");
    for (const p of missingProducts) {
      console.log(`  - ${p.subcategory}.webp  ou  ${p.name}.jpg`);
    }
  }

  console.log(`\nTerminé : ${ok} relié(s), ${miss} problème(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
