import test from "node:test";
import assert from "node:assert/strict";
import {contractWindowSourceScore,rankContractCandidates,
 proposeContractScenarioBuild} from "../src/contract-multi-scenarios.js";
import {optimizeBuild,spentPoints,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";

const period={enabled:true,startingMana:1000,manaCapacity:1000,
 passiveRegenPerSecond:0,durationSeconds:10,
 freeTicks:{ForbiddenContract:0,RoyalContract:0}};
const level=(f=0,r=0,p=0,ct=0)=>({ForbiddenContract:f,
 RoyalContract:r,TerrifyingPact:p,CombatTechniques:ct});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),a+" ≠ "+b);

test("window score credits only funded seconds, not maximum for the entire horizon",()=>{
 const l=level(10,10,15);
 const whole=contractWindowSourceScore(l,period,{goldWeight:.7});
 const starved=contractWindowSourceScore(l,{...period,
  startingMana:1,manaCapacity:1},{goldWeight:.7});
 assert.equal(whole.status,"scored");
 assert.equal(whole.fundedTicks,10);
 assert.equal(starved.status,"scored");
 assert.ok(starved.fundedTicks<10);
 assert.ok(starved.weightedLog10<whole.weightedLog10);
 const p0=contractWindowSourceScore(l,period,{goldWeight:.7});
 const pact=contractWindowSourceScore(l,period,{goldWeight:.7,
  pactAtMaxDuringFundedTicks:true});
 assert.ok(pact.weightedLog10>p0.weightedLog10);
 assert.equal(p0.pactAssumedAtFullSourceWhileFunded,false);
 assert.equal(pact.gameplayUptimeVerified,false);
 assert.equal(pact.addedToOriginalOptimizerScore,false);
});

test("explicit weighting produces reproducible candidate ranking; never infers active frequency",()=>{
 const candidates=[{id:"conservative",result:{levels:level()},
  modeledLogScore:100},{id:"contract-investment",result:{levels:level(10,10,15)},
  modeledLogScore:80}];
 const opt={goldWeight:.7,contractTimeline:period};
 const req=(activeFraction,pact=false)=>rankContractCandidates(candidates,opt,{
  enabled:true,activeFraction,pactAtMaxDuringFundedTicks:pact});
 assert.equal(req(0).winnerId,"conservative");
 assert.equal(req(1).winnerId,"contract-investment");
 assert.equal(req(1).globallyOptimal,false);
 assert.equal(req(1).appliedToRecommendation,false);
 assert.equal(req(undefined).status,"unresolved");
 assert.equal(req("NaN").status,"unresolved");
 assert.equal(req(1.1).status,"unresolved");
 assert.equal(rankContractCandidates(candidates,{...opt,
  assumeContractsAtMax:true},{enabled:true,activeFraction:1}).status,"unresolved");
 assert.equal(rankContractCandidates(candidates,{goldWeight:.7},
  {enabled:true,activeFraction:1}).status,"unresolved");
});

test("pact level 15/22 is never scored without explicit active maximum assumption",()=>{
 const first=contractWindowSourceScore(level(10,10,15),period,{goldWeight:.7});
 const second=contractWindowSourceScore(level(10,10,22),period,{goldWeight:.7});
 near(first.weightedLog10,second.weightedLog10);
 const a=contractWindowSourceScore(level(10,10,15),period,
  {goldWeight:.7,pactAtMaxDuringFundedTicks:true});
 const b=contractWindowSourceScore(level(10,10,22),period,
  {goldWeight:.7,pactAtMaxDuringFundedTicks:true});
 assert.ok(b.weightedLog10>a.weightedLog10);
});

