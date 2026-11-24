# Fin de la saison 13 de transcendance — état au 24 novembre 2026

## Contexte actuel
Fin de saison confirmée par le joueur. L'E9 Wiki indique le **24 novembre
2026** comme date de fin de la saison 13 (calendrier communautaire,
**pas un horodatage serveur certifié**). Le jeu ramène les comptes au
**plafond normal de 180 000 stages** entre deux saisons.

Game Hive décrit explicitement que les monuments, mementos et pets
transcendants disparaissent au reset, tandis que les familiers Legacy/Exotic
permanents restent présents.

Références :
- Game Hive : https://gamehive.com/blog/devupdate-95-if-i-had-a-million-stages/
- Wiki TT2 : https://tt2.wiki/en/guides/transcendence
- Calendrier : https://e9wiki.com/tt2/en
- Game Hive, roster saison 13 : https://gamehive.com/blog/devlog-231-transcendence-season-13/

## Familiers : catalogues réellement vérifiés sur internet
- 30 familiers permanents dans `vendor/pets.js` :
  tous les noms, types, slots et coefficients ont été comparés aux **30**
  lignes `csv/PetInfo.csv`, SHA Git
  `c6f367e2ec38d7348c44974edde7de3c679ce300`.
  **Aucun nouvel ID permanent à ajouter**.
- 15 références historiques `SeasonalPet1..15` dans
  `vendor/transcendent-pets.js` : concordance totale avec
  `csv/EndgamePetInfo.csv`, SHA Git
  `7d0b47e117a5dadaf2b6774394874791690c83f6`.
- Les 15 pets transcendants sont **inactifs hors saison** et donc
  totalement exclus de `availablePets`, recommandations, pets équipés,
  effets passifs, couplage avec l'équipement et scores de builds, même
  si l'import ancien **ne contient pas de numéro de saison**.
- Les anciens IDs restent dans le catalogue uniquement pour reconnaître
  les données historiques sans les valoriser.

## Stages, monuments, imports et cache
- `CURRENT_MAIN_GAME_STAGE_CAP = 180000` dans
  `src/current-season-policy.js`.
- Tout stage importé, partagé, enregistré ou transmis au worker au-delà
  du plafond est borné à 180 000, sans inventer un stage atteint si la
  valeur importée est inconnue (0).
- À compter du 24/11/2026 dans la politique courante, les monuments
  archivés sont exclus des bonus directs **et** de la contribution
  additive Monument Damage. Les effets journaliers de saison ne
  s'affichent pas comme bonus actuels.
- L'ancien roster et les monuments restent consultables dans les catalogues
  et les tests historiques datés, sans pouvoir entrer dans le score actuel.
- Les imports ESM du frontend et du worker sont versionnés pour éviter
  de réutiliser un module d'avant le reset.

Cette politique **doit être actualisée au lancement confirmé de la
prochaine saison** : ne pas réactiver automatiquement les pets/montants
de la saison 13 sur la base d'un ancien CSV `IsActive`.

## Tests
```bash
node --test tests/post-season13-reset.test.js tests/season-rollover-safety.test.js
npm run check
npm run bench:issue30
```

Aucun GitHub Actions n'est autorisé sur ce dépôt.
