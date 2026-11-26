import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {enumerateOwnedGearAssignments} from "../src/equipment-scenarios.js";
import {enumerateJointGearAndSkills} from "../src/joint-candidate-search.js";
import {MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS} from "../src/gear-search-policy.js";

const sourceGear=count=>Array.from({length:count},(_,i)=>({
 id:"Sword"+i,slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e"+(50+i)
}));
const config=profile=>({accountProfile:profile,damage:"Clan Ship",gold:"Fairy",
 goldWeight:.7,skillPoints:0,maxStage:0,qol:"none",sets:{},
 currentLevels:{},minimums:{},selectedDamagePet:null,selectedGoldPet:null
});
test("owned-gear enumeration aligns with joint search for 16, 17, 32 and 33",()=>{
 for(const count of [16,17,32,33]){
  const p=parseAccountProfile({equipmentInventory:sourceGear(count)});
  const candidates=enumerateOwnedGearAssignments(p,config(p),
   MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS);
  assert.equal(candidates.combinations,count);
  assert.equal(candidates.exhaustive,count<=32);
  assert.equal(candidates.assignments.length,count<=32?count:0);
 }
});
test("joint gear + SP evaluator processes 32 real distinct assignments",()=>{
 const assignments=Array.from({length:32},(_,i)=>({Sword:"Sword"+i}));
 let solveCount=0;
 const selection=enumerateJointGearAndSkills({},{
  assignments,
  gearFor:ctx=>({selected:{Sword:{id:ctx.selectedEquipment.Sword}},
   gearSearch:{exhaustiveWithinOwnedInventory:true,
    optimizedWithPetCombatTechniquesLevel:0}}),
  solve:()=>{solveCount++;return {
   levels:{CombatTechniques:0},score:1,optimality:{mode:"exact",upperBound:1}
  }},
  score:(result,ctx)=>Number(ctx.selectedEquipment.Sword.slice(5))+1
 });
 assert.equal(selection.search.assignmentsRequested,32);
 assert.equal(selection.search.evaluations,32);
 assert.ok(solveCount>=32);
 assert.equal(selection.best.context.selectedEquipment.Sword,"Sword31");
 assert.equal(selection.search.globallyOptimalAcrossPetGearSP,false);
 assert.throws(()=>enumerateJointGearAndSkills({},{
  assignments:[...assignments,{Sword:"Sword32"}],gearFor:()=>{},
  solve:()=>{},score:()=>0
 }),/1–32 assignments/);
});
test("public worker returns a build for 17, 32 and 33 eligible equipment setups",async()=>{
 const messages=[];
 globalThis.self={postMessage:msg=>messages.push(msg),onmessage:null};
 await import("../src/worker.js?audit56-gear-boundary=1");
 for(const count of [17,32,33]){
  messages.length=0;
  const profile=parseAccountProfile({equipmentInventory:sourceGear(count)});
  self.onmessage({data:{type:"optimize",settings:config(profile)}});
  const response=messages.findLast(x=>x.ok!==undefined);
  assert.equal(response?.ok,true,"count "+count+": "+response?.error);
  assert.ok(Number.isFinite(response.result?.modeledScenario?.totalLog10));
  if(count<=32){
   assert.equal(response.result.jointSearch.assignmentsRequested,count);
   assert.equal(response.result.jointSearch.method,
    "full-owned-gear-cartesian-with-SP-reoptimization");
  }else{
   assert.equal(response.result.jointSearch.assignmentsRequested,undefined);
   assert.ok(response.result.jointSearch.evaluations>=1);
  }
  assert.ok(response.result.spent<=0);
 }
});