test("source-only evaluation rejects invalid mana and unknown weights",()=>{
 const l=level(10,0,15);
 assert.equal(contractWindowSourceScore(l,{...period,startingMana:""},
  {goldWeight:.7}).status,"unresolved");
 assert.equal(contractWindowSourceScore(l,period,{goldWeight:Infinity}).status,"unresolved");
 const bad=rankContractCandidates([{id:"a",result:{levels:l},
  modeledLogScore:Infinity}],{goldWeight:.7,contractTimeline:period},
  {enabled:true,activeFraction:1});
 assert.equal(bad.status,"unresolved");
});

test("candidate generator never uses the optimistically scored solution directly",()=>{
 let calls=[];
 const solve=context=>{
  calls.push(context);
  if(context.assumeContractsAtMax)
   return {levels:level(10,10,15)};
  return {levels:level(context.minimums?.ForbiddenContract??0,
   context.minimums?.RoyalContract??0,
   context.minimums?.TerrifyingPact??0)};
 };
 const settings={goldWeight:.7,skillPoints:10000,
  contractTimeline:period,contractMultiScenario:{
   enabled:true,activeFraction:1,pactAtMaxDuringFundedTicks:true}};
 const base={levels:level()};
 const x=proposeContractScenarioBuild({settings,baseline:base,
  gearSelection:{selected:{}},solve,score:r=>r.levels.ForbiddenContract?80:100});
 assert.ok(calls.length>=2&&calls.length<=4);
 assert.equal(calls[0].assumeContractsAtMax,true);
 assert.ok(calls.slice(1).every(ctx=>ctx.assumeContractsAtMax===false));
 assert.ok(calls.slice(1).some(ctx=>ctx.minimums.TerrifyingPact===15));
 assert.equal(x.selection.appliedToRecommendation,true);
 assert.equal(x.result.levels.ForbiddenContract,10);
 assert.equal(x.selection.globallyOptimal,false);
});
test("generator blocks changed CT gear coupling, invalid explicit weight, or infeasible optimistic seed",()=>{
 const s={goldWeight:.7,contractTimeline:period,
  contractMultiScenario:{enabled:true,activeFraction:1,pactAtMaxDuringFundedTicks:true}};
 const baseline={levels:level(0,0,0,5)};
 const alt=proposeContractScenarioBuild({settings:s,baseline,score:r=>r.levels.ForbiddenContract?80:100,
  solve:ctx=>({levels:level(10,10,22,ctx.assumeContractsAtMax?20:20)})});
 assert.equal(alt.selection.requiresNewGearCTRefinement,true);
 assert.equal(alt.selection.appliedToRecommendation,false);
 assert.equal(alt.result,baseline);
 const conflict=proposeContractScenarioBuild({settings:{
  ...s,assumeContractsAtMax:true},baseline,
  solve:()=>{throw Error("must not run an inconsistent scenario")},
  score:()=>100});
 assert.equal(conflict.selection.status,"unresolved");
 assert.equal(conflict.selection.reason,"cannot-combine-with-maximum-contract-scoring");
 assert.equal(conflict.result,baseline);
 const invalid=proposeContractScenarioBuild({settings:{
  ...s,contractMultiScenario:{enabled:true}},baseline,solve:()=>{throw Error("should not execute")},
  score:()=>100});
 assert.equal(invalid.selection.status,"unresolved");
 const failed=proposeContractScenarioBuild({settings:s,baseline,score:()=>100,
  solve:()=>{throw Error("not enough SP") }});
 assert.equal(failed.selection.status,"only-conservative-feasible");
});

test("18 real damage/gold routes remain conservative by default and are eligible for sourced what-if",()=>{
 const common={goldWeight:.7,skillPoints:150,qol:"none",
  currentLevels:{},minimums:{},maxStage:15000,
  craftingPower:1,timeToKill:8,sClone:30};
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={...common,damage,gold};
  const base=optimizeBuild(settings);
  assert.ok(spentPoints(base.levels)<=settings.skillPoints);
  assert.equal(proposeContractScenarioBuild({settings,baseline:base}).result,base);
  const inactive=contractWindowSourceScore(base.levels,period,{goldWeight:.7});
  assert.equal(inactive.status,"scored");
  assert.ok(Number.isFinite(inactive.weightedLog10));
 }
});

