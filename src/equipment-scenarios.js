import {factorizedGearSearch} from "./factorized-gear-search.js?v=20261127-r1";
import {MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS,MAX_GEAR_ENUMERATION_INPUT_LIMIT} from "./gear-search-policy.js?v=20261123-boss-specials-r1";
/**
 * Interchangeable equipment is a separate optimization dimension, never
 * confused with fixed artifacts, gemstones or Titan research.
 *
 * Score only explicit numeric FIRST effects with verified semantics. Unknown
 * values are kept visible but never given guessed power coefficients.
 */
import {ARTIFACT_CATALOG} from "../vendor/account-catalog.js?v=20261123-boss-specials-r1";
import {equipmentEffectReduction,EQUIPMENT_AURA_TARGETS} from "./equipment-reductions.js?v=20261123-boss-specials-r1";
import {calculatePermanentArtifactEffects} from "./account-artifacts.js?v=20261123-boss-specials-r1";
import {petPassiveEvidence,logPassivePetMultiplier,petScenarioScore,petEquipmentCombatTechniquesIncrement,ALL_PETS,verifiedEquipmentPetAmplifierTarget} from "./pet-scenarios.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {petLevelEvidence} from "./account-pet-levels.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {extractFixedAccountPower} from "./account-power.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {resolveGemstoneEvidence} from "./account-gemstones.js?v=20261123-boss-specials-r1";
import {resolvePermanentSetPower,resolveCraftingPower} from "./account-permanent-sets.js?v=20261123-boss-specials-r1";
const CATEGORIES=["Sword","Helmet","Armor","Aura","Slash"];
const GUNBLADE_BUILDS=new Set(["Dagger","Heavenly Strike","Gold Gun","Shadow Clone"]);
const officialSlots={...Object.fromEntries(CATEGORIES.map(x=>[x.toLowerCase(),x])),
 weapon:"Sword",hat:"Helmet",suit:"Armor",chest:"Armor"};
const finiteLog=value=>{
 const s=String(value??"").trim();
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(s))return null;
 const match=s.match(/^(\d+(?:\.\d*)?|\.\d+)(?:[Ee]([+-]?\d+))?$/);
 const mantissa=Number(match[1]),exp=Number(match[2]||0);
 return mantissa>0&&Number.isFinite(mantissa)&&Number.isSafeInteger(exp)?
  Math.log10(mantissa)+exp:null;
};
const slotOf=record=>{
 const raw=String(record.slot||"").replace(/[^a-z]/gi,"").toLowerCase();
 return officialSlots[raw]||null;
};
function helmetKind(item){
 const text=[item.name,item.id,item.bonusType].filter(Boolean).join(" ").toLowerCase();
 if(text.includes("elder snow cap"))return "Elder Snow Cap";
 if(text.includes("gunblade"))return "Gunblade";
 if(/ranged|range|marksman/.test(text))return "Ranged hero";
 if(/spell|magic|\bmage\b/.test(text))return "Spell hero";
 if(/melee|tank|ground/.test(text))return "Melee hero";
 return "Unknown";
}
function equipmentFit(item,settings,profile){
 if(item.slot!=="Helmet")return true;
 const kind=helmetKind(item);
 if(GUNBLADE_BUILDS.has(settings.damage))return kind==="Gunblade";
 // Only an explicit strongest hero ID from the export permits class
 // filtering; no selection from the last-unlocked hero or weapon roster.
 const dominant=profile?.dominantHero;
 if(dominant?.verified===true)
  return kind==="Elder Snow Cap"||kind===dominant.heroClass+" hero";
 return ["Elder Snow Cap","Ranged hero","Spell hero","Melee hero"].includes(kind);
}
function directEffectScore(type,amount,settings){
 const log=finiteLog(amount),reduction=equipmentEffectReduction(type,settings);
 return log===null||log<0||reduction.weight===null?null:log*reduction.weight;
}
function firstEffectScore(item,settings){
 return directEffectScore(item.bonusType,item.bonusAmount,settings);
}
function linkedAuraTarget(item){
 return item?.slot==="Aura"?EQUIPMENT_AURA_TARGETS[item.bonusType]??null:null;
}
/** These secondary rolls are source-known, but cannot be converted to a
 * permanent boss damage/gold multiplier without hit/proc/uptime rates.
 * Keep them separate from unknown bonus identifiers (and from 0-weight
 * but genuinely inapplicable damage families).
 */
