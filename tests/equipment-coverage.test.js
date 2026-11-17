import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {bestEquipmentByCategory,gearSelectionEffects,ownedEquipment}
 from "../src/equipment-scenarios.js";
import {modeledScenarioCoverage,calculateModeledScenario}
 from "../src/calculation-ledger.js";
import {availablePets} from "../src/pet-scenarios.js";

const config=accountProfile=>({
 accountProfile,damage:"Pet",gold:"Fairy",goldWeight:.7,
 selectedDamagePet:null,selectedGoldPet:null
});
const sword={id:"SwordX",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e100"};
const result={
 score:30,
 accountAdjustedScore:40,
 fixedAccount:{weightedLog10:10,damageLog10:10,goldLog10:0,matched:1},
 accountIntegration:{unmodeledEffects:4,unknownCatalogIds:2,
  gemstoneEffects:{unresolved:1}}
};

test("truncated gear inventory cannot be used for automatic item ranking",()=>{
 const rows=[sword,...Array.from({length:512},(_,i)=>({
  id:"Armor"+i,slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e5"
 }))];
 const profile=parseAccountProfile({equipmentInventory:rows});
 assert.equal(profile.sections.equipmentInventory.truncated,true);
 assert.equal(ownedEquipment(profile).length,512);
 const auto=bestEquipmentByCategory(profile,config(profile),2);
 for(const slot of ["Sword","Helmet","Armor","Aura","Slash"])
  assert.deepEqual(auto[slot],[],"unsafe partial ranking for "+slot);
 const selection=gearSelectionEffects(profile,config(profile));
 assert.equal(selection.inventoryTruncated,true);
 assert.equal(selection.autoSelectionBlocked,true);
 assert.equal(selection.selectedSlotCount,0);
 assert.equal(selection.independentScore,0);
 const coverage=modeledScenarioCoverage(result,config(profile),selection);
 assert.equal(coverage.inventoryTruncated,true);
 assert.equal(coverage.safeForAutomaticGearRecommendation,false);
 assert.ok(coverage.gaps.includes("truncated-equipment-inventory"));
});

test("an explicit item from a partial inventory may be scored, but stays partial",()=>{
 const rows=[sword,...Array.from({length:512},(_,i)=>({
  id:"Misc"+i,slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e2"
 }))];
 const profile=parseAccountProfile({equipmentInventory:rows});
 const choice=ownedEquipment(profile).find(x=>x.id==="SwordX");
 const selection=gearSelectionEffects(profile,config(profile),{Sword:choice.uid});
 assert.equal(selection.selectedSlotCount,1);
 assert.equal(selection.selected.Sword.name,"SwordX");
 assert.ok(selection.independentScore>=100);
 assert.equal(selection.inventoryTruncated,true);
 assert.equal(selection.petEquipmentCoverageComplete,false);
 assert.equal(selection.missingExplicitSelections.length,0);
 const modeled=calculateModeledScenario(result,config(profile),selection);
 assert.equal(modeled.coverage.inventoryTruncated,true);
 assert.equal(modeled.coverage.missingGearSlots,4);
 assert.equal(modeled.coverage.complete,false);
});

test("explicitly requested missing equipment never silently picks another item",()=>{
 const profile=parseAccountProfile({equipmentInventory:[sword]});
 const selection=gearSelectionEffects(profile,config(profile),{Sword:"Sword:invalid"});
 assert.equal(selection.selected.Sword,undefined);
 assert.equal(selection.independentScore,0);
 assert.equal(selection.missingExplicitSelections.length,1);
 assert.deepEqual(selection.missingExplicitSelections[0],{
  slot:"Sword",id:"Sword:invalid",
  reason:"selected-gear-not-in-import-or-not-compatible"
 });
 const coverage=modeledScenarioCoverage(result,config(profile),selection);
 assert.equal(coverage.missingExplicitSelections,1);
 assert.ok(coverage.gaps.includes("invalid-explicit-equipment-selections"));
 assert.equal(coverage.safeForAutomaticGearRecommendation,false);
});

test("unmodeled secondary, primary and amplifiers remain distinct coverage gaps",()=>{
 const profile=parseAccountProfile({equipmentInventory:[{
  ...sword,secondaryEffects:[{type:"AllProbabilityBoost",amount:10}]
 }]});
 const selection=gearSelectionEffects(profile,config(profile));
 const coverage=modeledScenarioCoverage(result,config(profile),selection);
 assert.equal(coverage.missingGearSlots,4);
 assert.equal(coverage.unknownGearSecondaries,1);
 assert.equal(coverage.unknownGemstoneBonuses,1);
 assert.equal(coverage.unresolvedAccountEffects,4);
 assert.equal(coverage.unknownCatalogIds,2);
 for(const reason of ["unmodeled-equipment-secondaries",
  "unmodeled-gemstone-bonuses","incomplete-account-formulas"])
  assert.ok(coverage.gaps.includes(reason),reason);
});

test("invalid active pet selection is diagnosed without inventing pet damage",()=>{
 const profile=parseAccountProfile({petLevels:{Pet1:50,Pet20:50}});
 const ctx={...config(profile),selectedDamagePet:"Pet20",selectedGoldPet:"Pet1"};
 assert.equal(availablePets(profile).length,2);
 const coverage=modeledScenarioCoverage(result,ctx);
 assert.equal(coverage.invalidDamagePet,true);
 assert.equal(coverage.invalidGoldPet,true);
 assert.equal(coverage.realStagePredictionValidated,false);
 assert.ok(coverage.gaps.includes("invalid-selected-pet"));
});

test("a missing account does not imply that the true game multipliers are zero",()=>{
 const profile=parseAccountProfile({Version:"8.4"});
 const ctx=config(profile);
 const coverage=modeledScenarioCoverage(result,ctx);
 assert.equal(coverage.inventoryPresent,false);
 assert.equal(coverage.missingGearSlots,5);
 assert.equal(coverage.complete,false);
 assert.ok(coverage.gaps.includes("missing-equipment-inventory"));
});
