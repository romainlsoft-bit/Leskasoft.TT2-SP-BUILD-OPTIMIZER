import test from "node:test";
import assert from "node:assert/strict";
import {refineCoupledGearAndSkills,enumerateJointGearAndSkills}
 from "../src/joint-candidate-search.js";
import {modeledCandidateUpperBound} from "../src/model-score-bounds.js";

const gearAtCT=(ctx,id="fixed")=>({
 selected:{Sword:{id}},
 gearSearch:{optimizedWithPetCombatTechniquesLevel:ctx.petCombatTechniquesLevel,
  exhaustiveWithinOwnedInventory:true},
 petEquipmentSlotWeights:{Sword:ctx.petCombatTechniquesLevel},
 petEquipmentPassiveWeights:{},petEquipmentCoverageComplete:true
});
test("W: fixed gear must reoptimize when CT changes its Pet equipment multiplier",()=>{
 const seen=[];
 const joint=refineCoupledGearAndSkills({},{
  gearFor:ctx=>gearAtCT(ctx),
  solve:ctx=>{
   seen.push(ctx.equipmentPetSlotWeights.Sword);
   return {levels:{CombatTechniques:40},score:ctx.equipmentPetSlotWeights.Sword};
  },
  score:r=>r.score
 });
 assert.deepEqual(seen,[0,40]);
 assert.equal(joint.best.adjustedScore,40);
 assert.equal(joint.best.gearSelection.gearSearch.optimizedWithPetCombatTechniquesLevel,40);
 assert.equal(joint.search.converged,true);
 assert.equal(joint.search.cycleDetected,false);
});
test("W: gear signature alone cannot be used as a CT convergence proof",()=>{
 const result=refineCoupledGearAndSkills({},{
  gearFor:ctx=>gearAtCT(ctx),
  solve:ctx=>({levels:{CombatTechniques:ctx.equipmentPetSlotWeights.Sword===0?30:30},
   score:ctx.equipmentPetSlotWeights.Sword}),
  score:r=>r.score
 });
 assert.equal(result.search.evaluations,2);
 assert.equal(result.search.trace[1].ctForGear,30);
 assert.equal(result.best.adjustedScore,30);
});
test("W: complete owned gear enumeration solves each fixed assignment at final CT",()=>{
 const seen=[];
 const joint=enumerateJointGearAndSkills({},{
  assignments:[{Sword:"A"},{Sword:"B"}],
  gearFor:ctx=>gearAtCT(ctx,ctx.selectedEquipment.Sword),
  solve:ctx=>{
   seen.push([ctx.selectedEquipment.Sword,
    ctx.equipmentPetSlotWeights.Sword]);
   return {levels:{CombatTechniques:20},
    score:ctx.equipmentPetSlotWeights.Sword+
     (ctx.selectedEquipment.Sword==="B"?3:0)};
  },
  score:r=>r.score
 });
 assert.deepEqual(seen,[["A",0],["A",20],["B",0],["B",20]]);
 assert.equal(joint.best.adjustedScore,23);
 assert.equal(joint.best.gearSelection.selected.Sword.id,"B");
 assert.equal(joint.search.refinementEvaluations,4);
 assert.equal(joint.search.everyFixedGearCTConverged,true);
 assert.ok(joint.search.trace.every(x=>x.ctConsistent));
});
test("W: non-converged CT feedback must not be certified as converged",()=>{
 const joint=enumerateJointGearAndSkills({},{
  assignments:[{Sword:"A"}],
  gearFor:ctx=>gearAtCT(ctx,ctx.selectedEquipment.Sword),
  solve:ctx=>({levels:{CombatTechniques:
   ctx.equipmentPetSlotWeights.Sword===0?20:0},
   score:ctx.equipmentPetSlotWeights.Sword}),
  score:r=>r.score
 });
 assert.equal(joint.search.everyFixedGearCTConverged,false);
 assert.equal(joint.search.unconvergedAssignments,1);
 assert.equal(joint.search.converged,false);
 assert.equal(joint.search.trace[0].ctConsistent,false);
});
test("W: upper-bound ranking remains stable under large finite log scores",()=>{
 const joint=enumerateJointGearAndSkills({},{
  assignments:[{Sword:"A"},{Sword:"B"}],
  gearFor:ctx=>gearAtCT(ctx,ctx.selectedEquipment.Sword),
  solve:ctx=>({
   levels:{CombatTechniques:0},
   score:ctx.selectedEquipment.Sword==="A"?9999:9990,
   optimality:{upperBound:ctx.selectedEquipment.Sword==="A"?9999:9991}
  }),
  score:r=>r.score,
  upperBoundOf:modeledCandidateUpperBound
 });
 assert.equal(joint.best.adjustedScore,9999);
 assert.equal(joint.search.comparisonBounds.certifiedWithinVisited,true);
});
