# Audit #56 — version du jeu, saison et description des capacités

## Constat
Le catalogue de l'arbre de compétences est vérifié contre `8.4.0`
(`SkillTreeInfo2.0.csv`, révision de référence `2026-09-18`).
Une importation TT2 8.4.1/8.4.2 pouvait néanmoins être présentée sans
signalement général : la page ne testait que la chaîne `8.4.1`.

La documentation publique indiquait encore que le mode automatique
comparait des familiers alors que la PR #55 avait volontairement
désactivé la comparaison exhaustive des paires.

## Correctifs
- `src/game-version-policy.js` est une frontière de versions pure, avec
  parseur strict, comparaison numérique `major.minor.patch` et provenance
  unique du catalogue. Un suffixe inconnu échoue de manière prudente.
- `parseExport` fournit `versionCompatibility` sans inventer
  une validation complète des mécaniques du compte.
- `src/app.js` signale tout export **plus récent**, plus ancien ou
  de version non reconnue. Messages localisés en EN/FR/UK/RU.
- La date de démarrage saison 14 est désormais lue via
  `VERIFIED_NEXT_SEASON_START_UTC` ; plus de constante UTC dupliquée
  dans le contrôleur d'interface.
- Quatre guides de référence corrigés pour refléter la sélection de
  **un familier possédé par slot**, pas une optimisation exhaustive
  de toutes les paires. Cautions version/saison, `dateModified` de la
  modification réelle du contenu.
- Tokens des modules `engine`, `worker`, `i18n` et de l'entrée HTML
  actualisés de manière cohérente pour éviter le cache ancien.

## Périmètre et limites
- Aucun coefficient de calcul ni table de compétences TT2 n'a été changé.
- Le programme continue à générer un format de build historique
  `Version: 8.4.0`. La compatibilité avec tous les clients plus récents
  **n'est pas certifiée**.
- La saison 14 est renseignée via les données sourcées déjà présentes ;
  l'implémentation ne prétend pas deviner les futures saisons.
- La validation du score de jeu réel demeure une issue indépendante.
- Le serveur et le référencement réel doivent toujours être inspectés
  en production : une inspection statique ne prouve pas l'indexation.

## Qualification attendue avant fusion
```powershell
npm run check
npm run bench:22k
npm run bench:issue30
npm run bench:push
```
Aucune GitHub Action. Valider aussi les liens FR/EN/UK/RU et l'import
d'exports 8.4.0, 8.4.1, 8.4.2.

Suivi : #56, lot compatibilité / SEO, à fusionner après qualification.
