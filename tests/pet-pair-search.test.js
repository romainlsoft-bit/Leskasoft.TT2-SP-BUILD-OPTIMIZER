import test from "node:test";
import assert from "node:assert/strict";
import {selectPetPair} from "../src/pet-pair-search.js";

const damage=[{id:"D1",name:"One"},{id:"D2",name:"Two"}];
const gold=[{id:"G1",name:"Coin"},{id:"G2",name:"Fairy"}];
const weighted={
 "D1/G1":0,"D2/G1":10,
 "D1/G2":25,"D2/G2":20
};
const score=(d,g)=>({adjustedScore:weighted[d+"/"+g],
 result:{paired:{damage:d,gold:g}}});

test("pet pair search repairs stale damage winner when gold candidate changes",()=>{
 const chosen=selectPetPair(damage,gold,score);
 assert.equal(chosen.best.damagePet,"D1");
 assert.equal(chosen.best.goldPet,"G2");
 assert.equal(chosen.best.adjustedScore,25);
 assert.deepEqual(chosen.best.result.paired,{damage:"D1",gold:"G2"});
 assert.equal(chosen.converged,true);
 assert.ok(chosen.passes>=2);
 assert.deepEqual(chosen.damageResults.map(x=>x.adjustedScore),[25,20]);
 assert.deepEqual(chosen.goldResults.map(x=>x.adjustedScore),[0,25]);
 assert.equal(chosen.shortlistOnly,true);
});
test("one incomplete coordinate pass is reported as unresolved, not globally optimal",()=>{
 const chosen=selectPetPair(damage,gold,score,{maxPasses:1});
 assert.equal(chosen.best.damagePet,"D2");
 assert.equal(chosen.best.goldPet,"G2");
 assert.equal(chosen.best.adjustedScore,20);
 assert.equal(chosen.converged,false);
 assert.equal(chosen.damageResults.find(x=>x.petId==="D1").adjustedScore,25);
});
test("evaluations of the same pet pair are cached, including final result",()=>{
 const seen=new Map(),progress=[];
 const chosen=selectPetPair(damage,gold,(d,g)=>{
  const key=d+"/"+g;
  seen.set(key,(seen.get(key)||0)+1);
  return score(d,g);
 },{onProgress:p=>progress.push(p)});
 assert.equal(seen.size,chosen.uniqueEvaluations);
 assert.ok([...seen.values()].every(n=>n===1));
 assert.equal(progress.length,chosen.uniqueEvaluations);
 assert.ok(chosen.uniqueEvaluations<=damage.length*gold.length);
 assert.equal(chosen.attempts.length,chosen.uniqueEvaluations);
});
test("missing opposite slot does not fabricate a pet or score",()=>{
 const selected=selectPetPair(damage,[],d=>({adjustedScore:d==="D1"?3:7}));
 assert.equal(selected.best.damagePet,"D2");
 assert.equal(selected.best.goldPet,null);
 assert.equal(selected.best.adjustedScore,7);
 assert.equal(selected.converged,true);
 const alternate=selectPetPair([],gold,(_,g)=>({adjustedScore:g==="G1"?5:1}));
 assert.equal(alternate.best.damagePet,null);
 assert.equal(alternate.best.goldPet,"G1");
 assert.equal(alternate.converged,true);
 assert.deepEqual(selectPetPair([],[],score).candidateCount,undefined);
});
test("score ties prefer existing candidate to prevent oscillation",()=>{
 const ties=selectPetPair(damage,gold,()=>({adjustedScore:42}));
 assert.deepEqual([ties.best.damagePet,ties.best.goldPet],["D1","G1"]);
 assert.equal(ties.converged,true);
 assert.equal(ties.passes,1);
});
test("invalid evaluator results, duplicate pets, or unsafe pass counts are rejected",()=>{
 assert.throws(()=>selectPetPair(damage,gold,()=>({adjustedScore:NaN})),/Non-finite/);
 assert.throws(()=>selectPetPair(damage,gold,()=>({adjustedScore:Infinity})),/Non-finite/);
 assert.throws(()=>selectPetPair(damage,gold,()=>null),/Non-finite/);
 assert.throws(()=>selectPetPair([damage[0],damage[0]],gold,score),/Duplicated/);
 assert.throws(()=>selectPetPair([...damage,{id:"D3"},{id:"D4"}],gold,score),/three/);
 assert.throws(()=>selectPetPair(damage,gold,score,{maxPasses:0}),/1–6/);
});

test("Q: exhaustive shortlist solves a 2x2 coordinate-descent trap",()=>{
 const grid={"D1/G1":9,"D2/G1":8,"D1/G2":7,"D2/G2":20};
 const evalPair=(d,g)=>({adjustedScore:grid[d+"/"+g],result:{gearFor:d+"/"+g}});
 const coord=selectPetPair(damage,gold,evalPair);
 assert.equal(coord.best.adjustedScore,9);
 const exact=selectPetPair(damage,gold,evalPair,{exhaustiveShortlist:true});
 assert.deepEqual([exact.best.damagePet,exact.best.goldPet],["D2","G2"]);
 assert.equal(exact.best.adjustedScore,20);
 assert.equal(exact.best.result.gearFor,"D2/G2");
 assert.equal(exact.exhaustiveWithinShortlist,true);
 assert.equal(exact.shortlistOnly,true);
 assert.equal(exact.uniqueEvaluations,4);
 assert.deepEqual(exact.damageResults.map(r=>r.adjustedScore),[7,20]);
 assert.deepEqual(exact.goldResults.map(r=>r.adjustedScore),[8,20]);
});
test("Q: exactly nine distinct evaluations for a 3x3 shortlist",()=>{
 const a=[{id:"A"},{id:"B"},{id:"C"}],b=[{id:"X"},{id:"Y"},{id:"Z"}];
 const seen=new Map(),progress=[];
 const result=selectPetPair(a,b,(d,g)=>{
  const id=d+"/"+g; seen.set(id,(seen.get(id)||0)+1);
  return {adjustedScore:d==="C"&&g==="Z"?100:0};
 },{exhaustiveShortlist:true,onProgress:p=>progress.push(p)});
 assert.equal(result.uniqueEvaluations,9);
 assert.ok([...seen.values()].every(n=>n===1));
 assert.equal(progress.at(-1).completed,9);
 assert.equal(progress.at(-1).total,9);
 assert.deepEqual([result.best.damagePet,result.best.goldPet],["C","Z"]);
});
test("Q: one-slot search and ties stay deterministic",()=>{
 const single=selectPetPair(damage,[],d=>({adjustedScore:d==="D2"?9:2}),
  {exhaustiveShortlist:true});
 assert.equal(single.best.goldPet,null);
 assert.equal(single.best.damagePet,"D2");
 assert.equal(single.uniqueEvaluations,2);
 const ties=selectPetPair(damage,gold,()=>({adjustedScore:7}),
  {exhaustiveShortlist:true});
 assert.deepEqual([ties.best.damagePet,ties.best.goldPet],["D1","G1"]);
 assert.equal(ties.uniqueEvaluations,4);
 assert.equal(ties.converged,true);
});
