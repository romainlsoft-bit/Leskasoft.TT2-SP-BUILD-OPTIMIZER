import {test} from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js";
import {resolvePermanentSetPower,calculateCraftedSetMultiplier} from "../src/account-permanent-sets.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild} from "../src/engine.js";

const SETS=["Mech","Collector","Midas","Diamond","Blacksmith","Retaliator"];
const source=(sets=SETS,extra={})=>parseAccountProfile({
 equipmentSets:sets,playerStats:{"Crafting Power":5},...extra
});
const near=(got,expected)=>assert.ok(Math.abs(got-expected)<1e-10,
 `expected ${expected}, got ${got}`);
const expected=(id,bonusType,count,cp=5)=>{
 const effect=EQUIPMENT_SET_CATALOG[id].bonuses.find(x=>x.type===bonusType);
 return count*calculateCraftedSetMultiplier(effect,cp).log10;
};
const counted=p=>resolvePermanentSetPower(p).entries.filter(x=>x.countKind);

test("source inventory has all five 8.4 per-owned-set multiplier families",()=>{
 const cases=[
  ["Mech","DamagePerMythicSet","Mythic","AllDamage"],
  ["Collector","DamagePerUniqueSet","Unique","AllDamage"],
  ["Diamond","DamagePerLegendarySet","Legendary","AllDamage"],
  ["Midas","GoldPerLegendarySet","Legendary","GoldAll"],
  ["Blacksmith","DamagePerEquipmentSet","All","AllDamage"]
 ];
 const found=counted(source());
 assert.equal(found.length,cases.length);
 for(const [id,type,countKind,output] of cases){
  const row=found.find(x=>x.id===id&&x.sourceBonusType===type);
  assert.ok(row,id+" must be present");
  assert.equal(row.countKind,countKind);
  assert.equal(row.bonusType,output);
  assert.equal(row.appliedToAccount,true);
  assert.equal(row.route,"direct");
  assert.equal(row.countVerified,true);
 }
});

test("owned completed-set counts are category-specific and multiply log10 once",()=>{
 const profile=source(),ledger=resolvePermanentSetPower(profile);
 assert.deepEqual(ledger.ownedCounts,
  {All:6,Mythic:1,Legendary:4,Unique:1,Rare:0,Event:0});
 assert.equal(ledger.countedEffectsApplied,5);
 assert.equal(ledger.ownedRosterComplete,true);
 const rows=counted(profile);
 for(const [id,bonusType,count] of [
  ["Mech","DamagePerMythicSet",1],
  ["Collector","DamagePerUniqueSet",1],
  ["Diamond","DamagePerLegendarySet",4],
  ["Midas","GoldPerLegendarySet",4],
  ["Blacksmith","DamagePerEquipmentSet",6]
 ]){
  const row=rows.find(x=>x.id===id);
  assert.equal(row.count,count);
  near(row.log10,expected(id,bonusType,count));
 }
 near(ledger.byType.GoldAll,expected("Midas","GoldPerLegendarySet",4));
 near(ledger.byType.AllDamage,
  expected("Mech","DamagePerMythicSet",1)+
  expected("Collector","DamagePerUniqueSet",1)+
  expected("Diamond","DamagePerLegendarySet",4)+
  expected("Blacksmith","DamagePerEquipmentSet",6)+
  expected("Retaliator","AllDamage",1));
});

test("equipment pieces sold do not reduce completed-set multipliers",()=>{
 const original=source();
 const sold=source(SETS,{equipmentInventory:[],equippedGear:{}});
 assert.deepEqual(resolvePermanentSetPower(original).ownedCounts,
  resolvePermanentSetPower(sold).ownedCounts);
 near(resolvePermanentSetPower(original).byType.AllDamage,
  resolvePermanentSetPower(sold).byType.AllDamage);
});

