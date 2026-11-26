import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {binaryExpectedMultiplierLog10,sourceChanceDelta,
 resolveConditionalProbabilityEvidence} from "../src/conditional-probabilities.js";
import {petSearchPlan} from "../src/pet-scenarios.js";
import {selectPetPair} from "../src/pet-pair-search.js";
import {refineCoupledGearAndSkills,enumerateJointGearAndSkills,gearSignature}
 from "../src/joint-candidate-search.js";
import {gearSelectionEffects,enumerateOwnedGearAssignments,ownedEquipment} from "../src/equipment-scenarios.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {calculateModeledScenario} from "../src/calculation-ledger.js";
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8,`${a} != ${b}`);
const cfg=(profile,extra={})=>({
 accountProfile:profile,damage:"Pet",gold:"Fairy",goldWeight:.7,
 skillPoints:100,qol:"none",sets:{},minimums:{},currentLevels:{},
 maxStage:0,craftingPower:1,timeToKill:8,sClone:30,...extra
});
test("U: 8.4 source B chance differences are sourced for Heavy Strikes / Transmutation / Love Potion",()=>{
 const rows=[["critical","HeavyStrikes"],["jackpot","Transmutation"],
  ["multipleTitan","LovePotion"]];
 for(const [family,id] of rows){
  const x=sourceChanceDelta(family,{[id]:0},{[id]:1});
  assert.equal(x.verifiable,true);
  assert.equal(x.sourceSkill,id);
  assert.ok(x.delta>0);
  const reverse=sourceChanceDelta(family,{[id]:1},{[id]:0});
  near(x.delta+reverse.delta,0);
  assert.equal(sourceChanceDelta(family,{},{[id]:1}).verifiable,false);
 }
 assert.equal(sourceChanceDelta("multipleTitan",{MultiMonsters:0},
  {MultiMonsters:50}).verifiable,false);
});
test("U: observed final chance is a current-tree snapshot, additive projection never scored",()=>{
 const p=parseAccountProfile({playerStats:{
  "Critical Chance":"25%","Jackpot Gold Chance":"30%",
  "Multiple Titan Chance":"15%","Jackpot Gold Multiplier":"1e9999"
 }});
 const settings=cfg(p,{damage:"Pet",currentLevels:{
  HeavyStrikes:1,Transmutation:1,LovePotion:1}});
 const final={HeavyStrikes:2,Transmutation:2,LovePotion:2,PetDmg:50};
 const got=resolveConditionalProbabilityEvidence(p,settings,{},final);
 const source=sourceChanceDelta("jackpot",settings.currentLevels,final);
 near(got.families.jackpot.candidateChanceIfUncapped,.3+source.delta);
 assert.equal(got.families.critical.candidateChanceVerified,false);
 assert.equal(got.families.multipleTitan.candidateChanceVerified,false);
 assert.equal(got.probabilitiesAppliedToScore,false);
 assert.equal(got.jackpotBinaryEvent.exportedMultiplierLog10,9999);
 near(got.jackpotBinaryEvent.observedExpectedMultiplierLog10,9999+Math.log10(.3));
 assert.equal(got.jackpotBinaryEvent.candidateTreeMultiplierKnown,false);
 assert.equal(got.petAttackCadence.tapsPerAttackFromPetEvolution,5);
 assert.equal(got.petAttackCadence.attacksPerSecondVerified,false);
 assert.equal(got.petAttackCadence.petAttackDamagePerHitLog10,null);
});
test("U: stable Bernoulli expected event multiplier at numerical limits",()=>{
 near(binaryExpectedMultiplierLog10(0,9999),0);
 near(binaryExpectedMultiplierLog10(1,9999),9999);
 near(binaryExpectedMultiplierLog10(.2,2),Math.log10(.8+20));
 near(binaryExpectedMultiplierLog10(.01,9999),9997);
 for(const invalid of [[-1,2],[1.001,2],[.5,Infinity],[NaN,10]])
  assert.equal(binaryExpectedMultiplierLog10(...invalid),null);
});
test("U: clamped or unsourced chance cannot become a fixed build coefficient",()=>{
 const p=parseAccountProfile({playerStats:{"Jackpot Gold Chance":"100%"}});
 const settings=cfg(p,{currentLevels:{Transmutation:1}});
 const scenario=resolveConditionalProbabilityEvidence(p,settings,{},{Transmutation:2});
 assert.equal(scenario.families.jackpot.candidateChanceIfUncapped,null);
 assert.equal(scenario.families.jackpot.candidateChanceVerified,false);
 assert.equal(scenario.jackpotBinaryEvent.observedExpectedMultiplierLog10,null);
});
test("U: full owned inventory enumerates all eligible gear combinations when small",()=>{
 const p=parseAccountProfile({equipmentInventory:[
  {id:"S1",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e10"},
  {id:"S2",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e20"},
  {id:"S3",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e30"},
  {id:"A1",slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e10"},
  {id:"A2",slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e20"}
 ]});
 const settings=cfg(p);
 const gear=gearSelectionEffects(p,settings);
 assert.equal(gear.gearSearch.ownedInventoryConfigurations,6);
 assert.equal(gear.gearSearch.examinedConfigurations,6);
 assert.equal(gear.gearSearch.exhaustiveWithinOwnedInventory,true);
 const swords=ownedEquipment(p).filter(x=>x.slot==="Sword");
 const manual=swords.map(sword=>gearSelectionEffects(p,settings,{Sword:sword.uid}));
 assert.ok(manual.every(x=>x.gearSearch.exhaustiveWithinOwnedInventory===true));
 near(gear.independentScore,Math.max(...manual.map(x=>x.independentScore)));
 assert.equal(gear.selected.Sword.name,"S3");
});
test("U: 512-item complete gear search is explicitly bounded, not falsely exhaustive",()=>{
 const rows=[];
 for(const slot of ["Sword","Helmet","Armor","Aura","Slash"]){
  for(let i=0;i<5;i++)rows.push({id:`${slot}${i}`,
   name:slot==="Helmet"?`Elder Snow Cap ${i}`:`${slot} ${i}`,
   slot,bonusType:slot==="Aura"?"SwordBoost":slot==="Armor"?"GoldAll":"AllDamage",
   bonusAmount:"1e5"});
 }
 const p=parseAccountProfile({equipmentInventory:rows});
 const gear=gearSelectionEffects(p,cfg(p));
 assert.equal(gear.gearSearch.ownedInventoryConfigurations,3125);
 assert.equal(gear.gearSearch.exhaustiveWithinOwnedInventory,false);
 assert.equal(gear.gearSearch.shortlisted,true);
 assert.ok(gear.gearSearch.examinedConfigurations<=243);
});
test("U: small 4x3 owned Pet/Fairy roster escapes legacy 3x3 pruning",()=>{
 const p=parseAccountProfile({petLevels:{
  Pet1:120,Pet7:100,Pet13:130,Pet14:150,
  Pet6:120,Pet12:120,Pet20:120}});
 const plan=petSearchPlan(p,cfg(p));
 assert.deepEqual(plan.eligibleCount,{damage:4,gold:3});
 assert.deepEqual(plan.candidateCount,{damage:4,gold:3});
 assert.equal(plan.exhaustiveEligible,true);
 const grid=selectPetPair(plan.damage,plan.gold,(d,g)=>({
  adjustedScore:d==="Pet14"&&g==="Pet20"?100:0
 }),{exhaustiveShortlist:true,maxCandidatesPerSlot:6,entireEligibleRoster:true});
 assert.equal(grid.uniqueEvaluations,12);
 assert.equal(grid.best.adjustedScore,100);
 assert.equal(grid.exhaustiveAmongEligiblePetPairs,true);
 assert.equal(grid.shortlistOnly,false);
});
test("U: large roster retains an explicit budget and omitted-candidates report",()=>{
 const p=parseAccountProfile({petLevels:{
  Pet1:150,Pet2:150,Pet7:150,Pet8:150,Pet13:150,Pet14:150,
  Pet6:150,Pet12:150,Pet20:150}});
 const plan=petSearchPlan(p,cfg(p,{skillPoints:22600}));
 assert.deepEqual(plan.eligibleCount,{damage:6,gold:3});
 assert.ok(plan.candidateCount.damage*plan.candidateCount.gold<=16);
 assert.equal(plan.exhaustiveEligible,false);
 assert.ok(plan.omittedCandidates.damage>0);
 assert.equal(plan.screeningIsCertifiedUpperBound,false);
});
test("U: optimized CT triggers gear re-choice, then re-optimizes SP against new primary",()=>{
 const invocations=[];
 const gearFor=s=>{
  const id=s.petCombatTechniquesLevel>=20?"HigherAtCT40":"AtCT0";
  return {selected:{Sword:{id}},petEquipmentSlotWeights:{
   Sword:id==="HigherAtCT40"?2:1
  },petEquipmentPassiveWeights:{},gearSearch:{exhaustiveWithinOwnedInventory:true}};
 };
 const joint=refineCoupledGearAndSkills({},{
  gearFor,
  solve:context=>{
   invocations.push(context.equipmentPetSlotWeights.Sword);
   return {levels:{CombatTechniques:40},score:context.equipmentPetSlotWeights.Sword===2?9:1};
  },
  score:result=>result.score
 });
 assert.deepEqual(invocations,[1,2]);
 assert.equal(joint.best.adjustedScore,9);
 assert.equal(joint.best.gearSelection.selected.Sword.id,"HigherAtCT40");
 assert.equal(joint.search.evaluations,2);
 assert.equal(joint.search.converged,true);
 assert.equal(joint.search.globallyOptimalAcrossPetGearSP,false);
 assert.equal(joint.search.allExaminedGearSpacesComplete,true);
});
test("U: gear/CT oscillation is detected and best visited score preserved",()=>{
 const gearFor=s=>({selected:{Sword:{id:s.petCombatTechniquesLevel>=20?"B":"A"}},
  petEquipmentSlotWeights:{Sword:s.petCombatTechniquesLevel>=20?2:1}});
 const joint=refineCoupledGearAndSkills({},{
  gearFor,
  solve:ctx=>({levels:{CombatTechniques:ctx.equipmentPetSlotWeights.Sword===1?40:0},
   score:ctx.equipmentPetSlotWeights.Sword===1?11:7}),
  score:r=>r.score
 });
 assert.equal(joint.search.cycleDetected,true);
 assert.equal(joint.search.converged,false);
 assert.equal(joint.best.adjustedScore,11);
 assert.equal(joint.search.evaluations,2);
});
test("U: real worker scoring inputs remain finite on 18 builds with candidate source-proc evidence",()=>{
 const p=parseAccountProfile({playerStats:{
  "Critical Chance":"40%","Jackpot Gold Chance":"25%",
  "Multiple Titan Chance":"10%", "Jackpot Gold Multiplier":"1e9999"
 }});
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings=cfg(p,{skillPoints:200,damage,gold,
    currentLevels:{HeavyStrikes:1,Transmutation:1,LovePotion:1}});
  const result=optimizeBuild(settings);
  const gear=gearSelectionEffects(p,settings);
  const scenario=calculateModeledScenario(result,settings,gear);
  assert.ok(Number.isFinite(scenario.totalLog10));
  assert.equal(scenario.conditionalProcs.probabilitiesAppliedToScore,false);
  assert.equal(scenario.conditionalProcs.families.critical.candidateChanceVerified,false);
  assert.ok(Number.isFinite(scenario.conditionalProcs.jackpotBinaryEvent.observedExpectedMultiplierLog10));
  assert.equal(scenario.coverage.realStagePredictionValidated,false);
 }
});

test("U: full small owned gear Cartesian search reruns the real SP optimizer for every assignment",()=>{
 const p=parseAccountProfile({equipmentInventory:[
  {id:"SwordLow",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e3"},
  {id:"SwordHigh",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e80"},
  {id:"ArmorLow",slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e5"},
  {id:"ArmorHigh",slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e50"}]});
 const settings=cfg(p,{skillPoints:0});
 const owned=enumerateOwnedGearAssignments(p,settings,16);
 assert.equal(owned.exhaustive,true);
 assert.equal(owned.assignments.length,4);
 const solveCalls=[];
 const actual=enumerateJointGearAndSkills(settings,{
  assignments:owned.assignments,
  gearFor:ctx=>gearSelectionEffects(ctx.accountProfile,ctx,
   ctx.selectedEquipment||{}),
  solve:ctx=>{
   solveCalls.push(ctx.equipmentPetSlotWeights);
   return optimizeBuild(ctx);
  },
  score:(result,ctx,gear)=>
   calculateModeledScenario(result,ctx,gear).totalLog10
 });
 assert.equal(actual.search.evaluations,4);
 assert.equal(solveCalls.length,4);
 assert.equal(actual.search.exhaustiveOwnedGearPerPetPair,true);
 assert.equal(actual.best.gearSelection.selected.Sword.name,"SwordHigh");
 assert.equal(actual.best.gearSelection.selected.Armor.name,"ArmorHigh");
 assert.equal(actual.search.globallyOptimalAcrossPetGearSP,false);
});
test("U: truncated/missing inventory never becomes a full Cartesian proof",()=>{
 const no=enumerateOwnedGearAssignments(parseAccountProfile({}),cfg(null));
 assert.equal(no.exhaustive,false);
 assert.equal(no.assignments.length,0);
 const p=parseAccountProfile({equipmentInventory:[
  {id:"S1",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e10"}]});
 const invalid=enumerateOwnedGearAssignments(p,cfg(p,{
  selectedEquipment:{Sword:"Sword:999"}}));
 assert.equal(invalid.exhaustive,false);
 assert.equal(invalid.reason,"explicit-selected-item-not-available");
});