const CONDITIONAL_SECONDARIES=new Set([
 "CritDamage","CriticalDamage","CritChance","CriticalChance",
 "JackpotGold","JackpotGoldChance","MultiMonstersGold",
 "ChestChance","ChestersonChance","AllProbabilityBoost"
]);
export function equipmentSecondaryEvidence(item,settings){
 const known=[],unknown=[],inapplicable=[],conditional=[],effects=item.secondaryEffects||[];
 for(const effect of effects){
  const reduction=equipmentEffectReduction(effect.bonusType,settings);
  const score=directEffectScore(effect.bonusType,effect.bonusAmount,settings);
  if(score===null){
   const reason=CONDITIONAL_SECONDARIES.has(effect.bonusType)||
    /(?:Chance|Probability|Crit|Jackpot|MultiMonsters)/.test(effect.bonusType)?
     "conditional-chance-crit-or-nonboss-gold":"unverified-secondary-formula";
   const record={...effect,status:reduction.status,reason};
   unknown.push(record);
   if(reason==="conditional-chance-crit-or-nonboss-gold")conditional.push(record);
  }
  else if(reduction.status==="inapplicable")
   inapplicable.push({...effect,score:0,source:reduction.source});
  else known.push({...effect,score,source:reduction.source,reduction:reduction.weight});
 }
 return {recorded:effects.length,known,unknown,inapplicable,conditional,
  score:known.reduce((n,x)=>n+x.score,0),complete:unknown.length===0};
}
const BOOST_BY_SLOT={Sword:"SwordBoost",Helmet:"HelmetBoost",Armor:"ArmorBoost",
 Aura:"AuraBoost",Slash:"SlashBoost"};
const equipmentBoostCache=new WeakMap();
/** Gear's direct primary and linked-Aura primary determine the real
 * conversion weight of an active equipment pet. The active pet's increment
 * has already been separated from its passive by petScenarioScore; this
 * function is used ONLY to choose gear, never added to independentScore.
 */
function equipmentPetPresence(profile){
 const families=new Map();
 for(const pet of petPassiveEvidence(profile).entries){
  if(!(pet.level>0))continue;
  const previous=families.get(pet.bonusType);
  families.set(pet.bonusType,{hasPassive:previous?.hasPassive===true||pet.passiveFraction>0});
 }
 return families;
}
function recordEquipmentPetWeight(slot,effect,presence,weights,passiveWeights){
 const family=presence.get(BOOST_BY_SLOT[slot]);
 const weight=effect.first===null?0:Math.max(0,effect.primarySourceWeight??0);
 if(!family||!(weight>0))return;
 weights[slot]=weight;
 if(family.hasPassive)passiveWeights[slot]=weight;
}
function activePetAwareGearScore(profile,settings,gear,presence){
 const weights={},passiveWeights={};
 for(const slot of CATEGORIES){
  const item=gear[slot];
  if(!item)continue;
  recordEquipmentPetWeight(slot,equipmentEffectScore(item,settings,profile,gear),
   presence,weights,passiveWeights);
 }
 const context={...settings,accountProfile:profile,
  equipmentPetSlotWeights:weights,equipmentPetPassiveWeights:passiveWeights};
 const level=Number.isSafeInteger(settings?.petCombatTechniquesLevel)&&
  settings.petCombatTechniquesLevel>=0?settings.petCombatTechniquesLevel:0;
 // Same two terms as the final ledger plus CT skill increment. This is
 // ONLY a ranking term: independentScore still excludes both.
 return petScenarioScore(context,level)+petEquipmentCombatTechniquesIncrement(context,level);
}
/** Equipment pet bonus chain: five Exotic pet passives -> Restored Rune
 * Heart -> equipment primary; alongside Ring of Calisto and slot-specific
 * artifacts/research. No secondary roll is amplified by this chain.
 */
