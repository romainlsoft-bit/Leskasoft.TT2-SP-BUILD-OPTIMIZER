# Audit #56 — frontières navigateur et accessibilité clavier

## Architecture et responsabilités

Cette PR poursuit la séparation des responsabilités, sans changer les
coefficients TT2, la programmation dynamique, l'import du jeu ou les modes
de calcul de boss.

- `src/browser-persistence.js` est la seule infrastructure responsable
  des clés `tt2_skill_optimizer_v1` et `tt2_site_language`. Les
  fonctions acceptent un stockage injecté : quota, accès interdit, JSON
  corrompu et stockage absent sont testables sans navigateur.
- `restoreSavedBuild` valide les données au travers de
  `sanitizeUserBuild` avant tout accès au contrôleur.
- `persistSavedBuild` préserve la limite existante de 4 000 000
  caractères et ne conserve pas une vieille session si le nouvel état
  dépasse cette limite.
- `eraseSavedBrowserData` ne signale la réussite qu'après les deux
  suppressions ; si le navigateur refuse l'accès, l'UI montre une erreur
  et ne prétend pas avoir effacé l'état en rechargeant.
- `src/share-link-protocol.js` est le seul point de sérialisation des
  paramètres publics. Le même schéma compact `#build=` et les mêmes
  attributs publics sont conservés.
- Les nouveaux liens utilisent `TextEncoder` et la base64 binaire
  au lieu des anciens `unescape/encodeURIComponent`. Le résultat est
  identique pour les payloads JSON UTF-8 existants. `accountProfile`,
  l'inventaire, les identifiants, les états privés et les familiers
  équipés ne sont jamais ajoutés au lien.
- Les validations de niveaux et de budget continuent d'utiliser
  `src/build-input-boundary.js` : pas de deuxième implémentation.

## Accessibilité

Les quatre interfaces et les quatre guides possèdent :
- un lien localisé **Passer au contenu principal** visible lors de la
  navigation au clavier ;
- un landmark `<main id="main-content" tabindex="-1">` cible ;
- un style de focus explicite ;
- le respect de `prefers-reduced-motion` pour transitions, animations,
  défilement CSS et défilement programmatique vers les résultats.

Les URL canoniques, `hreflang`, méta robots et graphes JSON-LD restent
inchangés.

## Tests

`tests/browser-infrastructure-a11y.test.js` couvre :
- stockage normal, valeurs anciennes, JSON corrompu, dépassement de
  taille, exceptions sur accès et effacement ;
- confidentialité des liens et compatibilité exacte du base64 historique ;
- validation de niveaux hostiles et limitation de taille du fragment ;
- huit pages localisées, styles de focus et réduction des animations ;
- absence de faux succès d'effacement et suppression du code mort
  correspondant dans `app.js`.

Les tests historiques portant sur les chaînes de `app.js` suivent
désormais les modules responsables, sans abandonner leurs assertions
de sécurité.

## Qualification avant fusion

```powershell
npm run check
npm run bench:22k
npm run bench:issue30
npm run bench:push
```

Pas de GitHub Actions. Aucun merge dans `main` avant la qualification
complète de la tête de cette PR. Les sources et ZIP de qualification
restent exclusivement dans `D:\Leskasoft\TT2`.

## Hors périmètre

- Les vrais tests Playwright sur Chromium/Firefox/WebKit restent à ajouter
  au pipeline local/TeamCity. Les tests statiques et le faux DOM ne
  remplacent pas une qualification clavier et lecteur d'écran.
- Validation HTTP live (CSP, HTTPS, codes et Core Web Vitals), dépendante
  de l'hébergement.
- Calibration des formules TT2 et performances du solveur en jeu.
