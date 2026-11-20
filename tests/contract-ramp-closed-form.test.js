import test from "node:test";
import assert from "node:assert/strict";
import {contractWindowRampMeanLog10,contractWindowSourceScore}
 from "../src/contract-multi-scenarios.js";
import {simulateContractTimeline} from "../src/contract-timeline.js";
const near=(a,b,tol=1e-11)=>Math.abs(a-b)<=tol*
 Math.max(1,Math.abs(a),Math.abs(b));
const reference=(max,r,n,total)=>{
 let sum=0;
 for(let tick=1;tick<=n;tick++)sum+=max*Math.min(1,tick/r);
 return sum/total;
};
test("closed-form 1Hz ramp agrees with exact per-tick source reference",()=>{
 const ramps=[.2,1,1.01,1.5,2,3,15,60,61.2,3599,3600,5000];
 const fractions=[0,1,2,3,10,59,60,120,1800,3600];
 for(const ramp of ramps)for(const funded of fractions){
  const actual=contractWindowRampMeanLog10(88.5,ramp,funded,3600);
  const expected=reference(88.5,ramp,funded,3600);
  assert.ok(near(actual,expected),JSON.stringify({ramp,funded,actual,expected}));
 }
});
test("no bonus after simulated mana exhaustion in the full explicit window",()=>{
 const levels={ForbiddenContract:10,RoyalContract:10,TerrifyingPact:15};
 const scenario={enabled:true,startingMana:25,manaCapacity:25,
  passiveRegenPerSecond:0,durationSeconds:120,
  freeTicks:{ForbiddenContract:0,RoyalContract:0}};
 const s=simulateContractTimeline(levels,scenario);
 const out=contractWindowSourceScore(levels,scenario,{goldWeight:.7});
 assert.equal(out.status,"scored");
 assert.equal(out.fundedTicks,s.fundedTicks);
 let expectedD=0,expectedG=0;
 for(const [id,term] of Object.entries(s.terms)){
  const raw=reference(term.sourceMaxLog10,term.sourceRampSeconds,
   s.fundedTicks,scenario.durationSeconds);
  if(id==="ForbiddenContract")expectedD+=raw;
  else expectedG+=raw;
 }
 assert.ok(near(out.damageLog10,expectedD));
 assert.ok(near(out.goldLog10,expectedG));
 assert.ok(near(out.weightedLog10,expectedD+expectedG*.7));
 assert.equal(out.addedToOriginalOptimizerScore,false);
});
test("invalid gold weight rejects even a no-contract candidate",()=>{
 const empty={ForbiddenContract:0,RoyalContract:0,TerrifyingPact:0};
 const scenario={enabled:true,startingMana:10,manaCapacity:10,
  passiveRegenPerSecond:0,durationSeconds:10,freeTicks:{}};
 for(const weight of [undefined,null,"",NaN,Infinity,-1,3]){
  const input=weight===undefined?{}:{goldWeight:weight};
  const result=contractWindowSourceScore(empty,scenario,input);
  assert.equal(result.status,"unresolved");
  assert.equal(result.reason,"invalid-gold-weight");
 }
 assert.equal(contractWindowSourceScore(empty,scenario,{goldWeight:.7}).status,"scored");
});
test("ramp rejects zero duration, inverted window, infinity or fractional ticks",()=>{
 for(const args of [[1,0,3,10],[1,-1,3,10],[1,5,-1,10],
  [1,5,11,10],[1,5,.5,10],[Infinity,5,3,10],
  [1,5,3,0],[1,5,3,1.5],[1,Infinity,3,10]]){
  assert.equal(contractWindowRampMeanLog10(...args),null,JSON.stringify(args));
 }
 assert.equal(contractWindowRampMeanLog10(0,5,3,10),0);
 assert.equal(contractWindowRampMeanLog10(500,3,0,3600),0);
});
