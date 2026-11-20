/**
 * Independent additive Artifact Damage and Monument Damage pools.
 *
 * Artifact Damage raw component: DamageBonus * Level (TT2Master).
 * Monument Damage raw component: DamageBonus ^ (Level ^ DamageExpo).
 * A monument's Source DamageExpo (0.53/0.55 in the v8.4 CSV) controls
 * growth of the EXPONENT of its damage multiplier, not exponentiation
 * of its damage factor by a single numeric 0.53/0.55.
 * This matches the magnitude of observed multi-thousand-order monument
 * bonuses and Game Hive's official v6.11 exponent rebalance.
 *
 * EnchantmentMult is separately recorded. Its precise position in the
 * damage pool's gameplay chain is not proven: the scored baseline excludes
 * that boost and keeps any enchanted result diagnostic-only.
 */
import {positiveLog10} from "./account-artifacts.js?v=20261120-math-safety-r3";
export function log10Sum(logs=[]){
 const values=logs.filter(Number.isFinite);
 if(!values.length)return null;
 const max=Math.max(...values);
 const sum=values.reduce((n,x)=>n+Math.pow(10,x-max),0);
 return max+Math.log10(sum);
}
export function rawDamageLog10(info,level,system){
 const bonus=positiveLog10(info?.damageBonus),lv=positiveLog10(level);
 if(bonus===null||lv===null||lv<0)return null;
 if(system==="artifact")return bonus+lv;
 if(system!=="monument")return null;
 const expo=Number(info?.damageExpo);
 if(!Number.isFinite(expo)||expo<0||bonus<0)return null;
 // log10((DamageBonus)^(Level^DamageExpo))
 // = log10(DamageBonus) * 10^(DamageExpo * log10(Level)).
 // Do NOT exponentiate a log10 score itself. Reject unrepresentable
 // astronomical exponent values instead of returning Infinity or NaN.
 if(bonus===0)return 0;
 const exponentLog10=expo*lv;
 if(!Number.isFinite(exponentLog10)||
    exponentLog10>Math.log10(Number.MAX_VALUE/Math.max(1,bonus)))return null;
 const result=bonus*Math.pow(10,exponentLog10);
 return Number.isFinite(result)?result:null;
}
export function additiveDamageEvidence(artifacts,monuments,artifactCatalog,monumentCatalog){
 const entries=[],rejected=[];
 const add=(system,row,info)=>{
  const raw=rawDamageLog10(info,row.level,system);
  if(raw===null){rejected.push({system,id:row.id,reason:"unrepresentable-damage-scaling"});return}
  const enchantLog10=positiveLog10(info?.enchantedMult??info?.enchantmentMult);
  const enchantMayMatter=enchantLog10!==null&&enchantLog10!==0;
  const enchantKnown=row.enchanted===true||row.enchanted===false;
  const enchantedCandidate=!enchantKnown&&enchantMayMatter?null:
   row.enchanted===true&&enchantLog10!==null?raw+enchantLog10:raw;
  entries.push({system,id:row.id,level:row.level,
   unenchantedLog10:raw,candidateEnchantedLog10:enchantedCandidate,
   enchanted:row.enchanted===true,
   enchantmentKnown:enchantKnown,enchantmentMult:
    info?.enchantedMult??info?.enchantmentMult??null,
   exponent:system==="monument"?Number(info.damageExpo):1,
   sourceFormula:system==="monument"?"DamageBonus^(Level^DamageExpo)":
    "DamageBonus*Level",
   verifiedSumRule:"additive",appliedToScore:false});
 };
 for(const row of artifacts?.entries||[]){
  if(row.level===null||row.status==="conflicting-source-records")continue;
  const info=artifactCatalog[row.id];if(info)add("artifact",row,info);
 }
 for(const row of monuments?.entries||[]){
  if(row.level===null||row.damageEligible===false||!row.categoryAllowed||
    ["ignored-conflicting-export-records","ignored-wrong-transcendence-season",
     "ignored-truncated-monument-export"].includes(row.formulaStatus))continue;
  const info=monumentCatalog[row.id];if(info)add("monument",row,info);
 }
 const pools={};
 for(const [name,system] of [["artifacts","artifact"],["monuments","monument"]]){
  const subset=entries.filter(x=>x.system===system);
  const allCandidateKnown=subset.every(x=>x.candidateEnchantedLog10!==null);
  pools[name]={components:subset.length,
   unenchantedPoolLog10:log10Sum(subset.map(x=>x.unenchantedLog10)),
   candidateEnchantedPoolLog10:allCandidateKnown?
    log10Sum(subset.map(x=>x.candidateEnchantedLog10)):null,
   unresolvedEnchantments:subset.filter(x=>x.candidateEnchantedLog10===null).length,
   excludedUnrepresentable:rejected.filter(x=>x.system===system).length};
 }
 return {...pools,entries,rejected,appliedToScore:false,complete:false,
  warning:"Unenchanted Monument Damage components sum additively. Enchantment multiplier-to-pool relationship is diagnostic only."};
}
