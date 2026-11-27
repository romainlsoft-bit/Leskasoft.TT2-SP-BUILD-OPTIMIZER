import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {gearSelectionEffects,ownedEquipment} from "../src/equipment-scenarios.js";
import {petScenarioScore,petEquipmentCombatTechniquesIncrement} from "../src/pet-scenarios.js";
import {DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
const item=(id,slot,bonusType,bonusAmount,name=id)=>({id,slot,bonusType,bonusAmount,name});
const profile=parseAccountProfile({petLevels:{Pet26:100,Pet27:100,Pet28:50,Pet29:100,Pet30:100},
 equipmentInventory:[
 item("Tap","Sword","TapDamage","1e180"),item("All","Sword","AllDamage","1e100"),
 item("Fairy","Armor","FairyGold","1e100"),item("Gold","Armor","GoldAll","1e80"),
 item("LinkSword","Aura","SwordBoost","1e150"),item("LinkSlash","Aura","SlashBoost","1e120"),
 item("Slash","Slash","AllDamage","1e80")
 ]});
const owned=ownedEquipment(profile);
const ids=slot=>owned.filter(x=>x.slot===slot).map(x=>x.uid);
const total=(gear,settings,ct)=>{
 const ctx={...settings,accountProfile:profile,
  equipmentPetSlotWeights:gear.petEquipmentSlotWeights,
  equipmentPetPassiveWeights:gear.petEquipmentPassiveWeights};
 return gear.independentScore+petScenarioScore(ctx,ct)+petEquipmentCombatTechniquesIncrement(ctx,ct);
};
test("actual fixed-CT gear choice matches explicit Cartesian assignments across all 18 routes",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES)for(const ct of [0,50]){
  const settings={damage,gold,goldWeight:.7,petCombatTechniquesLevel:ct,
   selectedDamagePet:"Pet26",selectedGoldPet:"Pet28"};
  const auto=gearSelectionEffects(profile,settings);
  const alternatives=[];
  for(const Sword of ids("Sword"))for(const Armor of ids("Armor"))for(const Aura of ids("Aura"))
   alternatives.push(gearSelectionEffects(profile,settings,{Sword,Armor,Aura,Slash:ids("Slash")[0]}));
  const maximum=Math.max(...alternatives.map(g=>total(g,settings,ct)));
  assert.ok(Math.abs(total(auto,settings,ct)-maximum)<1e-8,damage+"/"+gold+"/"+ct);
  assert.equal(auto.gearSearch.exactForFixedCombatTechniques,true);
  assert.equal(auto.gearSearch.exactAcrossSP,false);
  assert.equal(auto.gearSearch.ownedInventoryConfigurations,8);
  assert.equal(auto.gearSearch.examinedConfigurations,3);
  assert.ok(auto.gearSearch.slotEvaluations<=10);
 }
});
test("manual constraints and missing inventory are not certified as complete",()=>{
 const settings={damage:"Pet",gold:"Fairy",goldWeight:.7};
 const manual=gearSelectionEffects(profile,settings,{Sword:ids("Sword")[0]});
 assert.equal(manual.selected.Sword.id,ids("Sword")[0]);
 const invalid=gearSelectionEffects(profile,settings,{Sword:"missing"});
 assert.equal(invalid.selected.Sword,undefined);
 assert.equal(invalid.gearSearch.exactForFixedCombatTechniques,false);
 const missing=gearSelectionEffects(parseAccountProfile({}),settings);
 assert.equal(missing.gearSearch.exactForFixedCombatTechniques,false);
});
