import test from "node:test";
import assert from "node:assert/strict";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints} from "../src/engine.js";
import {scoreAtLevel} from "../src/effects.js";
import {activationCountInWindow,cooldownFrequencyGainLog10}
 from "../src/flash-zip.js";

const close=(a,b)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<1e-10,`${a} != ${b}`);

test("cooldown B changes theoretical opportunities, never hit damage",()=>{
 assert.equal(activationCountInWindow(0,10,1),1);
 assert.equal(activationCountInWindow(9.95,10,1),1);
 assert.equal(activationCountInWindow(9.95,10,.993),2);
 assert.equal(activationCountInWindow(10,10,1),2);
 close(cooldownFrequencyGainLog10(.993,{
  flashZipBaseCooldownSeconds:10,flashZipWindowSeconds:9.95
 }),Math.log10(2));
 assert.equal(activationCountInWindow(1e308,1e-300,1),null);
 assert.equal(activationCountInWindow(100,1e-320,1e-320),null);
 assert.equal(activationCountInWindow(4,0,1),null);
 assert.equal(cooldownFrequencyGainLog10(1e-320,{
  flashZipWindowSeconds:1e308,flashZipBaseCooldownSeconds:1e-320
 }),0);
});
test("all 18 routes isolate QTE rate from weighted damage/gold score",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={damage,gold,goldWeight:.7,assumeFlashZipAtBoss:true};
  for(const level of [1,5,15]){
   const baseline=scoreAtLevel("BossDmgQTE",level,settings);
   const hypothetical={...settings,flashZipWindowSeconds:9.95,
    flashZipBaseCooldownSeconds:10,heartOfGoldWindowSeconds:9.95,
    heartOfGoldBaseCooldownSeconds:10};
   close(scoreAtLevel("BossDmgQTE",level,hypothetical),baseline);
   assert.equal(scoreAtLevel("BossDmgQTE",level,{
    ...hypothetical,assumeFlashZipAtBoss:false}),0);
  }
 }
});
test("legal SP allocations remain bounded when cooldown evidence is present",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const result=optimizeBuild({damage,gold,skillPoints:25,maxStage:1000,
   goldWeight:.7,qol:"none",currentLevels:{},minimums:{},
   flashZipWindowSeconds:9.95,flashZipBaseCooldownSeconds:10,
   assumeFlashZipAtBoss:true});
  assert.ok(spentPoints(result.levels)<=25,damage+"/"+gold);
  assert.ok(Number.isFinite(result.score),damage+"/"+gold);
 }
});
