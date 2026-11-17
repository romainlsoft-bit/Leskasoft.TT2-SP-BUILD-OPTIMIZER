import {test} from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {bestEquipmentByCategory,gearSelectionEffects,ownedEquipment,EQUIPMENT_CATEGORIES} from "../src/equipment-scenarios.js";

const profile=()=>parseAccountProfile({
 equipmentInventory:[
  {id:"SwordAlpha",slot:"Sword",name:"Sword A",bonusType:"AllDamage",bonusAmount:"1e280"},
  {id:"SwordBeta",slot:"Sword",name:"Sword B",bonusType:"AllDamage",bonusAmount:"1e220"},
  {id:"SwordGamma",slot:"Sword",name:"Sword C",bonusType:"AllDamage",bonusAmount:"1e210"},
  {id:"HelmGun",slot:"Helmet",name:"Gunblade helmet",bonusType:"Gunblade",bonusAmount:"2e140"},
  {id:"HelmElder",slot:"Helmet",name:"Elder Snow Cap",bonusType:"HeroDamage",bonusAmount:"4e140"},
  {id:"HelmRange",slot:"Helmet",name:"Ranged helmet",bonusType:"RangedHelperDamage",bonusAmount:"2e140"},
  {id:"HelmMagic",slot:"Helmet",name:"Spell helmet",bonusType:"SpellHelperDamage",bonusAmount:"3e140"},
  {id:"HelmTank",slot:"Helmet",name:"Melee helmet",bonusType:"MeleeHelperDamage",bonusAmount:"3e140"},
  {id:"ArmorA",slot:"Armor",name:"Fairy armor",bonusType:"FairyGold",bonusAmount:"1e120"},
  {id:"AuraA",slot:"Aura",name:"Aura",bonusType:"AllDamage",bonusAmount:"5e120"},
  {id:"SlashA",slot:"Slash",name:"Slash",bonusType:"AllDamage",bonusAmount:"3e120"}
 ]
});
const cfg=damage=>({damage,gold:"Fairy",goldWeight:0.7});

test("equipment inventory is independent from fixed gemstones and titans",()=>{
 const p=profile(),items=ownedEquipment(p);
 assert.equal(items.length,11);
 assert.ok(p.fixedSystemKeys.includes("titanCards"));
 assert.ok(p.fixedSystemKeys.includes("gemstones"));
 assert.equal(EQUIPMENT_CATEGORIES.length,5);
});
test("rank only top two per equipment slot, with no fake value for unknown bonuses",()=>{
 const p=profile(),r=bestEquipmentByCategory(p,cfg("Pet"));
 assert.equal(r.Sword.length,2);
 assert.equal(r.Sword[0].displayName,"Sword A");
 assert.equal(r.Sword[1].displayName,"Sword B");
 assert.equal(r.Sword[0].estimatedScore,280);
 assert.ok(Math.abs(r.Armor[0].estimatedScore-84)<1e-8);
 assert.equal(r.Helmet[0].estimatedScore,null);
});
test("gunblade for four specified builds; others get Elder Snow Cap or hero rotation",()=>{
 const p=profile();
 for(const damage of ["Dagger","Heavenly Strike","Gold Gun","Shadow Clone"]){
  const r=bestEquipmentByCategory(p,cfg(damage));
  assert.equal(r.Helmet.length,1);
  assert.equal(r.Helmet[0].helmetKind,"Gunblade");
  assert.equal(r.helmetRotation,undefined);
 }
 const pet=bestEquipmentByCategory(p,cfg("Pet"));
 assert.ok(pet.Helmet.every(x=>x.helmetKind!=="Gunblade"));
 assert.equal(pet.helmetRotation.unique[0].displayName,"Elder Snow Cap");
 assert.equal(pet.helmetRotation.ranged[0].displayName,"Ranged helmet");
 assert.equal(pet.helmetRotation.spell[0].displayName,"Spell helmet");
 assert.equal(pet.helmetRotation.melee[0].displayName,"Melee helmet");
});
test("changing an additive equipment choice only changes independent score",()=>{
 const p=profile(),settings=cfg("Pet");
 const auto=gearSelectionEffects(p,settings);
 const weak=ownedEquipment(p).find(x=>x.displayName==="Sword B");
 const other=gearSelectionEffects(p,settings,{Sword:weak.uid});
 assert.ok(auto.independentScore>other.independentScore);
 assert.equal(auto.selected.Sword.name,"Sword A");
 assert.equal(other.selected.Sword.name,"Sword B");
});
