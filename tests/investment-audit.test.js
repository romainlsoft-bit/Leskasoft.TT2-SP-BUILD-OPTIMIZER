import {test} from "node:test";
import assert from "node:assert/strict";
import {buildInvestmentAudit,sourceSpent} from "../src/investment-audit.js";
import {skillInfo} from "../vendor/skills.js";
import {DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
const sample={TerrifyingPact:26,ClanShipStun:26,HelperDmgQTE:15,
 HelperBoost:25};
test("TT2 8.4 exact SP costs: 26 Pact, 26 Anchoring, 15 Astral",()=>{
 assert.equal(sourceSpent("TerrifyingPact",26),2156);
 assert.equal(sourceSpent("ClanShipStun",26),420);
 assert.equal(sourceSpent("HelperDmgQTE",15),442);
 assert.equal(sourceSpent("TerrifyingPact",0),0);
 assert.throws(()=>sourceSpent("TerrifyingPact",31),/Invalid level/);
});
test("audit separates 3018 protected SP from free solver allocation",()=>{
 const settings={skillPoints:22654,currentLevels:sample,damage:"Pet",gold:"Fairy",
  goldWeight:0.7,assumeContractsAtMax:false,assumeBossStunned:false,
  astralActivations:0,protectUnmodeledSkills:true};
 const a=buildInvestmentAudit(sample,settings,
 ["TerrifyingPact","ClanShipStun","HelperDmgQTE"]);
 assert.equal(a.protectedSp,3018);
 assert.equal(a.protectedWarlordSp,862);
 assert.ok(Math.abs(a.protectedPct-13.322150613578177)<1e-7);
 assert.equal(a.protectedEntries.length,3);
 assert.equal(a.protectedEntries[0].id,"TerrifyingPact");
 assert.equal(a.tacticalInsight.combinedHeuristicWeight,169.1);
 assert.equal(a.tacticalInsight.sourceWeightValidatedAgainstNative,false);
 assert.equal(a.diagnosticAddedToScore,false);
});
test("all 18 route reports are finite and do not confuse protected with optimal",()=>{
 let count=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s={skillPoints:22654,currentLevels:sample,damage,gold,goldWeight:.7};
  const a=buildInvestmentAudit(sample,s,["TerrifyingPact","ClanShipStun","HelperDmgQTE"]);
  assert.ok(Number.isFinite(a.protectedPct));
  assert.ok(Number.isFinite(a.tacticalInsight.combinedHeuristicWeight));
  assert.equal(a.protectedAllocationIsNotOptimalityProof,true);
  count++;
 }
 assert.equal(count,18);
});
test("a newly selected level beyond protected minimum is not called protected SP",()=>{
 const r=buildInvestmentAudit({...sample,TerrifyingPact:27},
  {skillPoints:22654,currentLevels:sample,damage:"Pet",gold:"Fairy",goldWeight:.7},
  ["TerrifyingPact"]);
 assert.equal(r.protectedEntries[0].level,27);
 assert.equal(r.protectedEntries[0].protectedLevel,26);
 assert.equal(r.protectedEntries[0].protectedSp,2156);
});
