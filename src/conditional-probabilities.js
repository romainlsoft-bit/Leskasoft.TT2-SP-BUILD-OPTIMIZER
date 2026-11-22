/**
 * Explicit, final probability observations from TT2 8.4 exports.
 *
 * A displayed percent is a chance, not a gold/damage multiplier.
 * Bare numeric "Chance" fields have ambiguous units (0.5 vs 50%) and
 * are never silently normalized. No proc rate is inferred from skills.
 */
import {skillInfo} from "../vendor/skills.js?v=20261122-combat-window-r1";
import {positiveLog10} from "./account-artifacts.js?v=20261122-combat-window-r1";

// These are the 8.4 SkillTreeInfo2.0.csv B effects expressed as fractions:
// Cleaving Strike, Transmutation, Love Potion (NOT Ambush, whose B is
// extra monster COUNT). Only a documented additive what-if, never a rate
// inherited unmodified by a redistributed tree.
const CHANCE_TALENTS=Object.freeze({
 critical:"HeavyStrikes",jackpot:"Transmutation",multipleTitan:"LovePotion"
});
export function sourceChanceDelta(family,currentLevels={},candidateLevels={}){
 const id=CHANCE_TALENTS[family],row=skillInfo[id];
 if(!row||!Object.hasOwn(currentLevels,id)||!Object.hasOwn(candidateLevels,id))
  return {verifiable:false,delta:null,reason:"both-skill-levels-required"};
 const read=levels=>{
  const n=Number(levels[id]);
  if(!Number.isSafeInteger(n)||n<0||n>Number(row.MaxLevel))return null;
  const value=row["B"+n];
  if(value===undefined||value==="-"||value===null)return null;
  const parsed=Number(value);
  return Number.isFinite(parsed)&&parsed>=0&&parsed<=1?parsed:null;
 };
 const before=read(currentLevels),after=read(candidateLevels);
 return before===null||after===null?
  {verifiable:false,delta:null,reason:"unknown-source-skill-row"}:
  {verifiable:true,delta:after-before,sourceSkill:id,
   beforeSourceChance:before,afterSourceChance:after,
   source:"8.4 SkillTreeInfo2.0.csv: BonusTypeB",
   reason:null};
}

// For two possible *observed* outcomes with multiplier M on success,
// E = (1-p) + pM. Work in log10 to avoid 1e9999 overflowing doubles.
export function binaryExpectedMultiplierLog10(chance,multiplierLog10){
 if(typeof chance!=="number"||chance<0||chance>1||
    !Number.isFinite(chance)||!Number.isFinite(multiplierLog10))
  return null;
 if(chance===0)return 0;
 if(chance===1)return multiplierLog10;
 const x=Math.log10(1-chance);
 const y=Math.log10(chance)+multiplierLog10;
 const hi=Math.max(x,y);
 return hi+Math.log10(Math.pow(10,x-hi)+Math.pow(10,y-hi));
}
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
export function resolveConditionalProbabilityEvidence(profile,settings={},gear={},candidateLevels=null){
 const observed=profile?.chanceEvidence??parseFinalChanceEvidence({});
 const result={};
 for(const family of Object.keys(FAMILIES)){
  const entry=observed.families?.[family]||{fraction:null,status:"not-exported"};
  // Heavenly Strike crit is guaranteed by Angelic Radiance. This is not
  // a player-observed critical chance and does not change the others.
  const guaranteed=family==="critical"&&settings.damage==="Heavenly Strike";
  const fraction=guaranteed?1:entry.fraction;
  const delta=sourceChanceDelta(family,settings.currentLevels||{},candidateLevels||{});
  const hypothetical=entry.fraction!==null&&delta.verifiable?
   entry.fraction+delta.delta:null;
  // If an imported chance is already capped, subtracting skill fractions
  // would not reconstruct the underlying uncapped game stat. Keep unknown.
  const hypotheticalUncapped=hypothetical!==null&&hypothetical>=0&&
   hypothetical<=1?hypothetical:null;
  result[family]={observedFraction:entry.fraction??null,
   sourceTalentDelta:delta,
   candidateChanceIfUncapped:hypotheticalUncapped,
   candidateChanceVerified:false,
   candidateProjectionReason:hypothetical===null?
    "missing-observed-or-talent-level":hypotheticalUncapped===null?
    "projected-chance-outside-0-to-1":"assumes-unclamped-additive-chances",
   effectiveEventFraction:fraction??null,
   guaranteedByBuild:guaranteed,
   expectedEventsPer100Eligible:fraction===null?null:100*fraction,
   status:guaranteed?"guaranteed-heavenly-strike-critical":
    entry.status||"not-exported",
   source:guaranteed?"Angelic Radiance guaranteed critical hit":"explicit-observed-export-percent",
   multiplierOrGoldDistributionVerified:false,appliedToScore:false};
 }
 const jackpotLog=positiveLog10(profile?.stats?.jackpotGoldMultiplier);
 const jackpotObserved=result.jackpot.observedFraction;
 const jackpotExpected=jackpotLog!==null&&jackpotObserved!==null?
  binaryExpectedMultiplierLog10(jackpotObserved,jackpotLog):null;
 // This is a generic *single eligible event* expectation. An imported
 // multiplier can itself contain skill-dependent effects; never migrate
 // it into candidate-tree gold, nor assign it to all gold sources.
 const petEvolutionLevel=candidateLevels?.PetDmg;
 const reduction=petEvolutionLevel===undefined?null:
  Number(skillInfo.PetDmg?.["B"+petEvolutionLevel]);
 const tapsPerPetAttack=Number.isFinite(reduction)&&reduction>=0&&
  reduction<20?20-reduction:null;
 return {schema:"tt2-conditional-proc-evidence-v1",families:result,
  jackpotBinaryEvent:{
   exportedMultiplierLog10:jackpotLog,
   observedExpectedMultiplierLog10:jackpotExpected,
   appliesToAllGoldEvents:false,
   candidateTreeMultiplierKnown:false,
   contributionToSkillOrGoldScore:0
  },
  petAttackCadence:{
   tapsPerAttackFromPetEvolution:tapsPerPetAttack,
   autoAttacksPerSecond:null,actualTapRatePerSecond:null,
   attacksPerSecondVerified:false,petAttackDamagePerHitLog10:null,
   source:"8.4 Pet Evolution B: taps removed from baseline 20",
   scoredAsIndependentPetDPS:false
  },
  conditionalGearSecondaries:gear?.secondaryConditionalCount??0,
  recordedChances:Object.values(observed.families||{}).filter(x=>x.present).length,
  numericallyObserved:Object.values(observed.families||{}).filter(x=>x.fraction!==null).length,
  guaranteedCritForHeavenlyStrike:settings.damage==="Heavenly Strike",
  expectedGoldOrStageBonusLog10:null,probabilitiesAppliedToScore:false,
  complete:false};
}
