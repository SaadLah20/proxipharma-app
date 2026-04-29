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
* **Espace Pharmacien :** Outil de production. Réception et traitement des demandes, gestion des prix, dashboard de performance et notifications prioritaires.
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