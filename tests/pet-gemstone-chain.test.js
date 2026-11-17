import {test} from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {petArtifactAmplifiers} from "../src/pet-amplifiers.js";
import {petEquipmentCombatTechniquesIncrement,petCombatTechniquesIncrement,petSlotScore} from "../src/pet-scenarios.js";
import {scoreAtLevel} from "../src/effects.js";
import {equipmentPrimaryAmplifiers,gearSelectionEffects} from "../src/equipment-scenarios.js";
import {resolveGemstoneEvidence} from "../src/account-gemstones.js";
import {fixedAccountScore,extractFixedAccountPower} from "../src/account-power.js";
import {skillInfo} from "../vendor/skills.js";
import {DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";

const sword={id:"S1",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e100"};
const s=profile=>({
 damage:"Pet",gold:"Fairy",goldWeight:.7,sets:{},accountProfile:profile,
 selectedDamagePet:null,selectedGoldPet:null,
 equipmentPetSlotWeights:{Sword:1},equipmentPetPassiveWeights:{Sword:1}
});
const gem=()=>[
 {id:"GemA",level:500,primary:"ExoticPetDamageEffect:1e7",
  secondary:["EquipmentPetEffect:1e8"]},
 {id:"GemB",level:500,primary:"SwordBoost:1e11"}
];

test("Explicit gemstone pet-family and EquipmentPetEffect bonuses route to pets",()=>{
 const plain=parseAccountProfile({petLevels:{Pet26:100},equipmentInventory:[sword]});
 const boosted=parseAccountProfile({petLevels:{Pet26:100},equipmentInventory:[sword],gemstones:gem()});
 const ledger=resolveGemstoneEvidence(boosted);
 assert.equal(ledger.petEffects,2);
 assert.equal(ledger.equipmentEffects,1);
 const bonus=petArtifactAmplifiers(boosted);
 assert.ok(Math.abs(bonus.byTier.Exotic.damage-7)<1e-9);
 assert.ok(Math.abs(bonus.equipmentPetEffectLog10-8)<1e-9);
 assert.equal(bonus.exportedGemstoneAmplifiers,2);
 const effect=equipmentPrimaryAmplifiers(boosted).bySlot.Sword;
 const baseline=equipmentPrimaryAmplifiers(plain).bySlot.Sword;
 assert.ok(Math.abs(effect.petLog10-baseline.petLog10-15)<1e-8);
 assert.ok(Math.abs(effect.gemstoneLog10-11)<1e-9);
 assert.ok(Math.abs((gearSelectionEffects(boosted,s(boosted)).independentScore-
  gearSelectionEffects(plain,s(plain)).independentScore)-26)<1e-7);
 const fixed=fixedAccountScore(extractFixedAccountPower(boosted),s(boosted));
 assert.equal(fixed.damageLog10,0,"equipment and pet amplifiers are not independent damage");
 assert.equal(fixed.goldLog10,0);
});

test("Gemstone family amplifiers affect the actual active exotic pet",()=>{
 const a=parseAccountProfile({petLevels:{Pet26:4},equipmentInventory:[sword]});
 const b=parseAccountProfile({petLevels:{Pet26:4},equipmentInventory:[sword],gemstones:gem()});
 const baseline=petSlotScore({...s(a),selectedDamagePet:"Pet26"},"Pet26","damage");
 const upgraded=petSlotScore({...s(b),selectedDamagePet:"Pet26"},"Pet26","damage");
 assert.ok(Math.abs(upgraded-baseline-15)<1e-9);
 assert.equal(equipmentPrimaryAmplifiers(b).bySlot.Sword.petLog10,0,
  "at level four, the equipment-pet passive is not active");
});

test("Combat Techniques A increases a level-five passive by less than its full multiplier",()=>{
 const profile=parseAccountProfile({petLevels:{Pet26:5},equipmentInventory:[sword]});
 const cfg=s(profile);
 const level=20,logA=Math.log10(skillInfo.CombatTechniques["A"+level]);
 const inc=petEquipmentCombatTechniquesIncrement(cfg,level);
 assert.ok(inc>0&&inc<logA,"5% passive needs nonlinear scaling");
 assert.ok(Math.abs(scoreAtLevel("CombatTechniques",level,cfg)-inc)<1e-9);
 const full=parseAccountProfile({petLevels:{Pet26:100},equipmentInventory:[sword]});
 const fullInc=petEquipmentCombatTechniquesIncrement(s(full),level);
 assert.ok(Math.abs(fullInc-logA)<1e-9,
  "at level 100 the passive is 100% of the full boosted effect");
});

test("Level-four pet does not gain a phantom passive, but an actively equipped pet gets CT A",()=>{
 const p=parseAccountProfile({petLevels:{Pet26:4},equipmentInventory:[sword]});
 const level=20,logA=Math.log10(skillInfo.CombatTechniques["A"+level]);
 const cfg={...s(p),equipmentPetPassiveWeights:{}};
 assert.equal(petEquipmentCombatTechniquesIncrement(cfg,level),0);
 const active={...cfg,selectedDamagePet:"Pet26"};
 const inc=petEquipmentCombatTechniquesIncrement(active,level);
 assert.ok(Math.abs(inc-logA)<1e-9);
 assert.ok(Math.abs(scoreAtLevel("CombatTechniques",level,active)-
  (inc+petCombatTechniquesIncrement(active,level)))<1e-9);
});

test("Exotic equipment boosts respect the equipped slot weight across all eighteen builds",()=>{
 const profile=parseAccountProfile({petLevels:{Pet26:5,Pet28:100},equipmentInventory:[sword]});
 const level=20,logA=Math.log10(skillInfo.CombatTechniques["A"+level]);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const cfg={...s(profile),damage,gold,goldWeight:.7,
   equipmentPetSlotWeights:{Sword:1,Armor:.7},
   equipmentPetPassiveWeights:{Sword:1,Armor:.7}};
  const raw=petEquipmentCombatTechniquesIncrement(cfg,level);
  assert.ok(raw>0&&raw<1.7*logA+1e-10,damage+" / "+gold);
  assert.ok(Math.abs(scoreAtLevel("CombatTechniques",level,cfg)-raw)<1e-9);
 }
 assert.equal(DAMAGE_TYPES.length*GOLD_TYPES.length,18);
});

test("Gemstone research cannot amplify pets twice, and conflicting gemstones cannot amplify at all",()=>{
 const raw={petLevels:{Pet26:100},equipmentInventory:[sword],
  gemstonesResearch:{"0":{level:30}},playerStats:{"Gemstone Level":8000}};
 const p=parseAccountProfile(raw);
 const powered=parseAccountProfile({...raw,gemstones:gem()});
 const conflict=parseAccountProfile({...raw,gemstones:[...gem(),{
  id:"GemA",primary:"ExoticPetDamageEffect:1e999"}]});
 assert.equal(petArtifactAmplifiers(p).byTier.Exotic.damage,0);
 assert.equal(petArtifactAmplifiers(powered).byTier.Exotic.damage,7);
 assert.equal(petArtifactAmplifiers(conflict).byTier.Exotic.damage,0);
 assert.equal(petArtifactAmplifiers(conflict).equipmentPetEffectLog10,0);
 assert.ok(resolveGemstoneEvidence(conflict).unknown.some(x=>x.reason==="conflicting-gemstone-records"));
});
