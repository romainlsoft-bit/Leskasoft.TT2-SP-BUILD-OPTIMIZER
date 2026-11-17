/**
 * Active Pet/Gold pet optimizer contexts for TT2 8.4.
 * Two independent equipped pet slots: Damage and Gold/Support.
 * We rank each slot separately and do not build a 3x3 Cartesian product.
 * Scores are log10 proxies, not predictions of stages gained.
 */
import {PETS} from "../vendor/pets.js";
import {TRANSCENDENT_PETS} from "../vendor/transcendent-pets.js";

export const ALL_PETS=Object.freeze({...PETS,...TRANSCENDENT_PETS});
const PET_LOOKUP=Object.freeze(Object.fromEntries(Object.values(ALL_PETS).map(p=>[p.name.toLowerCase(),p])));
import {skillInfo} from "../vendor/skills.js";
import {petTier,petArtifactAmplifiers,logPassivePetMultiplier} from "./pet-amplifiers.js";
export {petTier,petArtifactAmplifiers,logPassivePetMultiplier} from "./pet-amplifiers.js";
const finite=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const levelsCache=new WeakMap();
function petLevels(profile){
 if(profile&&typeof profile==="object"&&levelsCache.has(profile))
  return levelsCache.get(profile);
 const result=Object.create(null);
 const records=profile?.sections?.petLevels?.records;
 if(!Array.isArray(records)){if(profile&&typeof profile==="object")levelsCache.set(profile,result);return result;}
 for(const row of records){
  const pet=ALL_PETS[row.id]||PET_LOOKUP[String(row.id).toLowerCase()];
  const level=finite(row.level);
  if(pet&&level>0)result[pet.id]=Math.min(100000,level);
 }
 if(profile&&typeof profile==="object")levelsCache.set(profile,result);
 return result;
}
export function availablePets(profile){
 const levels=petLevels(profile);
 return Object.values(ALL_PETS).filter(pet=>levels[pet.id]>0).map(pet=>({
  id:pet.id,name:pet.name,type:pet.type,equipType:pet.equipType,
  tier:petTier(pet),
  level:levels[pet.id]
 }));
}
export function logPetBonus(pet,level){
 if(!pet||!(level>=0))return 0;
 const capped=Math.min(level,100000);
 // "MaxImprovementLevels" counts improvement *increments*, NOT pet levels.
 // Permanent pets: +1 improvement each 20 levels after level 100.
 // Transcendent pets: +1 improvement each 5 levels starting at level 5.
 const transcendent=pet.tier==="Transcendent"||String(pet.id).startsWith("SeasonalPet");
 const first=transcendent?5:120;
 const every=transcendent?5:20;
 const steps=Math.min(Math.max(0,Math.floor((capped-first)/every)+1),
  Math.max(0,Number(pet.improvementLimit)||0));
 return Math.log10(Math.max(1,pet.base+pet.inc*capped))
  +steps*Math.log10(Math.max(1,pet.improve));
}
export function activePetGain(pet,level,extraPct=0,amplifierLog10=0){
 if(!pet||!(level>0))return 0;
 const effectiveLevel=level*(1+Math.max(0,extraPct));
 const amp=Math.max(0,amplifierLog10);
 const activeLog=logPetBonus(pet,effectiveLevel)+amp;
 const passiveLog=logPassivePetMultiplier(logPetBonus(pet,level)+amp,level);
 return activeLog-passiveLog;
}
const EQUIPMENT_PET_SLOTS=Object.freeze({
 SwordBoost:"Sword",HelmetBoost:"Helmet",ArmorBoost:"Armor",
 AuraBoost:"Aura",SlashBoost:"Slash"
});
/** Combat Techniques A only enhances equipment-pet effects whose gear
 * primary is actually modeled. Do not give SP imaginary account bonuses.
 */
