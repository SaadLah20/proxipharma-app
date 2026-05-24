/**
 * Storage pilote : ne garde que les fichiers produits dans public-assets/products/
 *
 * SUPPRIME :
 *   - bucket public-assets : tout sauf le préfixe products/ (products/ n'est pas listé → pas de timeout)
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
 *
 * Windows — si « fetch failed » (certificat TLS) :
 *   node --use-system-ca scripts/reset-storage-keep-product-photos-only.mjs
 *   node --use-system-ca scripts/reset-storage-keep-product-photos-only.mjs --confirm
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET_PUBLIC = "public-assets";
const BUCKET_PRIVATE = "private-media";
const KEEP_ROOT_FOLDER = "products";
const LIST_LIMIT = 200;
const MAX_RETRIES = 4;

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableError(message) {
  return /gateway timeout|timed out|timeout|502|503|504|fetch failed/i.test(message);
}

/** Liste une page dossier Storage avec nouvelles tentatives si timeout. */
async function listFolderPage(supabase, bucket, folder, offset) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: LIST_LIMIT,
      offset,
    });
    if (!error) return data ?? [];
    lastErr = error;
    if (!isRetryableError(error.message) || attempt === MAX_RETRIES - 1) {
      throw new Error(`${bucket}/${folder || "(root)"}: ${error.message}`);
    }
    const wait = 1500 * (attempt + 1);
    console.warn(`  … nouvelle tentative (${attempt + 2}/${MAX_RETRIES}) après ${wait} ms — ${folder || "(root)"}`);
    await sleep(wait);
  }
  throw new Error(`${bucket}/${folder || "(root)"}: ${lastErr?.message ?? "unknown"}`);
}

/** Liste récursive des fichiers sous un préfixe (pagination incluse). */
async function listAllPathsUnder(supabase, bucket, prefix = "") {
  const paths = [];
  const stack = [prefix];
  while (stack.length > 0) {
    const folder = stack.pop();
    let offset = 0;
    for (;;) {
      const entries = await listFolderPage(supabase, bucket, folder, offset);
      if (entries.length === 0) break;
      for (const entry of entries) {
        const rel = folder ? `${folder}/${entry.name}` : entry.name;
        if (entry.id == null) {
          stack.push(rel);
        } else {
          paths.push(rel);
        }
      }
      if (entries.length < LIST_LIMIT) break;
      offset += LIST_LIMIT;
    }
  }
  return paths;
}

/**
 * public-assets : ne parcourt pas products/ (évite Gateway Timeout sur gros catalogue).
 */
async function listPublicPathsToDelete(supabase) {
  const paths = [];
  const allRoot = [];
  let offset = 0;
  for (;;) {
    const page = await listFolderPage(supabase, BUCKET_PUBLIC, "", offset);
    allRoot.push(...page);
    if (page.length < LIST_LIMIT) break;
    offset += LIST_LIMIT;
  }

  for (const entry of allRoot) {
    if (entry.name === KEEP_ROOT_FOLDER) continue;
    const rel = entry.name;
    if (entry.id == null) {
      const sub = await listAllPathsUnder(supabase, BUCKET_PUBLIC, rel);
      paths.push(...sub);
    } else {
      paths.push(rel);
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

let publicToDelete;
let privatePaths;
try {
  console.log("Liste public-assets (hors products/)…");
  publicToDelete = await listPublicPathsToDelete(supabase);
  console.log("Liste private-media…");
  privatePaths = await listAllPathsUnder(supabase, BUCKET_PRIVATE, "");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`Erreur réseau Storage : ${msg}`);
  if (/fetch failed/i.test(msg)) {
    console.error(`
Causes fréquentes :
  1. Windows / TLS : relancez avec  node --use-system-ca scripts/reset-storage-keep-product-photos-only.mjs
  2. .env.local : vérifiez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
  3. Connexion : VPN, pare-feu, ou projet Supabase injoignable
`);
  }
  if (/gateway timeout|timeout/i.test(msg)) {
    console.error(`
Timeout Supabase : réessayez dans quelques minutes ou supprimez les dossiers
hors products/ depuis le Dashboard Storage (public-assets).
`);
  }
  process.exit(1);
}

console.log("--- Storage reset (keep product photos only) ---");
console.log(`public-assets/${KEEP_ROOT_FOLDER}/ : CONSERVÉ (non listé — évite timeout sur gros catalogue)`);
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
