/**
 * TT2 8.4 season-specific monument effects. Permanent artifacts are handled
 * independently: monuments reset each Transcendence season.
 *
 * Season 13 roster/date: Game Hive DevLog #231. No numerical bonus from a
 * legacy category, conflicting mirrored rows, or an unknown season.
 */
import {SEASON_ARTIFACT_CATALOG} from "../vendor/account-catalog.js?v=20261123-boss-specials-r1";
import {SEASON14_ARTIFACT_CATALOG,SEASON14_MONUMENT_SOURCE_SHA} from "../vendor/season14-monuments.js?v=20261123-boss-specials-r1";
import {resolveTranscendenceAge} from "./account-temporal.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {computeArtifactEffect,isDirectBonusType,positiveLog10} from "./account-artifacts.js?v=20261123-boss-specials-r1";
import {resolvePermanentSetPower} from "./account-permanent-sets.js?v=20261123-boss-specials-r1";

const catalogForSeason=season=>season==="14"?
 SEASON14_ARTIFACT_CATALOG:SEASON_ARTIFACT_CATALOG;
const indexForCatalog=catalog=>new Map(Object.values(catalog).flatMap(item=>[
 [item.id.toLowerCase(),item.id],[item.name.toLowerCase(),item.id]
]));
const BY_SEASON=Object.freeze({
 "13":indexForCatalog(SEASON_ARTIFACT_CATALOG),
 "14":indexForCatalog(SEASON14_ARTIFACT_CATALOG)
});
export const OFFICIAL_MONUMENT_CATEGORIES=Object.freeze({
 "13":Object.freeze(["Celestial","Viper","Arcanas"]),
 "14":Object.freeze(["Celestial","Viper","Pirate"])
});
const COUNTED=Object.freeze({
 DamagePerEquipmentSet:{kind:"All",type:"AllDamage"},
 GoldPerMythicSet:{kind:"Mythic",type:"GoldAll"}
});
function safeLevel(value,cap){
 const log=positiveLog10(value);
 if(log===null||log<0)return null; // no zero or fractional level
 const text=String(value).trim();
 const asNumber=Number(value);
 if(Number.isFinite(asNumber)&&asNumber<=Number.MAX_SAFE_INTEGER&&
    !Number.isInteger(asNumber))return null;
 if(cap>0){
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>=1&&n<=cap?text:null;
 }
 return text;
}
function unique(values){
 return [...new Set(values.filter(x=>x!==undefined&&x!==null).map(String))];
}
/**
 * The export might include the same monument in both monuments and
 * seasonArtifacts. Matching rows describe ONE monument; conflicting values
 * are excluded rather than resolved by an arbitrary section priority.
 */
