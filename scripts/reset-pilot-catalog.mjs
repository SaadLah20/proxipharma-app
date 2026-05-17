#!/usr/bin/env node
/**
 * Reset pilote : vide demandes + produits, réinsère 31 produits catalogue MAROC.
 *
 * .env.local : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage :
 *   node scripts/reset-pilot-catalog.mjs
 *
 * Puis : catalog/images/ + node scripts/attach-catalog-images.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const NIL = "00000000-0000-0000-0000-000000000000";

const CATALOG = [
  ["Doliprane 1000 mg, 8 comprimés", "doliprane-1000", 38.9, 49.9, "medicament", "SANOFI"],
  ["Paracétamol Biopharma 500 mg, 16 cp", "paracetamol-biopharma", 12.4, 16.0, "medicament", "BIOCODEX"],
  ["Maxilase sirop pédiatrique 200 ml", "maxilase-sirop", 64.8, 79.9, "medicament", "SANOFI"],
  ["Vogalène Flash 10 comprimés", "vogalene-flash", 71.9, 89.0, "medicament", "PIERRE FABRE"],
  ["Smecta oranges-vanilles, 10 sachets", "smecta", 108.9, 134.9, "medicament", "IPSEN"],
  ["Maalox menthe suspension 250 ml", "maalox", 58.7, 72.0, "medicament", "SANOFI"],
  ["Gaviscon anis sachets, 24 sachets", "gaviscon", 219.9, 269.9, "medicament", "RB"],
  ["Bisolvon sirop enfants", "bisolvon", 94.7, 115.0, "medicament", "SANOFI"],
  ["Motilium 10 mg filmoméprisibles, 10 cp", "motilium", 48.65, 59.9, "medicament", "JANSSEN"],
  ["Aerius anti-histaminique comprimés, 7 cp", "aerius", 92.95, 114.9, "medicament", "MSD"],
  ["Voltaren Emulgel tube 120 g", "voltaren-emulgel", 179.95, 219.9, "medicament", "NOVARTIS"],
  ["Flector Tissugel enveloppes, 10", "flector", 289.95, 349.0, "medicament", "SANOFI"],
  ["Ibuprofen 400 mg coop 20 cp", "ibuprofene-400", 19.95, 24.9, "medicament", "COOPER"],
  ["Spasfon lyoc 160 mg, 20 lyophilisés", "spasfon", 79.96, 98.9, "medicament", "MAYOLY"],
  ["Magnésium B6 coop 120 cp", "magnesium-b6", 99.94, 122.9, "medicament", "COOPER"],
  ["Vitamin C 500 mg coop 60 cp", "vitamine-c-500", 45.93, 55.9, "medicament", "COOPER"],
  ["Sérum physiologique 5 ml unidoses, boîte 40", "serum-physio", 32.93, 39.9, "parapharmacie", "Gilbert"],
  ["Eau distillée coop 250 ml", "eau-distillee", 9.93, 12.5, "parapharmacie", "COOPER"],
  ["Betadine derm solution 125 ml", "betadine", 56.93, 69.9, "medicament", "MUNDIPHARMA"],
  ["Savon dermatologique Dove Sensitive barre", "dove-savon", 18.93, 22.9, "parapharmacie", "UNILEVER"],
  ["Solaire enfants FPS 50+ spray 150 ml", "solaire-enfant", 159.93, 199.9, "parapharmacie", "LA ROCHE-POSAY"],
  ["Hydratant corps CeraVe 473 ml", "cerave-hydratant", 229.93, 279.9, "parapharmacie", "Cerave"],
  ["Listerine Fraîcheur 500 ml", "listerine", 69.93, 85.9, "parapharmacie", "JH"],
  ["Sensodyne Réparation toothpaste 75 ml", "sensodyne", 59.93, 72.9, "parapharmacie", "HALEON"],
  ["Optive yeux secs collyre multidose", "optive", 124.93, 152.9, "medicament", "ABBVIE"],
  ["Strepsils miel-citron, 24 pastilles", "strepsils", 79.93, 97.9, "medicament", "RB"],
  ["Thymotabs pastilles gorge 36", "thymotabs", 92.93, 114.9, "medicament", "Cooper"],
  ["Ventoline spray 100 µg, 200 doses", "ventoline", 129.93, 158.9, "medicament", "GSK"],
  ["Polaramine syrup 125 ml enfants", "polaramine", 42.93, 52.9, "medicament", "MSD"],
  ["Zyrtec 10 mg pelliculés boîte 7", "zyrtec-10", 86.93, 105.9, "medicament", "UCB"],
  ["Toplexil pédiatrique sirop allergies", "toplexil", 38.93, 47.9, "medicament", "SANOFI"],
];

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
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  console.log("1/4 Suppression des demandes…");
  const { error: e1 } = await sb.from("requests").delete().neq("id", NIL);
  if (e1) throw new Error(`requests: ${e1.message}`);

  const { error: e2 } = await sb.from("pharmacy_request_ref_counters").delete().gte("yr", 2000);
  if (e2) throw new Error(`counters: ${e2.message}`);

  console.log("2/4 Suppression ruptures marché + produits…");
  const { error: e3 } = await sb.from("market_shortages").delete().neq("id", NIL);
  if (e3) throw new Error(`market_shortages: ${e3.message}`);

  const { error: e4 } = await sb.from("products").delete().neq("id", NIL);
  if (e4) throw new Error(`products: ${e4.message}`);

  console.log("3/4 Insertion des 31 produits…");
  const rows = CATALOG.map(([name, slug, price_pph, price_ppv, product_type, laboratory]) => ({
    name,
    price_pph,
    price_ppv,
    product_type,
    laboratory,
    category: "ma_catalog_photos",
    subcategory: slug,
    photo_url: null,
    is_active: true,
  }));

  const { error: e5 } = await sb.from("products").insert(rows);
  if (e5) throw new Error(`insert products: ${e5.message}`);

  const { count } = await sb.from("products").select("*", { count: "exact", head: true });
  console.log(`4/4 OK — products: ${count}, requests: 0`);
  console.log("\nProchaines étapes :");
  console.log("  1. Photos dans catalog/images/ (voir catalog/LISTE_PHOTOS.md)");
  console.log("  2. node scripts/attach-catalog-images.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