test("a duplicate Unique in completed sets/inventory/equipped is counted only once",()=>{
 const profile=source(SETS,{
  uniqueEquipment:[{id:"Weapon_Retaliator"}],
  equippedGear:{Sword:{id:"Weapon_Retaliator",slot:"Sword"}},
  equipmentInventory:[{id:"Weapon_Retaliator",slot:"Sword"}]
 });
 const power=resolvePermanentSetPower(profile);
 assert.equal(power.ownedCounts.Unique,1);
 assert.equal(power.ownedCounts.All,6);
 assert.equal(power.entries.filter(e=>e.id==="Retaliator"&&e.appliedToAccount).length,1);
 const unique=power.entries.find(x=>x.sourceBonusType==="DamagePerUniqueSet");
 assert.equal(unique.count,1);
});

test("an incomplete or truncated completed-set roster never fabricates an exponent",()=>{
 const absent=parseAccountProfile({playerStats:{"Crafting Power":5},
  uniqueEquipment:[{id:"Weapon_Retaliator"}],
  equipmentInventory:[{id:"Weapon_Retaliator",slot:"Sword"}]});
 const result=resolvePermanentSetPower(absent);
 assert.equal(result.ownedRosterComplete,false);
 assert.equal(result.countedEffectsApplied,0);
 // Direct Unique bonuses may be computed for an explicitly recognized
 // owned item. Unknown OTHER sets must not be assumed to be unowned.
 for(const row of result.entries.filter(x=>x.countKind)){
  assert.equal(row.log10,null);
  assert.equal(row.count,null);
 }
 const oversized=source([...SETS,...Array.from({length:510},
  (_,i)=>"UnknownSet"+i)]);
 assert.equal(oversized.sections.equipmentSets.truncated,true);
 const blocked=resolvePermanentSetPower(oversized);
 assert.equal(blocked.ownedRosterComplete,false);
 assert.equal(blocked.countedEffectsApplied,0);
 assert.ok(blocked.entries.some(x=>x.sourceBonusType==="DamagePerEquipmentSet"&&
  x.status==="not-scored-unknown-completed-set-count"));
 assert.ok(blocked.unknown.some(x=>x.reason==="unknown-completed-set-count"));
});

test("old inventory-only Mythic pieces never count as completed Mythic sets",()=>{
 const p=parseAccountProfile({
  equipmentSets:["Mech","Blacksmith"],
  equipmentInventory:[{id:"Gear1",slot:"Sword",setId:"RaidMythic"}],
  playerStats:{"Crafting Power":50}
 });
 const res=resolvePermanentSetPower(p),myth=res.entries.find(x=>
  x.sourceBonusType==="DamagePerMythicSet");
 assert.equal(myth.count,1);
 assert.equal(res.ownedCounts.Mythic,1);
 assert.equal(res.ownedCounts.All,2);
});

test("Crafting Power and set counts produce damage/gold in all 18 build profiles",()=>{
 const profile=source();
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const input={accountProfile:profile,damage,gold,goldWeight:.7,
   skillPoints:80,qol:"none",sets:{},minimums:{},currentLevels:{},
   craftingPower:5,maxStage:0,timeToKill:8,sClone:30};
  const score=optimizeBuild(input);
  const count=score.accountIntegration.permanentSetPower;
  assert.equal(count.countedEffectsApplied,5);
  assert.equal(count.ownedCounts.Legendary,4);
  assert.ok(score.fixedAccount.damageLog10>1);
  assert.ok(score.fixedAccount.goldLog10>0);
  assert.ok(score.fixedAccount.permanentSetBonuses.some(x=>
   x.sourceBonusType==="DamagePerEquipmentSet"));
  assert.ok(Number.isFinite(score.accountAdjustedScore));
 }
});

test("counted set effects have no mythical stage gain or unknown-as-zero inference",()=>{
 const empty=parseAccountProfile({Version:"8.4.0"});
 const result=resolvePermanentSetPower(empty);
 assert.equal(result.ownedRosterComplete,false);
 assert.equal(result.countedEffectsApplied,0);
 assert.equal(result.complete,false);
 assert.ok(!("predictedStageGain" in result));
});
