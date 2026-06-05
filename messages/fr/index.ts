import { accountFr, demandePublicFr, demandesFr, modalsFr, notificationsFr, promoFr, timelineFr, conversationFr } from "./demandes";
import { annuaireFr } from "./annuaire";
import { authFr } from "./auth";
import { commonFr } from "./common";
import { headerFr } from "./header";
import { hubFr } from "./hub";
import { consultationCopyFr, prescriptionCopyFr, workflowFr } from "./workflow";
import { pharmacyPublicFr } from "./pharmacyPublic";

const messages = {
  common: commonFr,
  header: headerFr,
  auth: authFr,
  annuaire: annuaireFr,
  workflow: workflowFr,
  prescription: prescriptionCopyFr,
  consultation: consultationCopyFr,
  hub: hubFr,
  demandes: demandesFr,
  timeline: timelineFr,
  conversation: conversationFr,
  modals: modalsFr,
  notifications: notificationsFr,
  account: accountFr,
  promo: promoFr,
  pharmacyPublic: pharmacyPublicFr,
  demandePublic: demandePublicFr,
};

export default messages;
