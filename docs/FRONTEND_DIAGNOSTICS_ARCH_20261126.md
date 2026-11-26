# Audit #56 — séparation des diagnostics du frontend (lot architectural)

## Objectif
Réduire le couplage entre UI, résultats de calcul et fonctionnalités
expérimentales retirées de l'interface, sans modifier la méthode
d'optimisation, les coefficients, les sources TT2, les données importées ni
le format des builds.

## Architecture finale du lot
- `src/app.js` orchestre les événements DOM, le stockage, l'import du
  compte, la sélection des paramètres, les appels Web Worker et les
  résultats essentiels. Son volume passe d'environ 1 194 lignes à
  environ 646 lignes.
- `src/account-diagnostics-ui.js` présente exclusivement les résultats
  comptables de l'import (artefacts, monuments, recherches, sets, mana,
  armes de héros, bonus de compte) et les limites de validation.
  Dépendances explicites et injectées :
  `getById`, `doc`, `tr`, `numberText`,
  `formatLogMultiplier`, `seasonNotice`.
- `src/result-details-ui.js` présente les diagnostics des
  attaques, le détail du score proxy et les informations sur les boss.
  Dépendances explicites injectées :
  `getById`, `doc`, `tr`, `safe`, `numberText`, `exportBuild`.
- Les modules ne changent aucune donnée et n'invoquent pas le moteur
  de calcul ; ils n'effectuent que la présentation.

## Correctif identifié pendant la revue
La fonction `renderAccountIntegration` accédait à `sourceCoverage`
avant sa déclaration `const` quand des monuments étaient détectés.
Cette erreur de temporal dead zone pouvait empêcher d'afficher les
résultats après certaines importations. La variable est désormais
résolue une seule fois **avant** les panneaux monuments et saison.

## Nettoyage des fonctionnalités retirées
- Suppression du rendu des comparaisons automatiques de paires de
  familiers : `renderPetComparisons`, `lastScenarios` et leurs
  événements DOM devenus inaccessibles depuis la PR #55.
- Le public envoie directement `type:"optimize"`; plus de branche
  conditionnelle constante `compare=false`.
- Suppression du rendu public des comparaisons Stage Skip, Pareto Skip
  et dégâts natifs dont les réglages ont été retirés. Les fonctions
  de diagnostic **métier** et leurs tests de qualification internes
  sont conservés sans influencer le scoring ni le parcours normal.
- Maintien des diagnostics réellement utilisés : score proxy,
  canaux d'attaque, explications de puissance du compte et boss.

## Qualité et non-régression
- `tests/frontend-diagnostics-boundary.test.js` simule le DOM et
  reproduit une importation de monuments pour détecter la régression
  de `sourceCoverage`. Il vérifie également l'échappement HTML
  des canaux d'attaque.
- Les anciens tests qui exigeaient la présence de chaînes dans
  `app.js` vérifient désormais leur présence et leur comportement
  dans le module de présentation compétent, sans suppression des
  protections testées.
- Les URL des scripts de l'application sont actualisées dans les
  quatre versions statiques du site.
- Contrôles de syntaxe des modules modifiés et exécution ciblée
  des rendus sur un faux DOM réalisés côté agent.

## Validation finale nécessaire
```powershell
npm run check
npm run bench:22k
npm run bench:issue30
npm run bench:push
```
Ne pas lancer GitHub Actions. Aucun merge dans `main` sans retour
positif sur le commit exact de cette PR.

## Hors périmètre (issue #56 reste ouverte)
- Extraction des autres widgets et du stockage du frontend.
- Tests E2E Playwright sur navigateurs Windows et mobile.
- Compatibilité des mécaniques du jeu et calibration réelle des
  coefficients du proxy, qui sont des tâches distinctes.
