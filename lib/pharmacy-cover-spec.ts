/** Spécifications affichage couverture fiche publique (bandeau 21:9). */

/** Ratio du bandeau public (`aspect-[21/9]`). */
export const PHARMACY_COVER_ASPECT_RATIO = 21 / 9;

/** Largeur idéale à l’export (WebP) pour un affichage net sur mobile et desktop. */
export const PHARMACY_COVER_RECOMMENDED_WIDTH_PX = 1920;

/** Hauteur idéale correspondante (21:9). */
export const PHARMACY_COVER_RECOMMENDED_HEIGHT_PX = 823;

export const PHARMACY_COVER_UPLOAD_HINT =
  `Format paysage 21:9 recommandé : ${PHARMACY_COVER_RECOMMENDED_WIDTH_PX}×${PHARMACY_COVER_RECOMMENDED_HEIGHT_PX} px (ou proportion équivalente). Le bandeau utilise un recadrage centré : évitez le texte important sur les bords.`;

export const PHARMACY_LOGO_UPLOAD_HINT =
  "Carré, minimum 256×256 px. Fond transparent (PNG/WebP) de préférence.";