export function resolveMonumentEvidence(profile,at=new Date()){
 const age=resolveTranscendenceAge(profile,at);
 const catalog=catalogForSeason(age.season);
 // Unknown-season exports remain inspectable as historical diagnostics;
 // their recognized rows may NOT be scored without a verified season.
 const byId=BY_SEASON[age.season]||BY_SEASON["13"];
 const group=new Map(),unknown=[];
 const truncation=["monuments","seasonArtifacts"].filter(
  section=>profile?.sections?.[section]?.truncated===true);
 let explicitlyUnowned=0;
 for(const section of ["monuments","seasonArtifacts"]){
  for(const item of profile?.sections?.[section]?.records||[]){
   if(item.salvaged===true||item.owned===false){explicitlyUnowned++;continue;}
   const id=byId.get(String(item.id||"").trim().toLowerCase());
   if(!id){unknown.push({section,id:item.id,reason:"unknown-monument-id"});continue;}
   if(!group.has(id))group.set(id,[]);
   group.get(id).push({section,item});
  }
 }
 const categories=OFFICIAL_MONUMENT_CATEGORIES[String(age.season)]||null;
 const sets=resolvePermanentSetPower(profile);
 const entries=[];
 for(const [id,items] of group){
  const info=catalog[id];
  const levels=unique(items.map(x=>x.item.level));
  const enchants=unique(items.map(x=>x.item.enchanted));
  const seasons=unique(items.map(x=>x.item.season));
  const conflict=levels.length>1||enchants.length>1||seasons.length>1;
  const wrongSeason=seasons.length===1&&(
   age.season===null||seasons[0]!==String(age.season));
  const level=conflict?null:safeLevel(levels[0],info.maxLevel);
  const perSeasonDay=info.bonusType.includes("PerSeasonDay");
  const categoryAllowed=categories?
   categories.includes(info.category):info.isActive;
  const seasonKnown=categories!==null;
  const enchantKnown=enchants.length===1;
  const enchanted=enchantKnown?enchants[0]==="true":null;
  const requiresEnchant=positiveLog10(info.enchantmentMagnitude)!==0;
  const counted=COUNTED[info.bonusType]||null;
  const countVerified=!counted||sets.ownedRosterComplete===true;
  const count=counted&&countVerified?sets.ownedCounts[counted.kind]:null;
  const blocked=conflict?"ignored-conflicting-export-records":
   wrongSeason?"ignored-wrong-transcendence-season":
   age.betweenSeasons?"ignored-post-season13-reset":
   age.estimatedSeasonEnded?"ignored-estimated-expired-transcendence":
   truncation.length?"ignored-truncated-monument-export":
   level===null?"ignored-missing-or-invalid-level":
   !categoryAllowed?(seasonKnown?"not-in-current-transcendence-rotation":
    "inactive-in-8.4-catalog"):
   !seasonKnown?"unknown-season-category":
   perSeasonDay&&age.days===null?"ignored-missing-transcendence-age":
   !enchantKnown&&requiresEnchant?"unknown-enchantment-state":null;
  const effect=blocked?{log10:null}:computeArtifactEffect(info,level,enchanted===true);
  const raw=effect.log10;
  // Bonus-per-completed-set follows the same exponential category-count
  // meaning as official equipment-set bonuses. Never infer full sets from
  // a handful of currently equipped items.
  const countable=counted&&countVerified&&raw!==null&&
   Number.isFinite(raw*count);
  const direct=!counted&&isDirectBonusType(info.bonusType)&&
   !perSeasonDay&&raw!==null&&Number.isFinite(raw);
  const appliedToScore=Boolean(direct||countable);
  const log10=appliedToScore&&counted?raw*count:raw??null;
  const formulaStatus=blocked||
   (raw===null?"unrepresentable-monument-effect":
    counted&&!countVerified?"unknown-completed-set-count":
    appliedToScore?(counted?"computed-per-completed-set":
     "computed-direct-effect"):"computed-unscored-interaction");
  entries.push({id,name:info.name,category:info.category,type:info.bonusType,
   bonusType:counted?.type??info.bonusType,
   level,enchanted,maxLevel:info.maxLevel,catalogActive:info.isActive,
   categoryAllowed,seasonCategorySource:seasonKnown?
    "official-season-categories":"csv-fallback",
   log10,baseEffectLog10:raw,rawLog10:effect.rawLog10??null,
   enchantmentDeltaLog10:effect.enchantmentDeltaLog10??null,
   perSeasonDay,seasonDays:perSeasonDay?age.days:null,
   countedSetKind:counted?.kind??null,countedSetCount:count,
   countedSetVerified:countVerified,
   sources:[...new Set(items.map(x=>x.section))],duplicated:items.length>1,
   effectPerLevel:info.effectPerLevel,growthExpo:info.growthExpo,
   damageBonus:info.damageBonus,damageExpo:info.damageExpo,
   enchantmentMagnitude:info.enchantmentMagnitude,
   enchantmentMult:info.enchantmentMult,
   // A separate, additive All Monument Damage contribution exists even
   // when the monument's MAIN effect depends on another gameplay state.
   damageEligible:!conflict&&!wrongSeason&&!age.betweenSeasons&&
    !age.estimatedSeasonEnded&&
    !truncation.length&&level!==null&&categoryAllowed&&seasonKnown,
   formulaStatus,appliedToScore});
 }
 entries.sort((a,b)=>Number(a.id.slice("SeasonalArtifact".length))-
  Number(b.id.slice("SeasonalArtifact".length)));
 return {entries,unknown,truncatedSections:truncation,explicitlyUnowned,
  catalogCount:Object.keys(catalog).length,
  catalogSourceSha:age.season==="14"?SEASON14_MONUMENT_SOURCE_SHA:null,
  activeInCatalog:Object.values(catalog).filter(x=>x.isActive).length,
  importedRecords:[...group.values()].reduce((sum,x)=>sum+x.length,0),
  recognized:entries.length,
  conflicts:entries.filter(x=>["ignored-conflicting-export-records",
   "ignored-wrong-transcendence-season"].includes(x.formulaStatus)).length,
  perSeasonDay:entries.filter(x=>x.perSeasonDay).length,
  missingSeasonAge:entries.filter(x=>x.formulaStatus===
   "ignored-missing-transcendence-age").length,
  seasonDays:age.days,season:age.season,
  estimatedEndDate:age.estimatedEndDate,
  estimatedSeasonEnded:age.estimatedSeasonEnded,
  betweenSeasons:age.betweenSeasons,
  endDateSource:age.endDateSource,
  expirationOfficiallyConfirmed:false,
  seasonVerified:categories!==null&&!age.estimatedSeasonEnded&&
   !age.betweenSeasons,
  countedSetEffects:entries.filter(x=>x.countedSetKind!==null),
  computed:entries.filter(x=>x.log10!==null).length,
  modeled:entries.filter(x=>x.appliedToScore).length,complete:false};
}
