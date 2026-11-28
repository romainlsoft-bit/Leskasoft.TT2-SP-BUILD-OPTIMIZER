/** Post-solve attribution of the existing skill proxy. Never changes allocations or scores. */
import {tacticalInsightRecommendationSensitivity} from "./tactical-insight-sensitivity.js?v=20261123-boss-specials-r1&season=20261126-season14-r1&audit=20261123-ti-sensitivity-r1&dimensional=20261127-r1&poisonsprout=20261127-r1&proccoupling=20261127-r1&tithreshold=20261127-r1&integrity=20261127-r2&procfloors=20261128-r1";
import {spellEffectScorable,ACTIVE_SOURCE_SKILL_SPELLS} from "./spell-scenarios.js?v=20261123-boss-specials-r1";

export function buildModelAttribution({result,current,scoreCache,scoreContext,tiLocal,settings,SKILL_IDS,skillInfo,BRANCH_NAMES,GAME_VERSION}){
  // Explain the existing additive skill proxy without pretending that
  // a dominant coefficient establishes actual boss DPS. Same audit for
  // ALL six damage builds and three gold choices, with no change to DP.
  const skillAttribution=SKILL_IDS.filter(id=>result.levels[id]>0).map(id=>{
    const before=current[id],after=result.levels[id],scores=scoreCache.get(id);
    return {id,name:skillInfo[id].Name,branch:BRANCH_NAMES[skillInfo[id].Branch],
      level:after,priorLevel:before,sourceBonusTypeA:skillInfo[id].BonusTypeA,
      scoreLog10:scores[after],priorScoreLog10:scores[before],
      changeLog10:scores[after]-scores[before],
      conditionalSourceUnverified:id==="HelperBoost"||
       ["ForbiddenContract","RoyalContract","TerrifyingPact",
        "QuickFortune","PhilosophersFlux","HelperDmgSkillBoost",
        "ClanShipVoltage","CriticalHit","HelperInspiredWeaken","ClanShipStun",
        "Transmutation","TwilightGatheringMultiCastSkill","BossTimer",
        "MultiMonsters","PoisonedBlade","KratosSummon","LoadedDice","LovePotion",
        ].includes(id)||
       (id==="HeavyStrikes"&&scoreContext.damage!=="Heavenly Strike")};
  });
  const byBranch=Object.fromEntries(Object.values(BRANCH_NAMES).map(name=>[
    name,skillAttribution.filter(row=>row.branch===name)
     .reduce((sum,row)=>sum+row.scoreLog10,0)
  ]));
  const scoredTotal=skillAttribution.reduce((sum,row)=>sum+row.scoreLog10,0);
  const modelAttribution={schema:"tt2-skill-model-attribution-v1",
    entries:skillAttribution,byBranch,
    top:[...skillAttribution].sort((a,b)=>b.scoreLog10-a.scoreLog10).slice(0,8),
    scoredTotalLog10:scoredTotal,dpScoreLog10:result.score,
    additiveReconstructionMatches:Math.abs(scoredTotal-result.score)<=
     1e-7*Math.max(1,Math.abs(result.score)),
    sourceOnly:true,gameplayCalibrationVerified:false,
    nativeConditionalScoringGuards:{
      schema:"tt2-84-native-conditional-guards-v1",
      warCryScoredOnlyWhenSelected:spellEffectScorable("HelperBoost",scoreContext),
      thunderVolleyScoredOnlyWhenSelected:
        spellEffectScorable("ThunderVolley",scoreContext),
      streamOfBladesScoredOnlyWhenSelected:
        spellEffectScorable("StreamOfBlades",scoreContext),
      emberArtsFireSwordScoredOnlyWhenEquipped:
        spellEffectScorable("TapBoost",scoreContext),
      transmutationIsConditionalEventExpectation:true,
      transmutationDoesNotCreditFullJackpotAsAlwaysOn:true,
      multicastInventedTenfoldPerChargeRemoved:true,
      multicastGuessedMidasGoldTableRemoved:true,
      twilightGloomSpecialCNotScoredWithoutEvidence:true,
      cleavingStrikeGuaranteedCritOnlyForHeavenlyStrike:true,
      cleavingStrikeOtherBuildsUseSourceOnlyCritChance:true,
      importedCriticalChanceNotUsedForAlternativeTrees:true,
      ambushGoldNotCreditedOnEveryChestersonEvent:true,
      ambushMaximumTitanCountNotUsedAsEncounterChance:true,
      sourceSpellScoringBySkill:Object.fromEntries(
        Object.entries(ACTIVE_SOURCE_SKILL_SPELLS).map(([id,spell])=>
          [id,spellEffectScorable(spell,scoreContext)])),
      coordinatedOffensiveActiveAssumed:
        scoreContext.assumeCoordinatedOffensiveActive===true,
      flashZipChargedAtBossAssumed:scoreContext.assumeFlashZipAtBoss===true,
      nightmareSpecialAtBossAssumed:scoreContext.assumeNightmareAtBoss===true,
      magnumOpusActiveAtBossAssumed:scoreContext.assumeMagnumOpusAtBoss===true,
      specialAttemptRateNeverCountedAsHitDamage:true,
      specialCooldownOpportunitiesNotAddedToDamageScore:true,
      thunderVolleySpecialHitAssumed:
        scoreContext.assumeThunderVolleySpecialHit===true,
      daggerMarkedTargetAssumed:
        scoreContext.assumeDaggerTargetMarked===true,
      inspiredHelpersActiveAssumed:
        scoreContext.assumeInspiredHelpersActive===true,
      heroInspiredCountNotMultipliedIntoDamage:true,
      shadowCloneAttackRateNotConvertedToDamage:true,
      nativeDamageSourceTablesVersion:GAME_VERSION,
      verifiedRealStageImprovement:false
    },
    tacticalInsightCommunityWeightExcluded:tiLocal.enabled||
      settings.excludeUnverifiedTacticalInsight===true,
    tacticalInsightMode:tiLocal.enabled?"measured-local":
      settings.excludeUnverifiedTacticalInsight===true?"excluded":"community",
    tacticalInsightLocal:tiLocal.enabled?tiLocal:null,
    optimizerScoreChanged:tiLocal.enabled||
      settings.excludeUnverifiedTacticalInsight===true};
  modelAttribution.tacticalInsightSensitivity=
   tacticalInsightRecommendationSensitivity(current,result.levels,scoreContext);
  return modelAttribution;
}
