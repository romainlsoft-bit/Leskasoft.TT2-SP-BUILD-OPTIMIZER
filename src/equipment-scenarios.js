/**
 * Interchangeable equipment is a separate optimization dimension, never
 * confused with fixed artifacts, gemstones or Titan research.
 *
 * Score only explicit numeric FIRST effects with verified semantics. Unknown
 * values are kept visible but never given guessed power coefficients.
 */
import {ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {equipmentEffectReduction,EQUIPMENT_AURA_TARGETS} from "./equipment-reductions.js";
import {calculatePermanentArtifactEffects} from "./account-artifacts.js";
import {petPassiveEvidence,logPassivePetMultiplier} from "./pet-scenarios.js?v=20261118-pet-equipment-o";
import {petLevelEvidence} from "./account-pet-levels.js";
import {extractFixedAccountPower} from "./account-power.js?v=20261117-hero-classes";
import {resolveGemstoneEvidence} from "./account-gemstones.js?v=20261118-pet-equipment-o";
import {resolvePermanentSetPower,resolveCraftingPower} from "./account-permanent-sets.js";
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
export function equipmentSecondaryEvidence(item,settings){
 const known=[],unknown=[],inapplicable=[],effects=item.secondaryEffects||[];
 for(const effect of effects){
  const reduction=equipmentEffectReduction(effect.bonusType,settings);
  const score=directEffectScore(effect.bonusType,effect.bonusAmount,settings);
  if(score===null)unknown.push({...effect,status:reduction.status});
  else if(reduction.status==="inapplicable")
   inapplicable.push({...effect,score:0,source:reduction.source});
  else known.push({...effect,score,source:reduction.source,reduction:reduction.weight});
 }
 return {recorded:effects.length,known,unknown,inapplicable,
  score:known.reduce((n,x)=>n+x.score,0),complete:unknown.length===0};
}
const BOOST_BY_SLOT={Sword:"SwordBoost",Helmet:"HelmetBoost",Armor:"ArmorBoost",
 Aura:"AuraBoost",Slash:"SlashBoost"};
const equipmentBoostCache=new WeakMap();
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
   const exoticEquipment=/^Pet(26|27|28|29|30)$/.test(pet.id);
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
function rankEquipment(items,settings,profile,limit,selected={}){
 const ranked=items.map(item=>({...item,
  estimatedScore:equipmentEffectScore(item,settings,profile,selected).score}))
  .sort((a,b)=>(b.estimatedScore??-Infinity)-(a.estimatedScore??-Infinity)
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
export function bestEquipmentByCategory(profile,settings,limit=2){
 const incomplete=profile?.sections?.equipmentInventory?.truncated===true;
 const list=incomplete?[]:ownedEquipment(profile);
 const output={},selected={};
 // Targets MUST precede Aura: its primary effect is linked to precisely one
 // already selected Sword, Helmet or Slash, never independent damage.
 for(const slot of ["Sword","Helmet","Armor","Slash","Aura"]){
  const suitable=list.filter(item=>item.slot===slot&&equipmentFit(item,settings,profile));
  output[slot]=rankEquipment(suitable,settings,profile,limit,selected);
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
export function gearSelectionEffects(profile,settings,selection={}){
 const items=ownedEquipment(profile);
 const shortlist=bestEquipmentByCategory(profile,settings,2);
 const selected={},selectedGear={},petWeights={},passiveWeights={};
 const inventoryTruncated=profile?.sections?.equipmentInventory?.truncated===true;
 const missingExplicitSelections=[];
 // A strong Aura can make a slightly weaker standalone Sword/Helmet/Slash
 // the better *combined* choice. Enumerate the bounded two-per-slot shortlist
 // instead of choosing every primary independently; honor manual selections.
 // This is NOT a global optimum proof over unexamined inventory candidates.
 const autoChoices={...Object.fromEntries(CATEGORIES.map(slot=>[
  slot,shortlist[slot]?.[0]??null]))};
 if(!inventoryTruncated){
  const options=slot=>{
   if(selection[slot]){
    return [items.find(it=>it.uid===selection[slot]&&
     it.slot===slot&&equipmentFit(it,settings,profile))??null];
   }
   return shortlist[slot]?.length?shortlist[slot]:[null];
  };
  let winning=-Infinity;
  const armor=selection.Armor?
   items.find(it=>it.uid===selection.Armor&&it.slot==="Armor")??null:
   autoChoices.Armor;
  const armorScore=armor?equipmentEffectScore(armor,settings,profile).score??0:0;
  for(const sword of options("Sword"))
   for(const helmet of options("Helmet"))
    for(const slash of options("Slash")){
     const gear={Sword:sword,Helmet:helmet,Slash:slash};
     const base=[sword,helmet,slash].reduce((sum,item)=>
      sum+(item?equipmentEffectScore(item,settings,profile).score??0:0),armorScore);
     const auraOptions=selection.Aura?
      [items.find(it=>it.uid===selection.Aura&&it.slot==="Aura")??null]:
      rankEquipment(items.filter(it=>it.slot==="Aura"),settings,profile,2,gear);
     if(!auraOptions.length)auraOptions.push(null);
     for(const aura of auraOptions){
      const total=base+(aura?
       equipmentEffectScore(aura,settings,profile,gear).score??0:0);
      if(total>winning){
       winning=total;
       Object.assign(autoChoices,{Sword:sword,Helmet:helmet,Slash:slash,
        Armor:armor,Aura:aura});
      }
     }
    }
 }
 const equippedPets=new Map(petPassiveEvidence(profile).entries
  .filter(x=>x.level>0).map(x=>[x.bonusType,x]));
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
   secondaryEffects:effect.secondaries.known.map(x=>({
    type:x.bonusType,score:x.score,reduction:x.reduction,source:x.source})),
   unmodeledSecondaryTypes:effect.secondaries.unknown.map(x=>x.bonusType)};
  if(effect.score!==null)independentScore+=effect.score;
  const equipmentPet=equippedPets.get(BOOST_BY_SLOT[slot]);
  const primaryWeight=effect.first===null?0:
   Math.max(0,effect.primarySourceWeight??0);
  if(equipmentPet&&primaryWeight>0){
   petWeights[slot]=primaryWeight;
   if(equipmentPet.passiveFraction>0)passiveWeights[slot]=primaryWeight;
  }
 }
 const petLevelReport=petLevelEvidence(profile);
 return {selected,independentScore,
   dominantHero:profile?.dominantHero??null,
   heroClassRestricted:profile?.dominantHero?.verified===true,
  inventoryTruncated,autoSelectionBlocked:inventoryTruncated,
  missingExplicitSelections,linkedAuraCount,unresolvedAuraLinks,
  primaryUnknownCount:Object.values(selected).filter(x=>!x.primaryModeled).length,
  secondaryUnknownCount:Object.values(selected).reduce((n,x)=>n+x.secondaryUnknown,0),
  unresolvedAmplifiersCount:Object.values(selected).reduce(
   (n,x)=>n+x.primaryAmplifierUnresolved.length,0),
  selectedSlotCount:Object.keys(selected).length,
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
