import test from "node:test";
import assert from "node:assert/strict";
import {contractInvestmentPlans} from "../src/contract-plan-candidates.js";
const level=(f,r,p)=>({ForbiddenContract:f,RoyalContract:r,TerrifyingPact:p});
test("lv22 of Pact explores lv15, never hardcodes a damage multiplier",()=>{
 const rows=contractInvestmentPlans(level(10,10,22),level(20,20,25),{},
  {pactAtMaxDuringFundedTicks:true});
 assert.ok(rows.some(x=>x.id==="contract-pact-stepdown"&&
  x.minimums.TerrifyingPact===15));
 assert.ok(rows.some(x=>x.id==="contract-pact-priority"&&
  x.minimums.ForbiddenContract===1&&x.minimums.RoyalContract===1));
 assert.ok(rows.length<=3);
});
test("user minimums and opt-in respect are enforced per contract skill",()=>{
 const levels=level(10,10,22),seed=level(20,20,25);
 const conservative=contractInvestmentPlans(levels,seed,{},
  {pactAtMaxDuringFundedTicks:false});
 assert.equal(conservative.length,1);
 const restricted=contractInvestmentPlans(levels,seed,
  {TerrifyingPact:20,ForbiddenContract:8},
  {pactAtMaxDuringFundedTicks:true});
 assert.ok(restricted.every(x=>x.minimums.TerrifyingPact>=20&&
  x.minimums.ForbiddenContract>=8));
 assert.ok(restricted.length<=3);
});
