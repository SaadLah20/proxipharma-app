#!/usr/bin/env node
/**
 * Parité clés messages/fr vs messages/ar + repérage chaînes FR probables (chemins patient).
 * Usage: node scripts/i18n-key-parity.mjs [--strict-strings]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const FR_DIR = join(ROOT, "messages", "fr");
const AR_DIR = join(ROOT, "messages", "ar");
const strictStrings = process.argv.includes("--strict-strings");

function extractKeysFromBlock(block) {
  const keys = new Set();
  const stack = [""];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    if (/^\s+["'`][^"'`]*["'`],?\s*$/.test(line)) continue;

    const keyMatch = line.match(/^(\s+)([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!keyMatch) continue;

    const indent = keyMatch[1].length;
    const key = keyMatch[2];
    const rest = keyMatch[3].trim();
    const level = Math.max(0, Math.floor(indent / 2) - 1);

    while (stack.length > level + 1) stack.pop();

    const prefix = stack[level] ?? "";
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (rest === "{" || rest.startsWith("{")) {
      stack[level + 1] = fullKey;
    } else {
      keys.add(fullKey);
    }
  }

  return keys;
}

function parseExportsInFile(filePath) {
  const source = readFileSync(filePath, "utf8");
  const exports = {};
  const exportRe = /export const (\w+) = \{/g;
  let match;

  while ((match = exportRe.exec(source))) {
    const exportName = match[1];
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    exports[exportName] = extractKeysFromBlock(source.slice(start, i - 1));
  }

  return exports;
}

function namespaceMapForLocale(localeDir) {
  const indexSource = readFileSync(join(localeDir, "index.ts"), "utf8");
  const aliasToNs = new Map();

  for (const rawLine of indexSource.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    const m = line.match(/^\s+(\w+):\s*(\w+),?\s*$/);
    if (m) aliasToNs.set(m[2], m[1]);
  }

  const importRe = /import\s+\{([^}]+)\}\s+from\s+"\.\/([^"]+)"/g;
  let im;
  const keyed = new Set();

  while ((im = importRe.exec(indexSource))) {
    const file = im[2];
    const filePath = join(localeDir, `${file}.ts`);
    const fileExports = parseExportsInFile(filePath);
    const aliases = im[1].split(",").map((s) => s.trim());

    for (const alias of aliases) {
      const ns = aliasToNs.get(alias);
      const keys = fileExports[alias];
      if (!ns || !keys) continue;
      for (const k of keys) keyed.add(`${ns}:${k}`);
    }
  }

  return keyed;
}

function walkDir(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walkDir(p, acc);
    } else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(p);
  }
  return acc;
}

const PATIENT_PREFIXES = [
  "app/pharmacie/",
  "app/dashboard/demandes/",
  "app/dashboard/patient/",
  "app/auth/",
  "app/page.tsx",
  "components/annuaire/",
  "components/pharmacy/patient-",
  "components/pharmacy/pharmacy-public-",
  "components/pharmacy/pharmacy-rating",
  "components/pharmacy/pharmacy-request-service",
  "components/patient/",
  "components/promo/patient-",
  "components/promo/public-promo",
  "components/requests/product/patient-",
  "components/requests/hub/",
  "components/requests/request-conversation",
  "components/requests/conversation/",
  "components/requests/consultation/",
  "components/requests/patient-",
  "components/requests/request-exit",
  "components/requests/shared/request-detail-back",
  "components/requests/dossier-history",
  "components/requests/history-timeline",
  "components/requests/line-history",
  "components/notifications/external-notification",
];

const FRENCH_RE =
  /["'`]((?:[^"'\\]|\\.)*[àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇœŒ]|(?:Votre|Vous|Ajoute|Envoy|Confir|Annul|Charg|Retour|Message|Produit|Pharmac|Demande|Ordonn|Consult|La pharmacie|L'officine|Fermer|Historique)[^"'`]*)["'`]/g;

const IGNORE = [/useTranslations/, /t\(/, /tCommon\(/, /tDemandes\(/, /tHub\(/, /tAuth\(/, /console\./, /import /, /from "/, /className=/, /\/\//, /supabase/, /\.from\(/, /SUPPRIMER/, /fr-FR/, /product_request/, /free_consultation/, /text-/, /border-/, /bg-/];

function scanFrench() {
  const hits = [];
  for (const abs of walkDir(ROOT)) {
    const rel = relative(ROOT, abs).replace(/\\/g, "/");
    if (!PATIENT_PREFIXES.some((p) => rel.startsWith(p) || rel === p)) continue;
    const content = readFileSync(abs, "utf8");
    let m;
    const re = new RegExp(FRENCH_RE.source, "g");
    while ((m = re.exec(content)) !== null) {
      const ctx = content.slice(Math.max(0, m.index - 50), m.index + 50);
      if (IGNORE.some((p) => p.test(m[0]) || p.test(ctx))) continue;
      hits.push({ file: rel, line: content.slice(0, m.index).split("\n").length, snippet: m[0].slice(0, 90) });
    }
  }
  return hits;
}

function main() {
  const frKeys = namespaceMapForLocale(FR_DIR);
  const arKeys = namespaceMapForLocale(AR_DIR);
  const missingInAr = [...frKeys].filter((k) => !arKeys.has(k)).sort();
  const extraInAr = [...arKeys].filter((k) => !frKeys.has(k)).sort();

  console.log("=== i18n key parity (messages/fr vs messages/ar) ===");
  console.log(`FR keys: ${frKeys.size}`);
  console.log(`AR keys: ${arKeys.size}`);
  console.log(`Missing in AR: ${missingInAr.length}`);
  if (missingInAr.length) {
    console.log(missingInAr.slice(0, 50).join("\n"));
    if (missingInAr.length > 50) console.log(`… and ${missingInAr.length - 50} more`);
  }
  console.log(`Extra in AR: ${extraInAr.length}`);
  if (extraInAr.length) console.log(extraInAr.slice(0, 20).join("\n"));

  const stringHits = scanFrench();
  console.log("\n=== Probable French UI strings in patient/public paths ===");
  console.log(`Hits: ${stringHits.length}`);

  if (missingInAr.length > 0 || (strictStrings && stringHits.length > 0)) {
    if (strictStrings && stringHits.length > 0) {
      for (const h of stringHits.slice(0, 30)) {
        console.log(`  ${h.file}:${h.line} ${h.snippet}`);
      }
    }
    process.exitCode = 1;
    console.log("\nFAILED: fix key parity" + (strictStrings ? " and/or French strings" : "") + ".");
  } else {
    console.log("\nOK");
  }
}

main();
