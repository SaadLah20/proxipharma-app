#!/usr/bin/env node
/**
 * Upload local images → bucket public-assets (produits ou pharmacies).
 * Usage pilote (service role, hors navigateur) :
 *
 *   node scripts/upload-public-assets.mjs products ./mes-photos-produits
 *   node scripts/upload-public-assets.mjs pharmacies ./logos --pharmacy-id <uuid>
 *
 * Fichiers produits : nom = {product_uuid}.webp ou {product_uuid}.jpg
 * Fichiers pharmacie : logo.webp | cover.webp dans le dossier
 *
 * Requires .env.local : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const BUCKET = "public-assets";

async function loadEnvLocal() {
  try {
    const raw = await readFile(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

function extOf(filename) {
  const e = path.extname(filename).slice(1).toLowerCase();
  return e || "webp";
}

async function uploadObject(supabase, objectPath, buffer, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
    upsert: true,
    contentType,
  });
  if (error) throw new Error(`${objectPath}: ${error.message}`);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

async function uploadProducts(supabase, dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name));
  for (const f of files) {
    const id = path.basename(f.name, path.extname(f.name));
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      console.warn(`Skip (nom ≠ product uuid) : ${f.name}`);
      continue;
    }
    const ext = extOf(f.name);
    const buf = await readFile(path.join(dir, f.name));
    const objectPath = `products/${id}/main.${ext}`;
    const url = await uploadObject(supabase, objectPath, buf, `image/${ext === "jpg" ? "jpeg" : ext}`);
    console.log(`${f.name} → ${objectPath}`);
    console.log(`  SQL: update public.products set photo_url = '${objectPath}' where id = '${id}';`);
    console.log(`  URL: ${url}`);
  }
}

async function uploadPharmacy(supabase, dir, pharmacyId) {
  if (!pharmacyId) throw new Error("--pharmacy-id requis pour pharmacies");
  for (const kind of ["logo", "cover"]) {
    for (const ext of ["webp", "jpg", "jpeg", "png"]) {
      const file = path.join(dir, `${kind}.${ext}`);
      try {
        const buf = await readFile(file);
        const objectPath = `pharmacies/${pharmacyId}/${kind}.${ext === "jpeg" ? "jpg" : ext}`;
        const url = await uploadObject(
          supabase,
          objectPath,
          buf,
          `image/${ext === "jpg" || ext === "jpeg" ? "jpeg" : ext}`
        );
        console.log(`${kind} → ${objectPath}`);
        console.log(`  URL: ${url}`);
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  }
}

async function main() {
  await loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const [mode, dir, ...rest] = process.argv.slice(2);
  if (!mode || !dir) {
    console.error(
      "Usage: node scripts/upload-public-assets.mjs <products|pharmacies> <directory> [--pharmacy-id uuid]"
    );
    process.exit(1);
  }
  let pharmacyId = null;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--pharmacy-id") pharmacyId = rest[++i];
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  if (mode === "products") await uploadProducts(supabase, dir);
  else if (mode === "pharmacies") await uploadPharmacy(supabase, dir, pharmacyId);
  else {
    console.error("Mode inconnu:", mode);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
