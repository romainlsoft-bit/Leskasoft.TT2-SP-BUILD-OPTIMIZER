import test from "node:test";
import assert from "node:assert/strict";
import {dimensionalShiftEvidence} from "../src/dimensional-shift.js";
import {scoreAtLevel} from "../src/effects.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {skillInfo} from "../vendor/skills.js";
import {spell_reductions} from "../vendor/spells.js";
import {calculateModeledScenario} from "../src/calculation-ledger.js";
const cfg={damage:"Pet",gold:"Fairy",goldWeight:.7,skillPoints:500,
 maxStage:180000,qol:"none",sets:{},currentLevels:{},minimums:{},
 selectedSpells:["ShadowClone","TapBoost","HelperBoost","CritBoost","HandOfMidas","DualPet"],
 assumeMaxSpells:true};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+" vs "+b);

test("Dimensional Shift uses the selected primary spells, not the old aggregate coefficient",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={...cfg,damage,gold,minimums:{DualPetBoost:1}};
  const weight=settings.selectedSpells.reduce((sum,id)=>sum+
   (spell_reductions[id][damage]??0)+.7*(spell_reductions[id][gold]??0),0);
  for(const n of [0,1,10,Number(skillInfo.BossTimer.MaxLevel)]){
   const evidence=dimensionalShiftEvidence(n,settings);
   const expected=n===0?0:weight*Math.log10(Number(skillInfo.BossTimer["A"+n]));
   near(evidence.totalWeight,weight);
   near(scoreAtLevel("BossTimer",n,settings),expected);
   near(evidence.scoreLog10,expected);
   assert.equal(evidence.durationAddedToDamage,false);
   assert.equal(evidence.actualUptimeVerified,false);
   assert.equal(evidence.addedToSpellBaseline,false);
  }
 }
});

test("no Shadow Clone, unknown/conflicting loadout or inactive spells => no modeled gain",()=>{
 for(const settings of [
  {...cfg,selectedSpells:["TapBoost","HandOfMidas"]},
  {...cfg,selectedSpells:undefined},
  {...cfg,selectedSpells:["ShadowClone","ShadowClone"]},
  {...cfg,assumeMaxSpells:false}
 ]){
  assert.equal(scoreAtLevel("BossTimer",10,settings),0);
  assert.equal(dimensionalShiftEvidence(10,settings).completeForSelectedPrimaryProxy,false);
 }
});
test("only guaranteed spell unlocks count and gold weight zero removes only gold",()=>{
 const settings={...cfg,selectedSpells:["ShadowClone","DualPet","HandOfMidas"]};
 const locked=dimensionalShiftEvidence(1,settings);
 assert.equal(locked.rows.find(r=>r.id==="DualPet").modeled,false);
 near(locked.totalWeight,.7*.6);
 assert.equal(locked.completeForSelectedPrimaryProxy,false);
 const unlocked=dimensionalShiftEvidence(1,{...settings,minimums:{DualPetBoost:1}});
 near(unlocked.totalWeight,1+.7*.6);
 assert.equal(unlocked.completeForSelectedPrimaryProxy,true);
 near(dimensionalShiftEvidence(1,{...settings,minimums:{DualPetBoost:1},goldWeight:0}).totalWeight,1);
});

test("solver uses the actual guaranteed spell unlocks and does not double count baseline",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s={...cfg,damage,gold,currentLevels:{BossTimer:1},minimums:{BossTimer:1}};
  const result=optimizeBuild(s);
  assert.equal(result.protectedSkills.includes("BossTimer"),false);
  assert.ok(result.selectedSpellUnlocks.includes("DualPetBoost"));
  const evidence=result.conditionalSkills.rows.find(r=>r.id==="BossTimer").dimensionalShift;
  assert.equal(evidence.completeForSelectedPrimaryProxy,true);
  const row=result.modelAttribution.entries.find(r=>r.id==="BossTimer");
  near(row.scoreLog10,evidence.scoreLog10);
  assert.equal(result.modelAttribution.additiveReconstructionMatches,true);
  const ledger=calculateModeledScenario(result,s,{independentScore:0});
  near(ledger.selectedSpellBaselineLog10,result.spellScenario.weightedLog10);
  near(ledger.totalLog10,ledger.skillLog10+ledger.fixedAccountLog10+
   ledger.equippedGearLog10+ledger.activePetsAbovePassivesLog10+ledger.selectedSpellBaselineLog10);
  assert.ok(result.spent<=s.skillPoints);
 }
});
test("imported Dimensional Shift stays protected without sufficient spell evidence",()=>{
 const s={...cfg,selectedSpells:undefined,currentLevels:{BossTimer:1}};
 const result=optimizeBuild(s);
 assert.ok(result.protectedSkills.includes("BossTimer"));
 assert.ok(result.levels.BossTimer>=1);
});
