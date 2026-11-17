/**
 * Fixed account-power baseline sourced from TT2 8.4 CSV tables.
 *
 * Titan cards: GrowthExpo^level.
 * Gemstone / Titan research: only rows with BaseEffect=EffectPerLevel=0,
 * GrowthExpo>1; those rows use GrowthExpo^level.
 *
 * All multipliers are represented as base-10 logarithms, never as floating
 * point x10^N multipliers. Other effects (extra levels, raid stats, mana,
 * equipment interactions) are NOT estimated and remain unresolved.
 *
 * This baseline is immutable across SP candidates. Adding a constant to
 * each candidate's score cannot change marginal SP allocation, but is
 * required for absolute context and later *validated* cross-build ranking.
 */
import {ACCOUNT_SCALING} from "../vendor/account-scaling.js";
import {clanScrollEvidence} from "./account-scrolls.js";

const MAX_LEVEL=100000;
const KNOWN_MULTIPLIER=/^[A-Za-z][A-Za-z0-9_]*:([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?)$/;
const DIRECT_DAMAGE_TYPES=Object.freeze({
 "Clan Ship":["ClanShipDamage"],
 "Pet":["PetDamage"],
 "Shadow Clone":["ShadowCloneSkillAmount","CloneDmg"],
 "Heavenly Strike":["BurstDamageSkillAmount"],
 "Dagger":["UltraDaggerDamage"],
 "Gold Gun":["GoldGunDamage"]
});
const DIRECT_GOLD_TYPES=Object.freeze({
 Fairy:["FairyGold"],
 HoG:["GoldBoss"],
 Chesterson:["GoldChesterson"]
});
const cache=new WeakMap();
function logScientific(value){
 const s=String(value??"").trim();
 if(!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(s))return null;
 const m=s.match(/^\+?(\d+(?:\.\d*)?|\.\d+)(?:[Ee]([+-]?\d+))?$/);
 const mantissa=Number(m[1]),expo=Number(m[2]||0);
 if(!Number.isFinite(mantissa)||mantissa<=0||!Number.isFinite(expo))return null;
 return Math.log10(mantissa)+expo;
}
function numericLevel(value,max){
 const n=Number(value);
 return Number.isSafeInteger(n)&&n>0&&n<=max&&n<=MAX_LEVEL?n:null;
}
function cleanId(id){
 const text=String(id||"").trim();
 return text.length<=90?text:null;
}
function lookupRow(group,id){
 const raw=cleanId(id);
 if(raw===null)return null;
 const source=ACCOUNT_SCALING[group]||[];
 const name=raw.toLowerCase();
 return source.find(r=>r.id===raw||(group==="titanCards"&&r.name?.toLowerCase()===name))||null;
}
function findResearchRows(records,group,out,unknown){
 // Normalize IDs before counting: an ID and its localized/display name can
 // identify the same Titan Card. All ambiguous duplicates are excluded,
 // including the first occurrence, rather than choosing a favorable level.
 const rows=records.map(record=>({record,row:lookupRow(group,record.id)}));
 const occurrences=new Map();
 for(const {row} of rows)if(row)occurrences.set(row.id,(occurrences.get(row.id)||0)+1);
 for(const {record,row} of rows){
  if(!row){unknown.push({system:group,id:record.id,reason:"unknown-id-or-nonmultiplicative"});continue;}
  if(occurrences.get(row.id)>1){
   unknown.push({system:group,id:row.id,reason:"duplicate-source-id"});continue;
  }
  const level=numericLevel(record.level,row.maxLevel);
  if(level===null){unknown.push({system:group,id:record.id,reason:"missing-or-invalid-level"});continue;}
  const log10=level*Math.log10(row.growth);
  if(!Number.isFinite(log10)){unknown.push({system:group,id:record.id,reason:"nonfinite"});continue;}
  out.push({system:group,id:row.id,name:row.name||row.id,
   bonusType:row.bonusType,level,log10});
 }
}
function addGemstoneValues(records,out,unknown){
 for(const item of records){
  let found=false;
  const values=[
   ...(typeof item.primary==="string"?[item.primary]:[]),
   ...(Array.isArray(item.secondary)?item.secondary:typeof item.secondary==="string"?[item.secondary]:[])
  ];
  for(const value of values){
   const matched=String(value).match(KNOWN_MULTIPLIER);
   if(!matched){unknown.push({system:"gemstones",id:item.id,reason:"unknown-bonus-format"});continue;}
   const colon=value.indexOf(":"),type=value.slice(0,colon);
   const log10=logScientific(value.slice(colon+1));
   if(log10===null){unknown.push({system:"gemstones",id:item.id,reason:"invalid-bonus-value"});continue;}
   found=true;
   out.push({system:"gemstones",id:item.id,bonusType:type,
    log10,level:item.level?Number(item.level):null});
  }
  if(!found)unknown.push({system:"gemstones",id:item.id,reason:"missing-explicit-bonus"});
 }
}
export function extractFixedAccountPower(profile){
 if(!profile||typeof profile!=="object")return {available:false,byType:{},entries:[],unsupported:[],matched:0};
 if(cache.has(profile))return cache.get(profile);
 const sections=profile.sections||{};
 const entries=[],unsupported=[];
 const from=key=>sections[key]?.records||[];
 findResearchRows(from("mysticResearch"),"gemstoneResearch",entries,unsupported);
 findResearchRows(from("titanCards"),"titanCards",entries,unsupported);
 // This research can be exported as either TitanResearch or ForbiddenResearch.
 // Prefer the explicit collection; never apply the same nodes twice.
 const titanResearch=sections.titanResearch?.present?from("titanResearch"):from("forbiddenResearch");
 findResearchRows(titanResearch,"titanResearch",entries,unsupported);
 addGemstoneValues(from("gemstones"),entries,unsupported);
 const scrolls=clanScrollEvidence(profile);
 for(const row of scrolls.entries){
  if(row.log10===null){unsupported.push({system:"clanScrolls",id:row.id,reason:"additive-unverified"});continue;}
  entries.push({system:"clanScrolls",id:row.id,bonusType:row.bonusType,level:row.level,
   log10:row.setBoostedLog10??row.log10,setBoostModeled:scrolls.setBoostModeled,
   rawLog10:row.log10,setBonusPercent:scrolls.setBonusPercent});
 }
 for(const row of scrolls.unknown)unsupported.push({system:"clanScrolls",...row});
 const byType={};
 for(const entry of entries)byType[entry.bonusType]=(byType[entry.bonusType]||0)+entry.log10;
 const value={available:entries.length>0,byType,entries,unsupported,
  matched:entries.length,unknown:unsupported.length,
  // These only describe *some* systems. They must not be treated as complete.
  complete:false};
 cache.set(profile,value);
 return value;
}
export function fixedAccountScore(power,settings){
 if(!power?.available)return {damageLog10:0,goldLog10:0,weightedLog10:0,types:[]};
 const types=["AllDamage",...(DIRECT_DAMAGE_TYPES[settings.damage]||[])];
 const goldTypes=["GoldAll",...(DIRECT_GOLD_TYPES[settings.gold]||[])];
 const damageLog10=types.reduce((a,t)=>a+(power.byType[t]||0),0);
 const goldLog10=goldTypes.reduce((a,t)=>a+(power.byType[t]||0),0);
 const weight=Number(settings.goldWeight);
 return {damageLog10,goldLog10,
  weightedLog10:damageLog10+(Number.isFinite(weight)?weight:0)*goldLog10,
  types:[...types,...goldTypes]};
}
export function formatLogMultiplier(log10){
 if(!Number.isFinite(log10))return "unknown";
 if(log10===0)return "×1";
 const exponent=Math.floor(log10);
 const m=Math.pow(10,log10-exponent);
 return "×"+m.toFixed(2)+"e"+(exponent>=0?"+":"")+exponent;
}
