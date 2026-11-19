import {test} from "node:test";
import assert from "node:assert/strict";
import {simulateContractTimeline} from "../src/contract-timeline.js";
import {skillInfo} from "../vendor/skills.js";
import {resolveManaEvidence} from "../src/mana-evidence.js";
import {resolveContractScenario} from "../src/contract-scenarios.js";
import {scoreAtLevel} from "../src/effects.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild} from "../src/engine.js";
const levels={ForbiddenContract:10,RoyalContract:10,TerrifyingPact:15};
const options={enabled:true,startingMana:100,manaCapacity:100,
 passiveRegenPerSecond:0,freeTicks:{ForbiddenContract:0,RoyalContract:0},
 durationSeconds:5};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),
 a+" vs "+b);

test("missing inputs, especially free ticks, stay unknown rather than defaulting to zero",()=>{
 assert.equal(simulateContractTimeline(levels).status,"not-requested");
 const missing=simulateContractTimeline(levels,{...options,freeTicks:{}});
 assert.equal(missing.status,"missing-or-invalid-inputs");
 assert.ok(missing.reasons.includes("free-ticks-required:ForbiddenContract"));
 assert.ok(missing.reasons.includes("free-ticks-required:RoyalContract"));
 const missingMana=simulateContractTimeline(levels,{...options,startingMana:""});
 assert.ok(missingMana.reasons.includes("starting-mana-required"));
 const unsafe=simulateContractTimeline(levels,{...options,durationSeconds:4000});
 assert.ok(unsafe.reasons.includes("duration-must-be-integer-1-to-3600"));
});

test("source 1Hz charges are triangular, ramp reaches max and Pact remains separate",()=>{
 const x=simulateContractTimeline(levels,options);
 assert.equal(x.status,"simulated");
 assert.equal(x.fundedTicks,5);
 const b=Number(skillInfo.ForbiddenContract.B10)+Number(skillInfo.RoyalContract.B10);
 near(x.totalContractManaCharged,b*15);
 near(x.samples[0].manaCharged,b);
 near(x.samples[1].manaCharged,2*b);
 near(x.samples[2].manaCharged,3*b);
 near(x.samples[0].sourceForbiddenDamageLog10,
  Math.log10(Number(skillInfo.ForbiddenContract.A10)));
 near(x.samples[0].sourceRoyalGoldLog10,
  Math.log10(Number(skillInfo.RoyalContract.A10)));
 near(x.samples[0].pactFullGoldLog10,
  Math.log10(Number(skillInfo.TerrifyingPact.A15)));
 near(x.samples[0].pactFullDamageLog10,
  Math.log10(Number(skillInfo.TerrifyingPact.B15)));
 assert.equal(x.lastFundedTick.pactInstantaneousApplicationUnverified,true);
 assert.equal(x.addedToScore,false);
 assert.equal(x.actualUptimeVerified,false);
});

test("known free ticks preserve ramp but do not charge early ticks",()=>{
 const x=simulateContractTimeline(levels,{...options,
  freeTicks:{ForbiddenContract:3,RoyalContract:2}});
 assert.equal(x.samples[0].manaCharged,0);
 assert.equal(x.samples[1].manaCharged,0);
 near(x.samples[2].manaCharged,Number(skillInfo.RoyalContract.B10));
 const fifth=x.samples.find(row=>row.second===4);
 near(fifth.manaCharged,
  2*Number(skillInfo.ForbiddenContract.B10)+
   3*Number(skillInfo.RoyalContract.B10));
 const y=simulateContractTimeline(levels,{...options,
  freeTicks:{ForbiddenContract:5,RoyalContract:5}});
 assert.equal(y.totalContractManaCharged,0);
 assert.equal(y.fundedTicks,5);
});

