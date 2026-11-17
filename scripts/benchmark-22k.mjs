#!/usr/bin/env node
/**
 * Reproducible TT2 skill optimizer benchmark and 18-build audit.
 *
 * --all             all six Damage × all three Gold sources (not a sample)
 * --profile PATH    optional LOCAL, sanitized full TT2 JSON export; the
 *                   contents are never printed or transmitted
 * --sp N            explicit SP budget, default 22,500
 *
 * Test results are modeled scores, NOT projected stages.
 * This does not automatically choose a globally strongest damage build:
 * different build types still require sourced cross-build calibration.
 */
import {performance} from "node:perf_hooks";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {optimizeBuild,spentPoints,parseExport,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {gearSelectionEffects} from "../src/equipment-scenarios.js";
import {recommendPets} from "../src/pet-scenarios.js";
import {calculateModeledScenario} from "../src/calculation-ledger.js";

const args=process.argv.slice(2);
const option=(flag)=>{const i=args.indexOf(flag);return i>=0?args[i+1]:undefined};
const all=args.includes("--all");
const profilePath=option("--profile");
const positional=args.find(value=>/^\d+$/.test(value));
const sp=Number(option("--sp")??positional??22500);
const compare=all?DAMAGE_TYPES.flatMap(damage=>GOLD_TYPES.map(gold=>({damage,gold})))
 :[{damage:"Clan Ship",gold:"Fairy"}];
let localExport=null;
if(profilePath){
 try{localExport=parseExport(readFileSync(profilePath,"utf8"))}
 catch(error){
  console.error("Cannot parse the local export: "+error.message);
  process.exit(2);
 }
}
if(!Number.isSafeInteger(sp)||sp<0||sp>50000){
 console.error("Usage: node scripts/benchmark-22k.mjs [SP=22500] [--all] [--profile path-to-local-tt2-export.json] [--sp N]");
 process.exit(2);
}
let failed=0;
for(const {damage,gold} of compare){
 const initial={skillPoints:sp,damage,gold,goldWeight:.7,
  qol:"none",sets:localExport?.sets||{},currentLevels:localExport?.levels||{},
  minimums:{},maxStage:localExport?.maxStage||0,
  craftingPower:localExport?.craftingPower||1,timeToKill:8,sClone:30,
  accountProfile:localExport?.profile||null};
 const gear=gearSelectionEffects(initial.accountProfile,initial);
 const gearContext={...initial,equipmentPetSlotWeights:gear.petEquipmentSlotWeights,
  equipmentPetPassiveWeights:gear.petEquipmentPassiveWeights,
  equipmentPetCoverageComplete:gear.petEquipmentCoverageComplete};
 const selectedDamagePet=recommendPets(gearContext.accountProfile,gearContext,"damage",1)[0]?.id||null;
 const selectedGoldPet=recommendPets(gearContext.accountProfile,gearContext,"gold",1)[0]?.id||null;
 const input={...gearContext,selectedDamagePet,selectedGoldPet};
 const start=performance.now();
 const progress=[];
 try{
  const result=optimizeBuild(input,event=>progress.push(event.phase));
  const modeled=calculateModeledScenario(result,input,gear);
  const elapsedMs=performance.now()-start;
  assert.equal(result.spent,spentPoints(result.levels));
  assert.ok(result.spent<=sp);
  assert.ok(Number.isFinite(result.score));
  assert.ok(Number.isFinite(modeled.totalLog10));
  assert.ok(result.optimality.upperBound+1e-8>=result.score);
  if(damage==="Pet"&&gold==="Fairy"&&sp>=20000)
   assert.ok(result.spent>=sp*.95,`Pet/Fairy spent only ${result.spent} / ${sp} SP`);
  console.log(JSON.stringify({damage,gold,SP:sp,spent:result.spent,
   elapsedMs:Math.round(elapsedMs),approximate:result.optimality.mode!=="exact",
   scoreGap:result.optimality.gap,scoreLedger:modeled,
   unresolvedEffects:result.accountIntegration.unmodeledEffects,
   importedAccount:Boolean(localExport),progressEvents:progress.length,
   memoryHeapUsedMiB:Math.round(process.memoryUsage().heapUsed/1048576)}));
 }catch(error){
  failed++;
  console.error(JSON.stringify({damage,gold,error:error.message}));
 }
}
console.log(JSON.stringify({buildsChecked:compare.length,failed,
 success:failed===0,accountImported:Boolean(localExport),
 disclaimer:"Modeled score only; in-game stage progression not measured."}));
if(failed)process.exitCode=1;
