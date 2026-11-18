import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {calculatePermanentArtifactEffects} from "../src/account-artifacts.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {petPassiveEvidence} from "../src/pet-scenarios.js";
import {equipmentEffectReduction} from "../src/equipment-reductions.js";
import {gearSelectionEffects,ownedEquipment} from "../src/equipment-scenarios.js";
import {optimizeBuild} from "../src/engine.js";
import {calculateModeledScenario} from "../src/calculation-ledger.js";
const settings=(accountProfile,damage="Heavenly Strike")=>({
 accountProfile,damage,gold:"Fairy",goldWeight:.7,skillPoints:0,
 qol:"none",sets:{},currentLevels:{},minimums:{},maxStage:0,
 craftingPower:1,timeToKill:8,sClone:30
});
test("S: source-guaranteed HS critical hits route CritDamage and CriticalDamage gear",()=>{
 for(const damage of ["Pet","Clan Ship","Shadow Clone","Dagger","Gold Gun"]){
  assert.equal(equipmentEffectReduction("CritDamage",settings(null,damage)).weight,null);
  assert.equal(equipmentEffectReduction("CriticalDamage",settings(null,damage)).weight,null);
 }
 assert.equal(equipmentEffectReduction("CritDamage",settings(null)).weight,1);
 assert.equal(equipmentEffectReduction("CritChance",settings(null)).weight,null);
 const p=parseAccountProfile({equipmentInventory:[{
  id:"CritSword",slot:"Sword",bonusType:"CritDamage",bonusAmount:"1e50",
  secondaryEffects:[{type:"CriticalDamage",amount:"1e25"},
   {type:"CritChance",amount:"50"}]}]});
 const hs=gearSelectionEffects(p,settings(p));
 assert.equal(hs.selected.Sword.secondaryKnown,1);
 assert.equal(hs.selected.Sword.secondaryConditional,1);
 assert.ok(Math.abs(hs.independentScore-75)<1e-8);
 const pet=gearSelectionEffects(p,settings(p,"Pet"));
 assert.equal(pet.independentScore,0);
 assert.equal(pet.selected.Sword.secondaryConditional,2);
});
test("S: The Retaliator and Soot enter fixed HS damage only, not every build",()=>{
 const p=parseAccountProfile({artifacts:{Artifact59:{level:"100",enchanted:false}},
  petLevels:{Pet17:160}});
 const artifacts=calculatePermanentArtifactEffects(p,ARTIFACT_CATALOG);
 const critical=artifacts.entries.find(x=>x.id==="Artifact59");
 assert.equal(critical.bonusType,"CritDamage");
 assert.equal(critical.appliedToScore,true);
 assert.ok(critical.log10>0);
 const soot=petPassiveEvidence(p).entries.find(x=>x.id==="Pet17");
 assert.equal(soot.bonusType,"CritDamage");
 assert.equal(soot.appliedToScore,true);
 const fixed=extractFixedAccountPower(p);
 assert.ok(fixed.byType.CritDamage>critical.log10);
 const hs=fixedAccountScore(fixed,settings(p));
 const pet=fixedAccountScore(fixed,settings(p,"Pet"));
 assert.ok(Math.abs((hs.damageLog10-pet.damageLog10)-fixed.byType.CritDamage)<1e-7);
 assert.ok(hs.types.includes("CritDamage"));
 assert.ok(!pet.types.includes("CritDamage"));
});
test("S: crit equipment large exponents stay finite and ledger has no duplicate",()=>{
 const p=parseAccountProfile({artifacts:{Artifact59:{level:"10",enchanted:false}},
  petLevels:{Pet17:160},equipmentInventory:[
   {id:"Sword",slot:"Sword",bonusType:"CriticalDamage",bonusAmount:"1e9999"}]});
 const cfg=settings(p),gear=gearSelectionEffects(p,cfg);
 const context={...cfg,equipmentPetSlotWeights:gear.petEquipmentSlotWeights,
  equipmentPetPassiveWeights:gear.petEquipmentPassiveWeights,
  equipmentPetCoverageComplete:gear.petEquipmentCoverageComplete};
 const optimized=optimizeBuild(context);
 const ledger=calculateModeledScenario(optimized,context,gear);
 assert.ok(ledger.equippedGearLog10>=9999-1e-7);
 assert.ok(Math.abs(ledger.totalLog10-(ledger.skillLog10+
  ledger.fixedAccountLog10+ledger.equippedGearLog10+
  ledger.activePetsAbovePassivesLog10+
  ledger.selectedSpellBaselineLog10))<1e-7);
 assert.equal(ledger.coverage.realStagePredictionValidated,false);
});
test("S: armor shortlist honors manual choice and rejects unowned IDs",()=>{
 const p=parseAccountProfile({equipmentInventory:[
  {id:"All",slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e80"},
  {id:"Fairy",slot:"Armor",bonusType:"FairyGold",bonusAmount:"1e60"}]});
 const cfg=settings(p),rows=ownedEquipment(p);
 const armor=rows.find(x=>x.id==="Fairy");
 const automatic=gearSelectionEffects(p,cfg);
 assert.equal(automatic.selected.Armor.name,"All");
 const forced=gearSelectionEffects(p,cfg,{Armor:armor.uid});
 assert.equal(forced.selected.Armor.name,"Fairy");
 assert.ok(forced.independentScore<automatic.independentScore);
 const invalid=gearSelectionEffects(p,cfg,{Armor:"Armor:999"});
 assert.equal(invalid.selected.Armor,undefined);
 assert.equal(invalid.missingExplicitSelections.length,1);
});
