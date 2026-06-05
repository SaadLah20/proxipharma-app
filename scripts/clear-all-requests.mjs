/**
 * Vide toutes les demandes (D/O/C) + réservations promo + compteurs de codes publics.
 * Équivalent de supabase/scripts/clear-all-requests.sql via l’API Supabase.
 *
 * Ne touche pas le Storage : après ce script, lancer
 *   node --use-system-ca scripts/clear-request-private-media.mjs --confirm
 *
 * Prérequis .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage : node --use-system-ca scripts/clear-all-requests.mjs
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
    "Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local"
  );
  console.error("Sinon : exécutez supabase/scripts/clear-all-requests.sql dans le SQL Editor Supabase.");
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const nil = "00000000-0000-0000-0000-000000000000";

async function deleteAll(table, extraFilter) {
  let q = sb.from(table).delete().neq("id", nil);
  if (extraFilter) q = extraFilter(q);
  const { error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
}

try {
  await deleteAll("promo_in_app_notifications");
  await deleteAll("pharmacy_promo_reservation_status_history");
  await deleteAll("pharmacy_promo_reservations");
  const { error: eCountersPromo } = await sb
    .from("pharmacy_promo_reservation_ref_counters")
    .delete()
    .gte("yr", 2000);
  if (eCountersPromo) throw new Error(`pharmacy_promo_reservation_ref_counters: ${eCountersPromo.message}`);

  const { error: eAlt } = await sb
    .from("request_items")
    .update({ patient_chosen_alternative_id: null })
    .not("patient_chosen_alternative_id", "is", null);
  if (eAlt) throw new Error(`request_items (alternatives): ${eAlt.message}`);

  await deleteAll("requests");

  const { error: eCountersReq } = await sb
    .from("pharmacy_request_ref_counters")
    .delete()
    .gte("yr", 2000);
  if (eCountersReq) throw new Error(`pharmacy_request_ref_counters: ${eCountersReq.message}`);

  console.log("OK — demandes et réservations promo supprimées ; compteurs D/O/C et P réinitialisés.");
  console.log("Étape suivante : node --use-system-ca scripts/clear-request-private-media.mjs --confirm");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