export function equipmentPrimaryAmplifiers(profile,settings={}){
 const empty={bySlot:Object.fromEntries(CATEGORIES.map(slot=>[slot,{log10:0,
  petLog10:0,artifactLog10:0,unknown:[]}]))};
 if(!profile)return empty;
 const cp=resolveCraftingPower(profile,settings);
 const cacheKey=String(cp.level??"missing");
 let cached=equipmentBoostCache.get(profile);
 if(cached?.has(cacheKey))return cached.get(cacheKey);
 const artifact=calculatePermanentArtifactEffects(profile,ARTIFACT_CATALOG);
 const pets=petPassiveEvidence(profile);
 const fixed=extractFixedAccountPower(profile);
 const gems=resolveGemstoneEvidence(profile);
 const sets=resolvePermanentSetPower(profile,settings);
 const all=artifact.entries.find(x=>x.bonusType==="AllEquipmentEffect");
 const rune=artifact.entries.find(x=>x.bonusType==="EquipmentPetEffect");
 const bySlot={};
 for(const slot of CATEGORIES){
  const bonusType=BOOST_BY_SLOT[slot],unknown=[];
  let artifactLog10=0,petLog10=0,gemstoneLog10=0,setLog10=0;
  const target=artifact.entries.find(x=>x.bonusType===bonusType);
  for(const row of [all,target]){
   if(!row)continue;
   if(Number.isFinite(row.log10))artifactLog10+=row.log10;
   else unknown.push({id:row.id,reason:row.status});
  }
  // Multiple individually owned pets may share a primary family, such
  // as Effie and Quippy. Summing passive logarithms once per source ID
  // prevents a first-match loss without copying anything to secondaries.
  const petSources=[];
  const petRows=pets.entries.filter(x=>x.bonusType===bonusType);
  const gemRune=gems.entries.filter(x=>x.bonusType==="EquipmentPetEffect")
   .reduce((total,row)=>total+row.log10,0);
  for(const pet of petRows){
   if(!(pet.passiveFraction>0))continue;
   if(!Number.isFinite(pet.log10)){
    unknown.push({id:pet.id,reason:"unverified-pet-passive"});continue;
   }
   // Rune Heart / gemstone EquipmentPetEffect are proven for the five
   // Exotic equipment pets; the seasonal cross-stack is unverified.
   const exoticEquipment=verifiedEquipmentPetAmplifierTarget(pet);
   let runeLog10=0;
   if(exoticEquipment&&rune){
    if(Number.isFinite(rune.log10))runeLog10=rune.log10;
    else {unknown.push({id:rune.id,reason:rune.status});continue;}
   }
   if(!exoticEquipment&&(rune||gemRune>0))
    unknown.push({id:pet.id,reason:"seasonal-equipment-pet-rune-stack-unverified"});
   const log10=logPassivePetMultiplier(
    pet.rawLog10+pet.amplifierLog10+runeLog10+
     (exoticEquipment?gemRune:0),pet.level);
   if(!Number.isFinite(log10)){
    unknown.push({id:pet.id,reason:"unrepresentable-pet-effect"});continue;
   }
   petLog10+=log10;
   petSources.push({id:pet.id,tier:pet.tier,level:pet.level,
    passiveLog10:log10,equipmentPetEffectApplied:exoticEquipment});
  }
  // Completed permanent sets may grant slot-specific primary multipliers.
  // The same set entry is NEVER added to the fixed AllDamage account score.
  setLog10=sets.entries.filter(e=>e.appliedToEquipment&&
   (e.bonusType===bonusType||e.bonusType==="AllEquipmentEffect"))
   .reduce((n,e)=>n+e.log10,0);
  // Account multipliers from research, scrolls and gemstones of this
  // bonus family are not universally direct damage; route them to this slot.
  for(const row of fixed.entries)
   if(row.bonusType===bonusType||row.bonusType==="AllEquipmentEffect"){
    if(["artifacts","petPassive"].includes(row.system))continue;
    if(Number.isFinite(row.log10)){
     if(row.system==="gemstones")gemstoneLog10+=row.log10;
     else artifactLog10+=row.log10;
    }
   }
  for(const row of gems.unknown)
   unknown.push({id:row.id??"gemstones",reason:row.reason});
  for(const row of sets.unknown.filter(e=>
    e.bonusType===bonusType||e.bonusType==="AllEquipmentEffect"))
   unknown.push({id:row.id,reason:row.reason});
  bySlot[slot]={log10:artifactLog10+gemstoneLog10+petLog10+setLog10,
   petLog10,artifactLog10,gemstoneLog10,setLog10,petSources,unknown};
 }
 const result={bySlot,craftingPower:sets.craftingPower};
 cached??=new Map();
 cached.set(cacheKey,result);
 equipmentBoostCache.set(profile,cached);
 return result;
}
/**
 * Aura primaries strengthen exactly ONE other currently selected gear primary.
 * No phantom aura damage when its target is missing or not reducible. The
 * target's own primary amplifier has already been counted on that slot.
 * Never amplify the target's secondary rolls.
 */
