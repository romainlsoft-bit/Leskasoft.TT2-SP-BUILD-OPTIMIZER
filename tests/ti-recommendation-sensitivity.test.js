import test from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {tacticalInsightRecommendationSensitivity as audit}
 from "../src/tactical-insight-sensitivity.js";
import {scoreAtLevel} from "../src/effects.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints}
 from "../src/engine.js";

const opts=(damage="Pet",gold="Fairy",extra={})=>({
 damage,gold,goldWeight:.7,skillPoints:30000,
 maxStage:800000,qol:"none",minimums:{},currentLevels:{},sets:{},
 ...extra
});
const close=(a,b)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<1e-8,`${a} != ${b}`);

test("18 build routes identify TI-dependent ranking without converting to stages",()=>{
 const current={HelperBoost:1,PetDmg:10};
 const proposed={HelperBoost:30,PetDmg:1};
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const result=audit(current,proposed,opts(damage,gold));
  assert.equal(result.status,"compared-same-model-context",damage+"/"+gold);
  assert.equal(result.noReoptimizationPerformed,true);
  assert.equal(result.predictsStageGain,false);
  assert.equal(result.affectsAllocation,false);
  assert.ok(result.currentSpentSp<=30000&&result.proposedSpentSp<=30000);
  assert.ok(Number.isFinite(result.community.proposedMinusCurrentLog10));
  assert.ok(Number.isFinite(result.heuristicExcluded.proposedMinusCurrentLog10));
 }
});
test("Pet/Fairy synthetic regression reverses when TI community coefficient is removed",()=>{
 const r=audit({HelperBoost:1,PetDmg:10},{HelperBoost:30,PetDmg:1},opts());
 assert.equal(r.status,"compared-same-model-context");
 assert.ok(r.community.proposedMinusCurrentLog10>0);
 assert.ok(r.heuristicExcluded.proposedMinusCurrentLog10<0);
 assert.equal(r.proposedPositiveOnlyWithCommunityCoefficient,true);
 assert.equal(r.proposedImprovesUnderBothTIModels,false);
 assert.deepEqual(r.tacticalInsightLevels,{current:1,proposed:30});
 const threshold=r.coefficientSensitivity;
 assert.equal(threshold.status,"crossing");
 assert.equal(threshold.aboveThreshold,"positive");
 close((1-threshold.crossingFraction)*r.heuristicExcluded.proposedMinusCurrentLog10+
  threshold.crossingFraction*r.community.proposedMinusCurrentLog10,0);
 assert.equal(threshold.coefficientCalibrated,false);
});
test("only TI coefficient changes; other skill score unchanged",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s=opts(damage,gold);
  for(const id of ["PetDmg","HelperDmgQTE","ClanShipDmg",
   "MagnumOpus","PhilosophersFlux"]){
   close(scoreAtLevel(id,5,s),scoreAtLevel(id,5,{
    ...s,excludeUnverifiedTacticalInsight:true}));
  }
 }
});
test("no measured level pair, no scope-free comparison",()=>{
 const current={HelperBoost:1},proposed={HelperBoost:3};
 for(const mode of [
  {tacticalInsightCalibration:{enabled:true}},
  {resolvedTacticalInsightLocal:{enabled:true}},
  {excludeUnverifiedTacticalInsight:true}
 ]){
  assert.equal(audit(current,proposed,opts("Pet","Fairy",mode)).status,
   "not-comparable");
 }
 assert.equal(audit({},proposed,opts()).reason,"no-current-skill-tree");
 assert.equal(audit({HelperBoost:99},proposed,opts()).reason,
  "invalid-skill-tree-level");
 assert.equal(audit(current,proposed,opts("Pet","Fairy",{
  minimums:{HelperBoost:2}})).reason,
  "current-tree-does-not-meet-modeled-minimums");
 assert.equal(audit(current,proposed,opts("Pet","Fairy",{
  skillPoints:1})).reason,"skill-tree-exceeds-budget");
});
test("engine exposes the sensitivity as attribution only, not a second allocation",()=>{
 const currentLevels={HelperBoost:2,PetDmg:2};
 const r=optimizeBuild(opts("Pet","Fairy",{
  skillPoints:100,currentLevels,protectUnmodeledSkills:true}));
 const sensitivity=r.modelAttribution.tacticalInsightSensitivity;
 assert.equal(sensitivity.status,"compared-same-model-context");
 assert.equal(sensitivity.affectsAllocation,false);
 assert.equal(sensitivity.predictsStageGain,false);
 assert.ok(spentPoints(r.levels)<=100);
});
test("repository does not contain GitHub Actions workflows",()=>{
 assert.equal(existsSync(new URL("../.github/workflows/",import.meta.url)),false,
  "TT2 CI policy forbids GitHub Actions; use standalone Node tests");
});
