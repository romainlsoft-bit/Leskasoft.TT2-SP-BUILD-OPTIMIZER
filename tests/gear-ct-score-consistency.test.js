import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {bestEquipmentByCategory,gearSelectionEffects,equipmentPrimaryAmplifiers}
 from "../src/equipment-scenarios.js";
import {petEquipmentCombatTechniquesIncrement,petScenarioScore} from "../src/pet-scenarios.js";
import {skillInfo} from "../vendor/skills.js";

const cfg={damage:"Shadow Clone",gold:"Fairy",goldWeight:.7,sets:{},
 selectedDamagePet:null,selectedGoldPet:null};
const item=(id,bonusType,bonusAmount)=>({id,slot:"Sword",bonusType,bonusAmount});
const profile=inventory=>parseAccountProfile({petLevels:{Pet26:100},equipmentInventory:inventory});
const scientific=log=>`${10**(log-Math.floor(log))}e${Math.floor(log)}`;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} vs ${b}`);

function fixture(){
 const initial=profile([item("All","AllDamage","1e100")]);
 const amp=equipmentPrimaryAmplifiers(initial,cfg).bySlot.Sword.log10;
 // Tap's .6 reduction is balanced so it wins by exactly 2 log10 at CT=0.
 // CT A50 adds .4*log10(A50) more to All Damage, reversing the ranking.
 const tapLog=(102+.4*amp)/.6;
 return profile([item("Tap","TapDamage",scientific(tapLog)),item("All","AllDamage","1e100")]);
}
function terms(p,settings,gear,ct){
 const context={...settings,accountProfile:p,
  equipmentPetSlotWeights:gear.petEquipmentSlotWeights,
  equipmentPetPassiveWeights:gear.petEquipmentPassiveWeights};
 return {independent:gear.independentScore,
  pet:petScenarioScore(context,ct),
  increment:petEquipmentCombatTechniquesIncrement(context,ct),
  total:gear.independentScore+petScenarioScore(context,ct)+petEquipmentCombatTechniquesIncrement(context,ct)};
}
test("a stronger Combat Techniques passive can reverse the preferred primary",()=>{
 const p=fixture();
 const tap=gearSelectionEffects(p,cfg,{Sword:"Sword:0"});
 const all=gearSelectionEffects(p,cfg,{Sword:"Sword:1"});
 near(tap.independentScore-all.independentScore,2);
 assert.equal(gearSelectionEffects(p,cfg).selected.Sword.name,"Tap");
 const high={...cfg,petCombatTechniquesLevel:50};
 const t=terms(p,high,tap,50),a=terms(p,high,all,50);
 near(a.increment-t.increment,.4*Math.log10(Number(skillInfo.CombatTechniques.A50)));
 assert.ok(a.total>t.total);
 const chosen=gearSelectionEffects(p,high);
 assert.equal(chosen.selected.Sword.name,"All");
 assert.equal(bestEquipmentByCategory(p,high).Sword[0].displayName,"All");
 near(chosen.independentScore,all.independentScore);
 near(chosen.petEquipmentSlotWeights.Sword,1);
 near(chosen.petEquipmentPassiveWeights.Sword,1);
});

test("gear rank score agrees with ledger plus CT for both selected and passive exotic pet",()=>{
 const p=fixture();
 for(const pet of [null,"Pet26"])for(const ct of [0,1,25,50]){
  const settings={...cfg,selectedDamagePet:pet,petCombatTechniquesLevel:ct};
  const ranked=bestEquipmentByCategory(p,settings);
  const candidates=["Sword:0","Sword:1"].map(id=>{
   const g=gearSelectionEffects(p,settings,{Sword:id});
   return {id,g,...terms(p,settings,g,ct)};
  });
  for(const candidate of candidates){
   const row=ranked.Sword.find(x=>x.uid===candidate.id);
   near(row.petAwareScore,candidate.total);
   near(row.estimatedScore,candidate.independent);
  }
  candidates.sort((a,b)=>b.total-a.total);
  const chosen=gearSelectionEffects(p,settings);
  assert.equal(chosen.selected.Sword.id,candidates[0].id);
 }
});

test("CT does not create a pet bonus when no equipment pet is owned",()=>{
 const p=parseAccountProfile({equipmentInventory:[item("All","AllDamage","1e100")]});
 const high={...cfg,petCombatTechniquesLevel:50};
 const chosen=gearSelectionEffects(p,high);
 assert.deepEqual(chosen.petEquipmentSlotWeights,{});
 assert.deepEqual(chosen.petEquipmentPassiveWeights,{});
 const row=bestEquipmentByCategory(p,high).Sword[0];
 near(row.petAwareScore,row.estimatedScore);
 near(chosen.independentScore,row.estimatedScore);
});