function equipmentEffectScore(item,settings,profile,selectedGear={}){
 const linkedSlot=linkedAuraTarget(item);
 const secondaries=equipmentSecondaryEvidence(item,settings);
 const primaryAmplifier=equipmentPrimaryAmplifiers(profile,settings).bySlot[item.slot];
 const target=linkedSlot?selectedGear[linkedSlot]:null;
 const reduction=equipmentEffectReduction(
  linkedSlot?(target?.bonusType??"") : item.bonusType,settings);
 const base=finiteLog(item.bonusAmount);
 const targetFirst=target?firstEffectScore(target,settings):null;
 const primarySourceWeight=reduction.weight;
 let first=null,amp=0;
 if(linkedSlot){
  if(target&&targetFirst!==null&&base!==null&&base>=0&&
     primarySourceWeight!==null){
   first=base*primarySourceWeight;
   amp=primaryAmplifier.log10*primarySourceWeight;
  }
 }else{
  first=firstEffectScore(item,settings);
  if(first!==null&&primarySourceWeight!==null)
   amp=primaryAmplifier.log10*primarySourceWeight;
 }
 const unresolvedAura=linkedSlot!==null&&first===null;
 return {first,secondaries,primaryAmplifier,primaryBoostScore:amp,
  primarySourceWeight,linkedSlot,unresolvedAura,
  primaryReductionSource:reduction.source,
  score:first===null&&secondaries.known.length===0?
   null:(first??0)+amp+secondaries.score};
}
function rankEquipment(items,settings,profile,limit,selected={},presence=equipmentPetPresence(profile)){
 const ranked=items.map(item=>{
  const estimatedScore=equipmentEffectScore(item,settings,profile,selected).score;
  // Ranking must include the selected pet when the slot's damage-source
  // conversion differs (e.g. Tap primary versus All Damage). This is only
  // a shortlist heuristic; full pet×gear×SP global optimality is unproven.
  const gear={...selected,[item.slot]:item};
  const petAwareScore=estimatedScore===null?null:
   estimatedScore+activePetAwareGearScore(profile,settings,gear,presence);
  return {...item,estimatedScore,petAwareScore};
 }).sort((a,b)=>(b.petAwareScore??-Infinity)-(a.petAwareScore??-Infinity)
   ||a.displayName.localeCompare(b.displayName));
 const verified=ranked.filter(x=>x.estimatedScore!==null);
 const unknown=ranked.filter(x=>x.estimatedScore===null);
 return [...verified.slice(0,limit),...unknown.slice(0,Math.max(0,limit-verified.length))];
}

export function ownedEquipment(profile){
 const records=profile?.sections?.equipmentInventory?.records;
 if(!Array.isArray(records))return [];
 return records.map((record,index)=>{
  const slot=slotOf(record);
  if(!slot)return null;
  return {...record,uid:slot+":"+index,slot,
   displayName:record.name||record.id,helmetKind:slot==="Helmet"?helmetKind(record):null};
 }).filter(Boolean);
}
/**
 * Screening envelope: source-verified maximum equipment conversion weight
 * for each active equipment pet. Do not use the gear selected before a pet
 * was chosen; that can suppress a better pet+gear combination.
 * Envelope weights are for shortlist construction ONLY, not final scoring.
 */
