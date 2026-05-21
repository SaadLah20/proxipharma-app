# Synthèse des retours — Ordonnances & consultations libres

**Mode d’emploi**

1. Ce document résume les **décisions métier et UX** prises pour finaliser les deux parcours (hors demande produits).
2. Cocher ou compléter la section **« Reste à valider en pilote »** après chaque campagne de tests.
3. Pour reprendre le développement : utiliser la **phrase de reprise** dans `CAHIER_DES_CHARGES.md` §13.22.

**Dernière mise à jour** : 2026-05-17 (retours ordonnance lot 2 + header consultation sticky — commit **`46e68c7`**)

---

## A. Ordonnance — retours intégrés

### A1. Périmètre fonctionnel

| Sujet | Décision |
|--------|-----------|
| Lignes patient à l’envoi | **Non** — le patient envoie le **scan** (1–2 pages) ; la pharmacie saisit **tous** les produits. |
| Distinction « ajout officine » vs « produits ordonnance » | **Oui** — sur ordonnance, les lignes pharmacien = **produits ordonnance** (ambre), pas « ajout officine » (violet, réservé aux demandes produits). |
| Libellé badge / statut | **« Ordonnance »**, pas « Proposé » (ni côté pharmacien ni patient). |
| Workflow après `responded` | **Identique** à la demande produits (validation patient, réservation/commande, comptoir, écarts post-validé). |

### A2. Saisie pharmacien (scan + lignes)

| Sujet | Décision |
|--------|-----------|
| Accès scan | Agrandissement mobile + **FAB +** dans le lightbox pour ouvrir le modal de saisie. |
| Modal d’ajout | **Recherche catalogue** (≥ 2 caractères) ; le modal **ne se ferme pas** au clic produit — fermeture via **×** ou après **« Ajouter le produit ordonnance »**. |
| Quantités | **Deux champs** : **qté prescrite** (médecin) et **qté dispo** (officine). À l’ajout : dispo = prescrit ; le pharmacien peut **abaisser** la dispo, jamais la dépasser. |
| Disponibilités | **Même mécanismes** que demande produits : indisponible / rupture → **qté dispo 0** (pas de repli sur qté prescrite — `ordonnanceInsertAvailableQty`) ; dispo &lt; prescrit → **partiellement disponible** ; à commander → **date de réception prévue** obligatoire. |
| Proposition complémentaire | **Qté proposée** uniquement (pas de qté prescrite) ; badge **Proposé**. |
| Post-validé + alternative | Modal **Enregistrer** : pas de faux changement sur la ligne principale si le patient a **retenu une alternative** (comparaison branche alternative). |
| Lignes non retenues | Libellé **« Produit proposé par la pharmacie »** même pour saisie depuis scan. |
| Édition lignes déjà saisies | Qté prescrite et qté dispo **modifiables** sur la fiche ligne (pas seulement à l’ajout). |
| Publication | Au moins **une ligne ordonnance** avant de publier la réponse. |

### A3. Fichiers techniques de référence

- Config : `lib/request-kinds/prescription.config.ts`
- Lignes : `lib/prescription-pharmacist-lines.ts`, `lib/prescription-ordonnance-line-qty.ts`
- UI : `components/requests/prescription/` (`prescription-image-viewer.tsx`, `pharmacist-ordonnance-quick-add-modal.tsx`)
- Page pharmacien : `app/dashboard/pharmacien/demandes/[id]/page.tsx` (section « Produits ordonnance », thème ambre)
- Migrations : `20260525_001` … `20260525_004`, `20260526_001`, `20260530_001`, `20260531_001`

---

## B. Consultation libre — retours intégrés

### B1. Périmètre fonctionnel

| Sujet | Décision |
|--------|-----------|
| Contenu patient à l’envoi | **Texte** (min. caractères) + **jusqu’à 3 photos** facultatives. |
| Lignes produits | La pharmacie peut **proposer des produits** après l’échange ; workflow lignes = **demande produits** après publication de la réponse. |
| Conversation | **Messagerie** patient ↔ pharmacien sur le dossier (comme les autres types). |
| Thème UI | **Violet** (hubs, en-têtes, fiche consultation). |
| Avant réponse pharma | Le patient peut **modifier texte et photos** tant que le dossier est `submitted` / `in_review`. |

### B2. Parcours attendu

1. Patient : `/pharmacie/[id]/consultation-libre` → envoi.
2. Détail dossier (patient + pharmacien) : **page scroll unique** — brief + photos, **messagerie inline** (pas de FAB), puis lignes produits proposées (même logique que demande produits / ordonnance).
3. **En-tête** : `RequestKindHeader` (ou récap patient dans `PatientProductRequestActions` selon statut) — **plus** de `ConsultationDetailStickyChrome` / onglets (retiré mai 2026).
4. Pharmacien : recherche catalogue, qté, dispo **Disponible** / **À commander** (+ date si à commander), **alternatives** (qté par alternative enregistrée en `request_item_alternatives.available_qty`) → **publier** → `responded`.
5. Patient : validation comme demande produits — **« Proposé X »** = qté officine ; stepper plafonné à cette qté, **diminution** possible ; choix principal / alternative / aucun.

