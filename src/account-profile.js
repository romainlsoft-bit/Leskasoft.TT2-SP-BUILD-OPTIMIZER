/**
 * TT2 full-account export parser. This never persists the raw player save.
 * Only allowlisted mechanics fields are retained, without any identity data.
 * A present section is NOT necessarily modeled by the optimizer score.
 */
const SOURCE_SECTIONS=Object.freeze({
 artifacts:["artifacts","Artifacts","artifactLevels","ArtifactLevels"],
 gemstones:["gemstones","Gemstones","mysticGemstones","MysticGemstones"],
 mysticResearch:["gemstonesResearch","GemstonesResearch","gemstoneResearch","GemstoneResearch","mysticResearch","MysticResearch"],
 titanCards:["titanCards","TitanCards","necrobearCards","NecrobearCards","titanCollection","TitanCollection"],
 forbiddenResearch:["forbiddenResearch","ForbiddenResearch","necrobearResearch","NecrobearResearch","forbiddenResearchTree","ForbiddenResearchTree"],
 petLevels:["petLevels","PetLevels","pets","Pets"],
 passiveSkills:["passiveSkills","PassiveSkills"],
 monuments:["monuments","Monuments"],
 heroWeapons:["heroWeapons","HeroWeapons","heroWeaponLevels","HeroWeaponLevels"],
 equipmentSets:["equipmentSets","EquipmentSets"],
 equippedGear:["equippedEquipment","EquippedEquipment","equippedGear","EquippedGear"],
 equipmentInventory:["equipmentInventory","EquipmentInventory","ownedEquipment","OwnedEquipment","equipmentItems","EquipmentItems","equipment","Equipment"]
});
export const PROFILE_SECTION_NAMES=Object.keys(SOURCE_SECTIONS);
const MAX_ENTRIES=512;
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function field(record,names){
 if(!isObject(record))return {present:false,value:null};
 for(const name of names)if(Object.prototype.hasOwnProperty.call(record,name)&&record[name]!=null)
  return {present:true,value:record[name]};
 return {present:false,value:null};
}
const safeName=x=>{
 if(typeof x!=="string"&&typeof x!=="number")return null;
 const s=String(x).trim();
 return s&&s.length<=90&&!["__proto__","prototype","constructor"].includes(s)
  &&/^[\p{L}\p{N}_.: +()\/-]+$/u.test(s)?s:null;
};
const numericText=x=>{
 if(typeof x==="number")return Number.isFinite(x)?String(x):null;
 if(typeof x!=="string")return null;
 const s=x.trim();
 return s.length<=96&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(s)?s:null;
};
const itemId=x=>{
 if(!isObject(x))return null;
 for(const k of ["id","Id","ID","name","Name","key","Key","type","Type","setId","SetId"]){
  const v=safeName(x[k]);if(v!==null)return v;
 }
 return null;
};
const RECORD_FIELDS={
 level:["level","Level","lvl","Lvl","lv","Lv","upgradeLevel","UpgradeLevel"],
 amount:["amount","Amount","num","Num","count","Count","quantity","Quantity","total","Total"],
 primary:["primary","Primary","primaryBonus","PrimaryBonus","BonusTypeA"],
 secondary:["secondary","Secondary","secondaryBonus","SecondaryBonus","BonusTypeB"]
};
function extractRecord(rawId,item){
 const id=safeName(rawId)??itemId(item);
 if(id===null)return null;
 const record={id};
 if(!isObject(item)){
  const level=numericText(item);
  if(level!==null)record.level=level;
  return record;
 }
 for(const [key,names] of Object.entries(RECORD_FIELDS)){
  const selected=field(item,names);
  if(!selected.present)continue;
  if(key==="primary"||key==="secondary"){
   const values=Array.isArray(selected.value)?selected.value:[selected.value];
   const bonuses=values.slice(0,6).filter(x=>typeof x==="string")
    .map(x=>x.trim()).filter(x=>/^[A-Za-z][A-Za-z0-9_]*:[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(x)&&x.length<=110);
   if(bonuses.length)record[key]=key==="primary"?bonuses[0]:bonuses;
  }else{
   const value=numericText(selected.value);
   if(value!==null)record[key]=value;
  }
 }
 // These fields describe actual interchangeable equipment and never
 // constitute an inferred selection of what is currently equipped.
 const metadata={
  slot:["slot","Slot","category","Category","equipmentType","EquipmentType","equipType","EquipType"],
  name:["name","Name","displayName","DisplayName"],
  rarity:["rarity","Rarity"],
  bonusType:["bonusType","BonusType","primaryType","PrimaryType","BonusTypeA"],
  bonusAmount:["bonusAmount","BonusAmount","primaryAmount","PrimaryAmount","A","a"]
 };
 for(const [key,aliases] of Object.entries(metadata)){
  const selected=field(item,aliases);
  if(!selected.present)continue;
  const value=key==="bonusAmount"?numericText(selected.value):safeName(selected.value);
  if(value!==null)record[key]=value;
 }
 const enchanted=field(item,["enchanted","Enchanted","isEnchanted","IsEnchanted","e"]);
 if(enchanted.present&&[true,false,0,1,"0","1"].includes(enchanted.value))
  record.enchanted=Boolean(Number(enchanted.value));
 return record;
}
function extractEntries(value){
 let rows;
 if(Array.isArray(value))rows=value.map((item,index)=>
  [itemId(item)??(typeof item==="string"?item:String(index)),item]);
 else if(isObject(value))rows=Object.entries(value);
 else return {count:0,records:[],truncated:false};
 const records=[];
 for(const [id,item] of rows.slice(0,MAX_ENTRIES)){
  const normalized=extractRecord(id,item);
  if(normalized!==null)records.push(normalized);
 }
 return {count:rows.length,records,truncated:rows.length>MAX_ENTRIES};
}
const STATS=Object.freeze({
 lifetimeRelics:["Lifetime Relics","LifetimeRelics","Relics Earned","RelicsEarned"],
 relics:["Relics","Current Relics","CurrentRelics"],
 titanSouls:["Titan Souls","TitanSouls","Current Titan Souls","CurrentTitanSouls"],
 titanSoulsSpent:["Titan Souls Spent","TitanSoulsSpent","Lifetime Titan Souls Spent","LifetimeTitanSoulsSpent"],
 craftingPower:["Crafting Power","CraftingPower","CP"],
 heroWeaponUpgrades:["Hero Weapon Upgrades","HeroWeaponUpgrades"],
 clanScrollUpgrades:["Clan Scroll Upgrades","ClanScrollUpgrades"],
 totalPetLevels:["Total Pet Levels","TotalPetLevels"],
 necrobearLevel:["Necrobear Level","NecrobearLevel"]
});
export function parseAccountProfile(data){
 if(!isObject(data))throw new TypeError("Expected TT2 account object.");
 const sections={};
 for(const [name,aliases] of Object.entries(SOURCE_SECTIONS)){
  const source=field(data,aliases);
  sections[name]=source.present?{present:true,...extractEntries(source.value)}
   :{present:false,count:0,records:[],truncated:false};
 }
 const stats=isObject(data.playerStats)?data.playerStats:isObject(data.stats)?data.stats:{};
 const selectedStats={};
 for(const [key,aliases] of Object.entries(STATS)){
  const primary=field(stats,aliases),secondary=field(data,aliases);
  const text=numericText(primary.present?primary.value:secondary.value);
  if(text!==null)selectedStats[key]=text;
 }
 // Permanent progression is an immutable input snapshot, never a candidate
 // search dimension. Gear/pet changes must not mutate gems or Necrobear.
 const fixedSystems=["artifacts","gemstones","mysticResearch","titanCards","forbiddenResearch","petLevels","passiveSkills","monuments","heroWeapons"];
 return {schema:"tt2-account-profile-v1",
  gameVersion:safeName(data.Version??data.version)??null,
  sections,stats:selectedStats,
  fixedSystemKeys:fixedSystems,
  ownedSetIds:sections.equipmentSets.records.map(r=>r.id)};
}
export function profileCoverage(profile){
 if(!isObject(profile)||!isObject(profile.sections))return [];
 return PROFILE_SECTION_NAMES.filter(key=>profile.sections[key]?.present===true)
  .map(key=>({key,count:profile.sections[key].count}));
}
