export type RequestContentSnapshot = {
  updatedAt: string;
  status: string;
};

export type RequestStaleContext = {
  viewerRole: "patient" | "pharmacien";
  status: string;
  snapshot: RequestContentSnapshot | null;
  live: RequestContentSnapshot;
};

export type RequestStaleState = {
  stale: boolean;
  title: string;
  message: string;
};

/** Détecte un décalage serveur pendant une action en cours (autre acteur ou version plus récente). */
export function detectRequestDetailStale(ctx: RequestStaleContext): RequestStaleState | null {
  const { viewerRole, status, snapshot, live } = ctx;
  if (!snapshot) return null;
  if (snapshot.updatedAt === live.updatedAt && snapshot.status === live.status) return null;

  if (viewerRole === "pharmacien" && snapshot.status === "confirmed" && live.status === "treated") {
    return {
      stale: true,
      title: "Le patient a peut-être modifié sa validation",
      message:
        "Le dossier est passé en traitée ou a changé pendant votre consultation. Actualisez avant d’enregistrer ou de déclarer traitée.",
    };
  }

  if (viewerRole === "patient" && snapshot.status === "confirmed" && live.status === "treated") {
    return {
      stale: true,
      title: "Demande traitée par la pharmacie",
      message:
        "L’officine a déclaré votre demande comme traitée. Actualisez la page : vous ne pouvez plus modifier votre validation.",
    };
  }

  if (viewerRole === "pharmacien") {
    if (["submitted", "in_review"].includes(status)) {
      return {
        stale: true,
        title: "Demande mise à jour par le patient",
        message:
          "Le patient a modifié sa demande. Actualisez la page pour voir la liste à jour avant de répondre.",
      };
    }
    if (status === "responded") {
      return {
        stale: true,
        title: "Réponse obsolète",
        message:
          "Le dossier a changé (validation patient ou nouvelle version). Actualisez avant de modifier ou publier.",
      };
    }
    if (["confirmed", "treated"].includes(status)) {
      return {
        stale: true,
        title: "Dossier mis à jour",
        message:
          "Le patient a validé ou le dossier a évolué. Actualisez pour afficher l’état réel avant d’enregistrer.",
      };
    }
  }

  if (viewerRole === "patient") {
    if (["submitted", "in_review"].includes(status)) {
      return {
        stale: true,
        title: "La pharmacie a peut-être déjà répondu",
        message:
          "Actualisez la page : si une réponse a été publiée, vous ne pourrez plus modifier votre liste ici.",
      };
    }
    if (status === "responded") {
      return {
        stale: true,
        title: "Réponse de la pharmacie mise à jour",
        message:
          "La pharmacie a modifié sa réponse. Actualisez pour valider la version à jour.",
      };
    }
    if (["confirmed", "treated"].includes(status)) {
      return {
        stale: true,
        title: "Commande mise à jour par la pharmacie",
        message:
          "La pharmacie a modifié un ou plusieurs produits après votre validation. Actualisez pour voir les quantités et libellés à jour.",
      };
    }
  }

  return {
    stale: true,
    title: "Dossier mis à jour",
    message: "Actualisez la page pour continuer avec les dernières informations.",
  };
}

export function shouldPollRequestDetailDrift(status: string, viewerRole: "patient" | "pharmacien"): boolean {
  if (viewerRole === "pharmacien") {
    return ["submitted", "in_review", "responded", "confirmed", "treated"].includes(status);
  }
  return ["submitted", "in_review", "responded", "confirmed", "treated"].includes(status);
}
