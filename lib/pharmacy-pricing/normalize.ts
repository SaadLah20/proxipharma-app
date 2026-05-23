export function normalizeLaboratoryKey(lab: string | null | undefined): string {
  return (lab ?? "").trim().toUpperCase();
}
