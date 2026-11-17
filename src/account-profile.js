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
 titanResearch:["titanResearch","TitanResearch","titanResearchLevels","TitanResearchLevels"],
 petLevels:["petLevels","PetLevels","pets","Pets"],
 passiveSkills:["passiveSkills","PassiveSkills"],
 monuments:["monuments","Monuments"],
 seasonArtifacts:["seasonArtifacts","SeasonArtifacts","seasonalArtifacts","SeasonalArtifacts","transcendentArtifacts","TranscendentArtifacts"],
 heroWeapons:["heroWeapons","HeroWeapons","heroWeaponLevels","HeroWeaponLevels"],
 clanScrolls:["clanScrolls","ClanScrolls","clanScrollLevels","ClanScrollLevels","scrollLevels","ScrollLevels"],
 uniqueEquipment:["uniqueEquipment","UniqueEquipment","ownedUniqueEquipment","OwnedUniqueEquipment"],
 equipmentSets:["equipmentSets","EquipmentSets","completedEquipmentSets","CompletedEquipmentSets","ownedEquipmentSets","OwnedEquipmentSets","equipmentSetCollection","EquipmentSetCollection"],
 // Acquisition history is optional; the live inventory is NOT historical data.
 equipmentHistory:["equipmentHistory","EquipmentHistory","equipmentAcquisitionHistory","EquipmentAcquisitionHistory","equipmentCollectionHistory","EquipmentCollectionHistory"],
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
  &&/^[\p{L}\p{N}_.: +()\/'’\-]+$/u.test(s)?s:null;
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
const dateText=value=>{
 if(typeof value==="number"&&Number.isFinite(value)&&value>=946684800){
  const ms=value<1e12?value*1000:value;
  const d=new Date(ms);
  return Number.isFinite(d.getTime())?d.toISOString():null;
 }
 if(typeof value!=="string"||value.length>40)return null;
 const v=value.trim();
 if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(v))return null;
 const d=new Date(v);
 return Number.isFinite(d.getTime())?d.toISOString():null;
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
  bonusAmount:["bonusAmount","BonusAmount","primaryAmount","PrimaryAmount","A","a"],
  setId:["setId","SetId","equipmentSet","EquipmentSet","setName","SetName"],
  season:["season","Season","seasonNumber","SeasonNumber","transcendenceSeason","TranscendenceSeason"]
 };
 for(const [key,aliases] of Object.entries(metadata)){
  const selected=field(item,aliases);
  if(!selected.present)continue;
  const value=key==="bonusAmount"?numericText(selected.value):safeName(selected.value);
  if(value!==null)record[key]=value;
 }
 for(const [key,aliases] of Object.entries({
  acquiredAt:["acquiredAt","AcquiredAt","acquiredAtUtc","AcquiredAtUtc","obtainedAt","ObtainedAt","acquisitionDate","AcquisitionDate"],
  completedAt:["completedAt","CompletedAt","completionDate","CompletionDate","setCompletedAt","SetCompletedAt"]
 })){
  const found=field(item,aliases);
  if(found.present){const date=dateText(found.value);if(date)record[key]=date;}
 }
 const enchanted=field(item,["enchanted","Enchanted","isEnchanted","IsEnchanted","e"]);
 if(enchanted.present&&[true,false,0,1,"0","1"].includes(enchanted.value))
  record.enchanted=Boolean(Number(enchanted.value));
 return record;
}
function explicitlyUnlocked(value){
 // Completed-set collections may be boolean maps, not only arrays of IDs.
 // Never count false/zero or explicitly unfinished collections as acquired.
 if(value===false||value===0||value==="false"||value==="FALSE"||value==="0")return false;
 if(!isObject(value))return true;
 const flags=["owned","Owned","isOwned","IsOwned","unlocked","Unlocked",
  "completed","Completed","isCompleted","IsCompleted","collected","Collected"];
 const found=flags.filter(key=>Object.prototype.hasOwnProperty.call(value,key));
 if(!found.length)return true; // A set listed without a negative flag is owned.
 return found.every(key=>value[key]===true||value[key]===1||
  value[key]==="true"||value[key]==="TRUE"||value[key]==="1");
}
function extractEntries(value,maxEntries=MAX_ENTRIES,isEquipment=false,isCompletedSetCollection=false){
 let rows;
 if(Array.isArray(value))rows=value.map((item,index)=>
  [itemId(item)??(typeof item==="string"?item:String(index)),item]);
 else if(isObject(value))rows=Object.entries(value);
 else return {count:0,records:[],truncated:false};
 const records=[];
 for(const [id,item] of rows.slice(0,maxEntries)){
  if(isCompletedSetCollection&&!explicitlyUnlocked(item))continue;
  // A slot-keyed equipped export must retain the actual item ID and the slot.
  const slotKey=isEquipment&&/^(?:Weapon|Sword|Hat|Helmet|Suit|Armor|Aura|Slash)$/i.test(String(id));
  const nested=slotKey&&isObject(item)?field(item,["id","Id","ID","equipmentId","EquipmentId","EquipmentID","itemId","ItemId"]):{present:false};
  const actualId=nested.present?safeName(nested.value):null;
  const normalized=extractRecord(actualId??id,item);
  if(normalized!==null){
   if(slotKey&&!normalized.slot)normalized.slot=String(id);
   records.push(normalized);
  }
 }
 return {count:isCompletedSetCollection?records.length:rows.length,
  records,truncated:rows.length>maxEntries};
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
 transcendenceSeason:["Transcendence Season","TranscendenceSeason","SeasonNumber"],
 necrobearLevel:["Necrobear Level","NecrobearLevel"]
});
export function parseAccountProfile(data){
 if(!isObject(data))throw new TypeError("Expected TT2 account object.");
 const sections={};
 for(const [name,aliases] of Object.entries(SOURCE_SECTIONS)){
  const source=field(data,aliases);
  sections[name]=source.present?{present:true,...extractEntries(source.value,
    ["mysticResearch","titanResearch","forbiddenResearch"].includes(name)?2048:MAX_ENTRIES,
    ["equippedGear","equipmentInventory","equipmentHistory"].includes(name),
    name==="equipmentSets")}
   :{present:false,count:0,records:[],truncated:false};
 }
 const stats=isObject(data.playerStats)?data.playerStats:isObject(data.stats)?data.stats:{};
 const selectedStats={};
 for(const [key,aliases] of Object.entries(STATS)){
  const primary=field(stats,aliases),secondary=field(data,aliases);
  const text=numericText(primary.present?primary.value:secondary.value);
  if(text!==null)selectedStats[key]=text;
 }
 const seasonDate=field(stats,["TranscendenceStartDate","SeasonStartDate","SeasonStartedAt"]);
 const seasonTopDate=field(data,["TranscendenceStartDate","SeasonStartDate","SeasonStartedAt"]);
 const transcendenceStartedAt=dateText(seasonDate.present?seasonDate.value:seasonTopDate.value);
 // Permanent progression is an immutable input snapshot, never a candidate
 // search dimension. Gear/pet changes must not mutate gems or Necrobear.
 const fixedSystems=["artifacts","seasonArtifacts","gemstones","mysticResearch","titanCards","forbiddenResearch","titanResearch","petLevels","passiveSkills","monuments","heroWeapons","clanScrolls","uniqueEquipment"];
 return {schema:"tt2-account-profile-v1",
  dates:transcendenceStartedAt?{transcendenceStartedAt}:{},
  gameVersion:safeName(data.Version??data.version)??null,
  sections,stats:selectedStats,
  fixedSystemKeys:fixedSystems,
  // EquipmentSets is the UNLOCKED collection, not currently held inventory.
  // Selling the fifth item never removes the permanent set effect.
  ownedSetIds:[...new Set(sections.equipmentSets.records.map(r=>r.id))]};
}
export function profileCoverage(profile){
 if(!isObject(profile)||!isObject(profile.sections))return [];
 return PROFILE_SECTION_NAMES.filter(key=>profile.sections[key]?.present===true)
  .map(key=>({key,count:profile.sections[key].count}));
}
