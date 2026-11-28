import test from "node:test";
import assert from "node:assert/strict";
import {refineProbabilityAllocation,isFeasibleSkillAllocation} from "../src/probability-joint-refinement.js";
const skill=(id,opts={})=>({id,branch:"A",parent:"None",spReq:0,min:0,max:1,costs:[0,1],...opts});
test("joint activation can improve when neither single upgrade is attractive",()=>{
 const skills=[skill("MultiMonsters"),skill("LovePotion"),skill("other")];
 const initial={MultiMonsters:0,LovePotion:0,other:0};
 const report=refineProbabilityAllocation({skills,budget:2,levels:initial,
  scoreFor:()=>0,residualFor:t=>2*t.MultiMonsters*t.LovePotion});
 assert.equal(report.status,"improved");
 assert.deepEqual(report.levels,{MultiMonsters:1,LovePotion:1,other:0});
 assert.equal(report.gainLog10,2);
 assert.equal(report.alternativeAdditiveLog10,0);
 assert.equal(report.globallyExact,false);
 assert.equal(report.appliedToRecommendation,false);
 assert.deepEqual(initial,{MultiMonsters:0,LovePotion:0,other:0});
});
test("a coupled upgrade can be funded by multiple levels of one donor",()=>{
 const skills=[skill("other",{max:3,costs:[0,1,2,3]}),
  skill("LoadedDice",{costs:[0,3]})];
 const report=refineProbabilityAllocation({skills,budget:3,levels:{other:3,LoadedDice:0},
  scoreFor:(k,n)=>k.id==="other"?n:0,residualFor:t=>4*t.LoadedDice});
 assert.equal(report.status,"improved");
 assert.deepEqual(report.levels,{other:0,LoadedDice:1});
 assert.equal(report.spent,3);
 assert.equal(report.gainLog10,1);
});
test("hard floors, exclusions, cap, parent and ordered branch gates cannot be violated",()=>{
 const skills=[skill("ancestor",{min:1}),skill("filler",{max:2,costs:[0,1,2]}),
  skill("MultiMonsters",{parent:"ancestor",spReq:3}),
  skill("LovePotion",{excluded:true}),
  skill("LoadedDice",{max:0})];
 const levels={ancestor:1,filler:2,MultiMonsters:1,LovePotion:0,LoadedDice:0};
 assert.ok(isFeasibleSkillAllocation(skills,levels,4));
 for(const patch of [{ancestor:0},{filler:1},{LovePotion:1},{LoadedDice:1}])
  assert.equal(isFeasibleSkillAllocation(skills,{...levels,...patch},4),false);
 assert.equal(isFeasibleSkillAllocation(skills,levels,3),false);
 const report=refineProbabilityAllocation({skills,budget:4,levels,
  scoreFor:(k,n)=>k.id==="filler"?-n:0,residualFor:t=>100*(t.LovePotion+t.LoadedDice+t.MultiMonsters)});
 assert.equal(report.status,"no-improvement-in-tested-neighborhood");
 assert.equal(report.stationary,true);
});
test("residual memoization and fixed pass bound preserve deterministic gains",()=>{
 const skills=[skill("HeavyStrikes",{max:8,costs:[0,1,2,3,4,5,6,7,8]}),
  skill("LoadedDice",{min:1})];
 const levels={HeavyStrikes:0,LoadedDice:1};
 const config={skills,budget:9,levels,scoreFor:()=>0,residualFor:t=>t.HeavyStrikes*t.LoadedDice};
 const report=refineProbabilityAllocation(config);
 assert.deepEqual(report,refineProbabilityAllocation(config));
 assert.equal(report.moves,4);
 assert.equal(report.gainLog10,4);
 assert.equal(report.stationary,false);
 assert.ok(report.residualEvaluations<=report.evaluated+1);
 assert.ok(isFeasibleSkillAllocation(skills,report.levels,9));
});
test("no residual cannot create a fictitious gain on an additive optimum",()=>{
 const skills=[skill("HeavyStrikes"),skill("other")];
 const report=refineProbabilityAllocation({skills,budget:1,levels:{HeavyStrikes:0,other:1},
  scoreFor:(k,n)=>k.id==="other"?3*n:2*n,residualFor:()=>0});
 assert.equal(report.gainLog10,0);
 assert.equal(report.status,"no-improvement-in-tested-neighborhood");
 assert.equal(report.levels,undefined);
});
