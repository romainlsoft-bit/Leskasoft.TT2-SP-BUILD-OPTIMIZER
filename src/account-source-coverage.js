/**
 * Transparent TT2 account-source coverage by actual scoring ledger.
 *
 * Numeric fixed-account entries are checked against the EXISTING scorer's
 * weight for the current build.  This is not a claim that all game power
 * is modeled: unknown, conditional, dependent and resource-only bonuses
 * remain visible and distinct.
 *
 * Only aggregate counts, no player names, IDs, raw exports or inventories
 * appear in the returned user-facing report.
 */
import {fixedAccountScore} from "./account-power.js?v=20261122-push-target-r2";
import {clanTechnologyEvidence} from "./account-clan-technology.js?v=20261122-push-target-r2";
import {resolveTranscendenceAge} from "./account-temporal.js?v=20261122-push-target-r2";
// A subsystem may report unresolved dependent effects under a DIFFERENT
// namespace than its scored source rows. Keep their counts on the same
// system instead of presenting an over-optimistic coverage dashboard.
const UNSUPPORTED_SYSTEMS=Object.freeze({
 artifacts:["artifacts","artifactDerived"],
 monuments:["monuments","monumentDerived"],
 pets:["petPassive","petAmplifier","petLevels"],
 heroWeapons:["heroWeapons","heroProgression"]
});
const GROUPS=Object.freeze([
 {id:"titanCards",sections:["titanCards"],ledger:["titanCards"]},
 {id:"titanResearch",sections:["titanResearch","forbiddenResearch"],ledger:["titanResearch"]},
 {id:"gemstoneResearch",sections:["mysticResearch"],ledger:["gemstoneResearch"]},
 {id:"gemstones",sections:["gemstones"],ledger:["gemstones"]},
 {id:"artifacts",sections:["artifacts"],ledger:["artifacts","artifactDamage","whiteDwarf"]},
 {id:"monuments",sections:["monuments","seasonArtifacts"],ledger:["monuments","monumentDamage"]},
 {id:"pets",sections:["petLevels"],ledger:["petPassive"]},
 {id:"clanScrolls",sections:["clanScrolls"],ledger:["clanScrolls"]},
 {id:"heroWeapons",sections:["heroWeapons"],ledger:["heroWeapons","heroProgression"]},
 {id:"equipmentSets",sections:["equipmentSets"],ledger:["sets"]},
 {id:"clanTechnology",sections:["clanTechnology"],ledger:[]}
]);
const sum=a=>a.reduce((n,v)=>n+v,0);
function buildScoreWeights(power,settings,extra={}){
 const allRows=[...(power?.entries||[]),
  ...(extra.permanentSetPower?.entries||[]),
  ...(extra.timedSetPower?.entries||[])];
 const types=[...new Set(allRows.map(x=>x.bonusType).filter(Boolean))];
 const out=Object.create(null);
 for(const type of types){
  const result=fixedAccountScore({available:true,byType:{[type]:1}},settings);
  const weighted=result.weightedLog10;
  // The scorer's own conversion is the authority. A blank/zero
  // weight is not evidence that the item is absent from the real game.
  out[type]=Number.isFinite(weighted)?weighted:0;
 }
 return out;
}
export function accountSourceCoverage(profile,power,settings={},extra={}){
 const sections=profile?.sections||{};
 const ledger=power?.entries||[],unsupported=power?.unsupported||[];
 const weights=buildScoreWeights(power,settings,extra);
 const clan=clanTechnologyEvidence(profile);
 const resources=power?.researchResources;
 const summaries=[];
 for(const group of GROUPS){
  const sources=group.sections.map(x=>sections[x]||{});
  const present=sources.some(x=>x.present===true);
  const truncated=sources.some(x=>x.truncated===true);
  const importedRecords=sum(sources.map(x=>Number(x.count)||0));
  const named=new Set(group.ledger);
  const rows=ledger.filter(x=>named.has(x.system));
  const unmodeledSystems=new Set(
   UNSUPPORTED_SYSTEMS[group.id]||group.ledger);
  const bad=unsupported.filter(x=>unmodeledSystems.has(x.system));
  const supplementalUnknown=group.id==="equipmentSets"?
   (Number(extra.permanentSetPower?.unresolved)||0)+
   (Number(extra.timedSetPower?.omitted)||0):0;
  const eligible=rows.filter(x=>Number.isFinite(x.log10));
  const fixedScoreRows=eligible.filter(x=>x.log10>0&&weights[x.bonusType]>0&&
    x.route!=="equipment"&&x.route!=="pet");
  let fixedWeightedLog10=sum(fixedScoreRows.map(x=>x.log10*weights[x.bonusType]));
  const extraSetRows=group.id==="equipmentSets"?[
   ...(extra.permanentSetPower?.entries||[]).filter(x=>x.appliedToAccount),
   ...(extra.timedSetPower?.entries||[]).filter(x=>x.appliedToScore)
  ]:[];
  // Permanent and dated set multipliers enter the fixed score through
  // dedicated ledgers, NOT through power.entries. Show them only if the
  // currently chosen build source receives an existing nonzero reduction.
  const creditedSetRows=extraSetRows.filter(x=>x.log10>0&&
   weights[x.bonusType]>0);
  fixedWeightedLog10+=sum(creditedSetRows.map(x=>x.log10*weights[x.bonusType]));
  // Equipment/pet source entries may affect the selected setup later;
  // do not count them as independent permanent account multipliers.
  const dependentRows=rows.filter(x=>x.route==="equipment"||x.route==="pet").length;
  const resourceNodes=group.id==="titanResearch"?
   resources?.titanSouls?.matchedNodes??0:
   group.id==="gemstoneResearch"?
   resources?.gemstones?.matchedNodes??0:
   group.id==="clanTechnology"?clan.resourceNodes:0;
  const unresolved=bad.length+supplementalUnknown+
   (group.id==="clanTechnology"?clan.unknown.length:0);
  const status=!present?"not-in-export":truncated?"truncated":
   unresolved?"partially-modeled-with-unknowns":
   fixedScoreRows.length||creditedSetRows.length||dependentRows?"modeled-subset":
   importedRecords?"diagnostic-or-resource-only":"empty-exported-section";
  summaries.push({id:group.id,present,truncated,
   importedRecords,numericSourceRows:rows.length,
   fixedScoreRows:fixedScoreRows.length+creditedSetRows.length,
   supplementalSetRows:extraSetRows.length,
   fixedWeightedLog10,
   dependentRows,resourceNodes,unresolved,status,
   complete:false,scoreSource:"fixed-account-proxy-only"});
 }
 return {schema:"tt2-account-source-coverage-v1",systems:summaries,
  presentSystems:summaries.filter(x=>x.present).length,
  fixedScoredRows:sum(summaries.map(x=>x.fixedScoreRows)),
  dependentRows:sum(summaries.map(x=>x.dependentRows)),
  unresolvedRows:sum(summaries.map(x=>x.unresolved)),
  clanTechnology:clan,
  allGameBonusesIncluded:false,
  totalStagePredictionVerified:false,
  unverifiedSourceRelationshipsRemain:true,
  baselineScoredEffectsAreNotIndependentSPMarginals:true,
  sourceSnapshots:"TT2 8.4.0 Unity; 8.4.1 compatibility not independently proven",
  seasonCalendar:(()=>{
   const age=resolveTranscendenceAge(profile);
   return {season:age.season,
    estimatedEndDate:age.estimatedEndDate,
    estimatedSeasonEnded:age.estimatedSeasonEnded,
    endDateSource:age.endDateSource,
    expirationOfficiallyConfirmed:false};
  })(),
  knownHighImpactOmissions:{
   monumentEnchantmentBoostsUnscored:power?.monumentEffects?.omittedEnchantmentBoosts??0,
   unknownMonumentEnchantmentStates:power?.monumentEffects?.unresolvedEnchantments??0,
   seasonDayBonusApplicationNotVerified:true,
   effectiveGemstoneResearchLevelUnverified:true,
   clanTechnologyApplicationNotVerified:true
  }};
}
