/**
 * Public optimizer contract. Retired controls must never be restored by
 * localStorage, shared links, or a stale worker caller.
 *
 * The boss scenario represents an IDEAL push attempt: conditional effects
 * are enabled only in the model. It does NOT prove in-game uptime.
 *
 * Astral Awakening has at most five orb taps. Its score is already zero
 * when HelperDmgQTE is not purchased (see sourceSkillScoreAtLevel).
 */
export const IDEAL_BOSS_ORB_TAPS=5;
export function publicOptimizationSettings(options={}){
 if(!options||typeof options!=="object"||Array.isArray(options))
  throw new TypeError("Public optimization settings must be an object");
 return {...options,
  assumeHaystActive:true,
  assumeSnapActive:true,
  assumeCoordinatedOffensiveActive:true,
  assumeFlashZipAtBoss:true,
  assumeNightmareAtBoss:true,
  assumeMagnumOpusAtBoss:true,
  astralActivations:IDEAL_BOSS_ORB_TAPS,
  excludeUnverifiedTacticalInsight:false,
  tacticalInsightCalibration:null,
  resolvedTacticalInsightLocal:null,
  pushAttackChannelId:"",
  pushSourceStageSkipTarget:0,
  pushFrontierEnabled:false,
  attackDamageFrontierEnabled:false,
  attackDamageChannelId:"",
  comparePetScenarios:false
 };
}
/** Show only orb taps the selected build can actually activate. */
export function modeledAstralOrbTaps(levels,requested=IDEAL_BOSS_ORB_TAPS){
 return Number(levels?.HelperDmgQTE)>0?
  Math.max(0,Math.min(IDEAL_BOSS_ORB_TAPS,Number(requested)||0)):0;
}