test("both contracts draw from the same pool and shared payment never invents priority",()=>{
 const b=Number(skillInfo.ForbiddenContract.B10)+Number(skillInfo.RoyalContract.B10);
 const x=simulateContractTimeline(levels,{...options,startingMana:b*3,manaCapacity:b*3});
 assert.equal(x.fundedTicks,2);
 assert.equal(x.firstUnfundedSecond,2);
 assert.equal(x.firstFailureReason,"joint-contract-payment-not-affordable");
 assert.equal(x.reachesHorizon,false);
 assert.ok(x.remainingMana>=0);
});
test("passive regen and capacity, known income and spell expenses are explicit",()=>{
 const base=simulateContractTimeline(levels,{...options,startingMana:2,manaCapacity:5,
  passiveRegenPerSecond:5,freeTicks:{ForbiddenContract:0,RoyalContract:0}});
 assert.equal(base.status,"simulated");
 assert.ok(base.samples.every(row=>row.manaAfter<=5));
 const source=simulateContractTimeline(levels,{...options,
  manaEvents:[{second:1,amount:3}],spellCosts:[{second:2,amount:2}]});
 const noSource=simulateContractTimeline(levels,options);
 assert.equal(source.knownManaEventCount,1);
 assert.equal(source.knownSpellCostCount,1);
 assert.ok(source.samples[1].manaAfter>=noSource.samples[1].manaAfter);
 const canNotSpend=simulateContractTimeline(levels,{...options,
  spellCosts:[{second:0,amount:101}]});
 assert.equal(canNotSpend.firstFailureReason,"known-spell-cost-not-affordable");
});

test("level 15 and 22 Pact change source ceilings, not base contract mana",()=>{
 const a=simulateContractTimeline(levels,options);
 const b=simulateContractTimeline({...levels,TerrifyingPact:22},options);
 near(a.totalContractManaCharged,b.totalContractManaCharged);
 assert.equal(a.fundedTicks,b.fundedTicks);
 near(b.lastFundedTick.pactFullGoldLog10-a.lastFundedTick.pactFullGoldLog10,
  Math.log10(Number(skillInfo.TerrifyingPact.A22)/Number(skillInfo.TerrifyingPact.A15)));
 assert.equal(a.conditionalPactFullEffectsNotRampedOrCredited,true);
});

test("extreme scientific bonuses remain finite and no active level is not forced to use free tick inputs",()=>{
 const x=simulateContractTimeline({ForbiddenContract:0,RoyalContract:30,
  TerrifyingPact:30},{...options,freeTicks:{RoyalContract:0}});
 assert.equal(x.status,"simulated");
 assert.ok(Number.isFinite(x.lastFundedTick.sourceRoyalGoldLog10));
 assert.ok(Number.isFinite(x.lastFundedTick.pactFullDamageLog10));
 const inactive=simulateContractTimeline({ForbiddenContract:0,RoyalContract:0,TerrifyingPact:22},
  {...options,freeTicks:{}});
 assert.equal(inactive.status,"no-active-contract-talents");
});
test("explicit what-if is returned through mana evidence, without affecting any of the 18 scoring routes",()=>{
 const contract=resolveContractScenario(levels,{assumeContractsAtMax:false,goldWeight:.7});
 const reference=resolveManaEvidence({},levels,null,contract);
 assert.equal(reference.contractTimeline.status,"not-requested");
 const withTimeline=resolveManaEvidence({contractTimeline:options},levels,null,contract);
 assert.equal(withTimeline.contractTimeline.status,"simulated");
 assert.equal(withTimeline.contractTimeline.addedToScore,false);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const base={damage,gold,goldWeight:.7,skillPoints:100,qol:"none",
   sets:{},currentLevels:{},minimums:{},maxStage:30000,craftingPower:1,
   timeToKill:8,sClone:30};
  const plain=optimizeBuild(base);
  const whatIf=optimizeBuild({...base,contractTimeline:options});
  assert.deepEqual(whatIf.levels,plain.levels,damage+"/"+gold);
  near(whatIf.score,plain.score);
  assert.equal(whatIf.manaEvidence.contractTimeline.addedToScore,false);
  assert.equal(scoreAtLevel("TerrifyingPact",15,{...base,contractTimeline:options}),0);
 }
});
