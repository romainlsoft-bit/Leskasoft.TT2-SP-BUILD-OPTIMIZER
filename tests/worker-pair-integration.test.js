import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";

const makeSettings=accountProfile=>({
 accountProfile,damage:"Pet",gold:"Fairy",goldWeight:.7,
 skillPoints:100,qol:"none",sets:{},currentLevels:{},minimums:{},
 maxStage:0,craftingPower:1,timeToKill:8,sClone:30,
 selectedDamagePet:null,selectedGoldPet:null
});
let workerLoads=0;
async function workerHarness(){
 const responses=[];
 globalThis.self={postMessage:r=>responses.push(r),onmessage:null};
 await import("../src/worker.js?worker-pair-test="+(++workerLoads));
 const execute=(type,settings)=>{
  responses.length=0;
  globalThis.self.onmessage({data:{type,settings}});
  const result=responses.findLast(x=>x.ok!==undefined);
  return {responses:[...responses],result};
 };
 return execute;
}
test("worker returns a final skill build scored for the actual selected pet pair",async()=>{
 const execute=await workerHarness();
 const profile=parseAccountProfile({petLevels:{
  Pet1:230,Pet7:230,Pet12:140,Pet20:140
 }});
 const {result,responses}=execute("optimize-pet-scenarios",makeSettings(profile));
 assert.equal(result?.ok,true,result?.error);
 assert.ok(result.petSearch);
 assert.ok(result.petSearch.uniqueEvaluations>0);
 assert.ok(result.petSearch.uniqueEvaluations<=9);
 assert.equal(result.petSearch.exhaustiveWithinShortlist,true);
 assert.equal(typeof result.petSearch.comparisonBounds.certifiedWithinVisited,"boolean");
 assert.ok(Number.isFinite(result.petSearch.comparisonBounds.winningFeasibleScore));
 assert.ok(result.petSearch.comparisonBounds.winningUpperBound>=
  result.petSearch.comparisonBounds.winningFeasibleScore-1e-8);
 assert.equal(result.petSearch.comparisonBounds.noClaimAboutUnexploredConfigurations,true);
 assert.equal(typeof result.petSearch.jointSearch.comparisonBounds.certifiedWithinVisited,"boolean");
 assert.equal(result.petSearch.uniqueEvaluations,
  Math.max(1,result.petSearch.candidateCount.damage)*
  Math.max(1,result.petSearch.candidateCount.gold));
 assert.equal(result.selectedPets.damage,result.result.modeledScenario.selectedDamagePet);
 assert.equal(result.selectedPets.gold,result.result.modeledScenario.selectedGoldPet);
 assert.ok(Math.abs(result.result.modeledScenario.totalLog10-
  (result.result.accountAdjustedScore+
   result.result.modeledScenario.equippedGearLog10+
   result.result.modeledScenario.activePetsAbovePassivesLog10))<1e-8);
 assert.equal(result.result.petSearch.shortlistOnly,false);
 assert.equal(result.result.petSearch.exhaustiveAmongEligiblePetPairs,true);
 assert.ok(responses.some(x=>x.progress?.phase==="pet-scenarios"));
});

