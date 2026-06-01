import {
  PATIENT_DASHBOARD_BUCKETS,
  PHARMACIST_DASHBOARD_BUCKETS,
  type DemandeStatBucket,
} from "@/lib/demandes-hub-buckets";
import type { RequestKindId } from "@/lib/request-kinds/types";

type PatientArchiveStatus =
  | "cancelled"
  | "abandoned"
  | "expired"
  | "completed"
  | "partially_collected"
  | "fully_collected";

export type PatientArchiveIntroCopy = {
  title: string;
  lede: string;
};

function withBucketHints(
  base: DemandeStatBucket[],
  hints: Partial<Record<DemandeStatBucket["key"], string>>
): DemandeStatBucket[] {
  return base.map((b) => (hints[b.key] != null ? { ...b, hint: hints[b.key] } : b));
}

const PRESCRIPTION_PATIENT_BUCKET_HINTS: Partial<Record<DemandeStatBucket["key"], string>> = {
  envoyees: "Scan en attente de saisie",
  repondues: "À valider (24 h)",
  validees_traitees: "Validée — en préparation",
  traitee_retrait: "Prête — retrait officine",
  cloturees: "Terminée",
  abandonnees: "Abandonnée",
  expirees: "Expirée",
  annulees: "Annulée",
};

const PRESCRIPTION_PHARMACIST_BUCKET_HINTS: Partial<Record<DemandeStatBucket["key"], string>> = {
  envoyees: "Saisir depuis le scan",
  repondues: "Attente patient (24 h)",
  validees_traitees: "Suivi résa. / commande",
  traitee_retrait: "Retrait comptoir",
  cloturees: "Clôturée",
  abandonnees: "Abandonnée",
  expirees: "Expirée",
  annulees: "Annulée",
};

const CONSULTATION_PATIENT_BUCKET_HINTS: Partial<Record<DemandeStatBucket["key"], string>> = {
  envoyees: "Message envoyé",
  repondues: "À valider (24 h)",
  validees_traitees: "Validée — en préparation",
  traitee_retrait: "Prête — retrait",
  cloturees: "Terminée",
  abandonnees: "Abandonnée",
  expirees: "Expirée",
  annulees: "Annulée",
};

const CONSULTATION_PHARMACIST_BUCKET_HINTS: Partial<Record<DemandeStatBucket["key"], string>> = {
  envoyees: "Lire le message",
  repondues: "Attente patient (24 h)",
  validees_traitees: "Suivi lignes",
  traitee_retrait: "Retrait comptoir",
  cloturees: "Clôturée",
  abandonnees: "Abandonnée",
  expirees: "Expirée",
  annulees: "Annulée",
};

export function dashboardBucketsForKind(
  kindId: RequestKindId,
  role: "patient" | "pharmacien"
): DemandeStatBucket[] {
  const base = role === "patient" ? PATIENT_DASHBOARD_BUCKETS : PHARMACIST_DASHBOARD_BUCKETS;
  if (kindId === "prescription") {
    const hints = role === "patient" ? PRESCRIPTION_PATIENT_BUCKET_HINTS : PRESCRIPTION_PHARMACIST_BUCKET_HINTS;
    return withBucketHints(base, hints);
  }
  if (kindId === "free_consultation") {
    const hints = role === "patient" ? CONSULTATION_PATIENT_BUCKET_HINTS : CONSULTATION_PHARMACIST_BUCKET_HINTS;
    return withBucketHints(base, hints);
  }
  return base;
}

export function hubDashboardChrome(
  _kindId: RequestKindId,
  _role: "patient" | "pharmacien"
): { title: string; subtitle: string } {
  return {
    title: "8 statuts",
    subtitle: "Toucher un bloc pour ouvrir la liste filtrée — barres = volume relatif",
  };
}

