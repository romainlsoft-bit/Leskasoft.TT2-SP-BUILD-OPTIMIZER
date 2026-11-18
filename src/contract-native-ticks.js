/**
 * TT2 8.4 native IL2CPP contract tick math. Diagnostic only.
 * ForbiddenContract.ManaBurnBonusEffectLoop (RVA 0x25D3678)
 * RoyalContract.ManaBurnGoldLoop (RVA 0x25D6F94)
 *
 * A 1Hz InvokeRepeating tick advances effectTimeCount, including free ticks.
 * The bonus is maxBonus ^ min(1, effectTimeCount / timeUntilMax).
 * Every charged tick increments manaBurnCount: cost = baseCost * count.
 * Do not infer free ticks, mana regen, runtime-modified bonuses or uptime.
 */
const SAMPLES=Object.freeze([1,2,5,10,30,60]);
const NUM=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function log10Positive(raw){
 if(typeof raw!=="number"&&typeof raw!=="string")return null;
 const str=String(raw).trim();
 if(!NUM.test(str))return null;
 const [mantissa,exp="0"]=str.toLowerCase().split("e");
 const m=Number(mantissa),e=Number(exp);
 if(!(m>0)||!Number.isFinite(m)||!Number.isSafeInteger(e))return null;
 const value=Math.log10(m)+e;
 return Number.isFinite(value)?value:null;
}
const safeNonnegative=x=>{
 if(x==null||x==="")return null;
 const n=Number(x);
 return Number.isFinite(n)&&n>=0?n:null;
};
/**
 * Source-only illustration at explicit tick counts, never measured uptime.
 * freeTicks is optional; when absent costs with free ticks remain null.
 */
export function contractNativeTickSchedule({maximum,baseManaCost,timeUntilMax,
 freeTicks=null,tickSamples=SAMPLES}={}){
 const maxLog=log10Positive(maximum),base=safeNonnegative(baseManaCost);
 const duration=safeNonnegative(timeUntilMax);
 const free=freeTicks===null?null:safeNonnegative(freeTicks);
 const validFree=free===null||Number.isSafeInteger(free);
 if(maxLog===null||base===null||!(duration>0)||!validFree||
   !Array.isArray(tickSamples)||tickSamples.some(x=>!Number.isSafeInteger(x)||x<0)){
  return {status:"unresolved-native-tick-input",samples:[],
   addedToSkillScore:false,actualUptimeVerified:false};
 }
 const samples=tickSamples.map(ticks=>{
  const maxCost=base*ticks*(ticks+1)/2;
  const charged=free===null?null:Math.max(0,ticks-free);
  const withFreeCost=charged===null?null:base*charged*(charged+1)/2;
  return {ticks,bonusLog10:maxLog*Math.min(1,ticks/duration),
   manaSpentIfNoFreeTicks:Number.isFinite(maxCost)?maxCost:null,
   manaSpentIfKnownFreeTicks:Number.isFinite(withFreeCost)?withFreeCost:null,
   chargedTicksIfKnownFreeTicks:charged};
 });
 return {schema:"tt2-native-contract-ticks-v1",status:"source-only-illustration",
  sourceMaxMultiplierLog10:maxLog,sourceBaseManaCostPerChargedTick:base,
  sourceTimeUntilMaxFromBonusModelSeconds:duration,
  effectiveRuntimeTermsVerified:false,
  freeTicksKnown:free!==null,freeTicks:free,
  sampleTickSemantics:"first-tick-immediate-then-one-second-apart",
  samples,addedToSkillScore:false,addedToAccountScore:false,
  actualUptimeVerified:false,actualManaSupplyVerified:false,
  predictsStageGain:false};
}
