import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {exploreTacticalInsightAlternative as alternative}
 from "../src/ti-alternative.js";
import {scoreAtLevel} from "../src/effects.js";
import {SKILL_IDS,DAMAGE_TYPES,GOLD_TYPES,spentPoints,optimizeBuild}
 from "../src/engine.js";

const setup=(damage="Pet",gold="Fairy",extra={})=>({
 damage,gold,skillPoints:10000,maxStage:800000,goldWeight:.7,
 currentLevels:{HelperBoost:1,PetDmg:10},minimums:{},sets:{},
 qol:"none",...extra
});
const score=(levels,settings)=>SKILL_IDS.reduce((sum,id)=>
 sum+scoreAtLevel(id,levels[id]??0,settings),0);
const risky=()=>({modelAttribution:{tacticalInsightSensitivity:{
 status:"compared-same-model-context",
 proposedPositiveOnlyWithCommunityCoefficient:true
}}});
const baseline=(settings,levels)=>({...risky(),levels,score:score(levels,settings)});
const excluding=(settings,levels)=>({levels,
 score:score(levels,{...settings,excludeUnverifiedTacticalInsight:true})});
const proposed={HelperBoost:30,PetDmg:1};
const alternate={HelperBoost:1,PetDmg:10};

test("18 damage/gold routes compare source-backed alternative without asserting real stages",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings=setup(damage,gold);
  const original=baseline(settings,proposed);
  let calls=0;
  const report=alternative(settings,original,{
   solve:context=>{
    calls++;
    assert.equal(context.excludeUnverifiedTacticalInsight,true);
    assert.equal(context.damage,damage);
    assert.equal(context.gold,gold);
    assert.equal(context.skillPoints,settings.skillPoints);
    return excluding(context,alternate);
   }
  });
  assert.equal(calls,1,damage+"/"+gold);
  assert.ok(["explored","no-distinct-alternative"].includes(report.status),
   damage+"/"+gold+":"+JSON.stringify(report));
  assert.equal(report.appliedToRecommendation,false);
  assert.equal(report.realStageGainPredicted,false);
  if(report.status==="explored"){
   assert.deepEqual(report.levels,alternate);
   assert.ok(report.excludedTI.alternativeMinusOriginalLog10>0);
   assert.ok(spentPoints(report.levels)<=settings.skillPoints);
   assert.equal(report.claimsTIHasZeroInGameEffect,false);
  }
 }
});
test("second solve inherits fixed pet, equipment, constraints and import protection",()=>{
 const selectedEquipment={Sword:"id-sword",Armor:"id-armor"};
 const selectedDamagePet="Pet12",selectedGoldPet="Pet23";
 const minimums={HelperBoost:1,PetDmg:1};
 const settings=setup("Pet","Fairy",{
  selectedEquipment,selectedDamagePet,selectedGoldPet,minimums,
  excluded:["PhilosophersFlux"],protectUnmodeledSkills:true
 });
 const report=alternative(settings,baseline(settings,proposed),{
  solve:options=>{
   assert.equal(options.selectedDamagePet,selectedDamagePet);
   assert.equal(options.selectedGoldPet,selectedGoldPet);
   assert.equal(options.selectedEquipment,selectedEquipment);
   assert.equal(options.minimums,minimums);
   assert.equal(options.currentLevels,settings.currentLevels);
   assert.equal(options.protectUnmodeledSkills,true);
   assert.deepEqual(options.excluded,["PhilosophersFlux"]);
   assert.equal(options.tacticalInsightAlternativeEnabled,false);
   return excluding(options,alternate);
  }
 });
 assert.equal(report.status,"explored");
 assert.equal(report.petGearContextReused,true);
});
test("Pet/Fairy yields a genuinely different full-tree option under TI uncertainty",()=>{
 const settings=setup();
 const report=alternative(settings,baseline(settings,proposed),{
  solve:options=>excluding(options,alternate)
 });
 assert.equal(report.status,"explored");
 assert.equal(report.originalTILevel,30);
 assert.equal(report.alternativeTILevel,1);
 assert.ok(report.community.alternativeMinusOriginalLog10<0);
 assert.ok(report.excludedTI.alternativeMinusOriginalLog10>0);
 assert.ok(report.changedSkillCount>=2);
 const threshold=report.coefficientSensitivity;
 assert.equal(threshold.status,"crossing");
 assert.equal(threshold.aboveThreshold,"negative");
 assert.ok(Math.abs((1-threshold.crossingFraction)*report.excludedTI.alternativeMinusOriginalLog10+
  threshold.crossingFraction*report.community.alternativeMinusOriginalLog10)<1e-8);
 assert.equal(threshold.changesAllocation,false);
});
test("stable ranking, measured TI, and contract comparison never launch an expensive solve",()=>{
 let calls=0;
 const solve=()=>{calls++;throw Error("Must not solve");};
 const settings=setup();
 const stable={modelAttribution:{tacticalInsightSensitivity:{
  status:"compared-same-model-context",
  proposedPositiveOnlyWithCommunityCoefficient:false
 }}};
 assert.equal(alternative(settings,stable,{solve}).status,"not-needed");
 for(const variant of [
  {excludeUnverifiedTacticalInsight:true},
  {tacticalInsightCalibration:{enabled:true}},
  {resolvedTacticalInsightLocal:{enabled:true}},
  {contractMultiScenario:{enabled:true}},
  {allowContractScenarioReallocation:true}
 ]){
  assert.equal(alternative({...settings,...variant},
   baseline(settings,proposed),{solve}).status,"not-applicable");
 }
 assert.equal(calls,0);
});
test("infeasible or broken candidate never affects the recommended tree",()=>{
 const settings=setup();
 const original=baseline(settings,proposed);
 const unchanged=JSON.stringify(original);
 const options=[
  {solve:()=>{throw Error("constraints impossible");},status:"unresolved"},
  {solve:()=>({levels:{PetDmg:999},score:100}),status:"unresolved"},
  {solve:()=>({levels:alternate,score:Infinity}),status:"unresolved"},
  {solve:()=>({levels:proposed,score:score(proposed,{
   ...settings,excludeUnverifiedTacticalInsight:true})}),
   status:"no-distinct-alternative"}
 ];
 for(const variant of options){
  const report=alternative(settings,original,variant);
  assert.equal(report.status,variant.status);
  assert.equal(report.appliedToRecommendation,false);
 }
 assert.equal(JSON.stringify(original),unchanged);
});
test("real optimizer can be used for the second allocation with unchanged SP constraints",()=>{
 const settings=setup("Pet","Fairy",{
  skillPoints:120,currentLevels:{HelperBoost:1,PetDmg:1},
  maxStage:100000
 });
 const main=optimizeBuild(settings);
 // Test the adapter with the actual solver, forcing only the audit trigger.
 const risk={...main,...risky()};
 const report=alternative(settings,risk,{
  solve:options=>optimizeBuild(options)
 });
 assert.equal(report.appliedToRecommendation,false);
 assert.equal(report.realStageGainPredicted,false);
 if(report.status==="explored"){
  assert.ok(spentPoints(report.levels)<=120);
  assert.ok(report.excludedTI.alternativeMinusOriginalLog10>0);
 }
});
test("frontend displays only the extra build JSON; no hit damage entry or Actions",()=>{
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
 assert.match(worker,/exploreTacticalInsightAlternative\(context,result,/);
 const details=readFileSync(new URL("../src/result-details-ui.js",import.meta.url),"utf8");
  assert.match(details,/exportBuild\(alt\.levels\)/);
 assert.match(details,/alt\?\.status==="explored"/);
 assert.doesNotMatch(app,/push-observed-damage/);
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.match(html,/&amp;alt=20261123-ti-second-tree-r1/);
 }
});
