/**
 * Source-backed fixed Monument Damage baseline in current Transcendence.
 * Main effects of monument rows are scored separately in account-power.
 * Never add each additive component as its own multiplicative AllDamage.
 */
import {SEASON_ARTIFACT_CATALOG} from "../vendor/account-catalog.js?v=20261123-native-adaptive-r1";
import {additiveDamageEvidence} from "./account-damage-pools.js?v=20261123-native-adaptive-r1";

export function monumentDerivedPower(profile,monuments){
 const sections=profile?.sections||{};
 const anySource=sections.monuments?.present===true||
  sections.seasonArtifacts?.present===true;
 if(!anySource)return {entries:[],sourcePresent:false,seasonVerified:false,
  eligibleComponents:0,excludedComponents:0,unresolvedEnchantments:0,
  poolLog10:null,complete:false,unmodeled:["missing-monument-collection"],
  rejected:[],omittedEnchantmentBoosts:0,truncated:false,
  conservative:false,enchantmentMultIncluded:false,season:null,
  hypotheticalEnchantedPoolLog10:null,
  hypotheticalEnchantmentDeltaLog10:null,
  enchantmentSourceHypothesisComplete:false,
  hypotheticalEnchantmentIncludedInScore:false};
 const seasonVerified=monuments?.seasonVerified===true;
 const truncated=monuments?.truncatedSections?.length>0;
 // Never let a CSV IsActive flag claim membership in the current season.
 // Only explicit official category rotation permits scoring.
 const eligible=(monuments?.entries||[]).filter(row=>
  row.damageEligible===true&&row.seasonCategorySource===
   "official-season-categories");
 const pool=additiveDamageEvidence({entries:[]},{entries:eligible},{},
  SEASON_ARTIFACT_CATALOG);
 const log10=pool.monuments.unenchantedPoolLog10;
 const sourceCandidate=pool.monuments.candidateEnchantedPoolLog10;
 const sourceDelta=Number.isFinite(log10)&&
   Number.isFinite(sourceCandidate)?
    sourceCandidate-log10:null;
 const apply=seasonVerified&&!truncated&&Number.isFinite(log10);
 const entries=apply?[{system:"monumentDamage",id:"monumentDamage",
  bonusType:"AllDamage",log10,components:pool.monuments.components,
  season:monuments.season,conservative:true,
  enchantmentMultIncluded:false,appliedToScore:true}]:[];
 const rejected=pool.rejected;
 const omittedEnchantmentBoosts=pool.entries.filter(row=>
  row.system==="monument"&&row.enchanted===true&&
  row.candidateEnchantedLog10!==null&&
  row.candidateEnchantedLog10>row.unenchantedLog10).length;
 const unmodeled=[];
 if(!seasonVerified)unmodeled.push("unknown-transcendence-season");
 if(truncated)unmodeled.push("truncated-monument-collection");
 if(monuments?.unknown?.length)unmodeled.push("unknown-monument-identifiers");
 if(monuments?.conflicts)unmodeled.push("conflicting-or-stale-monuments");
 if(rejected.length)unmodeled.push("unrepresentable-monument-damage");
 if(pool.monuments.unresolvedEnchantments)
  unmodeled.push("unknown-monument-enchantment-multipliers");
 if(omittedEnchantmentBoosts)
  unmodeled.push("unscored-monument-enchantment-boosts");
 if(!apply&&eligible.length)unmodeled.push("unverifiable-monument-damage-pool");
 // Even with known rows, no assumption that the entire seasonal collection
 // or the in-game EnchantmentMult chain has been independently verified.
 return {entries,sourcePresent:true,seasonVerified,truncated,
  season:monuments?.season??null,eligibleComponents:pool.monuments.components,
  excludedComponents:Math.max(0,(monuments?.entries?.length||0)-
   pool.monuments.components),
  unresolvedEnchantments:pool.monuments.unresolvedEnchantments,
  omittedEnchantmentBoosts,rejected,rawPool:pool.monuments,
  poolLog10:apply?log10:null,
  // Numerical source-only "what if": treat each EnchantmentMult as a
  // multiplier on the corresponding additive damage component. Native
  // placement/stacking is NOT proven. The actual account and SP ledger
  // always use poolLog10 above, NEVER this diagnostic candidate.
  hypotheticalEnchantedPoolLog10:apply&&Number.isFinite(sourceCandidate)?
   sourceCandidate:null,
  hypotheticalEnchantmentDeltaLog10:apply&&
   Number.isFinite(sourceDelta)?sourceDelta:null,
  enchantmentSourceHypothesisComplete:apply&&
   Number.isFinite(sourceCandidate),
  hypotheticalEnchantmentIncludedInScore:false,
  enchantmentMultIncluded:false,conservative:apply,unmodeled,
  complete:false};
}
