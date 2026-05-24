/**
 * Storage pilote : ne garde que les fichiers produits dans public-assets/products/
 *
 * SUPPRIME :
 *   - bucket public-assets : tout sauf le préfixe products/
 *   - bucket private-media : tout (ordonnances, consultations, patient)
 *
 * CONSERVE :
 *   - public-assets/products/**  (photos catalogue)
 *
 * Prérequis .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage (dry-run) : node scripts/reset-storage-keep-product-photos-only.mjs
 * Usage (réel)    : node scripts/reset-storage-keep-product-photos-only.mjs --confirm
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET_PUBLIC = "public-assets";
const BUCKET_PRIVATE = "private-media";
const KEEP_PREFIX = "products/";

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

/** Liste récursive des chemins objet (fichiers) sous un préfixe. */
async function listAllPaths(supabase, bucket, prefix = "") {
  const paths = [];
  const stack = [prefix];
  while (stack.length > 0) {
    const folder = stack.pop();
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
    if (error) {
      throw new Error(`${bucket}/${folder || "(root)"}: ${error.message}`);
    }
    for (const entry of data ?? []) {
      const rel = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.id == null) {
        stack.push(rel);
      } else {
        paths.push(rel);
      }
    }
  }
  return paths;
}

async function removePaths(supabase, bucket, paths) {
  const batch = 100;
  for (let i = 0; i < paths.length; i += batch) {
    const chunk = paths.slice(i, i + batch);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) throw new Error(`remove ${bucket}: ${error.message}`);
  }
}

const confirm = process.argv.includes("--confirm");
const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const publicPaths = await listAllPaths(supabase, BUCKET_PUBLIC, "");
const publicToDelete = publicPaths.filter((p) => !p.startsWith(KEEP_PREFIX));
const publicToKeep = publicPaths.filter((p) => p.startsWith(KEEP_PREFIX));

const privatePaths = await listAllPaths(supabase, BUCKET_PRIVATE, "");

console.log("--- Storage reset (keep product photos only) ---");
console.log(`public-assets : ${publicToKeep.length} fichier(s) CONSERVÉ(S) sous ${KEEP_PREFIX}`);
console.log(`public-assets : ${publicToDelete.length} fichier(s) à supprimer (pharmacies, etc.)`);
console.log(`private-media : ${privatePaths.length} fichier(s) à supprimer (tout le bucket)`);

if (!confirm) {
  console.log("\nDry-run. Relancez avec --confirm pour supprimer.");
  process.exit(0);
}

if (publicToDelete.length > 0) {
  await removePaths(supabase, BUCKET_PUBLIC, publicToDelete);
  console.log(`Supprimé public-assets : ${publicToDelete.length}`);
}
if (privatePaths.length > 0) {
  await removePaths(supabase, BUCKET_PRIVATE, privatePaths);
  console.log(`Supprimé private-media : ${privatePaths.length}`);
}

console.log("Terminé.");
