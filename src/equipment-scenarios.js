/**
 * Interchangeable equipment is a separate optimization dimension, never
 * confused with fixed artifacts, gemstones or Titan research.
 *
 * Score only explicit numeric FIRST effects with verified semantics. Unknown
 * values are kept visible but never given guessed power coefficients.
 */
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
function equipmentEffectScore(item,settings){
 const first=firstEffectScore(item,settings),
  secondaries=equipmentSecondaryEvidence(item,settings);
 return {first,secondaries,score:first===null&&secondaries.known.length===0?
  null:(first??0)+secondaries.score};
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
  const ranked=suitable.map(item=>({...item,estimatedScore:equipmentEffectScore(item,settings).score}))
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
 const selected={};
 let independentScore=0;
 for(const slot of CATEGORIES){
  const key=selection[slot];
  const automatic=shortlist[slot]?.[0]||null;
  const item=key?items.find(it=>it.uid===key&&it.slot===slot&&equipmentFit(it,settings)):automatic;
  if(!item)continue;
  const effect=equipmentEffectScore(item,settings);
  selected[slot]={id:item.uid,name:item.displayName,kind:item.helmetKind,
   modeled:effect.score!==null,
   primaryModeled:effect.first!==null,
   secondaryKnown:effect.secondaries.known.length,
   secondaryUnknown:effect.secondaries.unknown.length,
   secondaryEffects:effect.secondaries.known.map(x=>({type:x.bonusType,score:x.score})),
   unmodeledSecondaryTypes:effect.secondaries.unknown.map(x=>x.bonusType)};
  // Explicit direct secondaries are included once; conditional reductions
  // and probability effects have no invented score.
  if(effect.score!==null)independentScore+=effect.score;
 }
 return {selected,independentScore};
}
export const EQUIPMENT_CATEGORIES=CATEGORIES;
