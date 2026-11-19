import {test} from "node:test";
import assert from "node:assert/strict";
import {skillInfo} from "../vendor/skills.js";
import {contractSkillScore,compareTerrifyingPactLevels,resolveContractScenario}
 from "../src/contract-scenarios.js";

const approx=(actual,expected)=>assert.ok(
 Math.abs(actual-expected)<1e-10*Math.max(1,Math.abs(expected)),
 "Expected "+expected+", received "+actual);

test("TT2 8.4 Pact 15 versus 22: conditional maxima rise, titan reduction does not",()=>{
 const d=compareTerrifyingPactLevels(15,22);
 assert.equal(d.skillPointDelta,533);
 approx(d.maxConditionalGoldLog10Delta,
  Math.log10(Number(skillInfo.TerrifyingPact.A22)/
   Number(skillInfo.TerrifyingPact.A15)));
 approx(d.maxConditionalDamageLog10Delta,
  Math.log10(Number(skillInfo.TerrifyingPact.B22)/
   Number(skillInfo.TerrifyingPact.B15)));
 assert.ok(d.maxConditionalGoldLog10Delta>29);
 assert.ok(d.maxConditionalDamageLog10Delta>20);
 assert.equal(d.titansPerStageReductionDelta,0);
 assert.equal(d.conditions.gold,"ForbiddenContract-active");
 assert.equal(d.conditions.damage,"RoyalContract-active");
 assert.equal(d.shownInGameStatsVerified,false);
 assert.equal(d.actualContractUptimeVerified,false);
 assert.equal(d.appliedToOptimizationScore,false);
 assert.equal(d.predictsStageGain,false);
});

test("comparison reverses correctly and Co0 is first-level cost",()=>{
 const increase=compareTerrifyingPactLevels(15,22);
 const decrease=compareTerrifyingPactLevels(22,15);
 assert.equal(decrease.skillPointDelta,-increase.skillPointDelta);
 approx(decrease.maxConditionalDamageLog10Delta,
  -increase.maxConditionalDamageLog10Delta);
 approx(decrease.maxConditionalGoldLog10Delta,
  -increase.maxConditionalGoldLog10Delta);
 assert.equal(compareTerrifyingPactLevels(0,1).skillPointDelta,3);
 assert.equal(compareTerrifyingPactLevels(0,0).skillPointDelta,0);
 assert.throws(()=>compareTerrifyingPactLevels(31,15),/Invalid/);
 assert.throws(()=>compareTerrifyingPactLevels(15,-1),/Invalid/);
});

test("Stats screenshot cannot turn conditional maxima into passive score",()=>{
 const levels={ForbiddenContract:1,RoyalContract:1,TerrifyingPact:15};
 const conservative={goldWeight:.7,assumeContractsAtMax:false,
  currentLevels:{TerrifyingPact:22}};
 const result=resolveContractScenario(levels,conservative);
 assert.equal(result.weightedLog10,0);
 assert.equal(result.pactSourceLevelComparison.skillPointDelta,-533);
 assert.ok(result.pactSourceLevelComparison.maxConditionalDamageLog10Delta< -20);
 for(const id of Object.keys(levels))
  assert.equal(contractSkillScore(id,levels[id],conservative),0);
 assert.equal(result.pactSourceLevelComparison.shownInGameStatsVerified,false);
 const atMaximum=resolveContractScenario(levels,
  {...conservative,assumeContractsAtMax:true,
   minimums:{ForbiddenContract:1,RoyalContract:1}});
 assert.ok(atMaximum.weightedLog10>0);
 assert.equal(atMaximum.pactSourceLevelComparison.skillPointDelta,-533);
 assert.equal(atMaximum.pactSourceLevelComparison.appliedToOptimizationScore,false);
 assert.equal(resolveContractScenario(levels,
  {goldWeight:.7}).pactSourceLevelComparison,null);
});
