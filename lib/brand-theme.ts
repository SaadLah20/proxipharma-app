/**
 * Pharmeto brand tokens (pharmeto.ma).
 * Palette conservée du teal pilote — remplaçable après validation graphique Partie 1.
 */
export const PHARMETO_BRAND = {
  name: "Pharmeto",
  domain: "pharmeto.ma",
  productionUrl: "https://pharmeto.ma",
  colors: {
    primary: "#0d9488",
    primaryDark: "#0f766e",
    secondary: "#64748b",
    background: "#fafafa",
    foreground: "#1e293b",
    success: "#16a34a",
    warning: "#d97706",
    error: "#dc2626",
    info: "#0284c7",
  },
  taglineFr: "Votre pharmacie de quartier, en ligne",
  taglineAr: "صيدليتكم في الحي، على الإنترنت",
  /** Incrémenter quand `public/brand/pharmeto-icon.png` change (splash PWA / cache navigateur). */
  iconAssetVersion: 2,
} as const;

/** URL publique de l’icône marque (query `v` = invalidation cache splash mobile). */
export const PHARMETO_ICON_SRC = `/brand/pharmeto-icon.png?v=${PHARMETO_BRAND.iconAssetVersion}`;
