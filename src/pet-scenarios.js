/**
 * Active Pet/Gold pet optimizer contexts for TT2 8.4.
 * Two independent equipped pet slots: Damage and Gold/Support.
 * We rank each slot separately and do not build a 3x3 Cartesian product.
 * Scores are log10 proxies, not predictions of stages gained.
 */
import {PETS} from "../vendor/pets.js?v=20261123-spell-score-r1";
import {TRANSCENDENT_PETS} from "../vendor/transcendent-pets.js?v=20261123-spell-score-r1";

export const ALL_PETS=Object.freeze({...PETS,...TRANSCENDENT_PETS});
import {skillInfo} from "../vendor/skills.js?v=20261123-spell-score-r1";
import {equipmentEffectReduction} from "./equipment-reductions.js?v=20261123-spell-score-r1";
import {EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js?v=20261123-spell-score-r1";
import {petTier,petArtifactAmplifiers,logPassivePetMultiplier,verifiedEquipmentPetAmplifierTarget} from "./pet-amplifiers.js?v=20261123-spell-score-r1";
import {petLevelEvidence} from "./account-pet-levels.js?v=20261123-spell-score-r1";
import {resolveTranscendenceAge} from "./account-temporal.js?v=20261123-spell-score-r1";
export {petTier,petArtifactAmplifiers,logPassivePetMultiplier,verifiedEquipmentPetAmplifierTarget} from "./pet-amplifiers.js?v=20261123-spell-score-r1";
const finite=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
// Official Game Hive DevLog #231: only these 10 Transcendent pets
// belong to season 13, not all 15 historical pets in the CSV.
export const OFFICIAL_SEASON13_PET_ROSTER=Object.freeze([
 "Brushleaf","Clawsette","Daisy","Lemon","Lullabye",
 "Owlivia","Quippy","Scaly","Sonara","Watson"
]);
const season13=new Set(OFFICIAL_SEASON13_PET_ROSTER);
const petLevels=(profile,at=new Date())=>{
 const raw=petLevelEvidence(profile).levels;
 const season=resolveTranscendenceAge(profile,at);
 // With no season metadata, preserve the raw positive-pet evidence,
 // explicitly without claiming that the historical season is verified.
 if(!season.season)return raw;
 const filtered={...raw};
 for(const pet of Object.values(TRANSCENDENT_PETS)){
  const allowed=season.season==="13"&&!season.estimatedSeasonEnded&&
   season13.has(pet.name);
  if(!allowed)delete filtered[pet.id];
 }
 return filtered;
};
export function availablePets(profile,at=new Date()){
 const levels=petLevels(profile,at);
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
  // Angelic Radiance guarantees Heavenly Strike critical hits. The same
  // verified CritDamage conversion already applies to The Retaliator,
  // Soot's passive, and equipped gear. It must also apply to an ACTIVE
  // Soot or Lemon, otherwise the optimizer silently omits a real choice.
  // Outside HS, crit averaging remains unverified and is not guessed.
  if(pet.type==="CritDamage")
   return Math.max(0,equipmentEffectReduction("CritDamage",settings).weight??0);
  // Use the pinned build conversion for Tap and All Hero pet bonuses.
 if(pet.type==="TapDamage"||pet.type==="AllHelperDamage")
  return Math.max(0,equipmentEffectReduction(pet.type,settings).weight??0);
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
/**
 * Set-granted Active Pet Level is additive: Fatal Samurai +25%,
 * Lucky Fox Saint/Ninetails +10%. These are sourced from the two
 * ActivePetLevel entries in EquipmentSetInfo.csv, not inferred from
 * equipped items. Inactive pet level/passive percent remains unchanged.
 */
export function activePetSetLevelBonus(settings={}){
 // No manual/form fallback: completed sets persist after sale but must be
 // present in the canonical, untruncated unlocked-set export.
 const owned=new Set(settings.accountProfile?.sections?.equipmentSets?.present===true&&
  settings.accountProfile?.sections?.equipmentSets?.truncated!==true?
  settings.accountProfile.ownedSetIds||[]:[]);
 const entries=[];let bonusPct=0;
 for(const id of owned){
  const set=EQUIPMENT_SET_CATALOG[id];
  if(!set)continue;
  for(const effect of set.bonuses||[]){
   if(effect.type!=="ActivePetLevel"||effect.perDay===true)continue;
   const amount=Number(effect.amount),inc=Number(effect.inc),
    expo=Number(effect.expo);
   if(!Number.isFinite(amount)||amount<0||amount>2||inc!==1||expo!==1)
    continue;
   bonusPct+=amount;
   entries.push({setId:id,bonusPct:amount});
  }
 }
 return {bonusPct,entries};
}
export function resolvePetLevels(settings,combatTechniques=0){
 // Explicit dependency phases: imported levels -> set/skill level modifiers
 // -> effective pet levels -> active/passive pet bonuses.
 // Equipment and gem bonuses are NOT invented when missing from the export.
 const records=petLevels(settings.accountProfile);
 const combat=skillInfo.CombatTechniques;
 const ctBonus=finite(combat?.["B"+combatTechniques]);
 const setBonus=activePetSetLevelBonus(settings);
 const bonusPct=ctBonus+setBonus.bonusPct;
 const effective=Object.fromEntries(Object.entries(records).map(([id,level])=>[
  id,level*(1+bonusPct)
 ]));
 return {base:records,effective,bonusPct,
  setBonusPct:setBonus.bonusPct,activePetSetEffects:setBonus.entries};
}
export function petSlotScore(settings,petId,slot,combatTechniques=0){
 const pet=ALL_PETS[petId],level=petLevels(settings.accountProfile)[petId];
 if(!pet||!level)return 0;
 const pct=finite(skillInfo.CombatTechniques?.["B"+combatTechniques]);
 const setBonus=activePetSetLevelBonus(settings).bonusPct;
 const tier=petTier(pet),kind=slot==="gold"?"gold":"damage";
 const artifactBoosts=petArtifactAmplifiers(settings.accountProfile);
 const amplifier=artifactBoosts.byTier[tier]?.[kind]??0;
 // A seasonal equipment-type pet shares the bonus family but is not a
 // verified Rune Heart or EquipmentPetEffect gemstone target. In lot O
 // only the passive gear path had this guard; applying a rune to the
 // seasonal ACTIVE path would fabricate score and bias pet ranking.
 const runeBoost=verifiedEquipmentPetAmplifierTarget(pet)&&
  Number.isFinite(artifactBoosts.equipmentPetEffectLog10)?
  artifactBoosts.equipmentPetEffectLog10:0;
 return petWeight(pet,slot,settings)*activePetGain(
  pet,level,pct+setBonus,amplifier+runeBoost);
}
/** Conditional pet interactions excluded from numeric ranking. The source
 * core bonus remains modeled but the unverified seasonal rune stack is not.
 */
export function petScenarioEvidence(settings={}){
 const boosts=petArtifactAmplifiers(settings.accountProfile);
 const selected=[settings.selectedDamagePet,settings.selectedGoldPet].filter(Boolean);
 const excludedSeasonalEquipmentRune=Array.from(new Set(selected)).filter(id=>{
  const pet=ALL_PETS[id];
  return pet&&petTier(pet)==="Transcendent"&&EQUIPMENT_PET_SLOTS[pet.type]&&
   Number.isFinite(boosts.equipmentPetEffectLog10)&&
   boosts.equipmentPetEffectLog10>0&&petLevels(settings.accountProfile)[id]>0;
 });
 return {excludedSeasonalEquipmentRune,unverifiedCrossStack:
  excludedSeasonalEquipmentRune.length>0,complete:false};
}
export function petScenarioScore(settings,combatTechniques=0){
 return petSlotScore(settings,settings.selectedDamagePet,"damage",combatTechniques)
  +petSlotScore(settings,settings.selectedGoldPet,"gold",combatTechniques);
}
export function petCombatTechniquesIncrement(settings,level){
 return petScenarioScore(settings,level)-petScenarioScore(settings,0);
}
/**
 * Source-based ranking of active pets when the final Combat Techniques
 * level is unknown before running the SP solver. Screen all 51 possible
 * source levels 0..50, not merely five evenly spaced examples: the
 * combined selected-pet + equipment-pet gain can change discontinuously
 * when a pet's own passive share or equipment primary changes.
 *
 * In addition to the selected pet's active value above passive, an Exotic
 * Equipment Pet may replace an inactive partial passive in the CT A
 * calculation. Include only that *difference* when estimating a candidate.
 *
 * The maximum across EVERY source CT level is still a SCREENING heuristic:
 * it is not a certified upper bound across untested equipment layouts,
 * nonlinear talents or unknown future source mechanics.
 */
export function petCandidateEnvelope(settings,petId,slot){
 const pet=ALL_PETS[petId];
 if(!pet||!(petLevels(settings.accountProfile)[petId]>0)||petWeight(pet,slot,settings)<=0)return null;
 const max=Math.max(0,Number(skillInfo.CombatTechniques?.MaxLevel)||0);
 const levels=Array.from({length:max+1},(_,level)=>level);
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
  samples,screeningOnly:true,
  testedAllSourceCombatTechniquesLevels:samples.length===max+1,
  equipmentScreeningNotAProvenGlobalBound:true};
}
export function recommendPets(profile,settings,slot,count=3){
 const source={...settings,accountProfile:profile};
 const candidates=availablePets(profile).filter(p=>petWeight(ALL_PETS[p.id],slot,source)>0);
 return candidates.map(p=>({...p,...petCandidateEnvelope(source,p.id,slot)}))
  .sort((a,b)=>b.estimatedGain-a.estimatedGain||a.id.localeCompare(b.id))
  .slice(0,Math.max(0,Math.min(45,Math.floor(count))));
}

/**
 * Dynamic, explicitly bounded product over all SOURCE-SCORABLE owned pets.
 * A small owner roster is searched fully, rather than accidentally losing
 * its 4th-ranked pet to the old hard-coded 3×3 screening.
 * Large rosters remain bounded for runtime; no unexamined score is claimed.
 */
export function petSearchPlan(profile,settings={}){
 const completeDamage=recommendPets(profile,settings,"damage",45);
 const completeGold=recommendPets(profile,settings,"gold",45);
 const sp=Number(settings.skillPoints??0);
 const pairBudget=sp<=1000?36:sp<=5000?25:16;
 const maxPerSlot=6;
 let d=Math.min(maxPerSlot,completeDamage.length);
 let g=Math.min(maxPerSlot,completeGold.length);
 // Product-only budget: keep a balanced rectangle; one-empty-slot
 // scenarios may evaluate all remaining candidates up to the slot cap.
 while(Math.max(1,d)*Math.max(1,g)>pairBudget){
  if(d>=g&&d>1)d--;
  else if(g>1)g--;
  else break;
 }
 const damage=completeDamage.slice(0,d),gold=completeGold.slice(0,g);
 const exhaustiveEligible=
  d===completeDamage.length&&g===completeGold.length;
 return {damage,gold,eligibleCount:{
  damage:completeDamage.length,gold:completeGold.length},
  candidateCount:{damage:d,gold:g},pairBudget,
  exhaustiveEligible,screeningIsCertifiedUpperBound:false,
  omittedCandidates:{damage:completeDamage.length-d,
   gold:completeGold.length-g},
  interpretation:"eligible means source-modeled petWeight > 0; conditional unscored pet effects remain outside ranking"};
}

/** Account-wide passive multipliers. A pet that is not selected still
 * contributes 5% for every 5 levels, reaching the full boost at level 100.
 * Only direct source types are applied to the fixed account score; equipment
 * boosts, mana, stage skip and hero reductions require additional mechanics.
 */
// All Hero and Tap enter the corresponding source-reduced fixed lanes.
const DIRECT_PASSIVE=new Set(["AllDamage","BossDamage","CritDamage","AllHelperDamage",
 "TapDamage","GoldAll","FairyGold","GoldBoss"]);
const MULTIPLICATIVE_PASSIVE=new Set([
 "AllDamage","BossDamage","TitanDamage","TapDamage","CritDamage","AllHelperDamage",
 "MeleeHelperDamage","RangedHelperDamage","SpellHelperDamage",
 "GroundHelperDamage","FlyingHelperDamage","GoldAll","FairyGold",
 "GoldBoss","JackpotGold","MultiMonstersGold",
 "SwordBoost","HelmetBoost","ArmorBoost","AuraBoost","SlashBoost"
]);
export function petPassiveEvidence(profile,at=new Date()){
 const pets=availablePets(profile,at),boosts=petArtifactAmplifiers(profile),
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
 const seasonal=entries.filter(x=>x.tier==="Transcendent");
 const seasonalEquipment=seasonal.filter(x=>EQUIPMENT_PET_SLOTS[x.bonusType]);
 const unresolvedRouted=entries.filter(x=>!x.appliedToScore&&
  !EQUIPMENT_PET_SLOTS[x.bonusType]);
 return {entries,byType,imported:entries.length,
  scored:entries.filter(x=>x.appliedToScore).length,
  seasonalImported:seasonal.length,
  seasonalDirect:seasonal.filter(x=>x.appliedToScore).length,
  seasonalEquipment:seasonalEquipment.length,
  unscoredDependent:unresolvedRouted.length,
  rejectedLevels:evidence.rejected,
  duplicateMirrors:evidence.duplicateMirrors,
  unknownAmplifiers:boosts.unknown,unmodeled,
  complete:false};
}
