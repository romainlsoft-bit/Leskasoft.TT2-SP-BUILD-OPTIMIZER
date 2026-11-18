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