### B3. Fichiers techniques de référence

- Config : `lib/request-kinds/consultation.config.ts` (`workflowEnabled: true`)
- Médias : `lib/consultation-media.ts`, `lib/private-media-signed-url-client.ts`
- UI : `components/requests/consultation/consultation-brief-panel.tsx` ; `request-conversation-inline.tsx` (onglets sticky : fichiers `consultation-detail-*` **non branchés** depuis 2026-06-03)
- Détail : `app/dashboard/demandes/[id]/page.tsx`, `app/dashboard/pharmacien/demandes/[id]/page.tsx`
- Création : `app/pharmacie/[id]/consultation-libre/page.tsx`
- Migration : **`20260529_001_free_consultation_workflow.sql`** (obligatoire avant E2E)

---

## C. Ce qui ne doit pas être mélangé (rappel)

- **Demande produits** : lignes créées par le **patient** ; « ajout officine » = `pharmacist_proposed` sur ce type uniquement.
- **Ordonnance** : aucune ligne patient ; tout est saisi par le pharmacien ; badge **Ordonnance**.
- **Consultation libre** : pas de catalogue patient ; proposition pharmacien après échange ; badge **Proposé** (cohérent avec une proposition suite à consultation).

---

## D. Reste à valider en pilote (checklist QA)

Cocher après test manuel sur branche **`fix/validated-supply-ecart-ui-modal`** (migrations à jour).

### Ordonnance

- [ ] Patient : envoi 1 puis 2 pages scan ; message optionnel.
- [ ] Pharmacien : lightbox + FAB + → modal ; ajout plusieurs produits sans fermeture intempestive.
- [ ] Pharmacien : prescrit 3 / dispo 1 → badge partiel ; rupture/indispo → dispo **0** (pas = prescrit) ; à commander + date.
- [ ] Pharmacien : proposition complémentaire — qté proposée seule, badge **Proposé**.
- [ ] Pharmacien : enregistrement post-validé sans faux écart si alternative retenue.
- [ ] Pharmacien : modification qté prescrite / dispo sur ligne existante.
- [ ] Patient : lignes non retenues — libellé **proposé par la pharmacie**.
- [ ] Patient : validation réponse ; post-validé (réservé, commande, comptoir) comme une demande produits.
- [ ] Aucune régression visible sur une **demande produits** du même compte.

### Consultation libre

- [ ] Migration **`20260529_001`** appliquée sur l’environnement de test.
- [ ] Patient : création consultation (texte + photos).
- [ ] Patient : édition texte/photos avant réponse pharma (onglet Conversation).
- [ ] Patient / pharmacien : onglets Conversation | Produits ; pas de FAB conversation.
- [ ] Patient / pharmacien : scroll long — récap dossier + onglets **restent en haut** (sticky).
- [ ] Pharmacien : onglet Produits — saisie + dispo (dispo / à commander) + date + publication.
- [ ] Patient : bascule onglet Produits après `responded` ; validation principal / alternative / aucun.
- [ ] Post-validé (réservé, commande, comptoir) comme une demande produits.

### Infra / CI

- [ ] `npm run lint` sans **erreur** (warnings `no-img-element` acceptables si déjà présents ailleurs).
- [ ] `npm run build` OK.

---

## E. Questions encore ouvertes (à trancher si besoin)

| # | Question | Proposition par défaut |
|---|----------|------------------------|
| E1 | Plafond qté prescrite ordonnance (1–10 vs 999) ? | **999** côté pharmacien (saisie officine). |
| E2 | Consultation : produits obligatoires avant publication ? | **Oui** — au moins une ligne (comme ordonnance). |
| E3 | SMS / notifs spécifiques ordonnance ou consultation ? | **Non** pour ce lot — réutiliser les statuts `responded` / `treated` existants. |

---

## F. Prompt conseillé (ouverture de contexte — détails ensuite)

**« On reprend ProxiPharma. Lis `CAHIER_DES_CHARGES.md` §13.22, §10 (session 2026-05-17 suite 2), ce fichier §D–F, `CONTEXTE.md` §6, `AGENTS.md`. Branche `fix/validated-supply-ecart-ui-modal` (commit `46e68c7`+). Migrations : `20260529_001`, `20260530_001`, `20260531_001`, `20260531_002`, ordonnance `20260525_*`. Ordonnance : rupture → dispo 0, badges, modal enregistrement. Consultation : onglets + header sticky. Donne-moi la prochaine tâche. »**
