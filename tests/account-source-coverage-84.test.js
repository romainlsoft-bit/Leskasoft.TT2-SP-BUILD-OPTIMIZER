import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile,PROFILE_SECTION_NAMES} from "../src/account-profile.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {equipmentEffectReduction} from "../src/equipment-reductions.js";
import {accountSourceCoverage} from "../src/account-source-coverage.js";
import {clanTechnologyEvidence} from "../src/account-clan-technology.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild} from "../src/engine.js";

const parse=data=>parseAccountProfile(data);
const profile=parse({
 Version:"8.4.1",
 gemstones:[{id:"Gem0",level:500,primary:"TapDamage:1e40",
  secondary:["CritDamage:1e30","AllHeroDamage:1e20"]}],
 gemsTonotRead:"sensitive-value",
 titanResearch:{"1":{level:3}},
 gemstonesResearch:{"0":{level:5}},
 clanTechnology:{
  "Journey.0":{level:2,bonusType:"TitanSoulsPerDay",bonusAmount:"10"},
  "Power.0":{level:1,bonusType:"MirrorForceTeamworkBoost",bonusAmount:"1.5"}
 }
});
test("8.4 clan-wide technology records are imported but never become personal SP power",()=>{
 assert.equal(PROFILE_SECTION_NAMES.includes("clanTechnology"),true);
 const tech=clanTechnologyEvidence(profile);
 assert.equal(tech.present,true);
 assert.equal(tech.importedRecords,2);
 assert.equal(tech.resourceNodes,1);
 assert.equal(tech.conditionalNodes,1);
 assert.equal(tech.addedToScore,false);
 assert.equal(tech.valuesVerified,false);
 assert.equal(tech.clanWide,true);
 assert.equal(clanTechnologyEvidence(parse({})).present,false);
});
test("the 18 routes do not double-count gem levels as a numeric research multiplier",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={damage,gold,goldWeight:.7};
  const power=extractFixedAccountPower(profile);
  const coverage=accountSourceCoverage(profile,power,settings);
  const gem=coverage.systems.find(x=>x.id==="gemstones");
  const gemResearch=coverage.systems.find(x=>x.id==="gemstoneResearch");
  const titan=coverage.systems.find(x=>x.id==="titanResearch");
  const clan=coverage.systems.find(x=>x.id==="clanTechnology");
  assert.equal(gem.importedRecords,1);
  assert.equal(gem.numericSourceRows,3);
  assert.equal(gemResearch.resourceNodes,1);
  assert.equal(titan.resourceNodes,1);
  assert.equal(clan.numericSourceRows,0);
  assert.equal(clan.fixedScoreRows,0);
  assert.equal(coverage.allGameBonusesIncluded,false);
  assert.equal(coverage.totalStagePredictionVerified,false);
  assert.equal(coverage.clanTechnology.addedToScore,false);
  // Reuse the original scorer's existing tap/hero/crit conversions.
  const expected=40*equipmentEffectReduction("TapDamage",settings).weight+
   20*(equipmentEffectReduction("AllHeroDamage",settings).weight??0)+
   30*(equipmentEffectReduction("CritDamage",settings).weight??0);
  const score=fixedAccountScore(power,settings);
  assert.ok(Math.abs(score.damageLog10-expected)<1e-8,
   damage+"/"+gold+" : "+score.damageLog10+" vs "+expected);
  assert.ok(Math.abs(gem.fixedWeightedLog10-expected)<1e-8);
 }
});
test("unknown, incomplete and truncated source sections are not advertised as fully modeled",()=>{
 const truncated=parse({gemstones:Array.from({length:513},(_,i)=>({
  id:"Gem"+i,level:500,primary:"AllDamage:1e20"
 }))});
 const power=extractFixedAccountPower(truncated);
 const coverage=accountSourceCoverage(truncated,power,
  {damage:"Pet",gold:"Fairy",goldWeight:.7});
 const gems=coverage.systems.find(x=>x.id==="gemstones");
 assert.equal(gems.truncated,true);
 assert.equal(gems.fixedScoreRows,0);
 assert.equal(gems.status,"truncated");
 assert.equal(gems.complete,false);
 assert.equal(coverage.systems.find(x=>x.id==="monuments").status,"not-in-export");
});
test("raw exported bonuses are classified as sources but not presumed usable without full data",()=>{
 const source=parse({clanTechnology:{
  foo:{level:1,bonusType:"CompletelyUnknownBonus",bonusAmount:"1e9999"},
  bar:{level:"invalid",bonusType:"GoldAll",bonusAmount:"1e50"}
 }});
 const tech=clanTechnologyEvidence(source);
 assert.equal(tech.unclassifiedNodes,1);
 assert.equal(tech.unknown.length,2);
 assert.equal(tech.addedToScore,false);
 const r=accountSourceCoverage(source,extractFixedAccountPower(source),
  {damage:"Pet",gold:"Fairy",goldWeight:.7});
 assert.ok(r.systems.find(x=>x.id==="clanTechnology").unresolved>=2);
});
test("a staged SP optimizer leaves sourced clan data out of unverified direct multipliers",()=>{
 const base={damage:"Pet",gold:"Fairy",goldWeight:.7,skillPoints:100,
  qol:"none",sets:{},currentLevels:{},minimums:{},maxStage:16000,
  craftingPower:1,timeToKill:8,sClone:30};
 const account=optimizeBuild({...base,accountProfile:profile});
 assert.ok(account.accountSourceCoverage);
 assert.equal(account.accountSourceCoverage.clanTechnology.addedToScore,false);
 assert.equal(account.accountSourceCoverage.systems.length,11);
 const noTech=optimizeBuild({...base,accountProfile:parse({
  gemstones:profile.sections.gemstones.records,
  titanResearch:profile.sections.titanResearch.records,
  gemstonesResearch:profile.sections.mysticResearch.records
 })});
 assert.deepEqual(account.levels,noTech.levels);
});


test("direct permanent and daily set effects are reported without adding their score twice",()=>{
 const source=parse({equipmentSets:[]});
 const base=extractFixedAccountPower(source);
 const entries=[{bonusType:"AllDamage",log10:10,appliedToAccount:true},
  {bonusType:"GoldAll",log10:20,appliedToAccount:true},
  {bonusType:"AllDamage",log10:999,appliedToEquipment:true}];
 const extra={permanentSetPower:{entries},timedSetPower:{
  entries:[{bonusType:"AllDamage",log10:2,appliedToScore:true}]}};
 const report=accountSourceCoverage(source,base,
  {damage:"Pet",gold:"Fairy",goldWeight:.7},extra);
 const sets=report.systems.find(x=>x.id==="equipmentSets");
 assert.equal(sets.fixedScoreRows,3);
 assert.equal(sets.supplementalSetRows,3);
 assert.ok(Math.abs(sets.fixedWeightedLog10-26)<1e-12);
 assert.equal(report.allGameBonusesIncluded,false);
});
