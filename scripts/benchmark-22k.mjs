#!/usr/bin/env node
// Manual reproducible 22.5k SP benchmark. Do not put large examples in the
// short unit-test suite or collect/store real player exports.
import {performance} from "node:perf_hooks";
import assert from "node:assert/strict";
import {optimizeBuild,spentPoints} from "../src/engine.js";

const sp=Number(process.argv[2]||22500);
if(!Number.isInteger(sp)||sp<0||sp>50000){
 console.error("Usage: node scripts/benchmark-22k.mjs [SP=22500] [--all]");
 process.exitCode=2;
}else{
 const cases=[{damage:"Clan Ship",gold:"Fairy",qol:"recommended"}];
 if(process.argv.includes("--all"))cases.push({damage:"Shadow Clone",gold:"Fairy",qol:"none"},{damage:"Pet",gold:"Fairy",qol:"none",mode:"efficiency"});
 for(const test of cases){
  const start=performance.now();
  const progress=[];
  try {
   const result=optimizeBuild({
    skillPoints:sp,damage:test.damage,gold:test.gold,qol:test.qol,
    goldWeight:0.7,mode:test.mode||"power",sets:{},currentLevels:{},minimums:{},
    maxStage:0,craftingPower:1,timeToKill:8,sClone:30
   },event=>progress.push(event.phase+":"+event.completed+"/"+event.total));
   const elapsedMs=performance.now()-start;
   assert.equal(result.spent,spentPoints(result.levels));
   assert.ok(result.spent<=sp);
   if(test.damage==="Pet" && sp>=20000)
     assert.ok(result.spent>=sp*0.95,`Pet/Fairy spent only ${result.spent} of ${sp} SP`);
   assert.ok(Number.isFinite(result.score));
   assert.ok(result.optimality.upperBound+1e-8>=result.score);
   console.log(JSON.stringify({
    sp,damage:test.damage,gold:test.gold,qol:test.qol,elapsedMs:Math.round(elapsedMs),
    spent:result.spent,remaining:result.remaining,solver:result.solver,
    certifiedModelScoreGap:result.optimality.gap??null,
    approximate:result.optimality.mode!=="exact",
    memoryHeapUsedMiB:Math.round(process.memoryUsage().heapUsed/1024/1024),
    progressPhases:progress.length
   },null,2));
  }catch(error){
   console.error(test.damage+": "+error.message);
   process.exitCode=1;
  }
 }
}
