/**
 * Report actually purchased GemstoneLevel and Titan Souls resource bonuses.
 * The 8.0 gemstone rework makes gemstone effects level-dependent; these
 * research-granted levels are not blindly added to explicit export bonuses,
 * which may already include them.
 */
import {RESOURCE_RESEARCH_CATALOG} from "../vendor/account-research-resources.js";
const GEM=new Map(RESOURCE_RESEARCH_CATALOG.gemstoneLevel.map(x=>[x.id,x]));
const SOUL=new Map(RESOURCE_RESEARCH_CATALOG.titanSouls.map(x=>[x.id,x]));
function validLevel(value,max){
 const level=Number(value);
 return value!==null&&value!==undefined&&value!==""&&Number.isSafeInteger(level)&&level>=0&&level<=max?level:null;
}
/** Merge the two names for Necrobear research without preferring a partial
 * collection or adding its repeated entries twice. Same ID+level across two
 * sections is one purchase; conflicts and duplicates within one section are
 * excluded from both the resource ledger and the numerical scoring.
 */
export function mergeTitanResearch(profile){
 const sections=profile?.sections||{},rows=[];
 for(const key of ["titanResearch","forbiddenResearch"])
  for(const record of sections[key]?.records||[])rows.push({...record,_source:key});
 const grouped=new Map(),unknown=[];
 for(const row of rows){
  const id=String(row.id);
  if(!grouped.has(id))grouped.set(id,[]);
  grouped.get(id).push(row);
 }
 const records=[];
 for(const [id,found] of grouped){
  const origins=new Set(found.map(x=>x._source));
  const levels=new Set(found.map(x=>String(x.level??"missing")));
  if(levels.size!==1||found.length>2||
     (found.length===2&&origins.size!==2)){
   unknown.push({system:"titanResearch",id,reason:"duplicate-or-conflicting-export-levels"});
   continue;
  }
  const { _source,...record }=found[0];
  records.push(record);
 }
 return {records,unknown,sources:{
  titanResearch:sections.titanResearch?.present===true,
  forbiddenResearch:sections.forbiddenResearch?.present===true},
  totalRawRecords:rows.length};
}
function accumulate(records,catalog,system){
 const occurrences=new Map(),valid=[],unknown=[];
 for(const r of records){const id=String(r.id);occurrences.set(id,(occurrences.get(id)||0)+1)}
 for(const r of records){
  const id=String(r.id),source=catalog.get(id);
  if(!source)continue;
  if(occurrences.get(id)>1){unknown.push({system,id,reason:"duplicate-source-id"});continue}
  const level=validLevel(r.level,source.maxLevel);
  if(level===null){unknown.push({system,id,reason:"missing-or-invalid-level"});continue}
  const amount=source.effectPerLevel*level;
  valid.push({id,level,bonusType:source.type,amount,maxLevel:source.maxLevel,
   effectPerLevel:source.effectPerLevel,calculation:"purchased-levels-times-effect-per-level"});
 }
 return {valid,unknown};
}
export function resourceResearchEvidence(profile){
 const gemSource=profile?.sections?.mysticResearch,
  gem=accumulate(gemSource?.records||[],GEM,"gemstoneResearch");
 const merged=mergeTitanResearch(profile),
  soul=accumulate(merged.records,SOUL,"titanResearch");
 const totals={TitanSoulsPerDay:0,TitanSoulsPerPrestige:0,TitanSoulsChance:0};
 for(const row of soul.valid)totals[row.bonusType]+=row.amount;
 const gemAdded=gem.valid.reduce((n,r)=>n+r.amount,0);
 return {
  gemstones:{
   present:gemSource?.present===true,
   catalogNodes:GEM.size,
   matchedNodes:gem.valid.length,
   extraLevelsFromResearch:gemAdded,
   // A raw or displayed GemstoneLevel may already contain these bonuses.
   effectiveGemstoneLevel:null,scoreAdjusted:false
  },
  titanSouls:{
   present:merged.sources.titanResearch||merged.sources.forbiddenResearch,
   catalogNodes:SOUL.size,
   matchedNodes:soul.valid.length,
   bonusPerDay:totals.TitanSoulsPerDay,
   bonusPerPrestige:totals.TitanSoulsPerPrestige,
   rawChanceBonusFraction:totals.TitanSoulsChance,
   balance:profile?.stats?.titanSouls??null,
   lifetimeSpent:profile?.stats?.titanSoulsSpent??null,
   bonusAppliedToDamageScore:false,
   totalGainPerDay:null,totalGainPerPrestige:null,
   dropChanceAfterCaps:null
  },
  entries:[...gem.valid,...soul.valid],
  unknown:[...gem.unknown,...merged.unknown,...soul.unknown],
  titanResearchSource:merged.sources,
  complete:false
 };
}
