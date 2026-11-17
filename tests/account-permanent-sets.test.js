import {test} from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {equipmentPrimaryAmplifiers,gearSelectionEffects} from "../src/equipment-scenarios.js";
import {activePetSetLevelBonus,petSlotScore,resolvePetLevels}
 from "../src/pet-scenarios.js";
import {calculateCraftedSetMultiplier,resolvePermanentSetPower,resolveCraftingPower}
 from "../src/account-permanent-sets.js";

const baseProfile=(extra={})=>parseAccountProfile({
 equipmentSets:["Airforce","Scorpion","Blacksmith","Wonder","Samurai","Ninetails"],
 playerStats:{"Crafting Power":9},
 ...extra
});
const settings=(profile,damage="Pet",gold="Fairy",goldWeight=.7)=>({
 accountProfile:profile,skillPoints:100,damage,gold,goldWeight,
 qol:"none",sets:{},currentLevels:{},minimums:{},
 craftingPower:Number(profile?.stats?.craftingPower||1),
 maxStage:0,timeToKill:8,sClone:30
});
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+" != "+b);

test("all direct set bonuses have source-backed Amount/Inc/Expo and never PerDay",()=>{
 const rows=Object.values(EQUIPMENT_SET_CATALOG)
  .flatMap(x=>x.bonuses.map(e=>({set:x.id,...e})));
 assert.equal(Object.keys(EQUIPMENT_SET_CATALOG).length,214);
 assert.equal(rows.filter(x=>x.perDay===true).length,30);
 const first=resolvePermanentSetPower(baseProfile());
 assert.equal(first.perDayProcessedHere,false);
 assert.ok(first.entries.every(x=>!x.perDay));
 assert.ok(first.appliedDirect>=2);
 assert.ok(first.appliedEquipment>=2);
 assert.ok(first.entries.some(x=>x.bonusType==="ActivePetLevel"&&!x.appliedToAccount));
});
test("Crafting Power formula for a completed set uses 8.4 source fields",()=>{
 const bonus=EQUIPMENT_SET_CATALOG.Airforce.bonuses
  .find(x=>x.type==="AllDamage");
 const expected=cp=>Math.log10(Number(bonus.amount))+
   Math.pow(cp-1,Number(bonus.expo))*Math.log10(Number(bonus.inc));
 for(const cp of [1,2,5,9,100,500]){
  const computed=calculateCraftedSetMultiplier(bonus,cp);
  approx(computed.log10,expected(cp));
  assert.equal(computed.conservative,false);
  assert.equal(computed.status,"crafting-power-formula");
 }
 const b9=calculateCraftedSetMultiplier(bonus,9);
 assert.ok(b9.log10>Math.log10(20));
 assert.equal(b9.improvementLog10>0,true);
});
test("unknown CP yields explicitly conservative base, not fictional boost",()=>{
 const p=parseAccountProfile({equipmentSets:["Airforce"]});
 const power=resolvePermanentSetPower(p);
 assert.equal(resolveCraftingPower(p).source,"missing-crafting-power");
 assert.equal(power.appliedDirect,1);
 assert.equal(power.conservative,1);
 approx(power.byType.AllDamage,Math.log10(20));
 assert.equal(power.entries.find(x=>x.appliedToAccount).status,"base-lower-bound-CP-unknown");
 const known=resolvePermanentSetPower(p,{craftingPower:15});
 assert.ok(known.byType.AllDamage>power.byType.AllDamage);
 assert.equal(known.craftingPower.source,"settings-fallback-unverified");
 assert.notEqual(known, power,"changing CP must invalidate cache");
});
test("exported CP has priority over conflicting UI value",()=>{
 const p=parseAccountProfile({
  equipmentSets:["Airforce"],playerStats:{"Crafting Power":9}
 });
 const power=resolvePermanentSetPower(p,{craftingPower:2});
 assert.equal(power.craftingPower.level,9);
 assert.equal(power.craftingPower.conflictingSettings,true);
 const reference=resolvePermanentSetPower(p,{craftingPower:9});
 approx(power.byType.AllDamage,reference.byType.AllDamage);
});
test("permanent set multiplier survives sale and never depends on current inventory",()=>{
 const setOnly=parseAccountProfile({equipmentSets:["Airforce"],
  equipmentInventory:[],playerStats:{"Crafting Power":5}});
 const withGear=parseAccountProfile({equipmentSets:["Airforce"],
  equipmentInventory:[{id:"RandomSword",slot:"Sword",
   bonusType:"AllDamage",bonusAmount:"1e3"}],
  playerStats:{"Crafting Power":5}});
 const a=resolvePermanentSetPower(setOnly);
 const b=resolvePermanentSetPower(withGear);
 approx(a.byType.AllDamage,b.byType.AllDamage);
 assert.equal(a.recognizedSets,1);
 assert.equal(b.recognizedSets,1);
 assert.equal(a.appliedDirect,1);
});
test("unique items count once from equipped, inventory or explicitly owned set",()=>{
 const p=parseAccountProfile({
  equipmentSets:["Retaliator"],
  uniqueEquipment:[{id:"Weapon_Retaliator"}],
  equipmentInventory:[{id:"Weapon_Retaliator",slot:"Sword",
   bonusType:"AllDamage",bonusAmount:"1e7"}],
  equippedGear:{Sword:{id:"Weapon_Retaliator",slot:"Sword"}},
  playerStats:{"Crafting Power":5}
 });
 const ledger=resolvePermanentSetPower(p);
 assert.equal(ledger.uniqueOwnedCount,1);
 assert.equal(ledger.ownedSetCount,1);
 assert.equal(ledger.appliedDirect,1);
 approx(ledger.byType.AllDamage,
  calculateCraftedSetMultiplier(EQUIPMENT_SET_CATALOG.Retaliator.bonuses[0],5).log10);
 assert.equal(ledger.entries.filter(x=>x.id==="Retaliator").length,1);
});
test("partial, incomplete and unowned sets never create a complete-set multiplier",()=>{
 const p=parseAccountProfile({
  equipmentSets:{Airforce:false,Scorpion:{unlocked:false}},
  equipmentInventory:[{id:"RandomSword",setId:"Airforce",slot:"Sword"}],
  playerStats:{"Crafting Power":12}
 });
 const out=resolvePermanentSetPower(p);
 assert.equal(out.ownedSetCount,0);
 assert.equal(out.appliedDirect,0);
 assert.equal(out.byType.AllDamage,undefined);
 assert.equal(out.byType.GoldAll,undefined);
});
test("set primary equipment boosts apply to matching first effects, not secondary rolls",()=>{
 const p=parseAccountProfile({
  equipmentSets:["Blacksmith","Wonder"],playerStats:{"Crafting Power":9},
  equipmentInventory:[{id:"SwordA",slot:"Sword",
   bonusType:"AllDamage",bonusAmount:"1e100",
   SecondaryEffects:[{type:"AllDamage",amount:"1e25"}]}]
 });
 const set=resolvePermanentSetPower(p);
 const expected=set.byType.SwordBoost+set.byType.AllEquipmentEffect;
 const amp=equipmentPrimaryAmplifiers(p,{craftingPower:9}).bySlot.Sword;
 approx(amp.setLog10,expected);
 const selection=gearSelectionEffects(p,settings(p));
 approx(selection.selected.Sword.permanentSetPrimaryAmplifierLog10,expected);
 approx(selection.independentScore,100+25+expected);
 const armor=equipmentPrimaryAmplifiers(p,{craftingPower:9}).bySlot.Armor;
 approx(armor.setLog10,set.byType.AllEquipmentEffect);
});
test("Ninetails and Fatal Samurai grant both active-pet level percentages",()=>{
 const p=parseAccountProfile({equipmentSets:["Samurai","Ninetails"],
  petLevels:{Pet1:200,Pet20:200}});
 const cfg=settings(p);
 const bonus=activePetSetLevelBonus(cfg);
 approx(bonus.bonusPct,.35);
 assert.equal(bonus.entries.length,2);
 const resolved=resolvePetLevels(cfg,0);
 approx(resolved.effective.Pet1,270);
 approx(resolved.base.Pet1,200);
 const unboosted=settings(parseAccountProfile({petLevels:{Pet1:200,Pet20:200}}));
 const withSelected={...cfg,selectedDamagePet:"Pet1"};
 const withoutSelected={...unboosted,selectedDamagePet:"Pet1"};
 assert.ok(petSlotScore(withSelected,"Pet1","damage",0)>
  petSlotScore(withoutSelected,"Pet1","damage",0));
});
test("fixed direct sets affect each appropriate damage/gold source once across 18 combos",()=>{
 const p=parseAccountProfile({
  equipmentSets:["Airforce","Scorpion","PetChampion"],
  playerStats:{"Crafting Power":9}
 });
 const set=resolvePermanentSetPower(p);
 assert.equal(DAMAGE_TYPES.length*GOLD_TYPES.length,18);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const cfg=settings(p,damage,gold);
  const optimized=optimizeBuild(cfg);
  const fixedRaw=fixedAccountScore(extractFixedAccountPower(p),cfg);
  const fixedSet=fixedAccountScore({available:true,byType:set.byType},cfg);
  approx(optimized.fixedAccount.damageLog10-fixedRaw.damageLog10,
    fixedSet.damageLog10);
  approx(optimized.fixedAccount.goldLog10-fixedRaw.goldLog10,
    fixedSet.goldLog10);
  assert.ok(optimized.fixedAccount.permanentSetBonuses.length>=2);
  assert.equal(optimized.accountIntegration.permanentSetPower.directEffects,
   set.appliedDirect);
 }
});
test("set formulas reject unsupported data without inventing positive power",()=>{
 for(const effect of [
  {amount:"0",inc:"1.05",expo:"0.8"},
  {amount:"10",inc:"0.99",expo:"0.8"},
  {amount:"10",inc:"1.05",expo:"Infinity"},
  {amount:"10",inc:"1.05",expo:"-1"},
  {amount:"1e999999999999999999999",inc:"1.05",expo:"0.9"}
 ]){
  assert.equal(calculateCraftedSetMultiplier(effect,10).log10,null);
 }
});

