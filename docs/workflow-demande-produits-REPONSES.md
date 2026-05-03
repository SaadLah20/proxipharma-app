# Réponses atelier — workflow « Demande de produits »

**Mode d’emploi**

1. Répondre **sous chaque question** (même brièvement : oui/non ou une phrase).
2. Mettre à jour la **date** en bas du fichier après chaque passage.
3. Au démarrage d’une session Cursor, utiliser le **prompt** indiqué dans `CAHIER_DES_CHARGES.md` §13 (bloc *Workflow produit — plan de développement*).

**Référence des questions** : fichier `docs/workflow-demande-produits-QUESTIONS.md`.

---

## A. Périmètre et objectif MVP « pilote »

### Q1

_Réponse :_ pour le pilote, on va faire un parcours de cout en bout, fonctionnel mais sans tableau de bord ni notifications pour le moment, on en abordera plus tard

### Q2

_Réponse :_nous allons lancer l'expérience pilote avec 12 pharmacies à 15

### Q3

_Réponse :_pas besoin de total commande pour l'instant, mais puisque tout les produits viennent de la table produits qui contient deja les prix de tout les produis, on affiche alors toujours le Prix unitaire et prix total par produit

---

## B. Statuts et machine à états

### Q4

_Réponse :_j'ai pas bien comprix cette question

### Q5

_Réponse :_on négligeant complètement cette notion de "préparer directement, case a cocher "si tout les produits" pour le moment

### Q6

_Réponse :_Ici je vais t'expliquer les statuts et workflow de facon définitve et complète:
1) Le client envoi une demande de produits, il est donc en attente de réponse pharmacien, le client peut a ce stade la modifier ou l'annuler. 
2) Le pharmacien traite la demande (Disponibilités, altérnatives, propositions, commentaire) et renvoi la réponse, la demande est donc répondue
3) Si le patient ne valide rien, après 24h la demande passe au statut abandonnée. 
4) lorsque la demande est répondue, le patient peut accepter ou non les produits, alternatives, proposition et quantités, ajuster et valider sa commande. la commande peut donc etre composée de produits disponible "a préparer directement" et des produits "a commander" dont la date de réception est connue par le patient. le patient peut aussi a ce stade annuler sa demande ou la cloturer en disant merci par exemple
5)Après validation de la commande par le patient, le pharmacien la traite dans son espace pour la faire passer du statut validée par le patient, a traitée par le pharmacien ou prete... le patient va donc pouvoir s'assurer que sa commande est traitée (produits disponibles pour lui, produits commandés par lui)
6)Ici le parcours est terminé coté patient, il peut soit se déplacer pour récupérer sa commande, appeler la pharmacie, ou annuler la commande
7) la pharmacien doit avoir un acces totale a une demande, et il peut suite a un appel par exemple avec le patient modifier la demande, ajouter des produits, ajuster quantité etc. et la le patient va voir sa commande modifiée dans la platforme
8) une demande est cloturée soit par le client en annulant sa commande. ou par le pharmacien suite a un appel ou une visite du patient, mais a l'interieure de chaque demande le pharmacien doit saisir ce qui a été récupérée, et ce qui a été annulé ou abandonné  par le patient

### Q7

_Réponse :_Réponse incluse dans Q6

---

## C. Données par demande (en-tête)

### Q8

_Réponse :_une seule zone dans l'envoi

### Q9

_Réponse :_A éliminer cette notion pour le moment

### Q10

_Réponse :_non

---

## D. Données par ligne produit (patient à l’envoi)

### Q11

_Réponse :_a la création (coté patient et coté pharmacien a la réponse), longeur minimale "une phrase pour decrire l'utilisation par exp", facultatif

### Q12

_Réponse :_entier strict, 1 par default, pas plus de 10

### Q13

_Réponse :_on ne peut pas ajouter un meme produit qui existe deja dans la liste

---

## E. Avant réponse pharmacien

### Q14

_Réponse :_pour les status, ce que je pense maintenant qu'il y aura quelque choses comme: envoyée (par le patient), répondue par le pharmacien, validée (par le patient), traitée (par le pharmacien), annulée, cloturée, abandonnée

### Q15

_Réponse :_pharmacie figée, s'il veut une autre pharmacie il doit tout refaire avec cette dernière

### Q16

_Réponse :_Liste de motifs, avec possibilité d'écrire si autre...

---

## F. Côté pharmacien : réponse et dispo

### Q17

_Réponse :_c'est juste une question UI, ce qui compte est la disponibilité envoyée réellement dans la réponse

### Q18

_Réponse :_Date obligatoire, heure facultatif

### Q19

_Réponse :_Le patient peut soit accepter un seul produit (principal ou une de ses alternatives) comme il peut décocher tout le bloc (zéro)

### Q20

