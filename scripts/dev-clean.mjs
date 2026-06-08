import { rmSync } from "node:fs";

try {
  rmSync(".next", { recursive: true, force: true });
  console.log("Cache .next supprime — relancez npm run dev");
} catch {
  console.log("Pas de dossier .next a supprimer.");
}
