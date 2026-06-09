export type RequestContentSnapshot = {
  updatedAt: string;
  status: string;
};

export type RequestStaleScenario =
  | "pharmacien_confirmed_to_treated"
  | "patient_confirmed_to_treated"
  | "pharmacien_submitted_updated"
  | "pharmacien_responded_stale"
  | "pharmacien_confirmed_updated"
  | "patient_submitted_stale"
  | "patient_responded_updated"
  | "patient_confirmed_updated"
  | "generic";

export type RequestStaleContext = {
  viewerRole: "patient" | "pharmacien";
  status: string;
  snapshot: RequestContentSnapshot | null;
  live: RequestContentSnapshot;
};

export type RequestStaleState = {
  stale: true;
  scenario: RequestStaleScenario;
};

/** Détecte un décalage serveur pendant une action en cours (autre acteur ou version plus récente). */
export function detectRequestDetailStale(ctx: RequestStaleContext): RequestStaleState | null {
  const { viewerRole, status, snapshot, live } = ctx;
  if (!snapshot) return null;
  if (snapshot.updatedAt === live.updatedAt && snapshot.status === live.status) return null;

  if (viewerRole === "pharmacien" && snapshot.status === "confirmed" && live.status === "treated") {
    return { stale: true, scenario: "pharmacien_confirmed_to_treated" };
  }

  if (viewerRole === "patient" && snapshot.status === "confirmed" && live.status === "treated") {
    return { stale: true, scenario: "patient_confirmed_to_treated" };
  }

  if (viewerRole === "pharmacien") {
    if (["submitted", "in_review"].includes(status)) {
      return { stale: true, scenario: "pharmacien_submitted_updated" };
    }
    if (status === "responded") {
      return { stale: true, scenario: "pharmacien_responded_stale" };
    }
    if (["confirmed", "treated"].includes(status)) {
      return { stale: true, scenario: "pharmacien_confirmed_updated" };
    }
  }

  if (viewerRole === "patient") {
    if (["submitted", "in_review"].includes(status)) {
      return { stale: true, scenario: "patient_submitted_stale" };
    }
    if (status === "responded") {
      return { stale: true, scenario: "patient_responded_updated" };
    }
    if (["confirmed", "treated"].includes(status)) {
      return { stale: true, scenario: "patient_confirmed_updated" };
    }
  }

  return { stale: true, scenario: "generic" };
}

export function shouldPollRequestDetailDrift(status: string, viewerRole: "patient" | "pharmacien"): boolean {
  if (viewerRole === "pharmacien") {
    return ["submitted", "in_review", "responded", "confirmed", "treated"].includes(status);
  }
  return ["submitted", "in_review", "responded", "confirmed", "treated"].includes(status);
}

/** Intervalle polling drift — plus réactif sur statuts post-validation. */
export function requestDetailDriftPollIntervalMs(status: string): number {
  if (["confirmed", "treated"].includes(status)) return 5_000;
  return 12_000;
}

export function isPatientConfirmedToTreatedStale(stale: RequestStaleState | null): boolean {
  return stale?.scenario === "patient_confirmed_to_treated";
}