_Réponse :_nouvelles lignes avec etiquette + motif

---

## G. Côté patient : après réponse du pharmacien

### Q21

_Réponse :_tous cochés, c'est au patient de décocher ... mais pour ceux qui sont en rupture du marché, nous allons les afficher autrement (grisés par exemple avec indication que nous allons vous notifier des que le produit est dispo)

### Q22

_Réponse :_confirmé

### Q23

_Réponse :_pas de remise, deux chiffres après virgule, somme PU*qté

### Q24

_Réponse :_un seul fil...

### Q25

_Réponse :_on va prévenir tous les gens qui ont consulté pour un produits en rupture, donc pas la peine de faire cette option de "préviens moi"

### Q26

_Réponse :_Obligatoire après validation finale, s'il veut la modifié il doit appeler la pharmacie qui elle peut la modifiée sur son espace (comme expliqué avant)

### Q27

_Réponse :_L'imporatant est que la date du passage doit etre comprise entre NOW et NOW + 4 jours dans le cas ou il n'y a pas de produits a commander confirmés, sinon elle sera comprise entre NOW et DATE DE RECEPTION DU DERNIER PRODUIT QUI ARRIVE + 3 jours

---

## H. Validation patient (récap)

### Q28

_Réponse :_tu mets une récap qui te parrait logique dans notre contexte

### Q29

_Réponse :_Réponse incluse dans Q6

---

## I. Après validation patient : pharmacien

### Q30

_Réponse :_Réponse incluse dans Q6, on doit faire simple maintenant pour développer de bout en bout, par la suitre en reviendera pour raffiner les fonctionnalités

### Q31

_Réponse :_Oui le patient doit voir ses produits qui sont collectée pour lui (prets, dispo) et les produits a commander confirmés avec leurs date d'arrivée prévues

---

## J. Comptoir et retrait

### Q32

_Réponse :_au comptoir c'est le pharmacien qui se charge de la modif de tout ce qui concerne la commande, le patient va voir toujours sa dernière version avec de préférence de mebtions comme (mis a jour le ... par le pharmacien) pour garder tracabilités minimales de ses commandes

### Q33

_Réponse :_j'ai pas bien compris cette question

---

## K. Notifications

### Q34

_Réponse :_Le pharmacien recoit notif de nouvelle demande, le patient recoit notif de demande répondue, le patient recoit notif pour lui relancer a agir avec la réponse du pharmacien après 2 heure de la réponse, le pharmacien recoit notif demandes validés, et pharmacien recoit notif pour relancer par appel les demandes répondues non validés après 4 heures de la réponse, le patient recoit notif après validation du traitement de sa demande par le pharmacien, pharmacien recoit notif si demande annulée, patient recoit notif pour passer récupérer sa commande le jour de "passage confirmé par lui", le patient recoit une relance le 48 heure de l'heure de passage pour relancer le client par téléphone afin qu'il cloture cette demande ou la prolonge par exemple

### Q35

_Réponse :_non nous allons devoir intégrer par la suite e-mail, sms où whatsapp. la pilote ne sera pas efficace sans ca vue la mentalité des marocains

---

## L. Pharmacien : exploitation

### Q36

_Réponse :_pas compris, décide toi

### Q37

_Réponse :_j'ai deja expliqué ca dans les notif

---

## M. Règles transverses

### Q38

_Réponse :_Pas d'expiration dans le pilote, tant que le patient peut toujours annuler ses commandes et puisque le pharmacien peut toujours cloturée des demandes lui meme

### Q39

_Réponse :_nous allons traiter la partie patients dans l'espace pharmacien plus tard, et oui biensur le pharmacien peut voir le nom, téléphone email etc de ses patients (ceux q'ils l'ont consultés ou ceux qu'ils l'ont ajouté aux favoris que nous allons traiter plus tard)

### Q40

_Réponse :_Pour l'Admin nous aimerions avoir un controle totale avec des analytices fiables pour mesurer l'expérience pilote et pouvoir intérvenir pour regler des problème et debloquer des trucs, donc tu juge toi meme ce qu'il faut avoir dans la partie admin

---

## N. Critères de validation pilote

### Q41

_Réponse :_
1) Le patient a envoyer une demande, le pharmacien recoit la notif, répond, le patient recoit la notif, valide, le pharmacien recoit la notif, execute, le patient recoit la notif, passe récupérer ses produits
2) Le patient a envoyer une demande, le pharmacien recoit la notif, répond, après 2 heures sans réaction du patient il recoit une notif, il valide ...
3) Le patient a envoyer une demande, le pharmacien recoit la notif, répond, le patient recoit la notif, valide, le pharmacien recoit la notif, execute, le patient annule la commande, le pharmacien recoit la notif.

---

_Dernière mise à jour des réponses (date) : **03/05/26**_
