# RUNBOOK - ProxiPharma

Guide operationnel minimal pour maintenir la production stable.

## 1) Environnements

- Production: projet Vercel connecte a la branche `main`
- Preview: deploiements automatiques sur branches de feature via Pull Request
- Base de donnees: Supabase (RLS active)

## 2) Variables d'environnement critiques

Configurer ces variables dans:
- Vercel (`Project Settings > Environment Variables`)
- GitHub (`Settings > Secrets and variables > Actions`)

Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement: cron/worker, **ne jamais** exposer au navigateur)
- `CRON_SECRET` (secret partagé pour protéger les endpoints cron)
- `RESEND_API_KEY` (prestataire e-mail, free tier possible)
- `EMAIL_FROM` (ex: `ProxiPharma <onboarding@resend.dev>` en dev, puis domaine validé)

Regle:
- Le nom doit etre exact
- La valeur ne doit pas contenir de guillemets

## 3) Process de release (solo founder)

1. Creer une branche de travail:
   - `git switch -c feat/nom-court`
2. Commit et push sur la branche
3. Ouvrir une PR vers `main`
4. Attendre checks verts:
   - `lint-and-build`
   - Vercel preview
5. Merge PR
6. Verifier le deploiement production Vercel

Important:
- Ne pas push direct sur `main` (branche protegee)

## 4) Checklist post-deploiement (5 min)

- Ouvrir URL production
- Verifier annuaire public (invite)
- Verifier login patient
- Verifier espace pharmacien
- Verifier espace admin
- Verifier absence d'erreurs 500 dans la console

## 5) Incidents frequents

### CI echoue sur build avec variables manquantes

Symptome:
- erreur sur `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Action:
1. Verifier secrets GitHub Actions
2. Verifier variables Vercel
3. Relancer workflow / redeployer

### Notifications externes ne partent pas (Q35)

Symptome:
- `notification_external_queue` reste en `pending`

Action:
1. Verifier que le cron/worker appelle `POST /api/cron/send-external-emails` avec `Authorization: Bearer <CRON_SECRET>`
2. Verifier `SUPABASE_SERVICE_ROLE_KEY` / `RESEND_API_KEY`
3. Verifier que `notification_external_prefs` est activé pour l'utilisateur + `profiles.email` non vide

### Erreur RLS "infinite recursion detected in policy for relation profiles"

Cause:
- policy `profiles` recursive

Action:
1. Aller dans Supabase SQL Editor
2. Supprimer la policy recursive
3. Reappliquer le correctif avec fonction helper `is_admin()`

### Push refuse sur `main`

Symptome:
- `Protected branch update failed`

Action:
1. Pousser sur une branche feature
2. Ouvrir PR
3. Merge apres checks verts

## 6) Sauvegarde et hygiene

- Garder les policies RLS versionnees (script SQL dans un dossier migrations)
- Eviter les modifications manuelles non tracees en production
- Documenter chaque incident resolu en 2-3 lignes dans ce fichier

## 7) Commandes utiles

```bash
npm run lint
npm run build
git status
git log --oneline -n 10
```
