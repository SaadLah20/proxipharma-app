/**
 * Storage pilote : conserve le catalogue produits + photos officines (public),
 * supprime le reste (y compris tout private-media = ordonnances, consultations, patient).
 *
 * CONSERVE (public-assets, non listés pour éviter timeout catalogue) :
 *   - products/**     (photos catalogue)
 *   - pharmacies/**   (logo, couverture officine)
 *
 * SUPPRIME :
 *   - public-assets : tout autre dossier/fichier à la racine
 *   - private-media : tout le bucket (ordonnances, consultations, photos dossier patient)
 *
 * Prérequis .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Dry-run :
 *   node --use-system-ca scripts/reset-storage-keep-catalog-and-pharmacy-photos.mjs
 * Réel :
 *   node --use-system-ca scripts/reset-storage-keep-catalog-and-pharmacy-photos.mjs --confirm
 *
 * Vidage demandes complet (BDD + scans) : voir supabase/scripts/clear-all-requests.sql
 * puis clear-request-private-media.mjs (équivalent ciblé private-media).
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET_PUBLIC = "public-assets";
const BUCKET_PRIVATE = "private-media";
/** Racines public-assets à ne jamais supprimer. */
const KEEP_PUBLIC_ROOTS = new Set(["products", "pharmacies"]);
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
    console.warn(`  … nouvelle tentative (${attempt + 2}/${MAX_RETRIES}) — ${folder || "(root)"}`);
    await sleep(wait);
  }
  throw new Error(`${bucket}/${folder || "(root)"}: ${lastErr?.message ?? "unknown"}`);
}

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
    if (KEEP_PUBLIC_ROOTS.has(entry.name)) continue;
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
  console.log("Liste public-assets (hors products/ et pharmacies/)…");
  publicToDelete = await listPublicPathsToDelete(supabase);
  console.log("Liste private-media (tout)…");
  privatePaths = await listAllPathsUnder(supabase, BUCKET_PRIVATE, "");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`Erreur Storage : ${msg}`);
  if (/fetch failed/i.test(msg)) {
    console.error("Windows : relancez avec  node --use-system-ca scripts/reset-storage-keep-catalog-and-pharmacy-photos.mjs");
  }
  process.exit(1);
}

const kept = [...KEEP_PUBLIC_ROOTS].join(", ");
console.log("--- Storage : garder catalogue + photos officines ---");
console.log(`public-assets/{${kept}}/ : CONSERVÉ (non parcouru)`);
console.log(`public-assets : ${publicToDelete.length} fichier(s) à supprimer (autres dossiers)`);
console.log(`private-media : ${privatePaths.length} fichier(s) à supprimer (ordonnances, consultations, patient, …)`);

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
