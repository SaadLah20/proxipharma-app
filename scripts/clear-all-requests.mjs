/**
 * Supprime toutes les lignes de `public.requests` (cascade FK) et vide
 * `pharmacy_request_ref_counters` pour repartir les codes Dnnn/YY.
 *
 * Prérequis dans .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (clé secrète — jamais côté client navigateur)
 *
 * Usage : node scripts/clear-all-requests.mjs
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l’environnement ou .env.local"
  );
  console.error("Sans clé service : exécutez supabase/scripts/clear-all-requests.sql dans le SQL Editor Supabase.");
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const nil = "00000000-0000-0000-0000-000000000000";

const { error: e1 } = await sb.from("requests").delete().neq("id", nil);
if (e1) {
  console.error("Erreur suppression requests:", e1.message);
  process.exit(1);
}

const { error: e2 } = await sb.from("pharmacy_request_ref_counters").delete().gte("yr", 2000);
if (e2) {
  console.error("Erreur suppression pharmacy_request_ref_counters:", e2.message);
  process.exit(1);
}

console.log("OK — toutes les demandes supprimées et compteurs de codes publics réinitialisés.");
