import test from "node:test";
import assert from "node:assert/strict";
import {optimizeExact} from "../src/solver-core.js";
const costs=[[0,14,18,32],[0,20,30,42],[0,2,14,24],[0,20,34,46],[0,14,22,28]];
const gains=[[0,29,54,65],[0,27,42,53],[0,29,54,69],[0,11,16,17],[0,25,52,53]];
const skills=costs.map((costs,i)=>({id:"s"+i,branch:"B"+i,parent:"None",spReq:0,min:0,max:3,costs}));
const score=(s,l)=>gains[Number(s.id.slice(1))][l];
const opts={gridThreshold:0,gridTarget:4};
const imported={s0:2,s1:1,s2:2,s3:0,s4:2};
const solve=(levels,sp=76,list=skills)=>optimizeExact(list,sp,score,"power",undefined,{...opts,initialLevels:levels});
const spent=(result,list=skills)=>list.reduce((sum,s)=>sum+s.costs[result.levels[s.id]],0);
test("imported capacity seed escapes a known pairwise local optimum",()=>{
 const original=solve(null), improved=solve(imported), exact=optimizeExact(skills,76,score);
 assert.equal(original.score,176);
 assert.equal(exact.score,187);
 assert.equal(improved.score,exact.score);
 assert.equal(improved.optimality.warmStart.selected,true);
 assert.equal(improved.optimality.warmStart.gain,11);
 assert.ok(spent(improved)<=76);
 assert.ok(improved.optimality.upperBound>=exact.score);
 assert.equal(improved.optimality.pairRefinement.gain,original.optimality.pairRefinement.gain);
});
test("empty, malformed and over-budget seeds cannot degrade grid solution",()=>{
 for(const seed of [{},{s0:4},{s0:1.5},{s0:"2"},{s0:3,s1:3,s2:3,s3:3,s4:3}]){
  const baseline=solve(null),actual=solve(seed);
  assert.deepEqual(actual.levels,baseline.levels);
  assert.equal(actual.score,baseline.score);
  assert.equal(actual.optimality.warmStart.status,"empty-or-invalid-budget");
 }
});
test("seed is a capacity hint, not a way around current skill constraints",()=>{
 const constrained=skills.map(s=>s.id==="s0"?{...s,min:1,excluded:true}:s.id==="s3"?{...s,min:1}:s);
 const baseline=solve(null,76,constrained);
 const actual=solve(imported,76,constrained);
 assert.equal(actual.levels.s0,1);
 assert.ok(actual.levels.s3>=1);
 assert.ok(spent(actual,constrained)<=76);
 assert.ok(actual.score>=baseline.score);
 assert.equal(actual.score,constrained.reduce((sum,s)=>sum+score(s,actual.levels[s.id]),0));
});
test("seeded search never loses modeled score and remains under exact reference",()=>{
 for(let budget=20;budget<=90;budget++){
  const baseline=solve(null,budget);
  const exact=optimizeExact(skills,budget,score);
  const actual=solve(exact.levels,budget);
  assert.ok(actual.score>=baseline.score);
  assert.ok(actual.score<=exact.score+1e-8);
  assert.ok(spent(actual)<=budget);
  assert.ok(actual.optimality.upperBound>=exact.score-1e-8);
 }
});
test("exact optimization ignores the seed",()=>{
 assert.deepEqual(optimizeExact(skills,76,score,"power",undefined,{initialLevels:imported}),
  optimizeExact(skills,76,score));
});
