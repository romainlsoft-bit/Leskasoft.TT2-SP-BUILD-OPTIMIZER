#!/usr/bin/env node
/**
 * Reproducible TT2 skill optimizer benchmark and 18-build audit.
 *
 * --all             all six Damage × all three Gold sources (not a sample)
 * --profile PATH    optional LOCAL, sanitized full TT2 JSON export; the
 *                   contents are never printed or transmitted
 * --sp N            explicit SP budget, default 22,500
 * --pair-search     exhaustively evaluate shortlisted pairs; costly
 *
 * Test results are modeled scores, NOT projected stages.
 * This does not automatically choose a globally strongest damage build:
 * different build types still require sourced cross-build calibration.
 */
import {performance} from "node:perf_hooks";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {optimizeBuild,spentPoints,parseExport,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {gearSelectionEffects,petCandidateGearWeightEnvelope} from "../src/equipment-scenarios.js";
import {recommendPets} from "../src/pet-scenarios.js";
import {calculateModeledScenario} from "../src/calculation-ledger.js";
import {selectPetPair} from "../src/pet-pair-search.js";

const args=process.argv.slice(2);
const option=(flag)=>{const i=args.indexOf(flag);return i>=0?args[i+1]:undefined};
const all=args.includes("--all");
const pairSearch=args.includes("--pair-search");
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
 console.error("Usage: node scripts/benchmark-22k.mjs [SP=22500] [--all] [--profile local-export.json] [--sp N] [--pair-search]");
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
 const envelope=petCandidateGearWeightEnvelope(initial.accountProfile,initial);
 const screeningContext={...gearContext,
  equipmentPetSlotWeights:envelope.slotWeights,
  equipmentPetPassiveWeights:envelope.passiveWeights};
 const damageCandidates=recommendPets(screeningContext.accountProfile,screeningContext,
  "damage",pairSearch?3:1);
 const goldCandidates=recommendPets(screeningContext.accountProfile,screeningContext,
  "gold",pairSearch?3:1);
 const start=performance.now();
 const progress=[];
 try{
  const evaluate=(damagePet,goldPet)=>{
   const input={...initial,selectedDamagePet:damagePet,selectedGoldPet:goldPet};
   const selectedGear=gearSelectionEffects(input.accountProfile,input);
   const pairContext={...input,
    equipmentPetSlotWeights:selectedGear.petEquipmentSlotWeights,
    equipmentPetPassiveWeights:selectedGear.petEquipmentPassiveWeights,
    equipmentPetCoverageComplete:selectedGear.petEquipmentCoverageComplete};
   const result=optimizeBuild(pairContext,event=>progress.push(event.phase));
   const modeled=calculateModeledScenario(result,pairContext,selectedGear);
   return {result,modeled,gearSelection:selectedGear,
    adjustedScore:modeled.totalLog10};
  };
  const selection=pairSearch&&(damageCandidates.length||goldCandidates.length)?
   selectPetPair(damageCandidates,goldCandidates,evaluate,{maxPasses:3,exhaustiveShortlist:true}):null;
  const evaluated=selection?.best||evaluate(
   damageCandidates[0]?.id||null,goldCandidates[0]?.id||null);
  const {result,modeled}=evaluated;
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
   petSelection:selection?{converged:selection.converged,
    exhaustiveWithinShortlist:selection.exhaustiveWithinShortlist===true,
    passes:selection.passes,uniqueEvaluations:selection.uniqueEvaluations}:
    {mode:"static-top1"},
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
