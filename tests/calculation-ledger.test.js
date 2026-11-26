import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseAccountProfile} from "../src/account-profile.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild} from "../src/engine.js";
import {gearSelectionEffects} from "../src/equipment-scenarios.js";
import {petScenarioScore} from "../src/pet-scenarios.js";
import {calculateModeledScenario,compareModeledScenarios} from "../src/calculation-ledger.js";

const source=()=>parseAccountProfile({
 petLevels:{Pet1:100,Pet20:100,Pet26:100,Pet28:100},
 gemstones:[{id:"Gem0",primary:"AllDamage:1e10",secondary:["SwordBoost:1e7"]}],
 equipmentInventory:[
  {id:"S1",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e100"},
  {id:"H1",slot:"Helmet",name:"Ranged hero helmet",bonusType:"AllDamage",bonusAmount:"1e90"},
  {id:"A1",slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e75"},
  {id:"U1",slot:"Aura",bonusType:"AllDamage",bonusAmount:"1e65"},
  {id:"L1",slot:"Slash",bonusType:"AllDamage",bonusAmount:"1e55"}
 ]
});
const settings=(accountProfile,damage="Pet",gold="Fairy",goldWeight=.7)=>({
 accountProfile,damage,gold,goldWeight,
 skillPoints:100,qol:"none",sets:{},currentLevels:{},minimums:{},
 maxStage:0,craftingPower:1,timeToKill:8,sClone:30,
 selectedDamagePet:"Pet1",selectedGoldPet:"Pet20"
});
function scenario(input){
 const selection=gearSelectionEffects(input.accountProfile,input);
 const gearContext={...input,equipmentPetSlotWeights:selection.petEquipmentSlotWeights,
  equipmentPetPassiveWeights:selection.petEquipmentPassiveWeights,
  equipmentPetCoverageComplete:selection.petEquipmentCoverageComplete};
 const result=optimizeBuild(gearContext);
 return {modeled:calculateModeledScenario(result,gearContext,selection),
  selection,gearContext,result};
}
test("One transparent score ledger covers the complete 6 × 3 build matrix",()=>{
 const profile=source();
 assert.equal(DAMAGE_TYPES.length*GOLD_TYPES.length,18);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const {modeled,result,selection,gearContext}=scenario(settings(profile,damage,gold));
  assert.ok(Number.isFinite(modeled.totalLog10),damage+"/"+gold);
  assert.equal(modeled.optimizedForActualStages,false);
  assert.equal(modeled.allAccountEffectsModeled,false);
  assert.equal(modeled.supportsAutomaticCrossBuildSelection,false);
  assert.equal(modeled.fixedAccountRecognized,result.fixedAccount.matched||0);
  assert.equal(modeled.selectedGearCount,Object.keys(selection.selected).length);
  assert.equal(modeled.skillLog10,result.score);
  assert.equal(modeled.fixedAccountLog10,result.fixedAccount.weightedLog10);
  assert.equal(modeled.equippedGearLog10,selection.independentScore);
  assert.equal(modeled.activePetsAbovePassivesLog10,petScenarioScore(gearContext,0));
  const expected=result.accountAdjustedScore+selection.independentScore+
   petScenarioScore(gearContext,0);
  assert.ok(Math.abs(modeled.totalLog10-expected)<1e-8,
   damage+"/"+gold+" has a lost or duplicated scoring term");
 }
});
test("GoldWeight zero removes gold-only modeled terms without deleting fixed damage",()=>{
 const profile=source(),s0=scenario(settings(profile,"Pet","Fairy",0)),
  s1=scenario(settings(profile,"Pet","Fairy",.7));
 assert.ok(s1.modeled.totalLog10>s0.modeled.totalLog10);
 assert.ok(s0.modeled.damageLog10>0);
 assert.equal(s0.modeled.goldWeight,0);
 assert.ok(s0.modeled.equippedGearLog10>0);
});
test("Unmodeled fields and missing account inventory never fabricate power",()=>{
 const empty=parseAccountProfile({Version:"8.4.0"});
 const data=scenario(settings(empty,"Clan Ship","Chesterson",.7));
 assert.equal(data.modeled.selectedGearCount,0);
 assert.equal(data.modeled.equippedGearLog10,0);
 assert.equal(data.modeled.activePetsAbovePassivesLog10,0);
 assert.equal(data.modeled.fixedAccountRecognized,0);
 assert.ok(Number.isFinite(data.modeled.totalLog10));
});
test("Scenario differences are log10 proxies, never claims of stage gains",()=>{
 const profile=source(),a=scenario(settings(profile,"Pet","Fairy")),
  b=scenario(settings(profile,"Pet","Fairy",0));
 assert.ok(Math.abs(compareModeledScenarios(a.modeled,b.modeled)-
  (a.modeled.totalLog10-b.modeled.totalLog10))<1e-10);
 assert.throws(()=>compareModeledScenarios(a.modeled,{}),/Incompatible/);
 assert.equal("predictedStageGain" in a.modeled,false);
});
test("A corrupted component or mismatched baseline is rejected",()=>{
 const p=source(),out=scenario(settings(p));
 const invalid={...out.result,score:NaN};
 assert.throws(()=>calculateModeledScenario(invalid,out.gearContext,out.selection),/Non-finite/);
 assert.throws(()=>calculateModeledScenario(
  {...out.result,accountAdjustedScore:out.result.accountAdjustedScore+1},
  out.gearContext,out.selection),/differs from engine/);
 assert.throws(()=>calculateModeledScenario(out.result,out.gearContext,
  {independentScore:Infinity}),/Non-finite/);
});
test("The worker uses the same ledger for manual and both pet recommendation paths",()=>{
 const worker=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
 assert.match(worker,/calculateModeledScenario\(result,context,gear\)/);
 assert.match(worker,/calculateModeledScenario\(\s*winning\.result,winning\.context,winning\.gearSelection\)/);
 assert.match(worker,/refineCoupledGearAndSkills/);
 assert.match(worker,/enumerateJointGearAndSkills/);
 assert.match(worker,/exhaustiveShortlist:true/);
 assert.match(worker,/adjustedScore:modeledScenario.totalLog10/);
 assert.ok(!worker.includes("result.accountAdjustedScore+petScenarioScore"));
});

test("The --all benchmark really enumerates 18 builds and never dumps raw exports",()=>{
 const script=readFileSync(new URL("../scripts/benchmark-22k.mjs",import.meta.url),"utf8");
 assert.match(script,/DAMAGE_TYPES\.flatMap\(damage=>GOLD_TYPES\.map\(gold=>/);
 assert.match(script,/buildsChecked:compare\.length/);
 assert.match(script,/--profile/);
 assert.ok(!script.includes("console.log(localExport)"));
 assert.ok(!script.includes("console.log(readFileSync"));
 assert.ok(!script.includes("process.env.GITHUB_TOKEN"));
});
test("The score breakdown is present in every localized UI",()=>{
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.ok(app.includes("result.modeledScenario"));
 const label="Modeled log10 score: skills {skills}, account {account}, equipped gear {gear}, active pets above passive {pets}; combined {total}. Not predicted stages.";
 for(const locale of ["fr","uk","ru"]){
  const i18n=readFileSync(new URL("../src/i18n-"+locale+".js",import.meta.url),"utf8");
  assert.equal(i18n.split(label).length-1,1);
 }
});