export function petCandidateGearWeightEnvelope(profile,settings={}){
 const inventory=profile?.sections?.equipmentInventory;
 const slotWeights={},passiveWeights={},eligiblePrimaries={};
 if(inventory?.present!==true||inventory.truncated===true)
  return {slotWeights,passiveWeights,eligiblePrimaries,
   screeningOnly:true,source:"unverified-or-truncated-inventory"};
 const items=ownedEquipment(profile);
 const passives=petPassiveEvidence(profile).entries;
 for(const slot of CATEGORIES){
  let best=0,verified=0;
  for(const item of items){
   if(item.slot!==slot||!equipmentFit(item,settings,profile)||
      finiteLog(item.bonusAmount)===null)continue;
   const linked=linkedAuraTarget(item);
   if(slot==="Aura"&&!linked)continue;
   const targets=linked?items.filter(target=>target.slot===linked&&
    equipmentFit(target,settings,profile)):[item];
   for(const target of targets){
    if(firstEffectScore(target,settings)===null)continue;
    const reduction=equipmentEffectReduction(target.bonusType,settings);
    if(reduction.weight!==null&&Number.isFinite(reduction.weight)&&
       reduction.weight>0){
     verified++;
     best=Math.max(best,reduction.weight);
    }
   }
  }
  eligiblePrimaries[slot]=verified;
  if(best>0){
   slotWeights[slot]=best;
   if(passives.some(p=>p.bonusType===BOOST_BY_SLOT[slot]&&p.passiveFraction>0))
    passiveWeights[slot]=best;
  }
 }
 return {slotWeights,passiveWeights,eligiblePrimaries,
  screeningOnly:true,source:"verified-owned-gear-primary-envelope"};
}
export function bestEquipmentByCategory(profile,settings,limit=2){
 const incomplete=profile?.sections?.equipmentInventory?.truncated===true;
 const list=incomplete?[]:ownedEquipment(profile);
 const output={},selected={},presence=equipmentPetPresence(profile);
 // Targets MUST precede Aura: its primary effect is linked to precisely one
 // already selected Sword, Helmet or Slash, never independent damage.
 for(const slot of ["Sword","Helmet","Armor","Slash","Aura"]){
  const suitable=list.filter(item=>item.slot===slot&&equipmentFit(item,settings,profile));
  output[slot]=rankEquipment(suitable,settings,profile,limit,selected,presence);
  if(output[slot][0])selected[slot]=output[slot][0];
 }
 if(!GUNBLADE_BUILDS.has(settings.damage)){
  const helmets=list.filter(x=>x.slot==="Helmet");
  output.helmetRotation={
   unique:helmets.filter(x=>x.helmetKind==="Elder Snow Cap").slice(0,1),
   ranged:helmets.filter(x=>x.helmetKind==="Ranged hero").slice(0,1),
   spell:helmets.filter(x=>x.helmetKind==="Spell hero").slice(0,1),
   melee:helmets.filter(x=>x.helmetKind==="Melee hero").slice(0,1)
  };
 }
 return output;
}
/**
 * Complete owned gear Cartesian assignments for a SMALL imported inventory.
 * The return is exhaustive only over eligible known item IDs/slots, not
 * over uncertain source effects, unimported inventory or actual stage DPS.
 * A manual selection narrows the corresponding slot without creating items.
 */
export function enumerateOwnedGearAssignments(profile,settings={},limit=MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS){
 if(!Number.isSafeInteger(limit)||limit<1||limit>MAX_GEAR_ENUMERATION_INPUT_LIMIT)
  throw new RangeError("Gear enumeration limit must be 1–"+MAX_GEAR_ENUMERATION_INPUT_LIMIT);
 const inventory=profile?.sections?.equipmentInventory;
 if(inventory?.present!==true||inventory.truncated===true)
  return {exhaustive:false,assignments:[],combinations:null,
   reason:"inventory-missing-or-truncated"};
 const owned=ownedEquipment(profile),manual=settings.selectedEquipment||{};
 const eligible=CATEGORIES.map(slot=>{
  const candidates=owned.filter(item=>item.slot===slot&&
   equipmentFit(item,settings,profile));
  if(manual[slot]){
   const chosen=candidates.find(x=>x.uid===manual[slot]);
   return chosen?[chosen]:[];
  }
  return candidates.length?candidates:[null];
 });
 if(eligible.some(x=>x.length===0))
  return {exhaustive:false,assignments:[],combinations:null,
   reason:"explicit-selected-item-not-available"};
 const combinations=eligible.reduce((n,choices)=>n*choices.length,1);
 if(combinations>limit)
  return {exhaustive:false,assignments:[],combinations,
   reason:"full-owned-gear-product-exceeds-limit"};
 let assignments=[{}];
 for(let i=0;i<CATEGORIES.length;i++){
  const next=[];
  for(const base of assignments)for(const candidate of eligible[i]){
   next.push(candidate?{...base,[CATEGORIES[i]]:candidate.uid}:{...base});
  }
  assignments=next;
 }
 return {exhaustive:true,assignments,combinations,reason:null,
  inspectedAllOwnedEligibleGear:true};
}

