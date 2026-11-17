import {test} from "node:test";
import assert from "node:assert/strict";
import {skillInfo} from "../vendor/skills.js";
import {scoreAtLevel} from "../src/effects.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {contractSkillScore,resolveContractScenario}
 from "../src/contract-scenarios.js";

const levels={ForbiddenContract:10,RoyalContract:10,TerrifyingPact:10};
const flags={assumeContractsAtMax:true,goldWeight:.7,
 minimums:{ForbiddenContract:1,RoyalContract:1}};
const approx=(a,b,msg="")=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),
 msg+" "+a+" ≠ "+b);
const log=(id,bonus,n)=>Math.log10(Number(skillInfo[id][bonus+n]));
const profile=parseAccountProfile({equipmentSets:[]});
const settings=(damage="Pet",gold="Fairy",assumeContractsAtMax=true)=>({
 ...flags,accountProfile:profile,skillPoints:500,damage,gold,
 qol:"none",sets:{},currentLevels:{},maxStage:250000,
 craftingPower:1,timeToKill:8,sClone:30,
 assumeContractsAtMax
});

test("Forbidden is damage, Royal is gold, Pact A is gold and Pact B damage",()=>{
 approx(contractSkillScore("ForbiddenContract",10,flags),
  log("ForbiddenContract","A",10));
 approx(contractSkillScore("RoyalContract",10,flags),
  .7*log("RoyalContract","A",10));
 approx(contractSkillScore("TerrifyingPact",10,flags),
  .7*log("TerrifyingPact","A",10)+log("TerrifyingPact","B",10));
 const model=resolveContractScenario(levels,flags);
 approx(model.damageLog10,log("ForbiddenContract","A",10)+
  log("TerrifyingPact","B",10));
 approx(model.goldLog10,log("RoyalContract","A",10)+
  log("TerrifyingPact","A",10));
 approx(model.weightedLog10,
  ["ForbiddenContract","RoyalContract","TerrifyingPact"]
   .reduce((sum,id)=>sum+contractSkillScore(id,levels[id],flags),0));
 assert.equal(model.titanReduction.addedToDamageScore,false);
 assert.equal(model.titanReduction.duringContracts,Number(skillInfo.TerrifyingPact.C10));
});

test("Pact synergy is gated separately by each contract's minimum",()=>{
 const neither={...flags,minimums:{}};
 const onlyForbidden={...flags,minimums:{ForbiddenContract:1}};
 const onlyRoyal={...flags,minimums:{RoyalContract:1}};
 assert.equal(contractSkillScore("TerrifyingPact",10,neither),0);
 approx(contractSkillScore("TerrifyingPact",10,onlyForbidden),
  .7*log("TerrifyingPact","A",10));
 approx(contractSkillScore("TerrifyingPact",10,onlyRoyal),
  log("TerrifyingPact","B",10));
 approx(contractSkillScore("TerrifyingPact",10,flags),
  contractSkillScore("TerrifyingPact",10,onlyForbidden)+
  contractSkillScore("TerrifyingPact",10,onlyRoyal));
});

test("unverified mana and ramp time never become free always-on bonuses",()=>{
 const disabled={...flags,assumeContractsAtMax:false};
 for(const id of Object.keys(levels))
  assert.equal(contractSkillScore(id,levels[id],disabled),0);
 const out=resolveContractScenario(levels,disabled);
 assert.equal(out.weightedLog10,0);
 assert.deepEqual(out.activeIfAssumptionsHold,{
  forbidden:false,royal:false,pact:false,pactGold:false,pactDamage:false
 });
 assert.equal(out.baseDrain.combined,0);
 assert.equal(out.assumptions.manaSustainable,false);
 assert.equal(out.validatedFullManaUptime,false);
 assert.equal(out.predictsStageGain,false);
 assert.equal(out.addToAccountBaseline,false);
});

test("mana cost uses only the two initial drains; no fictitious duration",()=>{
 const out=resolveContractScenario(levels,flags);
 const fc=Number(skillInfo.ForbiddenContract.B10),
  rc=Number(skillInfo.RoyalContract.B10);
 approx(out.baseDrain.forbidden,fc);
 approx(out.baseDrain.royal,rc);
 approx(out.baseDrain.combined,fc+rc);
 assert.equal(out.assumptions.drainGrowthOverTimeModeled,false);
 assert.ok(!("durationSeconds" in out));
 assert.ok(!("manaUptime" in out));
 const fOnly=resolveContractScenario({
  ForbiddenContract:10,RoyalContract:0,TerrifyingPact:10},flags);
 approx(fOnly.weightedLog10,
  log("ForbiddenContract","A",10)+.7*log("TerrifyingPact","A",10));
 assert.equal(fOnly.activeIfAssumptionsHold.pactDamage,false);
});

test("contract source IDs/values remain finite and correct across all 18 builds",()=>{
 let checked=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const ctx=settings(damage,gold);
  for(const [id,level] of Object.entries(levels)){
   for(const n of [0,1,level,30]){
    const score=scoreAtLevel(id,n,ctx);
    const sourced=contractSkillScore(id,n,ctx);
    approx(score,sourced,damage+" / "+gold+" / "+id+"/"+n);
    checked++;
   }
  }
 }
 assert.equal(checked,18*3*4);
});

test("invalid levels, weights and contract skill IDs fail without NaN",()=>{
 assert.throws(()=>contractSkillScore("Other",3,flags),/Unknown/);
 assert.throws(()=>contractSkillScore("TerrifyingPact",-1,flags),/Invalid/);
 assert.throws(()=>resolveContractScenario({ForbiddenContract:99},flags),/Invalid/);
 assert.throws(()=>resolveContractScenario(levels,{...flags,goldWeight:Infinity}),/weight/);
});

test("optimizer forces exactly the two prerequisite contracts only on explicit opt-in",()=>{
 const withContracts=optimizeBuild(settings("Pet","Fairy",true));
 const contract=withContracts.contractScenario;
 assert.ok(withContracts.levels.ForbiddenContract>=1);
 assert.ok(withContracts.levels.RoyalContract>=1);
 assert.equal(contract.assumptions.maximumRampReached,true);
 assert.equal(contract.assumptions.manaSustainable,false);
 assert.equal(contract.appliedInsideSkills,true);
 assert.equal(contract.addToAccountBaseline,false);
 assert.ok(Number.isFinite(contract.weightedLog10));
 const without=optimizeBuild(settings("Pet","Fairy",false));
 assert.equal(without.contractScenario.weightedLog10,0);
 assert.equal(without.contractScenario.appliedInsideSkills,false);
});
