/**
 * TT2 8.4 Lightning Strike: source-only, conditional boss-HP model.
 * PlayerController.TryLightningAttack native RVA 0x24878C0.
 *
 * The native code checks Bonus 329 (proc chance); on success it multiplies
 * current monster HP by bonus 330 (strike damage fraction) and bonus 331
 * (subsequent-strike efficiency) raised to the current strike counter.
 * The source does NOT provide an observed proc count for an arbitrary boss.
 *
 * DO NOT infer a strike count from clone attack rate or timeToKill. A per-
 * level effect can be compared for a caller-provided hypothetical proc
 * count, but it is not a validated stage or uptime prediction.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-ti-measured-r1";
const TALENT="CritSkillBoost";
function validCount(settings){
 if(settings?.assumeSourceOnlyLightningStrike!==true)return null;
 const n=settings?.lightningStrikeHits;
 return Number.isSafeInteger(n)&&n>=0&&n<=2000?n:null;
}
function effectAt(level,hits){
 const info=skillInfo[TALENT];
 const a=Number(info["A"+level]),b=Number(info["B"+level]);
 if(!(a>=0&&a<1&&b>=0&&b<=1&&Number.isFinite(a)&&Number.isFinite(b)))
  throw new RangeError("TT2 Lightning Strike source A/B out of modeled bounds");
 let score=0,p=a;
 for(let i=0;i<hits;i++){
  if(p>=1)throw new RangeError("TT2 Lightning Strike saturated hit fraction");
  score-=Math.log1p(-p)/Math.LN10;
  p*=b;
 }
 return score;
}
export function lightningStrikeSkillScore(level,settings={}){
 const cap=Number(skillInfo[TALENT].MaxLevel);
 if(!Number.isSafeInteger(level)||level<0||level>cap)
  throw new RangeError("Invalid TT2 Lightning Strike level");
 if(level===0)return 0;
 const hits=validCount(settings);
 if(hits===null)return 0;
 return effectAt(level,hits)-effectAt(0,hits);
}
export function lightningStrikeEvidence(levels={},settings={}){
 const level=Number(levels[TALENT]??0);
 const cap=Number(skillInfo[TALENT].MaxLevel);
 if(!Number.isSafeInteger(level)||level<0||level>cap)
  return {schema:"tt2-lightning-strike-source-v1",status:"invalid-skill-level",
   modeledScoreLog10:null,addedToFixedAccount:false,actualUptimeVerified:false};
 const n=validCount(settings),source=skillInfo[TALENT];
 const modeled=n!==null&&level>0;
 return {schema:"tt2-lightning-strike-source-v1",level,
  sourceBonusTypes:["LightningStrikeChance","LightningStrikeDamage",
   "LightningStrikeEfficiency"],
  chanceBase:source.BonusAmountD,
  damageFraction:source["A"+level],efficiency:source["B"+level],
  hitsAssumed:n,sourceOnlyScenario:modeled,
  modeledScoreLog10:modeled?lightningStrikeSkillScore(level,settings):0,
  status:modeled?"explicit-unverified-hit-scenario":
   level>0?"missing-observed-lightning-strike-count":"not-invested",
  actualUptimeVerified:false,
  statusFromNative:true,
  countInferredFromShadowClone:false,
  addedToFixedAccount:false,predictsStageGain:false};
}
