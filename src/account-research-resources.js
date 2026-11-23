/**
 * TT2 8.4 linear resource research: GemstoneLevel and Titan Souls.
 *
 * Both research families are additive progression resources, NOT damage
 * multipliers. Explicit gemstone effect multipliers from the export may
 * already incorporate research-granted levels. Never apply them twice.
 *
 * An incomplete or contradictory export does not justify a claimed total:
 * valid nodes remain inspectable, but aggregate resource rates are unknown.
 */
import {RESOURCE_RESEARCH_CATALOG} from "../vendor/account-research-resources.js?v=20261123-spell-score-r1";
const GEM=new Map(RESOURCE_RESEARCH_CATALOG.gemstoneLevel.map(x=>[x.id,x]));
const SOUL=new Map(RESOURCE_RESEARCH_CATALOG.titanSouls.map(x=>[x.id,x]));

function validLevel(value,max){
 if(typeof value!=="string"&&typeof value!=="number")return null;
 const raw=String(value).trim();
 if(!/^\d+$/.test(raw))return null;
 const level=Number(raw);
 return Number.isSafeInteger(level)&&level>=0&&level<=max?level:null;
}

/**
 * Merge Necrobear aliases only when the same purchase is corroborated.
 * Different IDs from separate sections are a union, never an intersection.
 * Duplicate IDs within one section and contradictory cross-section levels
 * are excluded. If either section was truncated, discard the entire merged
 * tree rather than scoring a potentially misleading fragment.
 */
export function mergeTitanResearch(profile){
 const sections=profile?.sections||{},keys=["titanResearch","forbiddenResearch"];
 const sources=Object.fromEntries(keys.map(key=>[key,sections[key]?.present===true]));
 const truncatedSections=keys.filter(key=>sections[key]?.truncated===true);
 const rows=[];
 for(const key of keys)for(const record of sections[key]?.records||[])
  rows.push({record,source:key});
 if(truncatedSections.length)return {
  records:[],unknown:truncatedSections.map(section=>({
   system:"titanResearch",section,reason:"truncated-research-export"
  })),sources,totalRawRecords:rows.length,truncated:true,
  truncatedSections,mirroredPurchases:0
 };
 const groups=new Map(),unknown=[],records=[];
 for(const item of rows){
  const id=String(item.record.id??"");
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(item);
 }
 let mirroredPurchases=0;
 for(const [id,found] of groups){
  const origins=new Set(found.map(x=>x.source));
  if(origins.size!==found.length||found.length>2){
   unknown.push({system:"titanResearch",id,reason:"duplicate-source-id"});
   continue;
  }
  const levels=found.map(x=>validLevel(x.record.level,Number.MAX_SAFE_INTEGER));
  if(levels.some(x=>x===null)){
   unknown.push({system:"titanResearch",id,reason:"missing-or-invalid-level"});
   continue;
  }
  if(new Set(levels).size!==1){
   unknown.push({system:"titanResearch",id,reason:"conflicting-export-levels"});
   continue;
  }
  const {record}=found[0];
  records.push({...record,level:String(levels[0])});
  if(found.length===2)mirroredPurchases++;
 }
 return {records,unknown,sources,totalRawRecords:rows.length,
  truncated:false,truncatedSections:[],mirroredPurchases};
}

function accumulate(records,catalog,system){
 const occurrences=new Map(),valid=[],unknown=[];
 for(const record of records){
  const id=String(record.id??"");
  if(!catalog.has(id))continue; // Other research effects have their own model.
  occurrences.set(id,(occurrences.get(id)||0)+1);
 }
 for(const record of records){
  const id=String(record.id??""),source=catalog.get(id);
  if(!source)continue;
  if(occurrences.get(id)>1){
   // One issue per repeated node, without treating any copy as canonical.
   if(!unknown.some(x=>x.id===id))
    unknown.push({system,id,reason:"duplicate-source-id"});
   continue;
  }
  const level=validLevel(record.level,source.maxLevel);
  if(level===null){
   unknown.push({system,id,reason:"missing-or-invalid-level"});
   continue;
  }
  const amount=source.effectPerLevel*level;
  if(!Number.isFinite(amount)){
   unknown.push({system,id,reason:"nonfinite-resource-coefficient"});
   continue;
  }
  valid.push({id,level,bonusType:source.type,amount,maxLevel:source.maxLevel,
   effectPerLevel:source.effectPerLevel,
   calculation:"purchased-levels-times-effect-per-level",
   sourceTable:system==="gemstoneResearch"?"GemstoneResearchInfo.csv":"TitanResearchInfo.csv",
   appliedToDamageScore:false});
 }
 return {valid,unknown};
}

