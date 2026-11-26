# Optimiseur public — scénario idéal de boss (26 novembre 2026)

## Choix produit

L'interface utilisateur ne propose plus d'interrupteurs de scénario temporaire.
Les calculs **publics** supposent que le joueur synchronise son push final avec
Hayst, Snap, Coordinated Offensive, Flash Zip, Nightmare Damage et Magnum Opus
(chacun selon son build). C'est une **hypothèse d'optimisation volontairement
optimiste**, PAS une preuve de disponibilité simultanée, de durée d'effet,
de DPS observé ou de gain réel en stages.

La fonction `publicOptimizationSettings` applique ce contrat dans l'application
et dans le worker, y compris si un ancien lien, une session sauvegardée ou un
appel direct au worker transmet des valeurs désormais périmées.

## Astral Awakening

Le niveau de `HelperDmgQTE` ne change pas la limite du modèle : cinq
activations d'orbes au maximum. Le multiplicateur attribué aux orbes reste
celui des lignes natives du skill, pondéré par le nombre de taps du scénario
idéal. Le résultat rapporte **0** si la compétence n'a pas été achetée
et **5** lorsqu'elle est présente. Aucune activation n'est créditée
sur un build de niveau zéro.

## Paramètres retirés

- Les deux outils Tactical Insight (désactivation du coefficient
  communautaire et calibration à deux mesures) ne sont plus proposés.
  **Le coefficient communautaire normal est conservé**, avec son statut
  de modèle non calibré ; les fonctions internes de diagnostic restent
  testables.
- Objectif Stage Skip, Pareto Stage Skip et alternatives de dégâts natifs :
  absents de l'interface et désactivés dans les requêtes publiques.
  Leurs modules internes sont conservés sans impact sur le calcul standard.
- Comparaison exhaustive des couples de familiers désactivée. Les slots
  explicitement choisis restent fixes. Chaque slot « Automatique »
  sélectionne un **unique familier possédé, compatible et classé** à partir
  des bonus modélisés. Le classement initial ne prétend pas explorer toutes
  les synergies possibles entre couples de familiers.
- L'inventaire d'équipements peut maintenant être exploré exhaustivement
  jusqu'à **32 configurations admissibles** (au lieu de 16) lorsque les
  données sont complètes. Cela peut ralentir la recherche mais améliore
  la couverture des configurations d'équipement.

## Audit de score / invariants

Le résultat utilise la somme en log10 des contributions *distinctes* :
compétences optimisées, compte fixe, équipement choisi, familiers actifs
au-delà de leurs passifs, et baseline des six sorts sélectionnés. Les
contributions conditionnelles sont accordées uniquement à leur
compétence et à leur source de dégâts admissible. Les cooldowns, taux
d'occasions et stacks inconnus ne deviennent pas artificiellement des
multiplicateurs de coups. Le moteur conserve sa vérification de
reconstruction additive et ses bornes de DP.

Les 18 routes (6 dégâts x 3 sources d'or) sont couvertes par les nouvelles
régressions de scénario public, ainsi que la stricte compatibilité des
familiers, les anciennes sessions et les limites des orbes.

### Qualification

La revue statique des fichiers modifiés et des URL des quatre pages est
effectuée. **La suite `npm run check` et les benchmarks sur le nouveau
commit doivent être exécutés localement avant fusion.** GitHub Actions
sont interdits. La validation technique ne remplace pas le test en jeu.