export function patientArchiveIntroCopy(
  status: PatientArchiveStatus,
  kindId: RequestKindId
): PatientArchiveIntroCopy {
  const ord = kindId === "prescription";
  const cons = kindId === "free_consultation";
  switch (status) {
    case "cancelled":
      return cons
        ? {
            title: "Archive — consultation annulée",
            lede: "Référence figée. Message, photos et échanges restent consultables en lecture seule.",
          }
        : ord
        ? {
            title: "Archive — ordonnance annulée",
            lede: "Référence figée. Le scan et les échanges restent consultables en lecture seule.",
          }
        : {
            title: "Archive — dossier annulé",
            lede: "Référence figée. Touchez une photo pour l’agrandir ; l’icône horloge ouvre l’historique détaillé du produit.",
          };
    case "abandoned":
      return cons
        ? {
            title: "Archive — consultation sans suite",
            lede: "Plus d’actions sur ProxiPharma. Message, photos et échanges restent consultables.",
          }
        : ord
        ? {
            title: "Archive — ordonnance sans suite",
            lede: "Plus d’actions sur ProxiPharma. Scan, produits saisis et messages restent consultables.",
          }
        : {
            title: "Archive — dossier abandonné",
            lede: "Plus d’actions possibles sur ProxiPharma. Les lignes et messages restent consultables en lecture seule.",
          };
    case "expired":
      return cons
        ? {
            title: "Archive — délai dépassé",
            lede: "La proposition n’a pas été validée à temps. Vous pouvez ouvrir une nouvelle consultation depuis l’annuaire.",
          }
        : ord
        ? {
            title: "Archive — délai dépassé",
            lede: "La réponse n’a pas été validée à temps. Vous pouvez envoyer une nouvelle ordonnance depuis l’annuaire (même pharmacie).",
          }
        : {
            title: "Archive — délai dépassé",
            lede: "La réponse n’a pas été validée à temps. Vous pouvez lancer une nouvelle demande depuis le bouton en tête de page si proposé.",
          };
    case "partially_collected":
      return ord
        ? {
            title: "Archive — retraits partiels",
            lede: "Certains produits retenus ont été retirés ; les autres restent visibles pour votre trace.",
          }
        : {
            title: "Archive — retraits partiels",
            lede: "Certaines lignes retenues ont été retirées au comptoir ; les autres restent visibles pour votre trace.",
          };
    case "fully_collected":
      return ord
        ? {
            title: "Archive — tout retiré",
            lede: "Tous les produits retenus de l’ordonnance ont été enregistrés comme retirés en officine.",
          }
        : {
            title: "Archive — tout retiré",
            lede: "Toutes les lignes retenues ont été enregistrées comme retirées en officine.",
          };
    case "completed":
    default:
      return cons
        ? {
            title: "Archive — consultation clôturée",
            lede: "Vue figée au moment de la clôture. Message, photos et produits proposés restent consultables.",
          }
        : ord
        ? {
            title: "Archive — ordonnance clôturée",
            lede: "Vue figée au moment de la clôture. Scan et produits saisis restent consultables sur chaque ligne.",
          }
        : {
            title: "Archive — dossier clôturé",
            lede: "Vue figée au moment de la clôture. Photos zoomables ; jalons et échanges conservés sur chaque ligne.",
          };
  }
}

export function patientOutcomeStatusFooter(
  status: PatientArchiveStatus,
  kindId: RequestKindId,
  closedFooterNote?: string | null
): string {
  const ord = kindId === "prescription";
  switch (status) {
    case "cancelled":
      return ord
        ? "L’ordonnance a été annulée. Conservez cette page comme trace ; le scan et les produits saisis restent en lecture seule."
        : "La pharmacie a mis fin au dossier. Conservez cette page comme trace ; le détail des produits est en lecture seule.";
    case "abandoned":
      return ord
        ? "Vous avez mis fin au parcours pour cette ordonnance. Le scan et les échanges restent consultables ci-dessous."
        : "Vous avez mis fin au parcours sur ProxiPharma pour ce dossier. Les échanges restent consultables ci-dessous.";
    case "expired":
      return ord
        ? "Sans validation de votre part dans le délai prévu, l’ordonnance s’est fermée. Envoyez une nouvelle ordonnance depuis l’annuaire si besoin."
        : "Sans validation de votre part dans le délai prévu, le dossier s’est fermé automatiquement.";
    case "partially_collected":
      return ord
        ? "Une partie des produits retenus a été retirée ; le reste figure comme non retiré dans l’archive."
        : "Une partie des produits retenus a été retirée au comptoir ; le reste figure comme non retiré dans l’archive.";
    case "fully_collected":
      return ord
        ? "Tous les produits retenus ont été enregistrés comme retirés au comptoir."
        : "Tous les produits retenus ont été enregistrés comme retirés au comptoir.";
    case "completed":
    default:
      return closedFooterNote ?? (ord
        ? "L’ordonnance est close. Les produits saisis par la pharmacie et le scan restent consultables ci-dessous."
        : "Le dossier est clos côté officine. Les montants et libellés reflètent l’état au moment de la clôture.");
  }
}

export function patientOutcomeExpiredHint(kindId: RequestKindId): string | null {
  if (kindId === "prescription") {
    return "Vous n’avez pas validé la réponse de la pharmacie dans le délai prévu. Pour renvoyer une ordonnance, utilisez l’annuaire et la fiche de la même pharmacie.";
  }
  return "Vous n'avez pas validé la réponse de la pharmacie dans le délai prévu. Vous pouvez créer une nouvelle demande avec les mêmes produits si besoin.";
}

export function pharmacistHardStopSectionCopy(
  status: "cancelled" | "abandoned" | "expired",
  kindId: RequestKindId
): { kickerSuffix: string; closedLabel: string } {
  const ord = kindId === "prescription";
  const kicker =
    status === "cancelled" ? "Annulée" : status === "abandoned" ? "Sans suite" : "Expirée";
  return {
    kickerSuffix: ord ? `${kicker} · ordonnance fermée` : `${kicker} · dossier fermé`,
    closedLabel: ord ? "Ordonnance en lecture seule" : "Dossier en lecture seule",
  };
}

export function pharmacistClosedSuccessIntro(kindId: RequestKindId): string {
  return kindId === "prescription"
    ? "Ordonnance clôturée — retraits enregistrés au comptoir (lignes retenues)."
    : "Clôture — retraits enregistrés au comptoir (lignes retenues).";
}

/** Libellé « produits retenus » dans l’archive patient (bandeau totaux). */
export function patientArchiveRetainedLabel(kindId: RequestKindId, count: number): string {
  if (kindId === "prescription") {
    return count > 1 ? "produits de l’ordonnance retenus" : "produit de l’ordonnance retenu";
  }
  return count > 1 ? "produits retenus" : "produit retenu";
}
