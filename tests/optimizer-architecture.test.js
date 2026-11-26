import test from "node:test";
import assert from "node:assert/strict";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES,spentPoints,parseExport} from "../src/engine.js";
import {buildAccountBaseline} from "../src/optimization-account-baseline.js";
import {createFinalCandidateDecision} from "../src/final-candidate-decision.js";

test("post-solve account and attribution boundaries preserve the public score across all routes",()=>{
 const profile=parseExport({Version:"8.4.0",Skills:{TapDmg:1},
  playerStats:{"Skill Points Owned":100},equipmentSets:["Mech","Blacksmith"]}).profile;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={damage,gold,skillPoints:100,goldWeight:.7,qol:"none",
   currentLevels:{},minimums:{},maxStage:0,craftingPower:1,timeToKill:8,sClone:30,
   accountProfile:profile,sets:{}};
  const result=optimizeBuild(settings);
  const baseline=buildAccountBaseline(settings,result.levels);
  assert.equal(result.spent,spentPoints(result.levels));
  assert.equal(result.spent+result.remaining,100);
  assert.equal(result.modelAttribution.additiveReconstructionMatches,true);
  assert.equal(result.fixedAccount.weightedLog10,baseline.fixedAccount.weightedLog10);
  assert.equal(result.accountAdjustedScore,result.score+baseline.fixedAccount.weightedLog10);
  assert.equal(result.accountIntegration.newlyResolvedSetEffects,baseline.newlyResolvedSetEffects);
 }
});

test("final candidate decision does not rerun solver for inactive alternatives",()=>{
 const settings={skillPoints:100};
 const result={score:12,levels:{TapDmg:1},modelAttribution:{}};
 const decide=createFinalCandidateDecision(settings,()=>{assert.fail("unexpected solve");});
 const out=decide({result,context:settings});
 assert.equal(out.score,result.score);
 assert.equal(out.levels,result.levels);
 assert.equal(out.tacticalInsightAlternative.status,"not-needed");
 assert.equal(out.pushFrontier,undefined);
 assert.equal(out.contractMultiScenario,undefined);
 assert.equal(result.tacticalInsightAlternative,undefined);
});

test("forced stage skip comparison reuses injected solver exactly once",()=>{
 const context={skillPoints:100,pushAttackChannelId:"test",pushSourceStageSkipTarget:5};
 const result={score:12,spent:80,levels:{TapDmg:1},branchTotals:{},
  pushSkipTarget:{enabled:true,attackChannelId:"test",sourceSkillId:"TapDmg",
   sourceColumn:"BonusAmountA",actualSourceStageSkip:5},modelAttribution:{}};
 let calls=0;
 const decide=createFinalCandidateDecision(context,opts=>{
  calls++;
  assert.equal(opts.pushAttackChannelId,"");
  assert.equal(opts.pushSourceStageSkipTarget,0);
  assert.equal(opts.skillPoints,100);
  return {score:13,spent:79,levels:{TapDmg:2},branchTotals:{},
   attackChannels:{channels:[{id:"test",skip:[{skillId:"TapDmg",kind:"stage",value:2}]}]}};
 });
 const out=decide({result,context});
 assert.equal(calls,1);
 assert.equal(out.score,12);
 assert.equal(out.pushSkipComparison.scoreDifferenceLog10,-1);
 assert.equal(out.pushSkipComparison.baselineSourceStageSkip,2);
 assert.equal(out.pushSkipComparison.constrainedSourceStageSkip,5);
 assert.equal(out.pushSkipComparison.stageGainPredicted,false);
});