test("worker does not automatically invent an equipped item from truncated inventory",async()=>{
 const execute=await workerHarness();
 const gear=[{id:"SwordX",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e100"},
 ...Array.from({length:512},(_,i)=>({
  id:"A"+i,slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e10"
 }))];
 const profile=parseAccountProfile({equipmentInventory:gear});
 assert.equal(profile.sections.equipmentInventory.truncated,true);
 const {result}=execute("optimize",makeSettings(profile));
 assert.equal(result?.ok,true,result?.error);
 assert.equal(result.result.modeledScenario.equippedGearLog10,0);
 assert.equal(result.result.modeledScenario.coverage.inventoryTruncated,true);
 assert.equal(result.result.modeledScenario.selectedGearCount,0);
});

test("S: six owned pets trigger nine genuine gear/SP pair evaluations",async()=>{
 const execute=await workerHarness();
 const profile=parseAccountProfile({petLevels:{Pet1:130,Pet7:120,Pet13:110,Pet6:125,Pet12:115,Pet20:140},equipmentInventory:[
 {id:"SwordAll",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e90"},
 {id:"SwordTap",slot:"Sword",bonusType:"TapDamage",bonusAmount:"1e130"},
 {id:"ArmorAll",slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e60"},
 {id:"ArmorFairy",slot:"Armor",bonusType:"FairyGold",bonusAmount:"1e80"}]});
 const {result,responses}=execute("optimize-pet-scenarios",makeSettings(profile));
 assert.equal(result?.ok,true,result?.error);
 assert.deepEqual(result.petSearch.candidateCount,{damage:3,gold:3});
 assert.equal(result.petSearch.uniqueEvaluations,9);
 const updates=responses.filter(x=>x.progress?.phase==="pet-scenarios");
 assert.deepEqual(updates.map(x=>x.progress.completed),[1,2,3,4,5,6,7,8,9]);
 assert.ok(updates.every(x=>x.progress.total===9));
 assert.equal(result.selectedPets.damage,result.result.modeledScenario.selectedDamagePet);
 assert.equal(result.selectedPets.gold,result.result.modeledScenario.selectedGoldPet);
 assert.ok(Number.isFinite(result.result.modeledScenario.totalLog10));
 assert.ok(result.result.spent<=100);
 assert.equal(result.result.modeledScenario.coverage.realStagePredictionValidated,false);
});

test("U: worker fully searches a 4x3 eligible owned pet roster, not 3x3",async()=>{
 const execute=await workerHarness();
 const profile=parseAccountProfile({petLevels:{
  Pet1:120,Pet7:100,Pet13:130,Pet14:150,
  Pet6:120,Pet12:120,Pet20:120}});
 const settings={...makeSettings(profile),skillPoints:90};
 const {result,responses}=execute("optimize-pet-scenarios",settings);
 assert.equal(result?.ok,true,result?.error);
 assert.deepEqual(result.petSearch.eligibleCount,{damage:4,gold:3});
 assert.deepEqual(result.petSearch.candidateCount,{damage:4,gold:3});
 assert.equal(result.petSearch.uniqueEvaluations,12);
 assert.equal(result.petSearch.shortlistOnly,false);
 assert.equal(result.petSearch.exhaustiveAmongEligiblePetPairs,true);
 assert.equal(result.petSearch.completeOwnedPetAndGearCartesian,false);
 assert.equal(result.petSearch.globallyOptimalAcrossPetGearSP,false);
 assert.equal(responses.filter(x=>x.progress?.phase==="pet-scenarios").length,12);
 assert.equal(result.selectedPets.damage,result.result.modeledScenario.selectedDamagePet);
 assert.equal(result.selectedPets.gold,result.result.modeledScenario.selectedGoldPet);
});
test("U: worker reruns real SP for every owned gear choice when pet×gear space is small",async()=>{
 const execute=await workerHarness();
 const p=parseAccountProfile({petLevels:{
  Pet1:150,Pet7:150,Pet6:140,Pet12:150},
  equipmentInventory:[
   {id:"SwordAll",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e40"},
   {id:"SwordPet",slot:"Sword",bonusType:"TapDamage",bonusAmount:"1e70"},
   {id:"ArmorAll",slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e40"},
   {id:"ArmorFairy",slot:"Armor",bonusType:"FairyGold",bonusAmount:"1e50"}
  ]});
 const {result}=execute("optimize-pet-scenarios",{
  ...makeSettings(p),skillPoints:120});
 assert.equal(result?.ok,true,result?.error);
 assert.deepEqual(result.petSearch.candidateCount,{damage:2,gold:2});
 assert.equal(result.petSearch.uniqueEvaluations,4);
 assert.equal(result.petSearch.fullOwnedGearCartesianPerPair,true);
 assert.equal(result.petSearch.completeOwnedPetAndGearCartesian,true);
 assert.equal(result.petSearch.jointSearch.evaluations,4);
 assert.equal(result.petSearch.jointSearch.exhaustiveOwnedGearPerPetPair,true);
 assert.ok(result.result.spent<=120);
 assert.equal(result.result.modeledScenario.coverage.realStagePredictionValidated,false);
});

test("review P2: explicit owned pet choices remain hard constraints during comparison",async()=>{
 const execute=await workerHarness();
 const profile=parseAccountProfile({petLevels:{
  Pet1:120,Pet7:120,Pet6:120
 }});
 const input={...makeSettings(profile),skillPoints:60,
  selectedDamagePet:"Pet7",selectedGoldPet:"Pet6"};
 const {result}=execute("optimize-pet-scenarios",input);
 assert.equal(result?.ok,true,result?.error);
 assert.deepEqual(result.selectedPets,{damage:"Pet7",gold:"Pet6"});
 assert.deepEqual(result.petSearch.manualSlots,{damage:true,gold:true});
 assert.equal(result.petSearch.uniqueEvaluations,1);
 assert.equal(result.result.modeledScenario.selectedDamagePet,"Pet7");
 assert.equal(result.result.modeledScenario.selectedGoldPet,"Pet6");
});
test("review P2: automatic gold pet search does not alter fixed damage pet",async()=>{
 const execute=await workerHarness();
 const profile=parseAccountProfile({petLevels:{
  Pet1:120,Pet7:120,Pet6:120,Pet12:120
 }});
 const {result}=execute("optimize-pet-scenarios",{
  ...makeSettings(profile),skillPoints:60,selectedDamagePet:"Pet7"});
 assert.equal(result?.ok,true,result?.error);
 assert.equal(result.selectedPets.damage,"Pet7");
 assert.equal(result.petSearch.manualSlots.damage,true);
 assert.equal(result.petSearch.manualSlots.gold,false);
 assert.equal(result.petSearch.candidateCount.damage,1);
});

test("worker: missing scenario weight preserves default allocation without guessing a probability",async()=>{
 const execute=await workerHarness();
 const profile=parseAccountProfile({equipmentSets:[]});
 const base={...makeSettings(profile),skillPoints:100};
 const reference=execute("optimize",base);
 const attempt=execute("optimize",{...base,
  contractTimeline:{enabled:true,startingMana:100,manaCapacity:100,
   passiveRegenPerSecond:0,durationSeconds:10,
   freeTicks:{ForbiddenContract:0,RoyalContract:0}},
  contractMultiScenario:{enabled:true,activeFraction:"",
   pactAtMaxDuringFundedTicks:true}});
 assert.equal(reference.result?.ok,true,reference.result?.error);
 assert.equal(attempt.result?.ok,true,attempt.result?.error);
 assert.deepEqual(attempt.result.result.levels,reference.result.result.levels);
 assert.equal(attempt.result.result.contractMultiScenario.status,"unresolved");
 assert.equal(attempt.result.result.contractMultiScenario.appliedToRecommendation,false);
});
test("worker: explicit timed scenario integrates through the final modeled ledger",async()=>{
 const execute=await workerHarness();
 const profile=parseAccountProfile({equipmentSets:[]});
 const settings={...makeSettings(profile),skillPoints:750,maxStage:15000,
  contractTimeline:{enabled:true,startingMana:200,manaCapacity:200,
   passiveRegenPerSecond:1,durationSeconds:10,
   freeTicks:{ForbiddenContract:0,RoyalContract:0}},
  contractMultiScenario:{enabled:true,activeFraction:1,
   pactAtMaxDuringFundedTicks:true}};
 const {result}=execute("optimize",settings);
 assert.equal(result?.ok,true,result?.error);
 const selection=result.result.contractMultiScenario;
 assert.ok(["ranked","only-conservative-feasible"].includes(selection.status),
  selection.status+": "+selection.reason);
 assert.ok(result.result.spent<=settings.skillPoints);
 assert.equal(selection.globallyOptimal,false);
 assert.equal(selection.predictsStages,false);
 const total=result.result.modeledScenario.totalLog10;
 const expected=result.result.accountAdjustedScore+
  result.result.modeledScenario.equippedGearLog10+
  result.result.modeledScenario.activePetsAbovePassivesLog10;
 assert.ok(Math.abs(total-expected)<1e-7*Math.max(1,Math.abs(total)));
 assert.equal(result.result.contractScenario.weightedLog10,0);
});

test("worker: conflicting maximum mode does not alter original maximum-score ledger",async()=>{
 const execute=await workerHarness();
 const profile=parseAccountProfile({equipmentSets:[]});
 const base={...makeSettings(profile),skillPoints:400,maxStage:15000,
  assumeContractsAtMax:true};
 const reference=execute("optimize",base);
 const timeline={enabled:true,startingMana:100,manaCapacity:100,
  passiveRegenPerSecond:0,durationSeconds:5,
  freeTicks:{ForbiddenContract:0,RoyalContract:0}};
 const conflict=execute("optimize",{...base,contractTimeline:timeline,
  contractMultiScenario:{enabled:true,activeFraction:1,
   pactAtMaxDuringFundedTicks:true}});
 assert.equal(reference.result?.ok,true,reference.result?.error);
 assert.equal(conflict.result?.ok,true,conflict.result?.error);
 assert.equal(conflict.result.result.contractMultiScenario.status,"unresolved");
 assert.equal(conflict.result.result.contractMultiScenario.reason,
  "cannot-combine-with-maximum-contract-scoring");
 assert.deepEqual(conflict.result.result.levels,reference.result.result.levels);
 assert.equal(conflict.result.result.score,reference.result.result.score);
 assert.equal(conflict.result.result.modeledScenario.totalLog10,
  reference.result.result.modeledScenario.totalLog10);
});
