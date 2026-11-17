/**
 * Separate additive "Artifact Damage" and "Monument Damage" pools.
 * TT2Master: Artifact.ADBoost = DamageBonus * Level.
 * Monument schema: DamageBonus * Level^DamageExpo, a distinct exponent.
 * Lemmingllama: monument damage stacks additively, not multiplicatively.
 *
 * EnchantmentMult is intentionally calculated as a separate candidate factor:
 * exact end-to-end interaction with the damage pool is still unverified.
 * These quantities are diagnostics and DO NOT enter the optimizer score.
 */
import {positiveLog10} from "./account-artifacts.js";
export function log10Sum(logs=[]){
 const values=logs.filter(Number.isFinite);
 if(!values.length)return null;
 const max=Math.max(...values);
 return max+Math.log10(values.reduce((sum,x)=>sum+Math.pow(10,x-max),0));
}
export function rawDamageLog10(info,level,system){
 const bonus=positiveLog10(info?.damageBonus),lvl=positiveLog10(level);
 const exponent=system==="monument"?Number(info?.damageExpo):1;
 if(bonus===null||lvl===null||!Number.isFinite(exponent)||exponent<0)return null;
 return bonus+exponent*lvl;
}
export function additiveDamageEvidence(artifacts,monuments,artifactCatalog,monumentCatalog){
 const entries=[],rejected=[];
 const add=(system,row,info)=>{
  const log10=rawDamageLog10(info,row.level,system);
  const rawEnch=positiveLog10(info?.enchantedMult??info?.enchantmentMult);
  const enchantChanged=rawEnch!==null&&rawEnch!==0;
  if(log10===null){rejected.push({system,id:row.id,reason:"unreadable-damage-data"});return}
  if(row.enchanted===null&&enchantChanged){
   rejected.push({system,id:row.id,reason:"unknown-enchantment-state"});return;
  }
  const hypotheticalEnchantDamageLog10=row.enchanted===true&&rawEnch!==null?log10+rawEnch:log10;
  entries.push({system,id:row.id,level:row.level,
   unenchantedLog10:log10,
   candidateEnchantedLog10:hypotheticalEnchantDamageLog10,
   enchantmentMult:info?.enchantedMult??info?.enchantmentMult??null,
   exponent:system==="monument"?Number(info.damageExpo):1,
   verifiedSumRule:"additive",
   appliedToScore:false});
 };
 for(const row of artifacts?.entries||[]){
  if(row.level===null||row.status==="conflicting-source-records")continue;
  const info=artifactCatalog[row.id];if(info)add("artifact",row,info);
 }
 for(const row of monuments?.entries||[]){
  if(row.level===null||!row.categoryAllowed||
     ["ignored-conflicting-export-records","ignored-wrong-transcendence-season"].includes(row.formulaStatus))continue;
  const info=monumentCatalog[row.id];if(info)add("monument",row,info);
 }
 const art=entries.filter(x=>x.system==="artifact");
 const mon=entries.filter(x=>x.system==="monument");
 return {
  artifacts:{components:art.length,unenchantedPoolLog10:log10Sum(art.map(x=>x.unenchantedLog10)),
   candidateEnchantedPoolLog10:log10Sum(art.map(x=>x.candidateEnchantedLog10))},
  monuments:{components:mon.length,unenchantedPoolLog10:log10Sum(mon.map(x=>x.unenchantedLog10)),
   candidateEnchantedPoolLog10:log10Sum(mon.map(x=>x.candidateEnchantedLog10))},
  entries,rejected,appliedToScore:false,
  complete:false,
  warning:"Additive pool contributions are separate from main bonus. The enchantment multiplier-to-pool relationship is diagnostic, not confirmed for the score."
 };
}
