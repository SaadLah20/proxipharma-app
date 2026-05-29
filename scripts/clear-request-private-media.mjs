/**
 * Storage : supprime uniquement les fichiers liés aux demandes
 * ordonnance + consultation libre (bucket private-media).
 *
 * SUPPRIME :
 *   - private-media/ordonnances/**
 *   - private-media/consultations/**
 *
 * CONSERVE :
 *   - public-assets/** (products/, pharmacies/ — catalogue + photos officine)
 *   - private-media/patient/** (photos dossier demande produits, si présentes)
 *
 * À lancer après supabase/scripts/clear-all-requests.sql si vous repartez les tests.
 *
 * Prérequis .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Dry-run : node --use-system-ca scripts/clear-request-private-media.mjs
 * Réel    : node --use-system-ca scripts/clear-request-private-media.mjs --confirm
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET_PRIVATE = "private-media";
const PREFIXES_TO_DELETE = ["ordonnances", "consultations"];
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

async function listFolderPage(supabase, folder, offset) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, error } = await supabase.storage.from(BUCKET_PRIVATE).list(folder, {
      limit: LIST_LIMIT,
      offset,
    });
    if (!error) return data ?? [];
    lastErr = error;
    if (!isRetryableError(error.message) || attempt === MAX_RETRIES - 1) {
      throw new Error(`${BUCKET_PRIVATE}/${folder || "(root)"}: ${error.message}`);
    }
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`${BUCKET_PRIVATE}/${folder || "(root)"}: ${lastErr?.message ?? "unknown"}`);
}

async function listAllPathsUnder(supabase, prefix) {
  const paths = [];
  const stack = [prefix];
  while (stack.length > 0) {
    const folder = stack.pop();
    let offset = 0;
    for (;;) {
      const entries = await listFolderPage(supabase, folder, offset);
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

async function removePaths(supabase, paths) {
  const batch = 100;
  for (let i = 0; i < paths.length; i += batch) {
    const chunk = paths.slice(i, i + batch);
    const { error } = await supabase.storage.from(BUCKET_PRIVATE).remove(chunk);
    if (error) throw new Error(`remove ${BUCKET_PRIVATE}: ${error.message}`);
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

const byPrefix = {};
let total = 0;

try {
  for (const prefix of PREFIXES_TO_DELETE) {
    console.log(`Liste ${BUCKET_PRIVATE}/${prefix}/…`);
    const paths = await listAllPathsUnder(supabase, prefix);
    byPrefix[prefix] = paths;
    total += paths.length;
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`Erreur : ${msg}`);
  if (/fetch failed/i.test(msg)) {
    console.error("Windows : relancez avec  node --use-system-ca scripts/clear-request-private-media.mjs");
  }
  process.exit(1);
}

console.log("--- Storage : ordonnances + consultations uniquement ---");
console.log("CONSERVÉ : public-assets (products/, pharmacies/)");
console.log("CONSERVÉ : private-media/patient/ (photos demandes produits, si besoin)");
for (const prefix of PREFIXES_TO_DELETE) {
  console.log(`${prefix}/ : ${byPrefix[prefix].length} fichier(s) à supprimer`);
}

if (!confirm) {
  console.log("\nDry-run. Ajoutez --confirm pour supprimer.");
  process.exit(0);
}

for (const prefix of PREFIXES_TO_DELETE) {
  const paths = byPrefix[prefix];
  if (paths.length > 0) {
    await removePaths(supabase, paths);
    console.log(`Supprimé ${prefix}/ : ${paths.length}`);
  }
}

console.log(`Terminé (${total} fichier(s)).`);