test("changing an unimported CP invalidates equipment amplifier cache",()=>{
 const p=parseAccountProfile({
  equipmentSets:["Blacksmith","Wonder"],
  equipmentInventory:[{id:"SwordA",slot:"Sword",
   bonusType:"AllDamage",bonusAmount:"1e100"}]
 });
 const before=equipmentPrimaryAmplifiers(p,{craftingPower:2}).bySlot.Sword;
 const after=equipmentPrimaryAmplifiers(p,{craftingPower:30}).bySlot.Sword;
 assert.ok(after.setLog10>before.setLog10);
 assert.notEqual(after,before);
 const early=gearSelectionEffects(p,{...settings(p),craftingPower:2});
 const late=gearSelectionEffects(p,{...settings(p),craftingPower:30});
 assert.ok(late.independentScore>early.independentScore);
 assert.ok(late.independentScore<early.independentScore+10,
  "set amplification must not be repeated on unrelated equipment sources");
});
test("PerDay rows are excluded even when the set has direct daily damage",()=>{
 const p=parseAccountProfile({
  equipmentSets:["StainGlass"],playerStats:{"Crafting Power":100}
 });
 const set=resolvePermanentSetPower(p);
 assert.equal(set.appliedDirect,0);
 assert.equal(set.byType.AllDamage,undefined);
 assert.equal(set.entries.some(x=>x.bonusType==="AllDamage"),false);
 assert.ok(set.entries.every(x=>x.perDay===false));
});
test("legacy Samurai flag and actual owned Samurai never grant active levels twice",()=>{
 const p=parseAccountProfile({equipmentSets:["Samurai","Ninetails"]});
 const combined=activePetSetLevelBonus({accountProfile:p,sets:{Samurai:true}});
 approx(combined.bonusPct,.35);
 assert.equal(combined.entries.filter(x=>x.setId==="Samurai").length,1);
});
