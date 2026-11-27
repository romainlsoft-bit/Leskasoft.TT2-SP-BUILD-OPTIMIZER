import test from "node:test";
import assert from "node:assert/strict";
import {refineGearWithCTSeeds,refineCoupledGearAndSkills} from "../src/joint-candidate-search.js";
const gear=(id,ct)=>({selected:{Sword:{id}},
 gearSearch:{optimizedWithPetCombatTechniquesLevel:ct,exhaustiveWithinOwnedInventory:true},
 petEquipmentSlotWeights:{Sword:id==="A"?1:id==="B"?2:3}});
const dependencies=(calls=[])=>({
 gearFor:s=>gear(s.petCombatTechniquesLevel>=45?"B":"A",s.petCombatTechniquesLevel),
 solve:s=>{
  calls.push(s.equipmentPetSlotWeights.Sword);
  return {levels:{CombatTechniques:s.equipmentPetSlotWeights.Sword===2?50:0},
   score:s.equipmentPetSlotWeights.Sword===2?20:10};
 },
 score:r=>r.score,upperBoundOf:r=>r.score
});
test("high-CT seed discovers a stronger gear/SP equilibrium missed from zero",()=>{
 const baseline=refineCoupledGearAndSkills({},dependencies());
 assert.equal(baseline.best.adjustedScore,10);
 const calls=[],actual=refineGearWithCTSeeds({},dependencies(calls));
 assert.equal(actual.best.adjustedScore,20);
 assert.equal(actual.best.gearSelection.selected.Sword.id,"B");
 assert.equal(actual.search.ctSeedSearch.gain,10);
 assert.equal(actual.search.ctSeedSearch.selectedAlternative,true);
 assert.equal(actual.search.ctSeedSearch.additionalCandidates,1);
 assert.equal(actual.search.ctSeedSearch.distinctSolvedGear,2);
 assert.equal(actual.search.comparisonBounds.certifiedWithinVisited,true);
 assert.equal(actual.search.globallyOptimalAcrossPetGearSP,false);
 assert.equal(calls.length,2);
});
test("seed budget is bounded, omitted candidates remain explicit and prior winner is preserved",()=>{
 const deps={
  gearFor:s=>gear(s.petCombatTechniquesLevel===0?"A":s.petCombatTechniquesLevel===50?"B":"C",s.petCombatTechniquesLevel),
  solve:s=>({levels:{CombatTechniques:s.petCombatTechniquesLevel},score:s.equipmentPetSlotWeights.Sword===1?10:1}),
  score:r=>r.score,upperBoundOf:r=>r.score
 };
 const actual=refineGearWithCTSeeds({}, {...deps,maxAdditionalCandidates:1});
 assert.equal(actual.best.adjustedScore,10);
 assert.equal(actual.search.ctSeedSearch.additionalCandidates,1);
 assert.equal(actual.search.ctSeedSearch.omittedDistinctGear,1);
 assert.equal(actual.search.ctSeedSearch.selectedAlternative,false);
 assert.equal(actual.search.ctSeedSearch.globallyExact,false);
});
test("imported CT is probed first and repeated gear selections are skipped",()=>{
 const calls=[],deps=dependencies(calls);
 const actual=refineGearWithCTSeeds({currentLevels:{CombatTechniques:47}},deps);
 assert.equal(actual.search.ctSeedSearch.probes[0].initialCT,47);
 assert.equal(actual.search.ctSeedSearch.probes[0].status,"evaluated");
 assert.ok(actual.search.ctSeedSearch.probes.slice(1).every(p=>p.status==="already-solved-gear"));
 assert.ok(calls.length<=3);
 assert.throws(()=>refineGearWithCTSeeds({}, {...deps,maxAdditionalCandidates:4}),/0–3/);
});
test("a single gear signature triggers no extra skill solves",()=>{
 const calls=[];
 const actual=refineGearWithCTSeeds({}, {
  gearFor:s=>gear("A",s.petCombatTechniquesLevel),
  solve:s=>{calls.push(s);return {levels:{CombatTechniques:0},score:1};},
  score:r=>r.score,upperBoundOf:r=>r.score
 });
 assert.equal(calls.length,1);
 assert.equal(actual.search.ctSeedSearch.additionalCandidates,0);
 assert.equal(actual.search.ctSeedSearch.omittedDistinctGear,0);
});
