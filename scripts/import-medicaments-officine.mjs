#!/usr/bin/env node
/**
 * Importe les médicaments (TVA=0) en base — additif, sans toucher à la parapharmacie.
 *
 * Source : CSV généré par scripts/convert-medicaments-xlsx.py
 *   colonnes : name, price_ppv, price_pph
 *
 * Champs Supabase :
 *   product_type = medicament
 *   category     = medicaments_officine
 *   PPV / PPH    = prix officine (médicament affiché au PPV fixe côté app)
 *
 * Prérequis : .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *
 * Usage :
 *   node scripts/import-medicaments-officine.mjs --dry-run
 *   node --use-system-ca scripts/import-medicaments-officine.mjs
 *   node scripts/import-medicaments-officine.mjs --csv scripts/medicaments_officine.csv
 */

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = path.join(__dirname, "medicaments_officine.csv");
const CATEGORY = "medicaments_officine";
const BATCH = 200;

async function loadEnvLocal() {
  try {
    const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
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

function parseArgs(argv) {
  let csv = DEFAULT_CSV;
  let dryRun = false;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--csv" && argv[i + 1]) csv = path.resolve(argv[++i]);
    else if (argv[i] === "--dry-run") dryRun = true;
  }
  return { csv, dryRun };
}

function parsePrice(v) {
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeNameKey(name) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseCsvAll(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
          continue;
        }
        inQuotes = false;
        continue;
      }
      field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\r") continue;
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseCsv(text) {
  const table = parseCsvAll(text.replace(/^\uFEFF/, ""));
  if (table.length < 2) throw new Error("CSV vide ou sans données");
  const header = table[0];
  const rows = [];
  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    const rec = {};
    for (let j = 0; j < header.length; j++) rec[header[j]] = cells[j] ?? "";
    const name = rec.name?.trim();
    if (!name) continue;
    const price_ppv = parsePrice(rec.price_ppv);
    const price_pph = parsePrice(rec.price_pph);
    if (price_ppv == null || price_pph == null) {
      console.warn(`Skip prix invalide : ${name}`);
      continue;
    }
    rows.push({ name, price_ppv, price_pph, key: normalizeNameKey(name) });
  }
  return rows;
}

function toInsertRow(row) {
  return {
    name: row.name,
    price_pph: row.price_pph,
    price_ppv: row.price_ppv,
    product_type: "medicament",
    category: CATEGORY,
    laboratory: null,
    photo_url: null,
    is_active: true,
  };
}

async function fetchExistingMedicaments(supabase) {
  const map = new Map();
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id,name")
      .eq("product_type", "medicament")
      .eq("category", CATEGORY)
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      map.set(normalizeNameKey(row.name), row.id);
    }
    if (data.length < page) break;
    from += page;
  }
  return map;
}

async function main() {
  await loadEnvLocal();
  const { csv, dryRun } = parseArgs(process.argv);

  console.log(`CSV : ${csv}`);
  console.log(`Mode : ${dryRun ? "dry-run" : "import additif"}`);

  const raw = await readFile(csv, "utf8");
  const parsed = parseCsv(raw);
  console.log(`\n${parsed.length} médicament(s) dans le CSV`);

  if (dryRun) {
    console.log("\nExemples :");
    for (const r of parsed.slice(0, 5)) {
      console.log(`  • ${r.name} — PPV=${r.price_ppv} PPH=${r.price_pph}`);
    }
    console.log("\n(dry-run — aucune écriture Supabase)");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log("Lecture médicaments déjà importés…");
  const existing = await fetchExistingMedicaments(supabase);
  console.log(`  ${existing.size} déjà en base (${CATEGORY})`);

  const toInsert = [];
  const toUpdate = [];
  for (const row of parsed) {
    const id = existing.get(row.key);
    if (id) {
      toUpdate.push({ id, price_pph: row.price_pph, price_ppv: row.price_ppv });
    } else {
      toInsert.push(toInsertRow(row));
    }
  }

  console.log(`\nÀ insérer : ${toInsert.length}`);
  console.log(`À mettre à jour (prix) : ${toUpdate.length}`);

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const slice = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from("products").insert(slice);
    if (error) {
      console.error(`Erreur insert lot ${i / BATCH + 1}:`, error.message);
      process.exit(1);
    }
    inserted += slice.length;
    process.stdout.write(`\r  insert … ${inserted}/${toInsert.length}`);
  }
  if (toInsert.length) console.log();

  let updated = 0;
  for (const row of toUpdate) {
    const { error } = await supabase
      .from("products")
      .update({ price_pph: row.price_pph, price_ppv: row.price_ppv })
      .eq("id", row.id);
    if (error) {
      console.error(`Erreur update ${row.id}:`, error.message);
      process.exit(1);
    }
    updated++;
    if (updated % BATCH === 0 || updated === toUpdate.length) {
      process.stdout.write(`\r  update … ${updated}/${toUpdate.length}`);
    }
  }
  if (toUpdate.length) console.log();

  const { count: paraCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("product_type", "parapharmacie");
  const { count: medCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("product_type", "medicament");

  console.log(`\nTerminé : +${inserted} inséré(s), ${updated} prix mis à jour.`);
  console.log(`Catalogue : ${medCount ?? "?"} médicament(s), ${paraCount ?? "?"} parapharmacie.`);
}

main().catch((e) => {
  console.error("Erreur :", e.message ?? e);
  process.exit(1);
});