export function petEquipmentCombatTechniquesWeight(settings={}){
 const passive=settings.equipmentPetPassiveWeights||{};
 const weights=settings.equipmentPetSlotWeights||{};
 let weight=Object.values(passive).reduce((sum,x)=>sum+Math.max(0,Number(x)||0),0);
 const levels=petLevels(settings.accountProfile);
 for(const id of new Set([settings.selectedDamagePet,settings.selectedGoldPet])){
  if(!id||!(levels[id]>0))continue;
  const slot=EQUIPMENT_PET_SLOTS[ALL_PETS[id]?.type];
  // Selected equipment pets with zero passive grant active CT. Do not add
  // the slot twice once the pet has any passive fraction.
  if(slot&&!(passive[slot]>0))weight+=Math.max(0,Number(weights[slot])||0);
 }
 return weight;
}
export function petWeight(pet,slot,settings){
 if(!pet)return 0;
 if(slot==="damage"){
  if(pet.equipType!=="Damage")return 0;
  if(EQUIPMENT_PET_SLOTS[pet.type])
   return Math.max(0,Number(settings.equipmentPetSlotWeights?.[EQUIPMENT_PET_SLOTS[pet.type]])||0);
  if(["AllDamage","BossDamage"].includes(pet.type))return 1;
  if(pet.type==="TapDamage"&&["Pet","Heavenly Strike","Shadow Clone","Dagger"].includes(settings.damage))return 1;
  return 0;
 }
 if(slot==="gold"){
  if(pet.equipType!=="Support")return 0;
  if(EQUIPMENT_PET_SLOTS[pet.type])
   return Math.max(0,Number(settings.equipmentPetSlotWeights?.[EQUIPMENT_PET_SLOTS[pet.type]])||0);
  if(pet.type==="GoldAll")return Math.max(0,finite(settings.goldWeight));
  if(pet.type==="FairyGold"&&settings.gold==="Fairy")return Math.max(0,finite(settings.goldWeight));
  if(pet.type==="GoldBoss"&&settings.gold==="HoG")return Math.max(0,finite(settings.goldWeight));
  return 0;
 }
 return 0;
}
export function resolvePetLevels(settings,combatTechniques=0){
 // Explicit dependency phases: imported levels -> set/skill level modifiers
 // -> effective pet levels -> active/passive pet bonuses.
 // Equipment and gem bonuses are NOT invented when missing from the export.
 const records=petLevels(settings.accountProfile);
 const combat=skillInfo.CombatTechniques;
 const ctBonus=finite(combat?.["B"+combatTechniques]);
 const samurai=Boolean(settings.sets?.Samurai)||
  Boolean(settings.accountProfile?.ownedSetIds?.includes("Samurai"));
 const bonusPct=ctBonus+(samurai?0.25:0);
 const effective=Object.fromEntries(Object.entries(records).map(([id,level])=>[
  id,level*(1+bonusPct)
 ]));
 return {base:records,effective,bonusPct};
}
export function petSlotScore(settings,petId,slot,combatTechniques=0){
 const pet=ALL_PETS[petId],level=petLevels(settings.accountProfile)[petId];
 if(!pet||!level)return 0;
 const pct=finite(skillInfo.CombatTechniques?.["B"+combatTechniques]);
 const samurai=Boolean(settings.sets?.Samurai)||
  Boolean(settings.accountProfile?.ownedSetIds?.includes("Samurai"));
 const tier=petTier(pet),kind=slot==="gold"?"gold":"damage";
 const amplifier=petArtifactAmplifiers(settings.accountProfile).byTier[tier]?.[kind]??0;
 return petWeight(pet,slot,settings)*activePetGain(pet,level,pct+(samurai?0.25:0),amplifier);
}
export function petScenarioScore(settings,combatTechniques=0){
 return petSlotScore(settings,settings.selectedDamagePet,"damage",combatTechniques)
  +petSlotScore(settings,settings.selectedGoldPet,"gold",combatTechniques);
}
export function petCombatTechniquesIncrement(settings,level){
 return petScenarioScore(settings,level)-petScenarioScore(settings,0);
}
export function recommendPets(profile,settings,slot,count=3){
 const source={...settings,accountProfile:profile};
 const candidates=availablePets(profile).filter(p=>petWeight(ALL_PETS[p.id],slot,source)>0);
 return candidates.map(p=>({...p,estimatedGain:petSlotScore(source,p.id,slot,30)}))
  .sort((a,b)=>b.estimatedGain-a.estimatedGain||a.id.localeCompare(b.id))
  .slice(0,Math.max(0,Math.min(3,Math.floor(count))));
}

/** Account-wide passive multipliers. A pet that is not selected still
 * contributes 5% for every 5 levels, reaching the full boost at level 100.
 * Only direct source types are applied to the fixed account score; equipment
 * boosts, mana, stage skip and hero reductions require additional mechanics.
 */
const DIRECT_PASSIVE=new Set(["AllDamage","BossDamage","GoldAll","FairyGold","GoldBoss"]);
const MULTIPLICATIVE_PASSIVE=new Set([
 "AllDamage","BossDamage","TitanDamage","TapDamage","AllHelperDamage",
 "MeleeHelperDamage","RangedHelperDamage","SpellHelperDamage",
 "GroundHelperDamage","FlyingHelperDamage","GoldAll","FairyGold",
 "GoldBoss","JackpotGold","MultiMonstersGold",
 "SwordBoost","HelmetBoost","ArmorBoost","AuraBoost","SlashBoost"
]);
export function petPassiveEvidence(profile){
 const pets=availablePets(profile),boosts=petArtifactAmplifiers(profile),
  byType=Object.create(null),entries=[],unmodeled=[];
 for(const p of pets){
  const pet=ALL_PETS[p.id],kind=pet.equipType==="Support"?"gold":"damage";
  const amp=boosts.byTier[p.tier]?.[kind]??0;
  const modeled=MULTIPLICATIVE_PASSIVE.has(pet.type);
  const rawLog10=logPetBonus(pet,p.level);
  const log10=modeled?logPassivePetMultiplier(rawLog10+amp,p.level):null;
  if(modeled&&DIRECT_PASSIVE.has(pet.type)&&log10!==null)
   byType[pet.type]=(byType[pet.type]||0)+log10;
  if(!modeled)unmodeled.push({id:p.id,type:p.type,reason:"nonmultiplicative-or-dependent"});
  entries.push({id:p.id,name:p.name,tier:p.tier,bonusType:p.type,
   level:p.level,passiveFraction:Math.min(1,Math.floor(p.level/5)*.05),
   rawLog10,amplifierLog10:amp,log10,
   appliedToScore:modeled&&DIRECT_PASSIVE.has(pet.type),
   petAttackDamageModeled:false});
 }
 return {entries,byType,imported:entries.length,
  scored:entries.filter(x=>x.appliedToScore).length,
  unknownAmplifiers:boosts.unknown,unmodeled,
  complete:false};
}
