/**
 * Explicit, final probability observations from TT2 8.4 exports.
 *
 * A displayed percent is a chance, not a gold/damage multiplier.
 * Bare numeric "Chance" fields have ambiguous units (0.5 vs 50%) and
 * are never silently normalized. No proc rate is inferred from skills.
 */
const FAMILIES=Object.freeze({
 critical:Object.freeze(["Critical Chance","CriticalChance","Crit Chance","CritChance","Critical Chance %","CritChancePercent"]),
 jackpot:Object.freeze(["Jackpot Gold Chance","JackpotGoldChance","Jackpot Chance","JackpotChance","Jackpot Gold Chance %","JackpotChancePercent"]),
 multipleTitan:Object.freeze(["Multiple Titan Chance","MultipleTitanChance","Multi Titan Chance","MultiTitanChance","MultiMonstersChance","Multiple Titan Chance %","MultiTitanChancePercent"])
});
const fractionOf=value=>{
 if(typeof value!=="string"&&typeof value!=="number")return null;
 const text=String(value).trim();
 // A "%" explicitly fixes the unit; numeric values without the unit
 // are allowed only on an alias explicitly ending in Percent or "%".
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(text))return null;
 const number=Number(text);
 return Number.isFinite(number)&&number>=0&&number<=100?number/100:null;
};
function readProbability(value,alias){
 const isPercentAlias=alias.endsWith("Percent")||alias.endsWith("%");
 if(typeof value==="string"&&value.trim().endsWith("%"))
  return fractionOf(value.trim().slice(0,-1).trim());
 if(value&&typeof value==="object"&&!Array.isArray(value)&&
    Object.hasOwn(value,"percent"))return fractionOf(value.percent);
 if(isPercentAlias)return fractionOf(value);
 return null;
}
export function parseFinalChanceEvidence(data={}){
 const sources=[["playerStats",data?.playerStats],["stats",data?.stats],["root",data]];
 const families={};
 for(const [family,aliases] of Object.entries(FAMILIES)){
  const found=[];
  for(const [source,object] of sources){
   if(!object||typeof object!=="object"||Array.isArray(object))continue;
   for(const alias of aliases){
    if(!Object.hasOwn(object,alias)||object[alias]===undefined||object[alias]===null)continue;
    const value=readProbability(object[alias],alias);
    found.push({source,field:alias,fraction:value,valid:value!==null});
   }
  }
  const valid=found.length>0&&found.every(x=>x.valid);
  const distinct=new Set(found.filter(x=>x.valid).map(x=>x.fraction.toPrecision(13)));
  const conflict=valid&&distinct.size>1;
  families[family]={present:found.length>0,
   fraction:valid&&!conflict?found[0].fraction:null,
   percent:valid&&!conflict?found[0].fraction*100:null,
   status:!found.length?"not-exported":!valid?"ambiguous-or-invalid-percent":
    conflict?"conflicting-observed-percent":"explicit-percent-observed",
   fields:found.map(x=>({source:x.source,field:x.field,valid:x.valid})),
   includedInScore:false};
 }
 return {schema:"tt2-final-chance-evidence-v1",families,
  complete:Object.values(families).every(x=>x.fraction!==null),
  source:"explicit-export-only",includedInScore:false};
}

/**
 * Probabilities alone do not establish event-specific Jackpot/Multiple
 * Titan multipliers, independent proc distributions or stage encounters.
 * Expected successes per 100 identical eligible opportunities follows
 * directly from linearity; it is NOT expected gold, stages or uptime.
 */
export function resolveConditionalProbabilityEvidence(profile,settings={},gear={}){
 const observed=profile?.chanceEvidence??parseFinalChanceEvidence({});
 const result={};
 for(const family of Object.keys(FAMILIES)){
  const entry=observed.families?.[family]||{fraction:null,status:"not-exported"};
  // Heavenly Strike crit is guaranteed by Angelic Radiance. This is not
  // a player-observed critical chance and does not change the others.
  const guaranteed=family==="critical"&&settings.damage==="Heavenly Strike";
  const fraction=guaranteed?1:entry.fraction;
  result[family]={observedFraction:entry.fraction??null,
   effectiveEventFraction:fraction??null,
   guaranteedByBuild:guaranteed,
   expectedEventsPer100Eligible:fraction===null?null:100*fraction,
   status:guaranteed?"guaranteed-heavenly-strike-critical":
    entry.status||"not-exported",
   source:guaranteed?"Angelic Radiance guaranteed critical hit":"explicit-observed-export-percent",
   multiplierOrGoldDistributionVerified:false,appliedToScore:false};
 }
 return {schema:"tt2-conditional-proc-evidence-v1",families:result,
  conditionalGearSecondaries:gear?.secondaryConditionalCount??0,
  recordedChances:Object.values(observed.families||{}).filter(x=>x.present).length,
  numericallyObserved:Object.values(observed.families||{}).filter(x=>x.fraction!==null).length,
  guaranteedCritForHeavenlyStrike:settings.damage==="Heavenly Strike",
  expectedGoldOrStageBonusLog10:null,probabilitiesAppliedToScore:false,
  complete:false};
}