test("explicit scenario can test Pact lv15 from a saved lv22 while respecting other protected skills",()=>{
 const settings={goldWeight:.7,contractTimeline:period,
  contractMultiScenario:{enabled:true,activeFraction:1,
   pactAtMaxDuringFundedTicks:true}};
 const saved={levels:level(10,10,22,5)};
 const calls=[];
 const resolve=ctx=>{
  calls.push(ctx);
  if(ctx.assumeContractsAtMax)return {levels:level(20,20,25,5)};
  return {levels:level(ctx.minimums.ForbiddenContract,
   ctx.minimums.RoyalContract,ctx.minimums.TerrifyingPact,5)};
 };
 const score=r=>r.levels.TerrifyingPact===15?199:
  r.levels.TerrifyingPact===22?198:100;
 const choice=proposeContractScenarioBuild({settings,baseline:saved,
  solve:resolve,score});
 assert.equal(choice.selection.status,"ranked");
 assert.ok(choice.selection.rows.some(row=>row.id==="contract-pact-stepdown"));
 assert.ok(calls.slice(1).every(ctx=>ctx.allowContractScenarioReallocation===true));
 assert.ok(calls.length<=4);
 assert.equal(choice.selection.protectsOtherUnmodeledSkills,true);
 assert.equal(choice.selection.globallyOptimal,false);
});
test("CT-unsafe highest scoring candidate does not exclude the next-safe scenario alternative",()=>{
 const settings={goldWeight:.7,contractTimeline:period,
  contractMultiScenario:{enabled:true,activeFraction:1,
   pactAtMaxDuringFundedTicks:true}};
 const base={levels:level(10,10,22,5)};
 const solve=ctx=>{
  if(ctx.assumeContractsAtMax)return {levels:level(20,20,25,5)};
  const m=ctx.minimums;
  return {levels:level(m.ForbiddenContract,m.RoyalContract,
   m.TerrifyingPact,m.TerrifyingPact===15?5:20)};
 };
 const result=proposeContractScenarioBuild({settings,baseline:base,
  solve,score:r=>r.levels.TerrifyingPact===25?300:
   r.levels.TerrifyingPact===15?299:100});
 assert.equal(result.selection.requiresNewGearCTRefinement,true);
 assert.equal(result.result.levels.CombatTechniques,5);
 assert.equal(result.selection.winnerId,"contract-pact-stepdown");
 assert.equal(result.selection.appliedToRecommendation,true);
});
test("narrow opt-in releases only contract protection, not unrelated unmodeled skills",()=>{
 const common={damage:"Pet",gold:"Fairy",goldWeight:.7,skillPoints:450,
  maxStage:16000,timeToKill:8,sClone:30,
  qol:"none",currentLevels:{ForbiddenContract:1,RoyalContract:1,
   TerrifyingPact:1,QuickFortune:1},minimums:{}};
 const normal=optimizeBuild(common);
 assert.ok(normal.protectedSkills.includes("TerrifyingPact"));
 assert.ok(normal.protectedSkills.includes("QuickFortune"));
 const policy={enabled:true,activeFraction:1,pactAtMaxDuringFundedTicks:true};
 const enabled=optimizeBuild({...common,contractTimeline:period,
  contractMultiScenario:policy,allowContractScenarioReallocation:true});
 assert.ok(!enabled.protectedSkills.includes("TerrifyingPact"));
 assert.ok(enabled.protectedSkills.includes("QuickFortune"));
 assert.ok(spentPoints(enabled.levels)<=450);
 const noExplicitPolicy=optimizeBuild({...common,contractTimeline:period,
  contractMultiScenario:{enabled:true,activeFraction:""},
  allowContractScenarioReallocation:true});
 assert.ok(noExplicitPolicy.protectedSkills.includes("TerrifyingPact"));
});
