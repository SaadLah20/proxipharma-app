# Design system ProxiPharma (refonte 2026)

## Principes

- **Fond clair** : `bg-background`, cartes `bg-card`, bordures `border-border/80`.
- **Une action principale** par écran (bouton `primary`, min 44px).
- **Typo lisible** : corps 15px minimum, pas de texte &lt; 12px sur parcours public/patient.
- **Statuts** : pastille neutre + libellé FR — pas de carte entière colorée.

## Repère type de demande (indicatif)

| Type | Accent | Usage autorisé |
|------|--------|----------------|
| Produits | sky | `RequestKindIndicator`, filet gauche 3px |
| Ordonnance | amber | idem |
| Consultation | violet | idem |

**Interdit** : gradients pleine largeur, buckets sky/teal/amber, KPI multicolores.

## Fichiers

- Tokens : `lib/design-system/tokens.ts`
- Accents type : `lib/design-system/request-kind-accent.ts`
- Composants : `components/ui/` (Badge, Card, Section, ListRow, StickyActionBar, RequestKindIndicator)

## Shells neutres

- Bandeau dossier : `neutralHeaderShell` (request-kind-accent.ts)
- Carte hub : `neutralCardShell`
