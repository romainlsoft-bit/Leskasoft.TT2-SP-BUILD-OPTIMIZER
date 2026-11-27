import test from "node:test";
import assert from "node:assert/strict";
import {refineBranchCapacities,optimizeExact} from "../src/solver-core.js";

test("full pair search crosses a distant tier gate missed by local radius",()=>{
 const a=Float64Array.from({length:21},(_,i)=>i===20?100:0);
 const b=Float64Array.from({length:21},(_,i)=>i>=5?10:0);
 const local=refineBranchCapacities([a,b],[10,10],20,[0,0],{radius:2});
 assert.equal(local.score,10);
 const full=refineBranchCapacities([a,b],local.capacities,20,[0,0],{fullPairs:true});
 assert.equal(full.score,100);
 assert.deepEqual(full.capacities,[20,0]);
 assert.equal(full.pairwiseStationary,true);
 assert.equal(full.globallyExact,false);
});

test("full pair search respects mandatory floors and uses available capacity",()=>{
 const a=Float64Array.of(-Infinity,0,0,0,8,8,8);
 const b=Float64Array.of(-Infinity,-Infinity,2,2,2,10,10);
 const result=refineBranchCapacities([a,b],[1,2],9,[1,2],{fullPairs:true});
 assert.deepEqual(result.capacities,[4,5]);
 assert.equal(result.score,18);
 assert.ok(result.totalAllocatedCapacity<=9);
 assert.equal(result.pairwiseStationary,true);
});

test("seeded branch frontiers agree with independent pair-stationarity check",()=>{
 let seed=123456;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let trial=0;trial<80;trial++){
  const frontiers=Array.from({length:4},()=>new Float64Array(21));
  for(const a of frontiers){
   let total=0;
   for(let i=0;i<a.length;i++){total+=rand()<.25?Math.floor(rand()*20):0;a[i]=total;}
  }
  const budget=25;
  const full=refineBranchCapacities(frontiers,[5,5,5,5],budget,[0,0,0,0],{fullPairs:true,maxPasses:30});
  assert.ok(full.score>=full.initialScore);
  assert.ok(full.totalAllocatedCapacity<=budget);
  assert.equal(full.score,full.capacities.reduce((sum,c,i)=>sum+frontiers[i][c],0));
  if(!full.pairwiseStationary)continue;
  const caps=full.capacities;
  const free=budget-full.totalAllocatedCapacity;
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)
   for(let a=0;a<21;a++)for(let b=0;b<21;b++){
    if(a+b>caps[i]+caps[j]+free)continue;
    assert.ok(frontiers[i][a]+frontiers[j][b]<=frontiers[i][caps[i]]+frontiers[j][caps[j]]+1e-10);
   }
 }
});

test("production grid refinement cannot lower the legacy score or exceed exact optimum",()=>{
 const skills=[
  {id:"a",branch:"A",parent:"None",spReq:0,min:0,max:3,costs:[0,3,13,31]},
  {id:"b",branch:"B",parent:"None",spReq:0,min:1,max:3,costs:[0,2,12,23]},
  {id:"c",branch:"C",parent:"None",spReq:0,min:0,max:3,costs:[0,5,15,29]}
 ];
 const gains={a:[0,4,9,40],b:[0,3,13,19],c:[0,5,18,35]};
 const score=(skill,level)=>gains[skill.id][level];
 for(let budget=2;budget<=65;budget++){
  const opts={gridThreshold:0,gridTarget:4};
  const legacy=optimizeExact(skills,budget,score,"power",undefined,{...opts,fullPairRefinement:false});
  const improved=optimizeExact(skills,budget,score,"power",undefined,opts);
  const exact=optimizeExact(skills,budget,score);
  const spent=skills.reduce((sum,s)=>sum+s.costs[improved.levels[s.id]],0);
  assert.ok(spent<=budget);
  assert.ok(improved.levels.b>=1);
  assert.ok(improved.score>=legacy.score);
  assert.ok(improved.score<=exact.score+1e-8);
  assert.ok(improved.optimality.upperBound>=exact.score-1e-8);
  assert.equal(improved.score,skills.reduce((sum,s)=>sum+score(s,improved.levels[s.id]),0));
 }
});
