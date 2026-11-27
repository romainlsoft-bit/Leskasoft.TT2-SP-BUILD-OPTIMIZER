import test from "node:test";
import assert from "node:assert/strict";
import {poisonSproutEvidence} from "../src/poison-sprout.js";
import {skillInfo} from "../vendor/skills.js";
import {publicOptimizationSettings} from "../src/public-optimization-policy.js";
import {scoreAtLevel} from "../src/effects.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+" vs "+b);
test("one additive poison application uses the native percent fraction",()=>{
 for(let n=0;n<=40;n++){
  const e=poisonSproutEvidence("PoisonedBlade",n,{assumePoisonApplied:true});
  near(e.scoreLog10,Math.log10(1+Number(skillInfo.PoisonedBlade["A"+n])));
  assert.equal(e.modeledStacks,n?1:0);
  assert.equal(e.sourceMaxStacks,10);
  assert.equal(e.actualActivationVerified,false);
  assert.equal(e.addedToFixedAccount,false);
 }
});
test("Sprout maximum source stacks multiply, never turn spawn chance into damage",()=>{
 for(let n=0;n<=30;n++){
  const e=poisonSproutEvidence("KratosSummon",n,{assumeSproutAtMax:true});
  const stacks=Number(skillInfo.KratosSummon["B"+n]);
  near(e.scoreLog10,n?stacks*Math.log10(Number(skillInfo.KratosSummon["A"+n])):0);
  assert.equal(e.modeledStacks,stacks);
  assert.equal(e.spawnChanceAddedToDamage,false);
  assert.equal(e.extraAccountStacksExcluded,true);
 }
});
test("absent assumptions and zero levels cannot award a conditional effect",()=>{
 for(const id of ["PoisonedBlade","KratosSummon"]){
  const max=Number(skillInfo[id].MaxLevel);
  for(let n=0;n<=max;n++)assert.equal(poisonSproutEvidence(id,n,{}).scoreLog10,0);
  assert.throws(()=>poisonSproutEvidence(id,max+1,{}),/Invalid stack talent level/);
 }
});
test("all 18 routes use source-only damage, independent of gold source or gold weight",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s=publicOptimizationSettings({damage,gold,goldWeight:.7});
  for(const id of ["PoisonedBlade","KratosSummon"]){
   near(scoreAtLevel(id,10,s),poisonSproutEvidence(id,10,s).scoreLog10);
   near(scoreAtLevel(id,10,{...s,goldWeight:0}),scoreAtLevel(id,10,s));
  }
 }
});
test("effective public scenarios release protected floors; nonpublic uncertainty retains them",()=>{
 const base={damage:"Pet",gold:"Fairy",goldWeight:.7,skillPoints:500,
  maxStage:180000,qol:"none",sets:{},currentLevels:{PoisonedBlade:1,KratosSummon:1},
  minimums:{PoisonedBlade:1,KratosSummon:1}};
 const off=optimizeBuild(base);
 for(const id of ["PoisonedBlade","KratosSummon"])assert.ok(off.protectedSkills.includes(id));
 const active=optimizeBuild(publicOptimizationSettings(base));
 for(const id of ["PoisonedBlade","KratosSummon"]){
  assert.ok(!active.protectedSkills.includes(id));
  const evidence=active.conditionalSkills.rows.find(r=>r.id===id);
  assert.equal(evidence.appliedToSkillScore,true);
  near(active.modelAttribution.entries.find(r=>r.id===id).scoreLog10,evidence.stackEvidence.scoreLog10);
 }
 assert.equal(active.combatAssumptions.poisonApplications,1);
 assert.equal(active.combatAssumptions.sproutStacks,Number(skillInfo.KratosSummon["B"+active.levels.KratosSummon]));
 assert.equal(active.modelAttribution.additiveReconstructionMatches,true);
 assert.ok(active.spent<=500);
 assert.equal(active.combatAssumptions.actualBossUptimeVerified,false);
});
