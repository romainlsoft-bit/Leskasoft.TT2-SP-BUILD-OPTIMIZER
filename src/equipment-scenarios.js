/**
 * Interchangeable equipment is a separate optimization dimension, never
 * confused with fixed artifacts, gemstones or Titan research.
 *
 * Score only explicit numeric FIRST effects with verified semantics. Unknown
 * values are kept visible but never given guessed power coefficients.
 */
const CATEGORIES=["Sword","Helmet","Armor","Aura","Slash"];
const GUNBLADE_BUILDS=new Set(["Dagger","Heavenly Strike","Gold Gun","Shadow Clone"]);
const officialSlots=Object.fromEntries(CATEGORIES.map(x=>[x.toLowerCase(),x]));
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
function firstEffectScore(item,settings){
 const log=finiteLog(item.bonusAmount);
 if(log===null||log<0)return null;
 const type=item.bonusType;
 const damage=new Set(["AllDamage","BossDamage"]);
 const gold=new Set(["GoldAll"]);
 if(damage.has(type))return log;
 if(gold.has(type))return log*Math.max(0,Number(settings.goldWeight)||0);
 if(type==="FairyGold"&&settings.gold==="Fairy")
  return log*Math.max(0,Number(settings.goldWeight)||0);
 return null;
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
  const ranked=suitable.map(item=>({...item,estimatedScore:firstEffectScore(item,settings)}))
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
  const effect=firstEffectScore(item,settings);
  selected[slot]={id:item.uid,name:item.displayName,kind:item.helmetKind,modeled:effect!==null};
  // Only additive, unconditional effects are considered here. They do not
  // change skill marginal gains, therefore DP tables remain cacheable.
  if(effect!==null)independentScore+=effect;
 }
 return {selected,independentScore};
}
export const EQUIPMENT_CATEGORIES=CATEGORIES;
