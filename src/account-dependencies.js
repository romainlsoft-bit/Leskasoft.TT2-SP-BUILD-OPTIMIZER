/**
 * Explicit source-driven dependency discovery. A set's bonus metadata is
 * NOT silently promoted to a numerical effect without a verified formula.
 * The graph is a DAG of dependency *classes*, not an invented skill model.
 */
import {ARTIFACT_CATALOG,EQUIPMENT_SET_CATALOG,SEASON_ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {resolveSetCompletionDates,resolveTranscendenceAge,heroWeaponEvidence} from "./account-temporal.js";
import {clanScrollEvidence} from "./account-scrolls.js";
import {extractTimedSetPower} from "./account-set-bonuses.js";
import {resolveUniqueOwnership} from "./account-unique.js";
import {resolveMonumentEvidence} from "./account-monuments.js";
import {calculatePermanentArtifactEffects} from "./account-artifacts.js";
import {additiveDamageEvidence} from "./account-damage-pools.js";
import {resourceResearchEvidence} from "./account-research-resources.js?v=20261117-resource-integrity";
import {resolveGemstoneEvidence} from "./account-gemstones.js?v=20261117-pet-gemstone-chain";

const object=x=>x&&typeof x==="object";
const byName=(catalog,value)=>{
 const key=String(value??"").trim();
 return catalog[key]||Object.values(catalog).find(x=>x.name?.toLowerCase()===key.toLowerCase())||null;
};
export function bonusDependence(type){
 const b=String(type??"");
 if(/GemstoneLevel/i.test(b))return "gemstoneEffectiveLevels";
 if(/(?:ActivePetLevel|PetLevel|LegacyPetDamageEffect|ExoticPetDamageEffect)/i.test(b))return "petEffectiveLevels";
 if(/(?:Equipment|SwordBoost|HelmetBoost|ArmorBoost|AuraBoost|SlashBoost)/i.test(b))return "equipmentEffectiveBonuses";
 if(/(?:HeroWeapon|HelperWeapon|ClanScroll|HeroSkill)/i.test(b))return "heroEffectiveLevels";
 if(/(?:SkillTree|SkillAmount|SkillCap|MultiCast|BonusBoost|Contract|Mana|Cooldown|Spell)/i.test(b))return "skillEffects";
 if(/(?:Gold|Damage|Relic|HP|Crit|Titan)/i.test(b))return "finalBuildPower";
 return "unknown";
}
const NODES=Object.freeze([
 {id:"accountInventory",after:[]},
 {id:"ownedSetEffects",after:["accountInventory"]},
 {id:"uniquePermanentEffects",after:["accountInventory"]},
 {id:"heroWeaponCollections",after:["accountInventory","ownedSetEffects","uniquePermanentEffects"]},
 {id:"clanScrollCollections",after:["accountInventory","ownedSetEffects"]},
 {id:"artifactEffects",after:["accountInventory","ownedSetEffects","uniquePermanentEffects"]},
 {id:"equipmentGrantedLevels",after:["accountInventory","ownedSetEffects"]},
 {id:"gemstoneEffectiveLevels",after:["ownedSetEffects","artifactEffects","equipmentGrantedLevels"]},
 {id:"heroEffectiveLevels",after:["ownedSetEffects","artifactEffects","heroWeaponCollections","clanScrollCollections"]},
 {id:"petEffectiveLevels",after:["gemstoneEffectiveLevels","equipmentGrantedLevels","ownedSetEffects","artifactEffects"]},
 {id:"equipmentEffectiveBonuses",after:["gemstoneEffectiveLevels","equipmentGrantedLevels","heroEffectiveLevels","ownedSetEffects","artifactEffects","petEffectiveLevels"]},
 {id:"skillEffects",after:["petEffectiveLevels","equipmentEffectiveBonuses","heroEffectiveLevels"]},
 {id:"finalBuildPower",after:["skillEffects","equipmentEffectiveBonuses","gemstoneEffectiveLevels"]}
]);
export function accountDependencyGraph(profile){
 const sets=[],artifacts=[],unknown=[];
 const setDates=resolveSetCompletionDates(profile);
 const timedSetPower=extractTimedSetPower(profile);
 const timedByKey=new Map(timedSetPower.entries.map(x=>[x.setId+"|"+x.bonusType,x]));
 const transcendence=resolveTranscendenceAge(profile);
 const heroWeapons=heroWeaponEvidence(profile);
 const clanScrolls=clanScrollEvidence(profile);
 const researchResources=resourceResearchEvidence(profile);
 const gemstones=resolveGemstoneEvidence(profile);
 const monuments=resolveMonumentEvidence(profile);
 const permanentArtifacts=calculatePermanentArtifactEffects(profile,ARTIFACT_CATALOG);
 const additiveDamage=additiveDamageEvidence(permanentArtifacts,monuments,
  ARTIFACT_CATALOG,SEASON_ARTIFACT_CATALOG);
 const knownArtifacts=new Map(permanentArtifacts.entries.map(x=>[x.id,x]));
 const uniqueEquipment=resolveUniqueOwnership(profile);
 const uniqueOwned=new Set(uniqueEquipment.ownedIds);
 for(const id of new Set(profile?.ownedSetIds||[])){
  const data=byName(EQUIPMENT_SET_CATALOG,id);
  if(!data){unknown.push({system:"set",id,reason:"not-in-dataset"});continue;}
  if(data.type==="Unique")uniqueOwned.add(data.id);
  sets.push({id:data.id,kind:data.type,enabled:data.enabled,
   permanentAfterSale:true,ownershipSource:"unlocked-set-collection",
   completion:setDates[id]||null,
   effects:data.bonuses.map(effect=>{
    const perDay=effect.perDay===true;
    return {type:effect.type,dependsOn:bonusDependence(effect.type),
     rawAmount:effect.amount,rawInc:effect.inc,rawExpo:effect.expo,
     perDay,maxValue:effect.maxValue??null,
     numericalStatus:perDay
      ?timedByKey.get(data.id+"|"+effect.type)?.status??"ignored-unmapped-time-effect"
      :"requires-verified-scaling"};
   })});
 }

 // Permanent artifacts and transient Transcendence monuments are distinct.
 for(const entry of profile?.sections?.artifacts?.records||[]){
  const item=byName(ARTIFACT_CATALOG,entry.id);
  if(!item){unknown.push({system:"artifacts",id:entry.id,reason:"not-in-dataset"});continue;}
  artifacts.push({id:item.id,name:item.name,level:entry.level??null,
   enchanted:entry.enchanted??null,type:item.bonusType,
   dependsOn:bonusDependence(item.bonusType),perSeasonDay:false,
   seasonDays:null,
   numericalStatus:knownArtifacts.get(item.id)?.status??"requires-verified-artifact-formula"});
 }
 for(const item of monuments.entries){
  artifacts.push({id:item.id,name:item.name,level:item.level,
   enchanted:item.enchanted,type:item.type,category:item.category,
   dependsOn:bonusDependence(item.type),perSeasonDay:item.perSeasonDay,
   seasonDays:item.seasonDays,monument:true,numericalStatus:item.formulaStatus,
   enchantedMagnitude:item.enchantmentMagnitude,appliedToScore:item.appliedToScore});
 }
 for(const item of monuments.unknown)
  unknown.push({system:item.section,id:item.id,reason:item.reason});
 const seen=new Set();
 for(const node of NODES){
  for(const parent of node.after)if(!seen.has(parent))
   throw new Error("Invalid dependency order: "+parent+" → "+node.id);
  seen.add(node.id);
 }
 // Unique items only in owned inventory do not occur in the completed-set
 // section; account for their unresolved permanent effects exactly once.
 const setIds=new Set(sets.map(x=>x.id));
 const additionalUniqueEffects=[...uniqueOwned].filter(id=>!setIds.has(id))
  .reduce((sum,id)=>sum+(EQUIPMENT_SET_CATALOG[id]?.bonuses?.length||0),0);
 const groups=[...new Set([...sets.flatMap(s=>s.effects.map(e=>e.dependsOn)),
  ...artifacts.map(a=>a.dependsOn)])];
 return {nodes:NODES,order:NODES.map(n=>n.id),sets,artifacts,groups,unknown,
  uniquePermanentOwnership:[...uniqueOwned].sort(),uniqueEquipment,heroWeapons,clanScrolls,transcendence,monuments,permanentArtifacts,additiveDamage,researchResources,gemstones,
  ignoredTimedEffects:timedSetPower.omitted,
  timedSetPower:{calculated:timedSetPower.calculated,applied:timedSetPower.applied,omitted:timedSetPower.omitted},
  ready:false,unmodeledEffects:
   sets.reduce((sum,x)=>sum+x.effects.length,0)+additionalUniqueEffects+
   artifacts.length-timedSetPower.applied-permanentArtifacts.scored-monuments.modeled,
  warning:"Source catalog and dependency order are known; numerical effect formulas and stacking are not fully validated."};
}

/**
 * Calculate the minimal downstream invalidation set on input changes.
 * Cannot create new effects or resolve unknown stacking rules.
 */
export function invalidateAccountNodes(changed=[],stages=NODES){
 const impacted=new Set(changed);
 const pending=[...changed];
 while(pending.length){
  const head=pending.pop();
  for(const node of stages){
   if(!node.after.includes(head)||impacted.has(node.id))continue;
   impacted.add(node.id);pending.push(node.id);
  }
 }
 return stages.filter(s=>impacted.has(s.id)).map(s=>s.id);
}
export function validateAccountGraph(stages=NODES){
 const visited=new Set(),visiting=new Set();
 const byId=new Map(stages.map(n=>[n.id,n]));
 const visit=id=>{
  if(visiting.has(id))throw new Error("Cyclic account dependencies involving "+id);
  if(visited.has(id))return;
  const node=byId.get(id);
  if(!node)throw new Error("Unknown account dependency "+id);
  visiting.add(id);
  for(const p of node.after)visit(p);
  visiting.delete(id);visited.add(id);
 };
 for(const node of stages)visit(node.id);
 return true;
}
