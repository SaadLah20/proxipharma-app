/**
 * Génère docs/ARCHITECTURE-APIS-print.html pour impression PDF (Chrome : Ctrl+P → Enregistrer en PDF).
 * Usage : node scripts/export-architecture-apis-html.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mdPath = path.join(root, "docs", "ARCHITECTURE-APIS.md");
const outPath = path.join(root, "docs", "ARCHITECTURE-APIS-print.html");

function inlineMd(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function parseTable(lines) {
  const rows = [];
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => inlineMd(c.trim()));
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) return "";
  const head = rows[0];
  const body = rows.slice(1);
  let html = "<table><thead><tr>";
  for (const c of head) html += `<th>${c}</th>`;
  html += "</tr></thead><tbody>";
  for (const row of body) {
    html += "<tr>";
    for (const c of row) html += `<td>${c}</td>`;
    html += "</tr>";
  }
  html += "</tbody></table>";
  return html;
}

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const parts = [];
  let i = 0;
  let inList = false;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("|")) {
      if (inList) {
        parts.push("</ul>");
        inList = false;
      }
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      parts.push(parseTable(tableLines));
      continue;
    }
    if (line.startsWith("# ")) {
      if (inList) {
        parts.push("</ul>");
        inList = false;
      }
      parts.push(`<h1>${inlineMd(line.slice(2))}</h1>`);
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      if (inList) {
        parts.push("</ul>");
        inList = false;
      }
      parts.push(`<h2>${inlineMd(line.slice(3))}</h2>`);
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      if (inList) {
        parts.push("</ul>");
        inList = false;
      }
      parts.push(`<h3>${inlineMd(line.slice(4))}</h3>`);
      i++;
      continue;
    }
    if (line.trim() === "---") {
      i++;
      continue;
    }
    if (line.trim().startsWith("- ")) {
      if (!inList) {
        parts.push("<ul>");
        inList = true;
      }
      parts.push(`<li>${inlineMd(line.trim().slice(2))}</li>`);
      i++;
      continue;
    }
    if (line.trim() === "") {
      if (inList) {
        parts.push("</ul>");
        inList = false;
      }
      i++;
      continue;
    }
    if (inList) {
      parts.push("</ul>");
      inList = false;
    }
    parts.push(`<p>${inlineMd(line)}</p>`);
    i++;
  }
  if (inList) parts.push("</ul>");
  return parts.join("\n");
}

const md = fs.readFileSync(mdPath, "utf8");
const body = mdToHtml(md);

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>ProxiPharma — APIs externes et technologies</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #0f172a;
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 32px 48px;
    }
    h1 { font-size: 1.5rem; color: #065f46; border-bottom: 2px solid #10b981; padding-bottom: 8px; }
    h2 { font-size: 1.15rem; margin-top: 1.5rem; color: #047857; page-break-after: avoid; }
    h3 { font-size: 1rem; margin-top: 1rem; color: #334155; }
    p { margin: 0.5rem 0; }
    code { font-size: 0.9em; background: #f1f5f9; padding: 1px 5px; border-radius: 4px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 20px;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #ecfdf5; font-weight: 600; }
    tr:nth-child(even) td { background: #f8fafc; }
    ul { margin: 8px 0 16px; padding-left: 1.25rem; }
    li { margin: 4px 0; }
    .print-hint {
      background: #eff6ff;
      border: 1px solid #93c5fd;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 10pt;
    }
    @media print {
      body { padding: 12px; max-width: none; }
      .print-hint { display: none; }
      h2 { page-break-before: auto; }
    }
  </style>
</head>
<body>
  <p class="print-hint"><strong>Enregistrer en PDF :</strong> Ctrl+P (ou Fichier → Imprimer) → Destination « Enregistrer au format PDF » → Enregistrer.</p>
  ${body}
</body>
</html>`;

fs.writeFileSync(outPath, html, "utf8");
console.log("OK:", outPath);
