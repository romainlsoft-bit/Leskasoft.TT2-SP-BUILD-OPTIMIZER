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
import {clanScrollEvidence} from "./account-scrolls.js?v=20261117-hero-scroll-m";
import {heroProgressionEvidence} from "./hero-progression.js?v=20261117-hero-scroll-m";
import {equipmentEffectReduction} from "./equipment-reductions.js";
import {ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {calculatePermanentArtifactEffects} from "./account-artifacts.js";
import {resolveMonumentEvidence} from "./account-monuments.js?v=20261117-monument-pools";
import {monumentDerivedPower} from "./account-monument-derived.js?v=20261117-monument-pools";
import {petPassiveEvidence} from "./pet-scenarios.js?v=20261118-pet-equipment-o";
import {artifactDerivedPower} from "./account-artifact-derived.js";
import {mergeTitanResearch,resourceResearchEvidence} from "./account-research-resources.js?v=20261117-resource-integrity";
import {resolveGemstoneEvidence} from "./account-gemstones.js?v=20261118-pet-equipment-o";

const MAX_LEVEL=100000;
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
 Chesterson:["ChestAmount","GoldChesterson"]
});
const cache=new WeakMap();
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
export function extractFixedAccountPower(profile){
 if(!profile||typeof profile!=="object")return {available:false,byType:{},entries:[],unsupported:[],matched:0};
 if(cache.has(profile))return cache.get(profile);
 const sections=profile.sections||{};
 const entries=[],unsupported=[];
 const from=key=>sections[key]?.records||[];
 // A truncated section cannot support a reliable resource or damage total.
 // Reject the entire fragment rather than treating omitted tail nodes as 0.
 for(const [key,group] of [["mysticResearch","gemstoneResearch"],["titanCards","titanCards"]]){
  if(sections[key]?.truncated===true)
   unsupported.push({system:group,reason:"truncated-research-export"});
  else findResearchRows(from(key),group,entries,unsupported);
 }
 // Both export aliases may contain different nodes, or mirror the same
 // purchases. Reconcile without choosing one partial tree over the other.
 const titanResearch=mergeTitanResearch(profile);
 findResearchRows(titanResearch.records,"titanResearch",entries,unsupported);
 for(const row of titanResearch.unknown)unsupported.push(row);
 // Post-8.0 fixed gemstones: use the game-exported multiplier once, and
 // route equipment bonuses through the gear chain, not directly into damage.
 const gemstoneEvidence=resolveGemstoneEvidence(profile);
 for(const row of gemstoneEvidence.entries)
  if(row.route!=="unresolved")entries.push(row);
 for(const row of gemstoneEvidence.unknown)unsupported.push(row);
 const artifactEffects=calculatePermanentArtifactEffects(profile,ARTIFACT_CATALOG);
 const scrolls=clanScrollEvidence(profile,artifactEffects);
 for(const row of scrolls.entries){
  if(row.log10===null){unsupported.push({system:"clanScrolls",id:row.id,reason:"additive-unverified"});continue;}
  entries.push({system:"clanScrolls",id:row.id,bonusType:row.bonusType,level:row.level,
   log10:row.setBoostedLog10??row.log10,setBoostModeled:scrolls.setBoostModeled,
   rawLog10:row.log10,setBonusPercent:scrolls.setBonusPercent,
   boostedSetBonusPercent:scrolls.enhancedSetBonusPercent,
   scrollAmplifiersModeled:row.scrollArtifactBoostModeled});
 }
 for(const row of scrolls.unknown)unsupported.push({system:"clanScrolls",...row});
 // Main effects of permanent artifacts and season-eligible monuments are
 // independent from separate additive artifact/monument damage pools.
 for(const row of artifactEffects.entries){
  if(row.appliedToScore)entries.push({system:"artifacts",id:row.id,
   bonusType:row.bonusType,level:row.level,enchanted:row.enchanted,log10:row.log10});
  else unsupported.push({system:"artifacts",id:row.id,reason:row.status});
 }
 for(const row of artifactEffects.unknown)unsupported.push({system:"artifacts",...row});
 const heroProgression=heroProgressionEvidence(profile,artifactEffects);
 for(const row of heroProgression.entries)entries.push(row);
 for(const reason of heroProgression.unresolved)
  unsupported.push({system:"heroProgression",reason});
 const monuments=resolveMonumentEvidence(profile);
 for(const row of monuments.entries){
  if(row.appliedToScore)entries.push({system:"monuments",id:row.id,bonusType:row.bonusType??row.type,
   level:row.level,enchanted:row.enchanted,log10:row.log10});
  else unsupported.push({system:"monuments",id:row.id,reason:row.formulaStatus});
 }
 for(const row of monuments.unknown)unsupported.push({system:"monuments",...row});
 const monumentDerived=monumentDerivedPower(profile,monuments);
 for(const row of monumentDerived.entries)entries.push({
  system:row.system,id:row.id,bonusType:row.bonusType,log10:row.log10,
  conservative:true,season:row.season});
 for(const reason of monumentDerived.unmodeled)
  unsupported.push({system:"monumentDerived",reason});
 const artifactDerived=artifactDerivedPower(profile,artifactEffects);
 for(const row of artifactDerived.entries)entries.push({
  system:row.system,id:row.id,bonusType:row.bonusType,
  log10:row.log10,conservative:row.conservative===true});
 for(const reason of artifactDerived.unmodeled)
  unsupported.push({system:"artifactDerived",reason});
 const passivePets=petPassiveEvidence(profile);
 for(const row of passivePets.entries){
  if(row.appliedToScore&&row.log10!==null)entries.push({
   system:"petPassive",id:row.id,bonusType:row.bonusType,
   log10:row.log10,level:row.level,tier:row.tier
  });
 }
 for(const row of passivePets.unmodeled)
  unsupported.push({system:"petPassive",...row});
 for(const row of passivePets.rejectedLevels)
  unsupported.push({system:"petLevels",...row});
 for(const row of passivePets.unknownAmplifiers)
  unsupported.push({system:"petAmplifier",...row});
 const byType={};
 for(const entry of entries)byType[entry.bonusType]=(byType[entry.bonusType]||0)+entry.log10;
 const value={available:entries.length>0,byType,entries,unsupported,
  matched:entries.length,unknown:unsupported.length,
  // These only describe *some* systems. They must not be treated as complete.
  complete:false,
  artifactDerived:{ownedArtifacts:artifactDerived.ownedArtifactCount,
   ownedCountVerifiable:artifactDerived.ownedCountVerifiable,
   whiteDwarfApplied:artifactDerived.whiteDwarfApplied,
   included:artifactDerived.entries.length,
   conservativeDamage:artifactDerived.entries.some(x=>x.system==="artifactDamage"),
   rawPoolLog10:artifactDerived.partialDamagePool?.unenchantedPoolLog10??null,
   poolComponents:artifactDerived.partialDamagePool?.components??0,
   complete:false},
  petPassives:{imported:passivePets.imported,scored:passivePets.scored,
   rejectedLevels:passivePets.rejectedLevels.length,
   duplicateMirrors:passivePets.duplicateMirrors,
   unknownAmplifiers:passivePets.unknownAmplifiers.length,
   seasonalImported:passivePets.seasonalImported,
   seasonalDirect:passivePets.seasonalDirect,
   seasonalEquipment:passivePets.seasonalEquipment,
   unscoredDependent:passivePets.unscoredDependent,complete:false},
  artifactEffects:{recognized:artifactEffects.recognized,computed:artifactEffects.computed,
   scored:artifactEffects.scored,duplicateRecords:artifactEffects.duplicateRecords,
   truncated:artifactEffects.truncated,unknownIds:artifactEffects.unknown.length,
   explicitlyUnowned:artifactEffects.explicitlyUnowned,
   magnifier:artifactEffects.magnifier,treasure:artifactEffects.treasure,
   supportedMagnifierTargets:artifactEffects.entries.filter(x=>x.magnifierApplied).length,
   supportedTreasureTargets:artifactEffects.entries.filter(x=>x.treasureApplied).length},
  researchResources:resourceResearchEvidence(profile),
  heroProgression,
  clanScrollPower:{recognized:scrolls.entries.length,completeRoster:scrolls.completeRoster,
   completeSets:scrolls.fullSets,unknown:scrolls.unknown.length,
   truncated:scrolls.truncated,additionalAmplifiersScored:scrolls.boostsModeled,
   quill:scrolls.quill,stamp:scrolls.stamp,scrollTutor:scrolls.scrollTutor,
   dragonWeaver:scrolls.scrollTutor,
   boostStackComplete:scrolls.boostStackComplete,
   enhancedSetBonusPercent:scrolls.enhancedSetBonusPercent,complete:false},
  gemstones:{present:gemstoneEvidence.present,
   recorded:gemstoneEvidence.recorded,recognized:gemstoneEvidence.recognized,
   duplicateMirrors:gemstoneEvidence.duplicateMirrors,
   excluded:gemstoneEvidence.excluded,
   directEffects:gemstoneEvidence.directEffects,
   equipmentEffects:gemstoneEvidence.equipmentEffects,
   petEffects:gemstoneEvidence.petEffects,
   unresolvedEffects:gemstoneEvidence.unresolvedEffects,
   unresolvedRecords:gemstoneEvidence.unknown.length,
   researchLevelsAddedToExportedValues:false,complete:false},
  monumentEffects:{recognized:monuments.recognized,
   computed:monuments.computed||0,scored:monuments.modeled||0,
   countedSetEffects:monuments.countedSetEffects?.length||0,
   countedSetApplied:monuments.entries.filter(x=>x.countedSetKind&&x.appliedToScore).length,
   season:monuments.season,seasonVerified:monuments.seasonVerified,
   seasonDays:monuments.seasonDays,unknownIds:monuments.unknown.length,
   conflicting:monuments.conflicts,truncatedSections:monuments.truncatedSections,
   explicitlyUnowned:monuments.explicitlyUnowned,
   additiveDamageApplied:monumentDerived.entries.length===1,
   additiveDamageLog10:monumentDerived.poolLog10,
   additiveComponents:monumentDerived.eligibleComponents,
   additiveExcludedComponents:monumentDerived.excludedComponents,
   additiveUnrepresentable:monumentDerived.rejected.length,
   enchantmentMultIncluded:false,
   unresolvedEnchantments:monumentDerived.unresolvedEnchantments,
   omittedEnchantmentBoosts:monumentDerived.omittedEnchantmentBoosts,
   additiveDamageConservative:monumentDerived.conservative,
   complete:false}};
 cache.set(profile,value);
 return value;
}
export function fixedAccountScore(power,settings){
 if(!power?.available)return {damageLog10:0,goldLog10:0,weightedLog10:0,types:[]};
 const types=["AllDamage","BossDamage",...(DIRECT_DAMAGE_TYPES[settings.damage]||[])];
 const goldTypes=["GoldAll",...(DIRECT_GOLD_TYPES[settings.gold]||[])];
 // Route verified All Hero Damage through pinned source build reductions,
 // rather than incorrectly treating it as universal All Damage.
 const heroTypes=["AllHelperDamage","AllHeroDamage","HeroDamage"];
 const heroLog10=heroTypes.reduce((sum,type)=>{
  const ratio=equipmentEffectReduction(type,settings).weight;
  return sum+(Number.isFinite(ratio)?(power.byType[type]||0)*ratio:0);
 },0);
 // Unlike AllHelperDamage, weapon mastery boosts BASE hero damage and
 // do not receive an additional build-source reduction.
 const baseHeroLog10=power.byType.BaseHeroDamage||0;
 // Permanent Tap sources (including pets and artifacts) are reduced once;
 // they are not universal All Damage or duplicate SP bonuses.
 const tapReduction=equipmentEffectReduction("TapDamage",settings).weight;
 const tapLog10=Number.isFinite(tapReduction)?
  (power.byType.TapDamage||0)*tapReduction:0;
 const damageLog10=types.reduce((a,t)=>a+(power.byType[t]||0),
  heroLog10+baseHeroLog10+tapLog10);
 const goldLog10=goldTypes.reduce((a,t)=>a+(power.byType[t]||0),0);
 const weight=Number(settings.goldWeight);
 return {damageLog10,goldLog10,
  weightedLog10:damageLog10+(Number.isFinite(weight)?weight:0)*goldLog10,
  types:[...types,"BaseHeroDamage","TapDamage",...heroTypes,...goldTypes]};
}
export function formatLogMultiplier(log10){
 if(!Number.isFinite(log10))return "unknown";
 if(log10===0)return "×1";
 const exponent=Math.floor(log10);
 const m=Math.pow(10,log10-exponent);
 return "×"+m.toFixed(2)+"e"+(exponent>=0?"+":"")+exponent;
}
