/** Titres et accents des groupes « validée / traitée » (alignés vue répondue épurée). */

export type PatientValidatedBucketId = "dispo_officine" | "commande" | "hors_perimetre";

export function patientValidatedBucketTitleFr(
  id: PatientValidatedBucketId,
  isTreatedView: boolean
): string {
  if (isTreatedView) {
    if (id === "dispo_officine") {
      return "Réservés pour vous";
    }
    if (id === "commande") {
      return "Commandés pour vous";
    }
  }
  switch (id) {
    case "dispo_officine":
      return "À réserver";
    case "commande":
      return "À commander";
    case "hors_perimetre":
      return "Point d'attention";
  }
}

export function patientValidatedBucketAriaTitleFr(
  id: PatientValidatedBucketId,
  isTreatedView: boolean
): string {
  const title = patientValidatedBucketTitleFr(id, isTreatedView);
  switch (id) {
    case "dispo_officine":
      return isTreatedView
        ? `${title} — en attente de votre passage en officine`
        : `${title} — dispo en officine à mettre de côté`;
    case "commande":
      return isTreatedView
        ? `${title} — réception ou retrait en cours`
        : `${title} — commande en cours pour vous`;
    case "hors_perimetre":
      return `${title} — suivi particulier avec l'officine`;
  }
}

function cnValidatedAccent(id: PatientValidatedBucketId, part: "header" | "shell"): string {
  const base =
    part === "header"
      ? "border border-border/80 bg-card shadow-none"
      : "border border-border/80 bg-card shadow-none";
  switch (id) {
    case "dispo_officine":
      return `${base} border-l-[3px] border-l-sky-600 bg-sky-50/20`;
    case "commande":
      return `${base} border-l-[3px] border-l-teal-700 bg-teal-50/25`;
    case "hors_perimetre":
      return `${base} border-l-[3px] border-l-amber-600 bg-amber-50/20`;
  }
}

export function patientValidatedBucketHeaderBarClass(id: PatientValidatedBucketId): string {
  return cnValidatedAccent(id, "header");
}

export function patientValidatedBucketSectionShellClass(id: PatientValidatedBucketId): string {
  return cnValidatedAccent(id, "shell");
}

export function patientValidatedBucketAccentTextClass(id: PatientValidatedBucketId): string {
  switch (id) {
    case "dispo_officine":
      return "text-sky-700";
    case "commande":
      return "text-teal-700";
    case "hors_perimetre":
      return "text-amber-800";
  }
}

/** @deprecated Préférer patientValidatedBucketAccentTextClass — conservé pour appels legacy. */
export function patientValidatedBucketHeaderClass(id: PatientValidatedBucketId): string {
  return patientValidatedBucketAccentTextClass(id);
}

export function patientValidatedBucketCountBadgeClass(): string {
  return "bg-muted/50 text-foreground ring-border/60";
}
