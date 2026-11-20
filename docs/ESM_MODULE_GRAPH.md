# Navigateur : graphe ESM unique — TT2 8.4

## Problème corrigé

Avant ce lot, les modules JavaScript étaient chargés à la fois sans query
string et avec plusieurs identifiants de révision (`?v=20261117-...`,
`?v=20261118-...`, `?v=20261120-...`). Pour un navigateur ESM, les URLs
`./pet-scenarios.js` et `./pet-scenarios.js?v=... ` désignent **deux
instances de module distinctes**, même lorsque leur contenu est identique.

Cela réexécute les modules, duplique les tables, peut rendre les caches
`WeakMap` indépendants, et complique la cohérence des résultats importés.
C'est particulièrement pénalisant pendant les nombreux candidats
pet × équipement × SP et leur qualification.

## Changement

La version de publication source est `20261120-unified-graph-r2`.

- Tous les **51 modules** de `src/` utilisent le même identifiant dans
  leurs imports JavaScript relatifs et réexports, y compris vers `vendor/`.
- Les quatre `index.html` sont synchronisés et le chargement du
  worker reçoit le même identifiant.
- **157 relations d'import** ont été examinées : URLs cohérentes, fichiers
  existants, pas de référence à une ancienne version.
- Les tests Node continuent d'importer les fichiers source directement
  sans query (une même session browser n'exécute jamais ces tests).

Ce n'est **pas** une optimisation du DP algorithmique ; c'est une
normalisation de modules et de caches. Aucun gain CPU ou MS n'est affirmé
sans benchmark avant/après.

## Garde-fou automatique hors GitHub Actions

Exécuter localement :

```powershell
npm run check:modules
```

`scripts/verify-module-graph.mjs` ne dépend d'aucun service extérieur :
il compare la version de `index.html`, des trois pages localisées et de
chaque import ESM relatif, vérifie l'existence des fichiers et lance
`node --check` sur chaque module de `src/`. Une régression de version,
une dépendance manquante ou une erreur de syntaxe fait échouer la commande.

Le script Windows `scripts/Verify-TT2-Offline.ps1` exécute désormais
`npm test`, `npm run check:data` **et** `npm run check:modules`,
puis le benchmark seulement avec `-Benchmark`.

Tous les GitHub Actions du dépôt avaient déjà été supprimés ; ce lot
n'en recrée aucun. Aucun déploiement ni fusion.
