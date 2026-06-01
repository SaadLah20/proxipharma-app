/** Titres et couleurs des groupes « validée / traitée » (alignés page répondue). */

export type PatientValidatedBucketId = "dispo_officine" | "commande" | "hors_perimetre";

export function patientValidatedBucketTitleFr(
  id: PatientValidatedBucketId,
  isTreatedView: boolean
): string {
  if (isTreatedView) {
    if (id === "dispo_officine") {
      return "Produits réservés pour vous et en attente de votre passage";
    }
    if (id === "commande") {
      return "Produits commandés pour vous";
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

export function patientValidatedBucketHeaderClass(id: PatientValidatedBucketId): string {
  switch (id) {
    case "dispo_officine":
      return "text-sky-950";
    case "commande":
      return "text-teal-950";
    case "hors_perimetre":
      return "text-amber-950";
  }
}
