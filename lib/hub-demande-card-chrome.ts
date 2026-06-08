export type HubDemandeCardAccent = "sky" | "amber" | "violet";

export function hubDemandeCardAccent(requestType: string | null | undefined): HubDemandeCardAccent {
  if (requestType === "prescription") return "amber";
  if (requestType === "free_consultation") return "violet";
  return "sky";
}

export function hubDemandeCardShellClass(accent: HubDemandeCardAccent): string {
  if (accent === "sky") {
    return "rounded-xl border border-sky-200/55 bg-card shadow-sm ring-1 ring-sky-100/35";
  }
  if (accent === "amber") {
    return "rounded-xl border border-amber-200/50 bg-card shadow-sm ring-1 ring-amber-100/30";
  }
  return "rounded-xl border border-violet-200/55 bg-card shadow-sm ring-1 ring-violet-100/35";
}

export function hubDemandeCardAccentBarClass(accent: HubDemandeCardAccent): string {
  if (accent === "sky") return "bg-sky-500";
  if (accent === "amber") return "bg-amber-500";
  return "bg-violet-500";
}

export function hubDemandeCardContextClass(
  emphasis: "urgent" | "info" | "muted" | "success" | undefined,
  accent: HubDemandeCardAccent,
): string {
  if (emphasis === "urgent") {
    return accent === "sky"
      ? "text-sky-900"
      : accent === "amber"
        ? "text-amber-950"
        : "text-violet-950";
  }
  if (emphasis === "success") return "text-emerald-800";
  if (emphasis === "muted") return "text-muted-foreground/85";
  return "text-muted-foreground";
}
