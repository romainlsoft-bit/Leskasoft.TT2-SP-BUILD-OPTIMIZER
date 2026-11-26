import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sourcedStageSkipChannels} from "../src/attack-channels.js";
import {explorePushParetoFrontier} from "../src/push-frontier.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints} from "../src/engine.js";

test("frontier is opt-in and never invents a Pet-only objective",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const no=explorePushParetoFrontier({damage,gold});
  assert.equal(no.status,"not-requested");
  assert.deepEqual(no.rows,[]);
  const need=explorePushParetoFrontier({damage,gold,pushFrontierEnabled:true},{
   solve:()=>{throw new Error("Missing attack should not run solver") }
  });
  assert.equal(need.reason,"select-an-attack-with-source-stage-skip");
 }
});

test("all 18 combinations optimize real feasible alternate trees with native level floors",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const attack=sourcedStageSkipChannels(damage)[0];
  const settings={damage,gold,goldWeight:.7,skillPoints:150,
   maxStage:300000,qol:"none",minimums:{},currentLevels:{},
   pushAttackChannelId:attack.id,pushSourceStageSkipTarget:0,
   pushFrontierEnabled:true};
  const plan=explorePushParetoFrontier(settings,{
   solve:input=>optimizeBuild(input),maxConstrained:1
  });
  assert.equal(plan.status,"explored",damage+"/"+gold);
  assert.equal(plan.build,damage);
  assert.equal(plan.gold,gold);
  assert.ok(plan.rows.length>=1&&plan.rows.length<=2);
  assert.ok(plan.pareto.length>=1);
  assert.equal(plan.noAssumedWarlordCap,true);
  assert.equal(plan.sourceSkipNotConvertedToDamage,true);
  assert.equal(plan.recommendedBestByActualStage,false);
  for(const row of plan.rows){
   assert.ok(spentPoints(row.levels)<=settings.skillPoints);
   assert.ok(row.scoreProxyLog10<=row.scoreUpperBoundLog10+1e-7);
   assert.equal(row.stageGainPredicted,false);
   assert.equal(row.scoreRepresentsMeasuredDps,false);
   assert.ok(row.sourceSkillLevel>=0);
   assert.ok(row.sourceStageSkip>=plan.baselineSourceStageSkip);
  }
 }
});

test("frontier reports incomplete or contradictory requests without altering legacy solve",()=>{
 const base={damage:"Pet",gold:"Fairy",goldWeight:.7,
  skillPoints:200,maxStage:300000,qol:"none",minimums:{},
  currentLevels:{},pushAttackChannelId:"lightning-burst",
  pushFrontierEnabled:true};
 assert.equal(explorePushParetoFrontier({...base,
  contractMultiScenario:{enabled:true}},{solve:optimizeBuild}).reason,
  "contract-scenario-comparison-is-separate");
 assert.equal(explorePushParetoFrontier({...base,assumeContractsAtMax:true},
  {solve:optimizeBuild}).reason,"unverified-contract-maximum-scenario");
 assert.throws(()=>explorePushParetoFrontier(base,{
  solve:optimizeBuild,maxConstrained:5}),/comparison budget/);
 const score=optimizeBuild(base);
 const alternate=explorePushParetoFrontier(base,{
  solve:optimizeBuild,maxConstrained:2});
 const unchanged=optimizeBuild(base);
 assert.deepEqual(score.levels,unchanged.levels);
 assert.equal(score.score,unchanged.score);
 assert.equal(alternate.rows[0].scoreProxyLog10,score.score);
});

test("calculated frontier does not treat Stage Skip as unconditional stage gain",()=>{
 const base={damage:"Pet",gold:"Fairy",skillPoints:300,
  goldWeight:.7,maxStage:300000,qol:"none",minimums:{},currentLevels:{},
  pushAttackChannelId:"lightning-burst",pushFrontierEnabled:true};
 const f=explorePushParetoFrontier(base,{
  solve:optimizeBuild,maxConstrained:3
 });
 assert.ok(f.attempted.length<=3);
 for(const row of f.rows){
  assert.equal(row.observedBossHitNotTransferred,true);
  assert.equal(row.stageGainPredicted,false);
  assert.ok(Array.isArray(row.dominatedWithinVisited));
  assert.ok(Array.isArray(row.certifiedProxyDominatorsWithinVisited));
 }
 assert.equal(f.globalOptimalityProven,false);
 assert.equal(f.exhaustiveOverSourceStageSkip,false);
});

test("push comparison is internal only; the public form has no controls",()=>{
 const cssVersion="20261122-toast-flat-r1";
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.doesNotMatch(html,/id="push-frontier-enabled"/);
  assert.ok(html.includes("styles.css?v="+cssVersion),path);
 }
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
 assert.doesNotMatch(app,/state\.pushFrontierEnabled=\$\("push-frontier-enabled"\)\.checked/);
 assert.match(worker,/const withPushFrontier=\(choice,result\)=>/);
});
