import test from "node:test";
import assert from "node:assert/strict";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {scoreAtLevel} from "../src/effects.js";
import {skillInfo} from "../vendor/skills.js";
import {probabilityCouplingSkillScore} from "../src/probability-coupling.js";
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+" vs "+b);
test("coupled source gains are additive score terms, not post-solve account bonuses",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const cfg={damage,gold,goldWeight:.7,skillPoints:1000,maxStage:180000,qol:"none",
   currentLevels:{},sets:{},minimums:{HeavyStrikes:1,Transmutation:1,MultiMonsters:1,LovePotion:1,LoadedDice:1},
   assumeHaystActive:true};
  const result=optimizeBuild(cfg);
  const e=result.probabilityCoupling;
  const love=probabilityCouplingSkillScore("LovePotion",result.levels.LovePotion,cfg);
  const dice=probabilityCouplingSkillScore("LoadedDice",result.levels.LoadedDice,cfg);
  const reverse=["HeavyStrikes","Transmutation","MultiMonsters"].reduce((sum,id)=>
   sum+probabilityCouplingSkillScore(id,result.levels[id],cfg),0);
  near(e.creditedIncrementLog10,love+dice+reverse);
  const l=result.modelAttribution.entries.find(r=>r.id==="LovePotion");
  const d=result.modelAttribution.entries.find(r=>r.id==="LoadedDice");
  near(l.scoreLog10,love);
  near(d.scoreLog10,dice+.7*Math.log10(Number(skillInfo.LoadedDice["B"+result.levels.LoadedDice])));
  assert.ok(result.modelAttribution.additiveReconstructionMatches);
  assert.ok(result.spent<=1000);
  assert.equal(e.residualAddedToScore,false);
  assert.equal(e.globallyExactJointModel,false);
  const joint=result.probabilityJointAlternative;
  assert.ok(joint);
  assert.equal(joint.appliedToRecommendation,false);
  if(joint.status==="improved"){
   assert.ok(joint.gainLog10>0);
   near(joint.originalAdditiveLog10,result.score);
   near(joint.originalResidualLog10,e.residualUnscoredLog10);
   near(joint.gainLog10,joint.alternativeAdditiveLog10+joint.alternativeResidualLog10-
    joint.originalAdditiveLog10-joint.originalResidualLog10);
   const full=probabilityCouplingEvidence(joint.levels,cfg);
   near(full.residualUnscoredLog10,joint.alternativeResidualLog10);
   assert.ok(joint.spent<=1000);
  }
 }
});
