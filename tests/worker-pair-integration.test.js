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
 assert.equal(result.selectedPets.damage,result.result.modeledScenario.selectedDamagePet);
 assert.equal(result.selectedPets.gold,result.result.modeledScenario.selectedGoldPet);
 assert.ok(Math.abs(result.result.modeledScenario.totalLog10-
  (result.result.accountAdjustedScore+
   result.result.modeledScenario.equippedGearLog10+
   result.result.modeledScenario.activePetsAbovePassivesLog10))<1e-8);
 assert.equal(result.result.petSearch.shortlistOnly,true);
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
