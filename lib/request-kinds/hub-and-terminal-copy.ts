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
  envoyees: "Scan transmis — la pharmacie saisit les produits.",
  repondues: "Produits saisis — à valider sous 24 h.",
  validees_traitees: "Vous avez validé ; la pharmacie suit la préparation.",
  traitee_retrait: "Préparation terminée ; retrait en officine.",
  cloturees: "Ordonnance terminée.",
  abandonnees: "Parcours arrêté après validation, sans retrait.",
  expirees: "Sans validation dans le délai après la réponse pharmacie.",
  annulees: "Ordonnance annulée (avant ou après réponse).",
};

const PRESCRIPTION_PHARMACIST_BUCKET_HINTS: Partial<Record<DemandeStatBucket["key"], string>> = {
  envoyees: "Scan à lire — saisir les produits de l’ordonnance.",
  repondues: "Réponse publiée : le patient doit valider sous 24 h.",
  validees_traitees: "Validée par le patient — suivi réservation / commande.",
  traitee_retrait: "Préparation déclarée — retrait au comptoir.",
  cloturees: "Ordonnance clôturée.",
  abandonnees: "Validée puis arrêt sans retrait.",
  expirees: "Aucune validation patient sous 24 h après votre réponse.",
  annulees: "Annulation patient ou brouillon abandonné.",
};

export function dashboardBucketsForKind(
  kindId: RequestKindId,
  role: "patient" | "pharmacien"
): DemandeStatBucket[] {
  const base = role === "patient" ? PATIENT_DASHBOARD_BUCKETS : PHARMACIST_DASHBOARD_BUCKETS;
  if (kindId !== "prescription") return base;
  const hints = role === "patient" ? PRESCRIPTION_PATIENT_BUCKET_HINTS : PRESCRIPTION_PHARMACIST_BUCKET_HINTS;
  return withBucketHints(base, hints);
}

export function hubDashboardChrome(
  kindId: RequestKindId,
  role: "patient" | "pharmacien"
): { title: string; subtitle: string } {
  if (kindId === "prescription") {
    return role === "patient"
      ? {
          title: "Vue rapide · ordonnances",
          subtitle: "Touchez un bloc pour ouvrir la liste filtrée (ordonnances)",
        }
      : {
          title: "Vue rapide · ordonnances reçues",
          subtitle: "Touchez un bloc pour filtrer les ordonnances de l’officine",
        };
  }
  return role === "patient"
    ? {
        title: "Vue rapide · demandes de produits",
        subtitle: "Touchez un bloc pour ouvrir la liste filtrée (demandes de produits)",
      }
    : {
        title: "Vue rapide · demandes de produits",
        subtitle: "Touchez un bloc pour ouvrir la liste filtrée (demandes de produits)",
      };
}

export function patientArchiveIntroCopy(
  status: PatientArchiveStatus,
  kindId: RequestKindId
): PatientArchiveIntroCopy {
  const ord = kindId === "prescription";
  switch (status) {
    case "cancelled":
      return ord
        ? {
            title: "Archive — ordonnance annulée",
            lede: "Référence figée. Le scan et les échanges restent consultables en lecture seule.",
          }
        : {
            title: "Archive — dossier annulé",
            lede: "Référence figée. Touchez une photo pour l’agrandir ; l’icône horloge ouvre l’historique détaillé du produit.",
          };
    case "abandoned":
      return ord
        ? {
            title: "Archive — ordonnance sans suite",
            lede: "Plus d’actions sur ProxiPharma. Scan, produits saisis et messages restent consultables.",
          }
        : {
            title: "Archive — dossier abandonné",
            lede: "Plus d’actions possibles sur ProxiPharma. Les lignes et messages restent consultables en lecture seule.",
          };
    case "expired":
      return ord
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
      return ord
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
