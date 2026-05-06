export function rewriteForPatientView(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  return text
    .replace(/\bLe patient a\b/g, "Vous avez")
    .replace(/\ble patient a\b/g, "vous avez")
    .replace(/\bLe patient\b/g, "Vous")
    .replace(/\ble patient\b/g, "vous")
    .replace(/\bdu patient\b/g, "de vous")
    .replace(/\bau patient\b/g, "à vous")
    .replace(/\bpar le patient\b/g, "par vous");
}

export function rewriteForPharmacistView(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  return text
    .replace(/\bLe patient a\b/g, "Votre client a")
    .replace(/\ble patient a\b/g, "votre client a")
    .replace(/\bLe patient\b/g, "Votre client")
    .replace(/\ble patient\b/g, "votre client")
    .replace(/\bdu patient\b/g, "de votre client")
    .replace(/\bau patient\b/g, "à votre client")
    .replace(/\bpar le patient\b/g, "par votre client");
}
