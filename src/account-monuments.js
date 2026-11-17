/**
 * TT2 8.4 monument evidence, not unverified damage formula estimates.
 * A single monument may occur in the monuments and seasonArtifacts export.
 * Reject conflicting levels or seasons, and keep huge levels as strings.
 */
import {SEASON_ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {resolveTranscendenceAge} from "./account-temporal.js";
const BY_ID=new Map(Object.values(SEASON_ARTIFACT_CATALOG).flatMap(item=>[
 [item.id.toLowerCase(),item.id],[item.name.toLowerCase(),item.id]
]));
const SCIENTIFIC=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/;
function safeLevel(value,cap){
 if(value===undefined||value===null)return null;
 const text=String(value).trim();
 if(!SCIENTIFIC.test(text))return null;
 const n=Number(text);
 if(cap>0)return Number.isSafeInteger(n)&&n>=1&&n<=cap?text:null;
 // Source MaxLevel=0 denotes uncapped; never round values such as 1e9999.
 return n>0||n===Infinity?text:null;
}
export function resolveMonumentEvidence(profile,at=new Date()){
 const age=resolveTranscendenceAge(profile,at),grouped=new Map(),unknown=[];
 for(const section of ["monuments","seasonArtifacts"]){
  for(const item of profile?.sections?.[section]?.records||[]){
   const id=BY_ID.get(String(item.id||"").trim().toLowerCase());
   if(!id){unknown.push({section,id:item.id,reason:"unknown-monument-id"});continue;}
   if(!grouped.has(id))grouped.set(id,[]);
   grouped.get(id).push({section,item});
  }
 }
 const entries=[];
 for(const [id,items] of grouped){
  const catalog=SEASON_ARTIFACT_CATALOG[id];
  const levels=[...new Set(items.map(x=>x.item.level).filter(x=>x!==undefined).map(String))];
  const enchants=[...new Set(items.map(x=>x.item.enchanted).filter(x=>x!==undefined).map(String))];
  const seasons=[...new Set(items.map(x=>x.item.season).filter(x=>x!==undefined).map(String))];
  const conflict=levels.length>1||enchants.length>1||seasons.length>1;
  const wrongSeason=seasons.length===1&&age.season!==null&&seasons[0]!==age.season;
  const level=conflict?null:safeLevel(levels[0],catalog.maxLevel);
  const perSeasonDay=catalog.bonusType.includes("PerSeasonDay");
  const formulaStatus=conflict?"ignored-conflicting-export-records":
   wrongSeason?"ignored-wrong-transcendence-season":
   level===null?"ignored-missing-or-invalid-level":
   !catalog.isActive?"inactive-in-8.4-catalog":
   perSeasonDay&&age.days===null?"ignored-missing-transcendence-age":
   "requires-verified-monument-formula";
  entries.push({id,name:catalog.name,category:catalog.category,type:catalog.bonusType,
   level,enchanted:enchants.length===1?enchants[0]:null,
   maxLevel:catalog.maxLevel,catalogActive:catalog.isActive,
   perSeasonDay,seasonDays:perSeasonDay?age.days:null,
   sources:[...new Set(items.map(x=>x.section))],duplicated:items.length>1,
   effectPerLevel:catalog.effectPerLevel,growthExpo:catalog.growthExpo,
   damageBonus:catalog.damageBonus,damageExpo:catalog.damageExpo,
   enchantmentMagnitude:catalog.enchantmentMagnitude,
   enchantmentMult:catalog.enchantmentMult,
   formulaStatus,appliedToScore:false});
 }
 entries.sort((a,b)=>Number(a.id.slice("SeasonalArtifact".length))-Number(b.id.slice("SeasonalArtifact".length)));
 return {
  entries,unknown,catalogCount:Object.keys(SEASON_ARTIFACT_CATALOG).length,
  activeInCatalog:Object.values(SEASON_ARTIFACT_CATALOG).filter(x=>x.isActive).length,
  importedRecords:[...grouped.values()].reduce((sum,x)=>sum+x.length,0),
  recognized:entries.length,
  conflicts:entries.filter(x=>x.formulaStatus==="ignored-conflicting-export-records"||
   x.formulaStatus==="ignored-wrong-transcendence-season").length,
  perSeasonDay:entries.filter(x=>x.perSeasonDay).length,
  missingSeasonAge:entries.filter(x=>x.formulaStatus==="ignored-missing-transcendence-age").length,
  seasonDays:age.days,season:age.season,modeled:0,complete:false
 };
}
