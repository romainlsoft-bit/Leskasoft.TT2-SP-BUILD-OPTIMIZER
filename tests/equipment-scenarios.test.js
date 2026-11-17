import {test} from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {bestEquipmentByCategory,gearSelectionEffects,ownedEquipment,EQUIPMENT_CATEGORIES,equipmentSecondaryEvidence,equipmentPrimaryAmplifiers} from "../src/equipment-scenarios.js";

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

test("secondary equipment rolls are deduplicated and scored only if direct",()=>{
 const p=parseAccountProfile({equipmentInventory:[
  {id:"SwordA",slot:"Weapon",bonusType:"AllDamage",bonusAmount:"1e100",
   BonusTypeB:"AllDamage",BonusAmountB:"1e90",
   BonusTypeC:"PetDamage",BonusAmountC:"2e50",
   secondaryBonuses:["AllDamage:1e90","DeadlyStrikeChance:0.03"]},
  {id:"SwordB",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e105"}
 ]});
 const a=p.sections.equipmentInventory.records[0];
 assert.equal(a.secondaryEffects.length,3);
 const rows=ownedEquipment(p);assert.equal(rows[0].slot,"Sword");
 const eff=equipmentSecondaryEvidence(rows[0],cfg("Pet"));
 assert.equal(eff.recorded,3);assert.equal(eff.known.length,2);
 assert.equal(eff.unknown.length,1);assert.ok(eff.score>139);
 assert.equal(bestEquipmentByCategory(p,cfg("Pet")).Sword[0].id,"SwordA");
 const chosen=gearSelectionEffects(p,cfg("Pet"));
 assert.equal(chosen.selected.Sword.secondaryKnown,2);
 assert.deepEqual(chosen.selected.Sword.unmodeledSecondaryTypes,["DeadlyStrikeChance"]);
});
test("secondary FairyGold only counts for Fairy, not HoG, and chance stays unknown",()=>{
 const p=parseAccountProfile({equipmentInventory:[{id:"ArmorA",slot:"Suit",
  bonusType:"GoldAll",bonusAmount:"1e100",
  SecondaryEffects:[{type:"FairyGold",amount:"1e70"},
   {type:"AllProbabilityBoost",amount:"10"}]}]});
 const item=ownedEquipment(p)[0];assert.equal(item.slot,"Armor");
 const fairy=equipmentSecondaryEvidence(item,{damage:"Pet",gold:"Fairy",goldWeight:.7});
 const hog=equipmentSecondaryEvidence(item,{damage:"Pet",gold:"HoG",goldWeight:.7});
 assert.ok(fairy.score>40);assert.equal(hog.score,0);
 assert.equal(fairy.unknown.length,1);
});

test("Exotic equipment pets and Restored Rune Heart boost the matching equipment primary",()=>{
 const cfgs=cfg("Pet");
 const base=parseAccountProfile({equipmentInventory:[{
  id:"SwordX",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e100"}]});
 const enriched=parseAccountProfile({
  equipmentInventory:[{id:"SwordX",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e100"}],
  petLevels:{Pet26:100,Pet27:100,Pet28:100,Pet29:100,Pet30:100},
  artifacts:{Artifact46:{level:100,e:0},
   Artifact40:{level:100,e:0},Artifact25:{level:100,e:0}}
 });
 const amp=equipmentPrimaryAmplifiers(enriched);
 assert.ok(amp.bySlot.Sword.petLog10>0);
 assert.ok(amp.bySlot.Sword.artifactLog10>0);
 assert.ok(amp.bySlot.Helmet.petLog10>0);
 assert.ok(amp.bySlot.Armor.petLog10>0);
 assert.ok(amp.bySlot.Aura.petLog10>0);
 assert.ok(amp.bySlot.Slash.petLog10>0);
 const a=gearSelectionEffects(base,cfgs),b=gearSelectionEffects(enriched,cfgs);
 assert.ok(b.independentScore>a.independentScore);
 assert.ok(b.selected.Sword.primaryAmplifierLog10>0);
 assert.equal(b.petEquipmentSlotWeights.Sword,1);
 assert.equal(b.petEquipmentPassiveWeights.Sword,1);
 assert.equal(b.petEquipmentCoverageComplete,false);
});
test("equipment-primary boosters never multiply secondary rolls",()=>{
 const p=parseAccountProfile({
  petLevels:{Pet26:100},
  equipmentInventory:[{id:"SwordA",slot:"Sword",bonusType:"AllDamage",
   bonusAmount:"1e100",secondary:["AllDamage:1e20"]}],
  artifacts:{Artifact46:{level:100,e:0}}
 });
 const chosen=gearSelectionEffects(p,cfg("Pet"));
 const e=chosen.selected.Sword;
 assert.equal(e.secondaryKnown,1);
 assert.ok(e.primaryBoostScore>0);
 assert.ok(Math.abs(chosen.independentScore-
  (100+20+e.primaryBoostScore))<1e-9);
});
