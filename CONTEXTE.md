# CONTEXTE.md : ProxiPharma
## 1. Vision du Produit
ProxiPharma est une plateforme de transformation digitale visant à moderniser les pharmacies au Maroc. Le MVP (12 pharmacies pilotes) a pour objectif de valider un modèle de fidélisation patient et d'efficacité opérationnelle.
La philosophie directrice est la **"réduction de la friction"** : l'application doit être instantanée, mobile-first, et intégrer des usages familiers (WhatsApp) pour éviter toute barrière technologique.

## 2. Proposition de Valeur

### Pour le Pharmacien (Efficacité & Sérénité)
* **Réduction de la charge administrative :** Automatisation du pricing (moteur PPH) pour supprimer les saisies manuelles.
* **Protection opérationnelle :** Mécanismes de gestion des statuts pour éviter les commandes "fantômes" ou les stocks bloqués trop longtemps.
* **Pilotage de l'activité :** Dashboard temps réel pour monitorer la réactivité de l'équipe et le volume de demandes.
* **Maîtrise de l'image :** Digitalisation de la fiche pharmacie (services, horaires, garde) avec mise à jour instantanée.

### Pour le Patient (Simplicité & Transparence)
* **Fluidité du parcours :** Annuaire "zéro friction" permettant de localiser une pharmacie et de passer à l'action (Appel/WhatsApp) en un clic.
* **Visibilité totale :** Suivi clair du statut de commande (En cours > Préparation > Prêt) sans avoir à se déplacer.
* **Gestion des alternatives :** Interface simplifiée pour valider les propositions du pharmacien en cas d'indisponibilité d'un produit.

## 3. Architecture Fonctionnelle

* **Annuaire Public :** Portail de découverte géolocalisé. Recherche rapide, filtres de garde et accès direct aux outils de contact.
* **Espace Patient :** Interface transactionnelle de suivi. Gestion des demandes, historique, notifications d'état, et validation d'alternatives.
* **Espace Pharmacien :** Outil de production. Réception et traitement des demandes, gestion des prix, dashboard de performance et notifications prioritaires. Coordonnées patient (nom, WhatsApp) sur les demandes de sa pharmacie via **RPC** dédiés, sans lecture large cross-rôle sur `profiles`.
* **Espace Admin :** Dashboard fondateur. Vision panoramique sur le réseau (12 pharmacies), maintenance proactive, gestion de base de données et impersonation pour débogage.

## 4. Règles Métier & UX Clés
* **Bilinguisme natif :** Support complet Arabe/Français avec détection automatique ou basculement fluide.
* **Approche "Mobile-First" :** Design au pouce, typographie lisible, réactivité instantanée (Optimistic UI).
* **Moteur de Pricing :** Centralisé et automatisé (basé sur le PPH). Aucune saisie manuelle de prix pour le pharmacien lors de la vente.
* **Système d'Alertes :** Notifications agressives côté pharmacien pour garantir la réactivité (< 15 min), couplées à des rappels automatiques côté patient pour les commandes en attente.

## 5. Principes de Développement
* **Modulabilité :** Chaque fonctionnalité doit être développée de manière isolée pour permettre des itérations rapides basées sur les retours terrain du pilote.
* **Stabilité :** Priorité absolue sur la fluidité des données entre les espaces Patient et Pharmacien.
* **Stack Technique :** Cursor (IDE), Supabase (Base de données), React + Tailwind (Frontend).

---

## 6. État technique récent (aligné repo — mai 2026)

### Références publiques mémorisables (migration `20260505_007_public_reference_codes.sql`)
Réduire la dépendance aux UUID pour les humains ; annuaire, support téléphonique et filtres peuvent utiliser des codes courts.

| Champ | Table | Exemple | Note |
|--------|--------|---------|------|
| `public_ref` | `pharmacies` | `PH001R` | PH + rang + lettre ville (Latin, sinon X) |
| `patient_ref` | `profiles` (rôle patient) | `P0007-K` | Affiché paramètres patient ; clients pharmacien |
| `request_public_ref` | `requests` | `D042/26` | Compteur **par officine + année** (fuseau Africa/Casablanca) |

Implémentation : séquences PostgreSQL, table `pharmacy_request_ref_counters`, triggers (trigger demande en **SECURITY DEFINER**). Si la signature **`RETURNS TABLE`** des RPC `pharmacist_patient_contact_for_request` / `pharmacist_patient_directory_for_my_pharmacy` change → **`DROP FUNCTION` puis `CREATE`** (sinon erreur **`42P13`**). Front : **`lib/public-ref.ts`**, filtres hubs demandes patient/pharmacien, annuaire `/`.

### Chrome plateforme
`components/layout/platform-chrome.tsx` + `platform-header.tsx` : header fixe, menus patient/pharmacien (demandes produits, ordonnances, consultations libres, etc.), cloche notifications in-app. Redirection après auth : **`lib/post-auth-redirect.ts`**.

### Notifications & analytics pharmacie (migrations `20260505_003` … `006`)
Titres/corps contextuels (patient vs pharmacien) ; événements **`pharmacy_engagement_events`** pour vues/clics fiche ; dashboard pharmacien (Recharts) avec repli si table absente (`lib/pharmacy-engagement.ts`). Fallback nom patient dans le trigger d’émission si **`full_name` vide** (**`20260505_006`**, fichier SQL daté même jour).

### Prochain chantier UX (hors bloc demande-produits déjà mature)
Les routes **ordonnances** et **consultations libres** (patient et pharmacien) sont des **placeholders** : développement ciblé **page par page** puis branchement métier.

### Livraison & Q35 externe
Branche **`fix/rls-recursion`** ; gros groupe récent **`a20c8c4`**. File **`notification_external_queue`** (**`20260505_001`**) — envoi réel via **`/api/cron/send-external-emails`** et secrets Vercel (voir **`RUNBOOK.md`**).