import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
test("normal worker uses bounded CT seeds for a large inventory with equipment pets",async()=>{
 const messages=[];
 globalThis.self={postMessage:r=>messages.push(r),onmessage:null};
 await import("../src/worker.js?ct-seed-integration=1");
 const profile=parseAccountProfile({petLevels:{Pet26:100},equipmentInventory:
  Array.from({length:33},(_,i)=>({id:"Sword"+i,slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e"+(50+i)}))});
 self.onmessage({data:{type:"optimize",settings:{accountProfile:profile,damage:"Pet",gold:"Fairy",goldWeight:.7,
  skillPoints:100,maxStage:15000,qol:"none",sets:{},currentLevels:{},minimums:{},selectedDamagePet:"Pet26"}}});
 const response=messages.findLast(x=>x.ok!==undefined);
 assert.equal(response?.ok,true,response?.error);
 const search=response.result.jointSearch;
 assert.equal(search.method,"bounded-multistart-fixed-CT-gear");
 assert.equal(search.ctSeedSearch.additionalCandidates,0);
 assert.ok(search.evaluations<=3);
 assert.ok(response.result.spent<=100);
 assert.ok(Number.isFinite(response.result.modeledScenario.totalLog10));
 assert.equal(search.globallyOptimalAcrossPetGearSP,false);
});
