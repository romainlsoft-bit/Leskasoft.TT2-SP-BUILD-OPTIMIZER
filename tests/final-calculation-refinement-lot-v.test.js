import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {equipmentEffectReduction} from "../src/equipment-reductions.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {petWeight,petSlotScore,petScenarioScore,petSearchPlan,
 recommendPets,ALL_PETS,petCandidateEnvelope} from "../src/pet-scenarios.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {gearSelectionEffects} from "../src/equipment-scenarios.js";
import {calculateModeledScenario} from "../src/calculation-ledger.js";
import {selectPetPair} from "../src/pet-pair-search.js";
import {refineCoupledGearAndSkills,enumerateJointGearAndSkills}
 from "../src/joint-candidate-search.js";
import {modeledCandidateUpperBound,rankVisitedCandidateBounds}
 from "../src/model-score-bounds.js";
import {scoreAtLevel} from "../src/effects.js";
import {refineBranchCapacities,optimizeExact} from "../src/solver-core.js";
import {skillInfo} from "../vendor/skills.js";
const near=(a,b,tolerance=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<=tolerance,`${a} vs ${b}`);
const cfg=(p,extra={})=>({
 damage:"Heavenly Strike",gold:"Fairy",goldWeight:.7,
 skillPoints:0,qol:"none",sets:{},currentLevels:{},minimums:{},
 maxStage:0,craftingPower:1,timeToKill:8,sClone:30,
 accountProfile:p,...extra
});
test("V: HS can choose owned Soot and seasonal Lemon as ACTIVE CritDamage pets",()=>{
 const p=parseAccountProfile({petLevels:{
  Pet17:75,SeasonalPet8:75,Pet1:150,Pet6:150
 }});
 const hs=cfg(p),pet=cfg(p,{damage:"Pet"});
 assert.equal(equipmentEffectReduction("CritDamage",hs).weight,1);
 assert.equal(petWeight(ALL_PETS.Pet17,"damage",hs),1);
 assert.equal(petWeight(ALL_PETS.SeasonalPet8,"damage",hs),1);
 assert.equal(petWeight(ALL_PETS.Pet17,"damage",pet),0);
 assert.equal(petWeight(ALL_PETS.SeasonalPet8,"damage",pet),0);
 for(const id of ["Pet17","SeasonalPet8"]){
  assert.ok(petSlotScore(hs,id,"damage",0)>0,id);
  assert.equal(petSlotScore(pet,id,"damage",0),0);
 }
 const eligible=recommendPets(p,hs,"damage",45);
 assert.ok(eligible.some(x=>x.id==="Pet17"));
 assert.ok(eligible.some(x=>x.id==="SeasonalPet8"));
 const plan=petSearchPlan(p,hs);
 assert.equal(plan.exhaustiveEligible,true);
 assert.ok(plan.damage.some(x=>x.id==="SeasonalPet8"));
 assert.ok(!petSearchPlan(p,pet).damage.some(x=>x.id==="SeasonalPet8"));
});
test("V: active HS crit gain is separated from fixed Soot passive and Retaliator main effect",()=>{
 const p=parseAccountProfile({artifacts:{Artifact59:{level:80,enchanted:false}},
  petLevels:{Pet17:70}});
 const settings=cfg(p), power=extractFixedAccountPower(p);
 assert.ok(power.byType.CritDamage>0);
 const baseline=fixedAccountScore(power,settings);
 const chosen={...settings,selectedDamagePet:"Pet17"};
 const expected=petSlotScore(settings,"Pet17","damage",0);
 assert.ok(expected>0);
 near(petScenarioScore(chosen,0),expected);
 const baseGear=gearSelectionEffects(p,settings);
 const result=optimizeBuild(settings);
 const old=calculateModeledScenario(result,settings,baseGear);
 const next=calculateModeledScenario(result,chosen,baseGear);
 near(next.totalLog10-old.totalLog10,expected);
 near(next.fixedAccountLog10,old.fixedAccountLog10);
 near(next.equippedGearLog10,old.equippedGearLog10);
 near(baseline.damageLog10,result.fixedAccount.damageLog10);
 assert.ok(ARTIFACT_CATALOG.Artifact59);
});
test("V: all 18 score routes only apply ACTIVE CritDamage when a guaranteed hit exists",()=>{
 const profile=parseAccountProfile({petLevels:{Pet17:65}});
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const base=cfg(profile,{damage,gold});
  const active={...base,selectedDamagePet:"Pet17"};
  const gear=gearSelectionEffects(profile,base);
  const result=optimizeBuild(base);
  const left=calculateModeledScenario(result,base,gear);
  const right=calculateModeledScenario(result,active,gear);
  const expected=damage==="Heavenly Strike"?
   petSlotScore(base,"Pet17","damage",0):0;
  near(right.totalLog10-left.totalLog10,expected);
  assert.equal(expected>0,damage==="Heavenly Strike");
 }
});
test("V: all CT rows 0..50 are inspected and score maximum includes every row",()=>{
 const p=parseAccountProfile({petLevels:{Pet26:25,Pet17:60}});
 const settings=cfg(p,{equipmentPetSlotWeights:{Sword:1},
  equipmentPetPassiveWeights:{Sword:1}});
 for(const id of ["Pet17","Pet26"]){
  const e=petCandidateEnvelope(settings,id,"damage");
  assert.equal(e.samples.length,Number(skillInfo.CombatTechniques.MaxLevel)+1);
  assert.deepEqual(e.samples.map(x=>x.combatTechniquesLevel),
   Array.from({length:e.samples.length},(_,i)=>i));
  near(e.estimatedGain,Math.max(...e.samples.map(x=>x.score)));
  assert.equal(e.testedAllSourceCombatTechniquesLevels,true);
  assert.equal(e.screeningOnly,true);
 }
});
test("V: exact modeled candidate upper bound adds only SP solver slack once",()=>{
 const result={score:31,optimality:{mode:"bounded-power",
  lowerBound:31,upperBound:33.75}};
 near(modeledCandidateUpperBound(result,101),103.75);
 near(modeledCandidateUpperBound({score:31,optimality:{
  mode:"exact",upperBound:31}},101),101);
 assert.throws(()=>modeledCandidateUpperBound({score:50,
  optimality:{upperBound:49}},90),/upper bound below/);
 assert.throws(()=>modeledCandidateUpperBound({score:50,
  optimality:{upperBound:Infinity}},90),/Non-finite/);
});
test("V: close winning lower bounds cannot be certified against competitor upper bounds",()=>{
 const a={id:"A",adjustedScore:100,scoreUpperBound:102};
 const b={id:"B",adjustedScore:99,scoreUpperBound:103};
 const report=rankVisitedCandidateBounds([a,b],a);
 assert.equal(report.certifiedWithinVisited,false);
 assert.equal(report.unresolvedCompetitors,1);
 near(report.largestPossibleChallengerGain,3);
 const proven=rankVisitedCandidateBounds([a,{...b,scoreUpperBound:99.9}],a);
 assert.equal(proven.certifiedWithinVisited,true);
 assert.equal(proven.unresolvedCompetitors,0);
 assert.equal(proven.noClaimAboutUnexploredConfigurations,true);
});
test("V: exhaustive pet-pair choice reports bound ambiguity, never a fabricated optimum",()=>{
 const petD=[{id:"D1"},{id:"D2"}],petG=[{id:"G1"},{id:"G2"}];
 const found=selectPetPair(petD,petG,(d,g)=>{
  const win=d==="D1"&&g==="G1";
  return {adjustedScore:win?100:99,scoreUpperBound:win?100:101};
 },{exhaustiveShortlist:true,entireEligibleRoster:true});
 assert.equal(found.exhaustiveAmongEligiblePetPairs,true);
 assert.equal(found.comparisonBounds.compared,4);
 assert.equal(found.comparisonBounds.certifiedWithinVisited,false);
 assert.equal(found.comparisonBounds.unresolvedCompetitors,3);
 assert.equal(found.best.adjustedScore,100);
});
test("V: fully visited pet-pair upper bounds can prove proxy choice even with approximate SP",()=>{
 const d=[{id:"D1"},{id:"D2"}],g=[{id:"G1"},{id:"G2"}];
 const res=selectPetPair(d,g,(x,y)=>({
  adjustedScore:x==="D2"&&y==="G2"?200:150,
  scoreUpperBound:x==="D2"&&y==="G2"?205:180
 }),{exhaustiveShortlist:true,entireEligibleRoster:true});
 assert.equal(res.comparisonBounds.certifiedWithinVisited,true);
 assert.equal(res.comparisonBounds.unresolvedCompetitors,0);
 assert.equal(res.exhaustiveAmongEligiblePetPairs,true);
});
test("V: joint gear/SP candidates expose score dominance without changing best feasible score",()=>{
 const gearFor=s=>({
  selected:{Sword:{id:s.selectedEquipment?.Sword??"S0"}},
  petEquipmentSlotWeights:{Sword:0},petEquipmentPassiveWeights:{}
 });
 const assignments=[{Sword:"S1"},{Sword:"S2"}];
 const out=enumerateJointGearAndSkills({},{
  assignments,gearFor,
  solve:context=>({
   score:context.selectedEquipment?.Sword==="S1"?10:9.5,
   levels:{CombatTechniques:0},
   optimality:{mode:"bounded-power",upperBound:
    context.selectedEquipment?.Sword==="S1"?10.2:11}
  }),
  score:r=>r.score,
  upperBoundOf:modeledCandidateUpperBound
 });
 assert.equal(out.best.gearSelection.selected.Sword.id,"S1");
 assert.equal(out.search.evaluations,2);
 assert.equal(out.search.comparisonBounds.certifiedWithinVisited,false);
 near(out.search.comparisonBounds.largestPossibleChallengerGain,1);
});
test("V: if gear scores have enough margin, both refinement and enumeration certify visited ranking",()=>{
 const gearFor=s=>({selected:{Sword:{id:s.petCombatTechniquesLevel>=10?"S2":"S1"}},
  petEquipmentSlotWeights:{Sword:s.petCombatTechniquesLevel>=10?2:1}});
 const observedCT=[];
 const joint=refineCoupledGearAndSkills({},{
  gearFor,solve:ctx=>{
   observedCT.push(ctx.petCombatTechniquesLevel);
   return {
    score:ctx.equipmentPetSlotWeights.Sword===2?20:10,
    levels:{CombatTechniques:25},
    optimality:{mode:"exact",upperBound:
     ctx.equipmentPetSlotWeights.Sword===2?20:10}
   };
  },score:r=>r.score,upperBoundOf:modeledCandidateUpperBound
 });
 assert.deepEqual(observedCT,[0,25],"solver sees the gear-screening CT source level");
 assert.equal(joint.best.adjustedScore,20);
 assert.equal(joint.search.comparisonBounds.certifiedWithinVisited,true);
 assert.equal(joint.search.converged,true);
});
test("V: Lightning Strike has 8.4 source probabilities below saturation at every talent level",()=>{
 const row=skillInfo.CritSkillBoost;
 for(let n=1;n<=Number(row.MaxLevel);n++){
  const a=Number(row["A"+n]),b=Number(row["B"+n]);
  assert.ok(a>0&&a<1,`A${n}`);
  assert.ok(b>0&&b<1,`B${n}`);
  assert.ok(Number.isFinite(scoreAtLevel("CritSkillBoost",n,
   {damage:"Pet",gold:"Fairy",goldWeight:.7,timeToKill:8,
    craftingPower:1,sets:{}})));
 }
});