export function resourceResearchEvidence(profile){
 const sections=profile?.sections||{},gemSource=sections.mysticResearch;
 const gemTruncated=gemSource?.truncated===true;
 const gem=accumulate(gemTruncated?[]:gemSource?.records||[],GEM,"gemstoneResearch");
 const merged=mergeTitanResearch(profile);
 const soul=accumulate(merged.records,SOUL,"titanResearch");
 const unknown=[
  ...(gemTruncated?[{system:"gemstoneResearch",section:"mysticResearch",
   reason:"truncated-research-export"}]:[]),
  ...gem.unknown,...merged.unknown,...soul.unknown
 ];
 const gemTrusted=gemSource?.present===true&&!gemTruncated&&gem.unknown.length===0;
 const soulPresent=merged.sources.titanResearch||merged.sources.forbiddenResearch;
 const soulTrusted=soulPresent&&!merged.truncated&&
  merged.unknown.length===0&&soul.unknown.length===0;
 const extraGemLevels=gem.valid.reduce((sum,r)=>sum+r.amount,0);
 const totals={TitanSoulsPerDay:0,TitanSoulsPerPrestige:0,TitanSoulsChance:0};
 for(const row of soul.valid)totals[row.bonusType]+=row.amount;
 const reported=validLevel(profile?.stats?.gemstoneLevel,Number.MAX_SAFE_INTEGER);
 const hypothesis=gemTrusted&&reported!==null&&
  Number.isSafeInteger(reported+extraGemLevels)?reported+extraGemLevels:null;
 const truncatedSections=[
  ...(gemTruncated?["mysticResearch"]:[]),...merged.truncatedSections
 ];
 const audit={incomplete:unknown.length>0,truncatedSections,
  excludedOrConflictingNodes:unknown.length,
  mirroredTitanResearchNodes:merged.mirroredPurchases,
  validatedGemstoneNodes:gem.valid.length,
  validatedTitanSoulNodes:soul.valid.length,
  gemstoneTotalsVerifiable:gemTrusted,titanSoulTotalsVerifiable:soulTrusted,
  sourceCoverageComplete:false};
 return {
  gemstones:{
   present:gemSource?.present===true,
   catalogNodes:GEM.size,matchedNodes:gem.valid.length,
   extraLevelsFromResearch:gemTrusted?extraGemLevels:null,
   reportedLevel:reported,
   basePlusResearchHypothesis:hypothesis,
   levelInterpretation:"unverified-base-versus-effective",
   effectiveGemstoneLevel:null,scoreAdjusted:false,
   totalsVerifiable:gemTrusted
  },
  titanSouls:{
   present:soulPresent,catalogNodes:SOUL.size,matchedNodes:soul.valid.length,
   bonusPerDay:soulTrusted?totals.TitanSoulsPerDay:null,
   bonusPerPrestige:soulTrusted?totals.TitanSoulsPerPrestige:null,
   rawChanceBonusFraction:soulTrusted?totals.TitanSoulsChance:null,
   balance:profile?.stats?.titanSouls??null,
   lifetimeSpent:profile?.stats?.titanSoulsSpent??null,
   bonusAppliedToDamageScore:false,
   totalGainPerDay:null,totalGainPerPrestige:null,dropChanceAfterCaps:null,
   totalsVerifiable:soulTrusted
  },
  entries:[...gem.valid,...soul.valid],unknown,audit,
  titanResearchSource:merged.sources,complete:false
 };
}
