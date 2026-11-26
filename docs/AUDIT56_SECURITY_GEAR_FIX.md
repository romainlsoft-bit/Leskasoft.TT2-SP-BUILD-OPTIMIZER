# Correctifs audit #56 — frontières navigateur et recherche d'équipements

## Portée

Cette PR ne change **aucun coefficient TT2**, aucune saison, aucune formule
mathématique de dégâts/or ni l'option publique de comparaison automatique
des familiers (qui reste désactivée). L'objectif est d'empêcher une entrée
navigateur hostile de se transformer en HTML actif et de supprimer un échec
systématique lorsque le moteur explorait 17 à 32 équipements possibles.

### Validation des liens et du stockage

- `src/build-input-boundary.js` est la frontière commune et testable.
- Les niveaux courants / minimums ne sont acceptés que pour les IDs des
  compétences connues et comme entiers non négatifs sous `MaxLevel`.
- Les exclusions, builds dégâts/or, presets, budgets et paramètres numériques
  sont limités à leurs valeurs acceptées par le produit.
- Les options obsolètes et champs supplémentaires des liens ne sont pas
  importés; les paramètres publics de boss sont toujours imposés ensuite
  par `publicOptimizationSettings`.
- Les liens malformés ou trop longs (max 32 768 caractères pour le fragment)
  échouent sans modifier le build affiché. Les liens *générés* sont
  également validés ; pas de lien invalide copié à l'utilisateur.
- Le stockage local est limité à 4 000 000 caractères, avec restauration
  des clés autorisées uniquement et nettoyage des niveaux. Les profils déjà
  normalisés restent disponibles pour un utilisateur ayant opté pour leur
  conservation dans le navigateur.
- Le DOM `skill-editor` échappe explicitement les deux attributs `value`,
  en complément du contrôle strict précédent.
- Le bouton « Effacer les données TT2 enregistrées » supprime le profil local,
  les préférences et la langue sauvegardée après confirmation et recharge la
  page avec des paramètres vierges.
- Les quatre pages et les imports ESM modifiés disposent d'une clé de cache
  renouvelée.

### Fiabilité et architecture de la recherche d'équipements

- `src/gear-search-policy.js` est l'unique source de
  `MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS=32`.
- Le worker, le générateur cartésien et le solveur couplé utilisent
  cette même limite.
- 17–32 combinaisons admises ne peuvent plus déclencher une exception
  « 1–16 assignments ».
- Au-delà de 32, le moteur conserve son repli sur la recherche couplée
  non exhaustive ; il ne prétend pas explorer des objets inconnus.
- Tests ciblés aux bornes 16/17/32/33, dont un scénario via le Web Worker
  et un solveur factice contrôlé (tous deux indépendants du jeu réel).

### Qualification demandée

```powershell
npm run check
npm run bench:22k
npm run bench:issue30
npm run bench:push
```

Aucune GitHub Action, et **aucune fusion dans main avant validation
complète de cette nouvelle tête de PR**. Les premiers contrôles de syntaxe
et des URL de modules ont été réalisés pendant l'implémentation, mais ne
remplacent pas les tests Node ni une validation manuelle en navigateur.

### Tests complémentaires de navigateur (facultatifs mais recommandés)

1. Ouvrir un lien partagé construit avec un niveau invalide : le formulaire
   doit refuser le chargement, sans exécuter de script ni modifier le build.
2. Restaurer un stockage local corrompu : le site doit ignorer les entrées
   non valides et conserver les préférences saines.
3. Importer un compte, effacer les données puis recharger : aucune section
   de compte ne doit réapparaître sans nouvel import.
4. Confirmer l'affichage FR/EN/UK/RU et les calculs sur des exports 8.4.x.