export function gearSelectionEffects(profile,settings,selection={}){
 const items=ownedEquipment(profile);
 const selected={},selectedGear={},petWeights={},passiveWeights={};
 const presence=equipmentPetPresence(profile);
 const inventoryTruncated=profile?.sections?.equipmentInventory?.truncated===true;
 const missingExplicitSelections=[];
 const eligibleBySlot=Object.fromEntries(CATEGORIES.map(slot=>[slot,
  items.filter(item=>item.slot===slot&&equipmentFit(item,settings,profile))]));
 const eligibleCount=Object.fromEntries(CATEGORIES.map(slot=>[
  slot,eligibleBySlot[slot].length]));
 const gearSearchSpace=CATEGORIES.reduce((n,slot)=>
  n*Math.max(1,selection[slot]?1:eligibleCount[slot]),1);
 const options=Object.fromEntries(CATEGORIES.map(slot=>{
  const choices=selection[slot]?
   [eligibleBySlot[slot].find(item=>item.uid===selection[slot])??null]:
   inventoryTruncated?[null]:eligibleBySlot[slot];
  return [slot,choices.length?choices:[null]];
 }));
 // At a fixed CT and pet pair, the modeled gear objective is additive
 // across slots except for Aura's explicit single-primary dependency.
 // The equipment-pet score is linear in each slot's conversion weight.
 // Compute its coefficient using the existing pet functions at unit
 // weight; non-equipment pets are constant and excluded from this rank.
 const ct=Number.isSafeInteger(settings?.petCombatTechniquesLevel)&&
  settings.petCombatTechniquesLevel>=0?settings.petCombatTechniquesLevel:0;
 const coefficients=Object.fromEntries(CATEGORIES.map(slot=>{
  const family=presence.get(BOOST_BY_SLOT[slot]);
  if(!family)return [slot,0];
  const ctx={...settings,accountProfile:profile,
   selectedDamagePet:ALL_PETS[settings.selectedDamagePet]?.type===BOOST_BY_SLOT[slot]?settings.selectedDamagePet:null,
   selectedGoldPet:ALL_PETS[settings.selectedGoldPet]?.type===BOOST_BY_SLOT[slot]?settings.selectedGoldPet:null,
   equipmentPetSlotWeights:{[slot]:1},
   equipmentPetPassiveWeights:family.hasPassive?{[slot]:1}:{}};
  return [slot,petScenarioScore(ctx,ct)+petEquipmentCombatTechniquesIncrement(ctx,ct)];
 }));
 const scoreSlot=(item,gear)=>{
  if(!item)return 0;
  const effect=equipmentEffectScore(item,settings,profile,gear);
  const weight=effect.first===null?0:Math.max(0,effect.primarySourceWeight??0);
  return (effect.score??0)+coefficients[item.slot]*weight;
 };
 const search=factorizedGearSearch(options,scoreSlot,linkedAuraTarget);
 const autoChoices=search.selected;
 const exhaustiveWithinOwnedInventory=!inventoryTruncated&&
  profile?.sections?.equipmentInventory?.present===true;
 let independentScore=0,unresolvedAuraLinks=0,linkedAuraCount=0;
 for(const slot of ["Sword","Helmet","Armor","Slash","Aura"]){
  const key=selection[slot];
  const automatic=autoChoices[slot]??null;
  const item=key?items.find(it=>it.uid===key&&it.slot===slot&&
   equipmentFit(it,settings,profile)):automatic;
  if(key&&!item)
   missingExplicitSelections.push({slot,id:key,reason:"selected-gear-not-in-import-or-not-compatible"});
  if(!item)continue;
  selectedGear[slot]=item;
  const effect=equipmentEffectScore(item,settings,profile,selectedGear);
  if(effect.linkedSlot)linkedAuraCount++;
  if(effect.unresolvedAura)unresolvedAuraLinks++;
  selected[slot]={id:item.uid,name:item.displayName,kind:item.helmetKind,
   modeled:effect.score!==null,
   primaryModeled:effect.first!==null,
   primaryReduction:effect.primarySourceWeight,
   primaryReductionSource:effect.primaryReductionSource,
   linkedPrimaryTarget:effect.linkedSlot,
   linkedPrimaryResolved:effect.linkedSlot? !effect.unresolvedAura:null,
   primaryAmplifierLog10:effect.primaryAmplifier.log10,
   primaryBoostScore:effect.primaryBoostScore,
   equipmentPetSources:effect.primaryAmplifier.petSources||[],
   permanentSetPrimaryAmplifierLog10:effect.primaryAmplifier.setLog10,
   primaryAmplifierUnresolved:effect.primaryAmplifier.unknown.map(x=>x.id),
   secondaryKnown:effect.secondaries.known.length,
   secondaryInapplicable:effect.secondaries.inapplicable.length,
   secondaryUnknown:effect.secondaries.unknown.length,
   secondaryConditional:effect.secondaries.conditional.length,
   secondaryEffects:effect.secondaries.known.map(x=>({
    type:x.bonusType,score:x.score,reduction:x.reduction,source:x.source})),
   unmodeledSecondaryTypes:effect.secondaries.unknown.map(x=>x.bonusType)};
  if(effect.score!==null)independentScore+=effect.score;
  recordEquipmentPetWeight(slot,effect,presence,petWeights,passiveWeights);
 }
 const petLevelReport=petLevelEvidence(profile);
 return {selected,independentScore,
   dominantHero:profile?.dominantHero??null,
   heroClassRestricted:profile?.dominantHero?.verified===true,
  inventoryTruncated,autoSelectionBlocked:inventoryTruncated,
  missingExplicitSelections,linkedAuraCount,unresolvedAuraLinks,
  primaryUnknownCount:Object.values(selected).filter(x=>!x.primaryModeled).length,
  secondaryUnknownCount:Object.values(selected).reduce((n,x)=>n+x.secondaryUnknown,0),
  secondaryConditionalCount:Object.values(selected).reduce(
   (n,x)=>n+x.secondaryConditional,0),
  unresolvedAmplifiersCount:Object.values(selected).reduce(
   (n,x)=>n+x.primaryAmplifierUnresolved.length,0),
  selectedSlotCount:Object.keys(selected).length,
  gearSearch:{method:"factorized-single-aura-dependency",examinedConfigurations:search.examinedConfigurations,
   slotEvaluations:search.slotEvaluations,
   ownedInventoryConfigurations:gearSearchSpace,
   ownedInventoryEligibleBySlot:eligibleCount,
   exhaustiveWithinOwnedInventory:exhaustiveWithinOwnedInventory&&
    missingExplicitSelections.length===0,
   shortlisted:false,
   exactForFixedCombatTechniques:exhaustiveWithinOwnedInventory&&missingExplicitSelections.length===0,
   optimizedWithPetCombatTechniquesLevel:Number.isSafeInteger(
    settings?.petCombatTechniquesLevel)?settings.petCombatTechniquesLevel:0,
   exactAcrossSP:false},
  petGearCoupledScreening:true,
  petPrimarySourcesCount:Object.values(selected).reduce(
   (sum,row)=>sum+(row.equipmentPetSources?.length||0),0),
  petEquipmentSlotWeights:petWeights,
  petEquipmentPassiveWeights:passiveWeights,
  petEquipmentCoverageComplete:petLevelReport.trustworthy&&
   ["Pet26","Pet27","Pet28","Pet29","Pet30"].every(id=>
    Object.hasOwn(petLevelReport.levels,id))&&
   profile?.sections?.equipmentInventory?.present===true&&
   profile?.sections?.equipmentInventory?.truncated!==true&&
   resolveGemstoneEvidence(profile).unknown.length===0&&
   CATEGORIES.every(slot=>selected[slot]?.primaryModeled===true)};
}
export const EQUIPMENT_CATEGORIES=CATEGORIES;