test("V: exact integer branch-capacity exchanges improve a grid solution monotonically",()=>{
 const a=Float64Array.from([0,0,1,2,6,7,8]);
 const b=Float64Array.from([0,1,2,2,2,2,2]);
 const refined=refineBranchCapacities([a,b],[3,3],6,[0,0],
  {radius:2,maxPasses:8});
 near(refined.initialScore,4);
 assert.ok(refined.score>=8);
 assert.ok(refined.gain>=4);
 assert.ok(refined.steps>=1);
 assert.equal(refined.totalAllocatedCapacity,6);
 assert.equal(refined.capacities[0]+refined.capacities[1],6);
 near(refined.score,a[refined.capacities[0]]+b[refined.capacities[1]]);
 assert.equal(refined.globallyExact,false);
 assert.deepEqual([3,3],[3,3],"input capacities remain immutable");
});
test("V: local budget refinement honors minima and unused SP independently",()=>{
 const arr=[Float64Array.from([0,2,3,10,11]),
  Float64Array.from([0,1,1,1,1])];
 const refined=refineBranchCapacities(arr,[2,1],5,[1,1],
  {radius:2,maxPasses:8});
 assert.ok(refined.score>=11);
 assert.ok(refined.totalAllocatedCapacity<=5);
 assert.ok(refined.capacities[0]>=1&&refined.capacities[1]>=1);
 assert.throws(()=>refineBranchCapacities(arr,[2,0],5,[1,1]),
  /Invalid initial branch capacity/);
 assert.throws(()=>refineBranchCapacities(arr,[4,4],5,[1,1]),
  /exceed SP budget/);
});
test("V: coarse branch DP is refined without violating its rigorous additive upper bound",()=>{
 const skills=[
  {id:"A",branch:"Red",parent:"None",spReq:0,min:0,max:3,
   costs:[0,1,2,3]},
  {id:"B",branch:"Blue",parent:"None",spReq:0,min:0,max:3,
   costs:[0,1,2,3]}
 ];
 const scores={A:[0,0,2,4],B:[0,2,2.5,3]};
 const get=(skill,level)=>scores[skill.id][level];
 const exact=optimizeExact(skills,4,get,"power",undefined,
  {gridThreshold:100});
 const coarse=optimizeExact(skills,4,get,"power",undefined,
  {gridThreshold:1,gridTarget:1});
 assert.equal(exact.optimality.mode,"exact");
 assert.equal(coarse.optimality.mode,"bounded-power");
 near(coarse.score,exact.score);
 assert.ok(coarse.optimality.localRefinement.gain>=0);
 assert.ok(coarse.optimality.initialLowerBound<=coarse.score+1e-10);
 assert.ok(coarse.optimality.upperBound>=coarse.score-1e-10);
 assert.ok(coarse.levels.A+coarse.levels.B<=4);
 assert.ok(coarse.optimality.gap>=0);
});
