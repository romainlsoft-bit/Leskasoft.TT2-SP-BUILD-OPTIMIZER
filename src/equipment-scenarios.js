/**
 * Interchangeable equipment is a separate optimization dimension, never
 * confused with fixed artifacts, gemstones or Titan research.
 *
 * Score only explicit numeric FIRST effects with verified semantics. Unknown
 * values are kept visible but never given guessed power coefficients.
 */
import {ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {calculatePermanentArtifactEffects} from "./account-artifacts.js";
import {petPassiveEvidence,logPassivePetMultiplier} from "./pet-scenarios.js?v=20261117-pet-gemstone-chain";
import {petLevelEvidence} from "./account-pet-levels.js";
import {extractFixedAccountPower} from "./account-power.js?v=20261117-pet-gemstone-chain";
import {resolveGemstoneEvidence} from "./account-gemstones.js?v=20261117-pet-gemstone-chain";
const CATEGORIES=["Sword","Helmet","Armor","Aura","Slash"];
const GUNBLADE_BUILDS=new Set(["Dagger","Heavenly Strike","Gold Gun","Shadow Clone"]);
const officialSlots={...Object.fromEntries(CATEGORIES.map(x=>[x.toLowerCase(),x])),
 weapon:"Sword",hat:"Helmet",suit:"Armor",chest:"Armor"};
const finiteLog=value=>{
 const s=String(value??"").trim();
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(s))return null;
 const match=s.match(/^(\d+(?:\.\d*)?|\.\d+)(?:[Ee]([+-]?\d+))?$/);
 const mantissa=Number(match[1]),exp=Number(match[2]||0);
 return mantissa>0&&Number.isFinite(mantissa)&&Number.isFinite(exp)?Math.log10(mantissa)+exp:null;
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
function equipmentFit(item,settings){
 if(item.slot!=="Helmet")return true;
 const kind=helmetKind(item);
 if(GUNBLADE_BUILDS.has(settings.damage))return kind==="Gunblade";
 return ["Elder Snow Cap","Ranged hero","Spell hero","Melee hero"].includes(kind);
}
function directEffectScore(type,amount,settings){
 const log=finiteLog(amount);
 if(log===null||log<0)return null;
 const byDamage={
  "Pet":["PetDamage"],"Clan Ship":["ClanShipDamage"],
  "Shadow Clone":["ShadowCloneSkillAmount","CloneDmg"],
  "Heavenly Strike":["BurstDamageSkillAmount"],
  "Dagger":["UltraDaggerDamage"],"Gold Gun":["GoldGunDamage"]
 };
 if(["AllDamage","BossDamage"].includes(type)||
    (byDamage[settings.damage]||[]).includes(type))return log;
 const weight=Math.max(0,Number(settings.goldWeight)||0);
 if(type==="GoldAll")return log*weight;
 const byGold={Fairy:["FairyGold"],HoG:["GoldBoss"],Chesterson:["ChestAmount"]};
 if((byGold[settings.gold]||[]).includes(type))return log*weight;
 return null;
}
function firstEffectScore(item,settings){
 return directEffectScore(item.bonusType,item.bonusAmount,settings);
}
export function equipmentSecondaryEvidence(item,settings){
 const known=[],unknown=[],effects=item.secondaryEffects||[];
 for(const effect of effects){
  const score=directEffectScore(effect.bonusType,effect.bonusAmount,settings);
  if(score===null)unknown.push({...effect,status:"requires-verified-reduction-or-probability"});
  else known.push({...effect,score});
 }
 return {recorded:effects.length,known,unknown,
  score:known.reduce((n,x)=>n+x.score,0),complete:unknown.length===0};
}
const BOOST_BY_SLOT={Sword:"SwordBoost",Helmet:"HelmetBoost",Armor:"ArmorBoost",
 Aura:"AuraBoost",Slash:"SlashBoost"};
const equipmentBoostCache=new WeakMap();
/** Equipment pet bonus chain: five Exotic pet passives -> Restored Rune
 * Heart -> equipment primary; alongside Ring of Calisto and slot-specific
 * artifacts/research. No secondary roll is amplified by this chain.
 */
export function equipmentPrimaryAmplifiers(profile){
 const empty={bySlot:Object.fromEntries(CATEGORIES.map(slot=>[slot,{log10:0,
  petLog10:0,artifactLog10:0,unknown:[]}]))};
 if(!profile)return empty;
 if(equipmentBoostCache.has(profile))return equipmentBoostCache.get(profile);
 const artifact=calculatePermanentArtifactEffects(profile,ARTIFACT_CATALOG);
 const pets=petPassiveEvidence(profile);
 const fixed=extractFixedAccountPower(profile);
 const gems=resolveGemstoneEvidence(profile);
 const all=artifact.entries.find(x=>x.bonusType==="AllEquipmentEffect");
 const rune=artifact.entries.find(x=>x.bonusType==="EquipmentPetEffect");
 const bySlot={};
 for(const slot of CATEGORIES){
  const bonusType=BOOST_BY_SLOT[slot],unknown=[];
  let artifactLog10=0,petLog10=0,gemstoneLog10=0;
  const target=artifact.entries.find(x=>x.bonusType===bonusType);
  for(const row of [all,target]){
   if(!row)continue;
   if(Number.isFinite(row.log10))artifactLog10+=row.log10;
   else unknown.push({id:row.id,reason:row.status});
  }
  const pet=pets.entries.find(x=>x.bonusType===bonusType);
  if(pet&&pet.passiveFraction>0&&Number.isFinite(pet.log10)){
   // Restored Rune Heart multiplies the full pet effect BEFORE applying
   // the 5%-per-five-level passive share. Applying rune to a zero passive
   // would create a phantom equipment bonus at levels 1-4.
   let runeLog10=0;
   if(rune){
    if(Number.isFinite(rune.log10))runeLog10=rune.log10;
    else unknown.push({id:rune.id,reason:rune.status});
   }
   const gemRune=gems.entries.filter(x=>x.bonusType==="EquipmentPetEffect")
    .reduce((total,row)=>total+row.log10,0);
   petLog10+=logPassivePetMultiplier(
    pet.rawLog10+pet.amplifierLog10+runeLog10+gemRune,pet.level);
  }
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
  bySlot[slot]={log10:artifactLog10+gemstoneLog10+petLog10,
   petLog10,artifactLog10,gemstoneLog10,unknown};
 }
 const result={bySlot};
 equipmentBoostCache.set(profile,result);return result;
}
function equipmentEffectScore(item,settings,profile){
 const first=firstEffectScore(item,settings),
  secondaries=equipmentSecondaryEvidence(item,settings);
 const primaryAmplifier=equipmentPrimaryAmplifiers(profile).bySlot[item.slot];
 // sourceWeight=1 for damage and goldWeight for gold, to avoid giving a
 // gold-only amplifier the wrong weight on the SP comparison.
 const sourceWeight=directEffectScore(item.bonusType,"10",settings);
 const amp=first!==null&&sourceWeight!==null?
  primaryAmplifier.log10*sourceWeight:0;
 return {first,secondaries,primaryAmplifier,primaryBoostScore:amp,
  score:first===null&&secondaries.known.length===0?
   null:(first??0)+amp+secondaries.score};
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
 const list=ownedEquipment(profile);
 const output={};
 for(const slot of CATEGORIES){
  const suitable=list.filter(item=>item.slot===slot&&equipmentFit(item,settings));
  const ranked=suitable.map(item=>({...item,estimatedScore:equipmentEffectScore(item,settings,profile).score}))
   .sort((a,b)=>(b.estimatedScore??-Infinity)-(a.estimatedScore??-Infinity)
    ||a.displayName.localeCompare(b.displayName));
  const verified=ranked.filter(x=>x.estimatedScore!==null);
  const unknown=ranked.filter(x=>x.estimatedScore===null);
  output[slot]=[...verified.slice(0,limit),...unknown.slice(0,Math.max(0,limit-verified.length))];
 }
 // A set of Ranged/Spell/Melee helmets is a rotation suggestion, not
 // one helmet worn simultaneously or three independent gear slots.
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
 const selected={},petWeights={},passiveWeights={};
 const equippedPets=new Map(petPassiveEvidence(profile).entries
  .filter(x=>x.level>0).map(x=>[x.bonusType,x]));
 let independentScore=0;
 for(const slot of CATEGORIES){
  const key=selection[slot];
  const automatic=shortlist[slot]?.[0]||null;
  const item=key?items.find(it=>it.uid===key&&it.slot===slot&&equipmentFit(it,settings)):automatic;
  if(!item)continue;
  const effect=equipmentEffectScore(item,settings,profile);
  selected[slot]={id:item.uid,name:item.displayName,kind:item.helmetKind,
   modeled:effect.score!==null,
   primaryModeled:effect.first!==null,
   primaryAmplifierLog10:effect.primaryAmplifier.log10,
   primaryBoostScore:effect.primaryBoostScore,
   primaryAmplifierUnresolved:effect.primaryAmplifier.unknown.map(x=>x.id),
   secondaryKnown:effect.secondaries.known.length,
   secondaryUnknown:effect.secondaries.unknown.length,
   secondaryEffects:effect.secondaries.known.map(x=>({type:x.bonusType,score:x.score})),
   unmodeledSecondaryTypes:effect.secondaries.unknown.map(x=>x.bonusType)};
  // Explicit direct secondaries are included once; conditional reductions
  // and probability effects have no invented score.
  if(effect.score!==null)independentScore+=effect.score;
  const equipmentPet=equippedPets.get(BOOST_BY_SLOT[slot]);
  const primaryWeight=effect.first===null?0:
   Math.max(0,directEffectScore(item.bonusType,"10",settings)??0);
  if(equipmentPet&&primaryWeight>0){
   petWeights[slot]=primaryWeight;
   if(equipmentPet.passiveFraction>0)passiveWeights[slot]=primaryWeight;
  }
 }
 return {selected,independentScore,
  petEquipmentSlotWeights:petWeights,
  petEquipmentPassiveWeights:passiveWeights,
  // A present pet section is not necessarily a complete Exotic roster.
  // Unknown levels must not permit the solver to discard existing CT SP.
  petEquipmentCoverageComplete:petLevelEvidence(profile).trustworthy&&
   ["Pet26","Pet27","Pet28","Pet29","Pet30"].every(id=>
    Object.hasOwn(petLevelEvidence(profile).levels,id))&&
   profile?.sections?.equipmentInventory?.present===true&&
   profile?.sections?.equipmentInventory?.truncated!==true&&
   resolveGemstoneEvidence(profile).unknown.length===0&&
   CATEGORIES.every(slot=>selected[slot]?.primaryModeled===true)};
}
export const EQUIPMENT_CATEGORIES=CATEGORIES;
