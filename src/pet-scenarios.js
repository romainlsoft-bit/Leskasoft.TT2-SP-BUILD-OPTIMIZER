/**
 * Active Pet/Gold pet optimizer contexts for TT2 8.4.
 * Two independent equipped pet slots: Damage and Gold/Support.
 * We rank each slot separately and do not build a 3x3 Cartesian product.
 * Scores are log10 proxies, not predictions of stages gained.
 */
import {PETS} from "../vendor/pets.js";
import {TRANSCENDENT_PETS} from "../vendor/transcendent-pets.js";

export const ALL_PETS=Object.freeze({...PETS,...TRANSCENDENT_PETS});
import {skillInfo} from "../vendor/skills.js";
import {petTier,petArtifactAmplifiers,logPassivePetMultiplier} from "./pet-amplifiers.js?v=20261117-pet-gemstone-chain";
import {petLevelEvidence} from "./account-pet-levels.js";
export {petTier,petArtifactAmplifiers,logPassivePetMultiplier} from "./pet-amplifiers.js?v=20261117-pet-gemstone-chain";
const finite=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const petLevels=profile=>petLevelEvidence(profile).levels;
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
/**
 * Combat Techniques equipment-pet A effect.
 *
 * An unselected Exotic pet gives only its passive share: at level 5,
 * for example, only 5% of the full bonus is active. Multiplying the full
 * effect by CT A and then taking the passive share is not the same as
 * awarding log10(A) unconditionally. The already-active equipped pet gets
 * the full CT A increment. Active-pet levels (CT B) are scored separately
 * by petCombatTechniquesIncrement; never apply CT B to all inactive pets.
 */
export function petEquipmentCombatTechniquesIncrement(settings={},ctLevel=0){
 const a=Number(skillInfo.CombatTechniques?.["A"+ctLevel]);
 if(!(ctLevel>0)||!Number.isFinite(a)||a<=1)return 0;
 const delta=Math.log10(a),levels=petLevels(settings.accountProfile);
 const boosts=petArtifactAmplifiers(settings.accountProfile);
 const rune=Number.isFinite(boosts.equipmentPetEffectLog10)?
  boosts.equipmentPetEffectLog10:0;
 const selected=new Set([
  ALL_PETS[settings.selectedDamagePet]?.equipType==="Damage"?
   settings.selectedDamagePet:null,
  ALL_PETS[settings.selectedGoldPet]?.equipType==="Support"?
   settings.selectedGoldPet:null
 ]);
 let score=0;
 for(const id of ["Pet26","Pet27","Pet28","Pet29","Pet30"]){
  const pet=ALL_PETS[id],petLevel=levels[id];
  if(!(petLevel>0))continue;
  const slot=EQUIPMENT_PET_SLOTS[pet.type];
  const slotWeight=Math.max(0,Number(settings.equipmentPetSlotWeights?.[slot])||0);
  if(!(slotWeight>0))continue;
  if(selected.has(id)){
   score+=slotWeight*delta;
  }else{
   const passiveWeight=Math.max(0,Number(settings.equipmentPetPassiveWeights?.[slot])||0);
   if(!(passiveWeight>0))continue;
   const kind=pet.equipType==="Support"?"gold":"damage";
   const tierBonus=boosts.byTier[petTier(pet)]?.[kind]??0;
   const full=logPetBonus(pet,petLevel)+tierBonus+rune;
   score+=passiveWeight*(logPassivePetMultiplier(full+delta,petLevel)-
    logPassivePetMultiplier(full,petLevel));
  }
 }
 return score;
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
 const artifactBoosts=petArtifactAmplifiers(settings.accountProfile);
 const amplifier=artifactBoosts.byTier[tier]?.[kind]??0;
 const runeBoost=EQUIPMENT_PET_SLOTS[pet.type]&&
  Number.isFinite(artifactBoosts.equipmentPetEffectLog10)?
  artifactBoosts.equipmentPetEffectLog10:0;
 return petWeight(pet,slot,settings)*activePetGain(
  pet,level,pct+(samurai?0.25:0),amplifier+runeBoost);
}
export function petScenarioScore(settings,combatTechniques=0){
 return petSlotScore(settings,settings.selectedDamagePet,"damage",combatTechniques)
  +petSlotScore(settings,settings.selectedGoldPet,"gold",combatTechniques);
}
export function petCombatTechniquesIncrement(settings,level){
 return petScenarioScore(settings,level)-petScenarioScore(settings,0);
}
/**
 * Source-based upper screening for candidates when the optimal Combat
 * Techniques level is unknown before running the SP solver. A single level
 * (formerly hard-coded at 30) can discard the actually best pet at 0 or 50.
 *
 * In addition to the selected pet's active value above passive, an Exotic
 * Equipment Pet may replace an inactive partial passive in the CT A
 * calculation. Include only that *difference* when estimating a candidate.
 *
 * The maximum of these sampled scores is a SCREENING heuristic, not a
 * certified upper bound or proof that the globally best pet is shortlisted.
 */
export function petCandidateEnvelope(settings,petId,slot){
 const pet=ALL_PETS[petId];
 if(!pet||petWeight(pet,slot,settings)<=0)return null;
 const max=Math.max(0,Number(skillInfo.CombatTechniques?.MaxLevel)||0);
 const levels=[0,Math.floor(max/4),Math.floor(max/2),Math.floor(3*max/4),max];
 const selection=slot==="damage"?"selectedDamagePet":"selectedGoldPet";
 const chosen={...settings,[selection]:petId};
 const baseline={...chosen,[selection]:null};
 const samples=Array.from(new Set(levels)).map(level=>{
  const active=petSlotScore(chosen,petId,slot,level);
  const ctDelta=petEquipmentCombatTechniquesIncrement(chosen,level)-
   petEquipmentCombatTechniquesIncrement(baseline,level);
  return {combatTechniquesLevel:level,score:active+ctDelta};
 });
 return {petId,estimatedGain:Math.max(...samples.map(x=>x.score)),
  samples,screeningOnly:true};
}
export function recommendPets(profile,settings,slot,count=3){
 const source={...settings,accountProfile:profile};
 const candidates=availablePets(profile).filter(p=>petWeight(ALL_PETS[p.id],slot,source)>0);
 return candidates.map(p=>({...p,...petCandidateEnvelope(source,p.id,slot)}))
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
 const evidence=petLevelEvidence(profile);
 return {entries,byType,imported:entries.length,
  scored:entries.filter(x=>x.appliedToScore).length,
  rejectedLevels:evidence.rejected,
  duplicateMirrors:evidence.duplicateMirrors,
  unknownAmplifiers:boosts.unknown,unmodeled,
  complete:false};
}
