import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resetAccountDependentOptions} from "../src/import-session-reset.js";

test("import of another TT2 account invalidates all previous contract and selected pet/gear assumptions",()=>{
 const saved={
  contractTimeline:{enabled:true,startingMana:10000,
   manaCapacity:10000,freeTicks:{ForbiddenContract:20,RoyalContract:50}},
  contractMultiScenario:{enabled:true,activeFraction:1,
   pactAtMaxDuringFundedTicks:true},
  assumeContractsAtMax:true,
  assumeCoordinatedOffensiveActive:true,
  assumeFlashZipAtBoss:true,
  assumeNightmareAtBoss:true,
  assumeMagnumOpusAtBoss:true,
  tacticalInsightCalibration:{enabled:true,lowerLevel:12,upperLevel:16},
  selectedDamagePet:"Pet33",selectedGoldPet:"Pet14",
  comparePetScenarios:false,selectedEquipment:{Sword:"SwordA"},
  currentLevels:{TerrifyingPact:22},
  skillPoints:22600,locale:"fr",damage:"Pet",gold:"Fairy"
 };
 const newState=resetAccountDependentOptions(saved);
 assert.equal(newState,saved);
 assert.equal(saved.contractTimeline,null);
 assert.equal(saved.contractMultiScenario,null);
 assert.equal(saved.assumeContractsAtMax,false);
 assert.equal(saved.assumeCoordinatedOffensiveActive,true);
 assert.equal(saved.assumeFlashZipAtBoss,true);
 assert.equal(saved.assumeNightmareAtBoss,true);
 assert.equal(saved.assumeMagnumOpusAtBoss,true);
 assert.equal(saved.tacticalInsightCalibration,null);
 assert.equal(saved.selectedDamagePet,null);
 assert.equal(saved.selectedGoldPet,null);
 assert.equal(saved.comparePetScenarios,false);
 assert.deepEqual(saved.selectedEquipment,{});
 assert.deepEqual(saved.currentLevels,{TerrifyingPact:22});
 assert.equal(saved.skillPoints,22600);
 assert.equal(saved.locale,"fr");
 assert.equal(saved.damage,"Pet");
 assert.equal(saved.gold,"Fairy");
});
test("import-session reset is idempotent and rejects missing state",()=>{
 const state={};
 resetAccountDependentOptions(state);
 const before=JSON.stringify(state);
 resetAccountDependentOptions(state);
 assert.equal(JSON.stringify(state),before);
 assert.throws(()=>resetAccountDependentOptions(null),TypeError);
});
test("the real app import path invokes session reset before accepting new skill levels",()=>{
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 const start=app.indexOf("function importRaw(raw){");
 const end=app.indexOf("function offerManualPaste(",start);
 assert.ok(start>=0&&end>start);
 const body=app.slice(start,end);
 assert.ok(body.indexOf("resetAccountDependentOptions(state);")>=0);
 assert.ok(body.indexOf("resetAccountDependentOptions(state);")<
  body.indexOf("state.currentLevels=parsed.levels;"));
 assert.ok(!body.includes("state.contractTimeline=null; //"),
  "A literal backslash-n after a line comment can silently hide a reset");
});
