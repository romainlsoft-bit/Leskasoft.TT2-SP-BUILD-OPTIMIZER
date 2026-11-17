import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {equipmentEffectReduction} from "../src/equipment-reductions.js";
import {gearSelectionEffects,bestEquipmentByCategory,ownedEquipment,
 equipmentSecondaryEvidence} from "../src/equipment-scenarios.js";
import {modeledScenarioCoverage} from "../src/calculation-ledger.js";

const cfg=(damage="Pet",gold="Fairy")=>({damage,gold,goldWeight:.7});
const profile=rows=>parseAccountProfile({equipmentInventory:rows});
const sword=(amount="1e100")=>({id:"Sword1",slot:"Sword",name:"Sword",
 bonusType:"AllDamage",bonusAmount:amount});
const aura=(id,target,amount)=>({id,slot:"Aura",name:id,
 bonusType:target,bonusAmount:amount});
test("reductions are source-specific, not universal damage",()=>{
 assert.equal(equipmentEffectReduction("TapDamage",cfg("Pet")).weight,1);
 assert.equal(equipmentEffectReduction("TapDamage",cfg("Shadow Clone")).weight,.6);
 assert.equal(equipmentEffectReduction("TapDamage",cfg("Gold Gun")).weight,.45);
 assert.equal(equipmentEffectReduction("TapDamage",cfg("Clan Ship")).weight,0);
 assert.equal(equipmentEffectReduction("HeroDamage",cfg("Pet")).weight,.5);
 assert.equal(equipmentEffectReduction("AllHeroDamage",cfg("Clan Ship")).weight,1);
 assert.equal(equipmentEffectReduction("HeroDamage",cfg("Gold Gun")).weight,.9);
 assert.equal(equipmentEffectReduction("SpellHelperDamage",cfg()).weight,null);
 assert.equal(equipmentEffectReduction("CriticalDamage",cfg()).weight,null);
});
test("source-specific conversion applies to primary and secondary independently",()=>{
 const p=profile([
  {id:"SwordT",slot:"Sword",bonusType:"TapDamage",bonusAmount:"1e100",
   secondaryEffects:[{type:"HeroDamage",amount:"1e40"},{type:"AllProbabilityBoost",amount:"10"}]}
 ]);
 const pet=gearSelectionEffects(p,cfg("Pet"));
 const clone=gearSelectionEffects(p,cfg("Shadow Clone"));
 assert.equal(pet.selected.Sword.primaryReduction,1);
 assert.equal(pet.selected.Sword.secondaryEffects[0].reduction,.5);
 assert.equal(pet.selected.Sword.secondaryUnknown,1);
 assert.equal(pet.independentScore,120);
 assert.equal(clone.independentScore,84);
});
test("Aura primary only strengthens a selected, scoreable target once",()=>{
 const p=profile([sword(),
  {id:"Slash1",slot:"Slash",bonusType:"PetDamage",bonusAmount:"1e50"},
  aura("AS","SwordBoost","1e30"),
  aura("AH","HelmetBoost","1e90"),
  aura("AL","SlashBoost","1e10")
 ]);
 const choice=gearSelectionEffects(p,cfg());
 assert.equal(choice.selected.Aura.name,"AS");
 assert.equal(choice.selected.Aura.linkedPrimaryTarget,"Sword");
 assert.equal(choice.linkedAuraCount,1);
 assert.equal(choice.unresolvedAuraLinks,0);
 assert.equal(choice.independentScore,180);
 assert.equal(bestEquipmentByCategory(p,cfg()).Aura[0].id,"AS");
});
test("Aura ranking follows explicit target selections, not stale default gear",()=>{
 const p=profile([sword(),{
  id:"SwordT",slot:"Sword",bonusType:"GoldGunDamage",bonusAmount:"1e90"
 },aura("SwordAura","SwordBoost","1e50"),
 aura("SlashAura","SlashBoost","1e35"),
 {id:"Slash1",slot:"Slash",bonusType:"PetDamage",bonusAmount:"1e90"}]);
 const chosen=gearSelectionEffects(p,cfg());
 assert.equal(chosen.selected.Aura.name,"SwordAura");
 assert.equal(chosen.independentScore,240);
 const explicit=ownedEquipment(p).find(x=>x.id==="SwordT");
 const swapped=gearSelectionEffects(p,cfg(),{Sword:explicit.uid});
 assert.equal(swapped.selected.Aura.name,"SlashAura");
 assert.equal(swapped.independentScore,125);
});
test("coupled Aura selects a weaker standalone sword when the pair wins",()=>{
 const p=profile([
  {id:"SwordHero",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e100"},
  {id:"SwordTap",slot:"Sword",bonusType:"TapDamage",bonusAmount:"1e175"},
  aura("SwordAura","SwordBoost","1e50")
 ]);
 const ranked=bestEquipmentByCategory(p,cfg("Shadow Clone"));
 assert.equal(ranked.Sword[0].id,"SwordTap");
 const coupled=gearSelectionEffects(p,cfg("Shadow Clone"));
 assert.equal(coupled.selected.Sword.name,"SwordHero");
 assert.equal(coupled.selected.Aura.linkedPrimaryTarget,"Sword");
 assert.equal(coupled.independentScore,150);
});
test("Aura cannot credit an absent, incompatible, or unmodeled target",()=>{
 const p=profile([aura("Only","SwordBoost","1e9999")]);
 const result=gearSelectionEffects(p,cfg());
 assert.equal(result.selected.Aura.primaryModeled,false);
 assert.equal(result.unresolvedAuraLinks,1);
 assert.equal(result.independentScore,0);
 const coverage=modeledScenarioCoverage({accountIntegration:{}},{
  ...cfg(),accountProfile:p},result);
 assert.ok(coverage.gaps.includes("unresolved-aura-primary-target"));
 assert.equal(coverage.safeForAutomaticGearRecommendation,false);
});
test("extreme scientific multipliers remain finite in log10",()=>{
 const p=profile([sword("1e9999"),aura("Big","SwordPrimaryEffect","1e7777")]);
 const choice=gearSelectionEffects(p,cfg());
 assert.equal(choice.independentScore,17776);
 assert.ok(Number.isFinite(choice.independentScore));
});
test("inapplicable secondary is distinct from unknown and never boosts gear",()=>{
 const p=profile([{...sword(),
  SecondaryEffects:[{type:"FairyGold",amount:"1e90"},
   {type:"PetDamage",amount:"1e30"},
   {type:"ManaRegeneration",amount:"50"}]}]);
 const s=equipmentSecondaryEvidence(ownedEquipment(p)[0],cfg("Clan Ship","HoG"));
 assert.equal(s.recorded,3);
 assert.equal(s.inapplicable.length,2);
 assert.equal(s.unknown.length,1);
 assert.equal(s.known.length,0);
});
test("all 18 damage/gold pairs route an aura target without cross-build leaks",()=>{
 const types=["Pet","Clan Ship","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"];
 const gold=["Fairy","HoG","Chesterson"];
 const p=profile([sword(),aura("SwordAura","SwordPrimaryEffect","1e80")]);
 for(const damage of types)for(const g of gold){
  const scored=gearSelectionEffects(p,cfg(damage,g));
  assert.equal(scored.independentScore,180,damage+"/"+g);
  assert.equal(scored.selected.Aura.linkedPrimaryResolved,true);
 }
});
test("Aura strengthening is not copied to secondary bonus values",()=>{
 const p=profile([{
  ...sword("1e100"),SecondaryEffects:[{type:"AllDamage",amount:"1e40"}]
 },aura("SwordAura","SwordBoost","1e30")]);
 const choice=gearSelectionEffects(p,cfg());
 assert.equal(choice.independentScore,170);
 assert.equal(choice.selected.Sword.secondaryKnown,1);
 assert.equal(choice.selected.Aura.secondaryKnown,0);
});
test("incompatible hero classes, conditional uniques and chance remain unmodeled",()=>{
 const p=profile([{id:"HelmetA",slot:"Helmet",name:"Ranged helmet",
  bonusType:"RangedHelperDamage",bonusAmount:"1e150",
  SecondaryEffects:[{type:"CriticalDamage",amount:"1e80"}]},
  sword()]);
 const scored=gearSelectionEffects(p,cfg());
 assert.equal(scored.selected.Helmet.primaryModeled,false);
 assert.equal(scored.selected.Helmet.secondaryUnknown,1);
 assert.equal(scored.independentScore,100);
});
