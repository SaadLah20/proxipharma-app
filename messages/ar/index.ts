import {
  accountAr,
  demandePublicAr,
  demandesAr,
  modalsAr,
  notificationsAr,
  promoAr,
  timelineAr,
  conversationAr,
} from "./demandes";
import { annuaireAr } from "./annuaire";
import { authAr } from "./auth";
import { commonAr } from "./common";
import { headerAr } from "./header";
import { hubAr } from "./hub";
import { consultationCopyAr, prescriptionCopyAr, prescriptionPublicAr, consultationPublicAr, workflowAr } from "./workflow";
import { pharmacyPublicAr } from "./pharmacyPublic";

const messages = {
  common: commonAr,
  header: headerAr,
  auth: authAr,
  annuaire: annuaireAr,
  workflow: workflowAr,
  prescription: prescriptionCopyAr,
  consultation: consultationCopyAr,
  hub: hubAr,
  demandes: demandesAr,
  timeline: timelineAr,
  conversation: conversationAr,
  modals: modalsAr,
  notifications: notificationsAr,
  account: accountAr,
  promo: promoAr,
  pharmacyPublic: pharmacyPublicAr,
  demandePublic: demandePublicAr,
  prescriptionPublic: prescriptionPublicAr,
  consultationPublic: consultationPublicAr,
};

export default messages;
