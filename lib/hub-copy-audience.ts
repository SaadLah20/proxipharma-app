/** Qui lit le libellé : patient ou officine (formulations « vous » adaptées). */
export type HubCopyAudience = "patient" | "pharmacien";

export function isPharmacienCopyAudience(audience: HubCopyAudience): boolean {
  return audience === "pharmacien";
}
