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
  tier:pet.tier??(Number(pet.id.slice(3))>=17?"Exotic":"Legacy"),
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
export function activePetGain(pet,level,extraPct=0){
 if(!pet||!(level>0))return 0;
 const effectiveLevel=level*(1+Math.max(0,extraPct));
 const activeLog=logPetBonus(pet,effectiveLevel);
 const baseLog=logPetBonus(pet,level);
 const fraction=Math.min(1,Math.floor(level/5)*0.05);
 // Fraction acts on the BONUS, not its logarithm.
 const passiveLog=fraction===0?0:baseLog+
  Math.log10(fraction+(1-fraction)*Math.pow(10,-baseLog));
 return activeLog-passiveLog;
}
export function petWeight(pet,slot,settings){
 if(!pet)return 0;
 if(slot==="damage"){
  if(pet.equipType!=="Damage")return 0;
  if(["AllDamage","BossDamage"].includes(pet.type))return 1;
  if(pet.type==="TapDamage"&&["Pet","Heavenly Strike","Shadow Clone","Dagger"].includes(settings.damage))return 1;
  return 0;
 }
 if(slot==="gold"){
  if(pet.equipType!=="Support")return 0;
  if(pet.type==="GoldAll")return Math.max(0,finite(settings.goldWeight));
  if(pet.type==="FairyGold"&&settings.gold==="Fairy")return Math.max(0,finite(settings.goldWeight));
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
 return petWeight(pet,slot,settings)*activePetGain(pet,level,pct+(samurai?0.25:0));
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
