# Workflow « Demande de produits » — questionnaire produit / métier

Document de référence pour cadrage du pilote Patient ↔ Pharmacien.  
Les réponses sont saisies dans **`workflow-demande-produits-REPONSES.md`**.

---

## A. Périmètre et objectif MVP « pilote »

**Q1.** Pour le pilote, veux-tu **tout** le parcours décrit ensemble, ou un **premier jalon** « bout en bout minimal » (sans tableau de bord logistique, sans notifications push réelles), puis un second ?

**Q2.** Le pilote couvre **une seule pharmacie** test ou **plusieurs** dès le départ ?

**Q3.** Faut-il **obligatoirement** le **total prix** dans le pilote, ou peut-on livrer d’abord « lignes + quantités » sans montant, puis ajouter les prix ?

---

## B. Statuts et machine à états

**Q4.** Liste les **statuts métier** que tu veux **nommer explicitement** côté dossier (libellé métier ; slug technique si tu en as déjà une idée).

**Q5.** Le cas **« tout disponible + préparer sans attendre le patient »** doit-il produire un **statut distinct** (ex. « commande prête ») ou rester sous un statut générique déjà prévu ?

**Q6.** Après **validation patient**, si le pharmacien **renvoie une demande ajustée** au patient : le dossier repasse au **même état « en attente réponse patient »** ou veux-tu un statut du type **« contre-proposition pharmacien »** ?

**Q7.** Le **comptoir / retrait** reste-t-il la **seule** clôture « physique », ou peut-on clôturer sans passage (ex. annulation à distance) ?

---

## C. Données par demande (en-tête)

**Q8.** **Commentaire général** patient : une seule zone à l’envoi, ou **plusieurs messages** dans le temps (fil type conversation) ?

**Q9.** La case **« préparer directement si tout est disponible »** : peut-elle être **modifiée par le patient** tant que le pharmacien n’a pas commencé à traiter ?

**Q10.** Faut-il un champ **priorité / urgence** au pilote ?

---

## D. Données par ligne produit (patient à l’envoi)

**Q11.** **Commentaire par produit** à la création : obligatoire, facultatif, longueur max ?

**Q12.** **Quantités** : entier strict, minimum 1, plafond à définir ?

**Q13.** Peut-on **dupliquer le même produit** sur deux lignes ou doit-on **fusionner** en une seule ligne ?

---

## E. Avant réponse pharmacien

**Q14.** « Non traitée par le pharmacien » = quels **statuts** exacts pour toi (ex. seulement `submitted`, ou aussi `in_review`) ?

**Q15.** Le patient peut **modifier** la demande : peut-il **changer de pharmacie** après le premier envoi ou la pharmacie est **figée** ?

**Q16.** **Annulation** par le patient : **sans motif**, **motif obligatoire**, ou **liste de motifs** ?

---

## F. Côté pharmacien : réponse et dispo

**Q17.** **« Par défaut tous les produits dispo »** : **pré-sélection UI** uniquement, ou **règle métier** si le pharmacien ne modifie rien ?

**Q18.** Pour **« à commander »** : **date seule**, **heure seule**, ou **date + heure** obligatoires par ligne ?

**Q19.** **Alternatives** (max 3) : le patient choisit **exactement une** alternative par produit principal, ou **zéro ou une** ?

**Q20.** **Produits additionnels proposés** : **nouvelles lignes** avec étiquette « proposé par le pharmacien » + motif, ou **rattachés** à une ligne existante ?

---

## G. Côté patient : après réponse du pharmacien

**Q21.** **Sélection par défaut** : tous les produits cochés y compris rupture / à commander, ou seulement ceux **disponibles** ?

**Q22.** **Alternatives** : choix **une seule** par groupe produit principal (type radio) — confirmé ?

**Q23.** **Total commande** : règle de calcul (somme PU × qté, TTC/HT, remises, arrondis) ?

**Q24.** **Commentaires** après réponse : **fil par produit + message général**, ou **un seul fil** chronologique ?

**Q25.** **Rupture** : opt-in « préviens-moi » **par ligne**, décochable par ligne ?

**Q26.** **Date de passage** : obligatoire avant validation finale ? Modifiable après ?

**Q27.** Contrainte **date de passage ≥ max(dates réception « à commander »)** : **stricte** (blocage) ou **avertissement** seulement ?

---

## H. Validation patient (récap)

**Q28.** Le **récap** avant envoi : quels blocs sont **obligatoires** (catégories dispo / à commander / rupture, total, date de passage, commentaires, etc.) ?

**Q29.** Après **valider**, le patient peut-il encore **annuler**, et jusqu’à quel **statut** côté pharmacien ?

---

## I. Après validation patient : pharmacien

**Q30.** Quand le pharmacien **met à jour et renvoie** au patient : **historique de versions** visible côté patient, ou **état courant + messages** uniquement ?

**Q31.** Quand le pharmacien « valide l’exécution » : quel **contenu** voit le patient (texte libre + lignes étiquetées « prêt » / « commandé ETA … ») ?

---

## J. Comptoir et retrait

**Q32.** **Modification sur place** : nouvelle validation patient systématique, ou traçabilité **côté pharmacien uniquement** (comptoir) ?

**Q33.** Plusieurs passages client : au-delà de « plus tard », faut-il d’autres **statuts lignes ou dossier** ?

---

## K. Notifications

**Q34.** Liste les **événements** devant créer une **notification métier** (même si in-app au début).

**Q35.** Pilote acceptable avec **liste in-app uniquement**, sans email/SMS ?

---

## L. Pharmacien : exploitation

**Q36.** Vues **« à commander / commandé / prêt / non récupéré »** : **jalon 1** pilote ou **jalon 2** ?

**Q37.** **Relance téléphonique** : simple **note interne + statut « à relancer »**, ou **workflow avec date de relance** ?

---

## M. Règles transverses

**Q38.** **Expiration** après réponse pharmacien (ex. **+7 jours**) : tu confirms, changes, ou pas d’expiration au pilote ?

**Q39.** **Identité patient** visible pharmacien au pilote : on **garde l’approche actuelle** (identifiant tronqué) ou évolution prévue ?

**Q40.** **Admin** : modération des demandes **nécessaire** au pilote ou hors scope ?

---

## N. Critères de validation pilote

**Q41.** Quels **3 scénarios de test manuel** sont **non négociables** pour dire « workflow produit validé » (une phrase par scénario) ?
