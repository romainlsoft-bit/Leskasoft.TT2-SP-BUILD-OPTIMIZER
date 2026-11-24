import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {petLevelEvidence} from "../src/account-pet-levels.js";
import {availablePets,petPassiveEvidence,recommendPets,petScenarioScore} from "../src/pet-scenarios.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {gearSelectionEffects} from "../src/equipment-scenarios.js";
import {scoreAtLevel} from "../src/effects.js";

const context=profile=>({accountProfile:profile,damage:"Pet",gold:"Fairy",goldWeight:0.7,
 sets:{},equipmentPetSlotWeights:{},equipmentPetPassiveWeights:{}});
const gear=()=>[
 {id:"SwordA",name:"Damage sword",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e100"},
 {id:"HatA",name:"Ranged hero helmet",slot:"Helmet",bonusType:"AllDamage",bonusAmount:"1e100"},
 {id:"ArmorA",slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e100"},
 {id:"AuraA",slot:"Aura",bonusType:"AllDamage",bonusAmount:"1e100"},
 {id:"SlashA",slot:"Slash",bonusType:"AllDamage",bonusAmount:"1e100"}
];
const exotic={Pet26:100,Pet27:100,Pet28:100,Pet29:100,Pet30:100};

test("ID + localized pet display name at an identical level is one passive",()=>{
 const p=parseAccountProfile({petLevels:[
  {id:"Pet1",level:100},{id:"Nova",level:100},
  {id:"Pet20",level:100},{id:"Jaws",level:100},
  {id:"SeasonalPet7",level:120},{id:"Lullabye",level:120}
 ]});
 const evidence=petLevelEvidence(p);
 assert.equal(evidence.duplicateMirrors,3);
 assert.equal(evidence.recognized,3);
 assert.equal(evidence.rejected.length,0);
 assert.equal(evidence.levels.Pet1,100);
 assert.equal(evidence.levels.Pet20,100);
 assert.equal(evidence.levels.SeasonalPet7,120);
 assert.equal(petLevelEvidence(p),evidence,"profile snapshot must use cache");
 assert.equal(availablePets(p).length,2);
 assert.ok(availablePets(p).every(x=>!x.id.startsWith("SeasonalPet")));
 const passive=petPassiveEvidence(p);
 assert.equal(passive.imported,2);
 assert.equal(passive.duplicateMirrors,3);
 const direct=extractFixedAccountPower(p);
 assert.equal(direct.petPassives.imported,2);
 assert.equal(direct.petPassives.rejectedLevels,0);
});

test("Conflicting pet ID/name observations exclude the pet from all scores",()=>{
 const p=parseAccountProfile({petLevels:[
  {id:"Pet1",level:100},{id:"Nova",level:5000},
  {id:"Pet20",level:100}
 ]});
 const evidence=petLevelEvidence(p);
 assert.ok(!Object.hasOwn(evidence.levels,"Pet1"));
 assert.equal(evidence.levels.Pet20,100);
 assert.deepEqual(evidence.rejected,[{id:"Pet1",reason:"conflicting-pet-levels"}]);
 const present=availablePets(p);
 assert.deepEqual(present.map(x=>x.id),["Pet20"]);
 assert.equal(recommendPets(p,context(p),"damage").length,0);
 assert.ok(recommendPets(p,context(p),"gold").some(x=>x.id==="Pet20"));
 const power=extractFixedAccountPower(p);
 assert.equal(power.petPassives.rejectedLevels,1);
 assert.ok(power.unsupported.some(x=>x.system==="petLevels"&&x.reason==="conflicting-pet-levels"));
 assert.ok(power.byType.FairyGold>0,"Pet20 (Jaws) contributes FairyGold, not GoldAll");
 assert.equal(power.byType.AllDamage||0,0,"cannot manufacture damage from rejected Nova");
});

test("Nonsense, negative, fractional, missing and out-of-range pet levels are rejected",()=>{
 const p=parseAccountProfile({petLevels:[
  {id:"Pet1",level:2.5},
  {id:"Pet2",level:-1},
  {id:"Pet3"},
  {id:"Pet4",level:100001},
  {id:"Pet5",level:100},
  {id:"Pet999",level:200}
 ]});
 const e=petLevelEvidence(p);
 assert.deepEqual(Object.keys(e.levels),["Pet5"]);
 assert.equal(e.rejected.length,5);
 assert.ok(e.rejected.some(x=>x.id==="Pet999"&&x.reason==="unknown-pet-id"));
 assert.equal(availablePets(p).length,1);
 assert.equal(petPassiveEvidence(p).imported,1);
 assert.equal(e.trustworthy,false);
});

test("Zero seasonal pet levels after reset remain known but never recommended",()=>{
 const p=parseAccountProfile({petLevels:{
  SeasonalPet7:0,SeasonalPet2:0,Pet1:100,Pet12:100
 }});
 const e=petLevelEvidence(p);
 assert.equal(e.levels.SeasonalPet7,0);
 assert.equal(e.levels.SeasonalPet2,0);
 assert.equal(e.rejected.length,0);
 assert.ok(!availablePets(p).some(x=>x.id.startsWith("SeasonalPet")));
 assert.ok(recommendPets(p,context(p),"damage").every(x=>!x.id.startsWith("SeasonalPet")));
 assert.equal(petScenarioScore({...context(p),selectedDamagePet:"SeasonalPet7"},0),0);
});

test("A truncated pet section cannot silently score a partial roster",()=>{
 const records=Array.from({length:513},(_,i)=>({id:"Pet1",level:i===512?200:100}));
 const p=parseAccountProfile({petLevels:records});
 assert.equal(p.sections.petLevels.truncated,true);
 const e=petLevelEvidence(p);
 assert.deepEqual(Object.keys(e.levels),[]);
 assert.ok(e.rejected.some(x=>x.reason==="truncated-pet-export"));
 assert.equal(e.trustworthy,false);
 assert.deepEqual(availablePets(p),[]);
 assert.equal(petPassiveEvidence(p).scored,0);
 assert.equal(extractFixedAccountPower(p).petPassives.imported,0);
});

test("Combat Techniques full-coverage gate needs all five explicit Exotic pet levels",()=>{
 const complete=parseAccountProfile({petLevels:exotic,equipmentInventory:gear()});
 const partial=parseAccountProfile({petLevels:{Pet26:100},equipmentInventory:gear()});
 const conflict=parseAccountProfile({petLevels:[
  ...Object.entries(exotic).map(([id,level])=>({id,level})),
  {id:"Annabelle",level:4}
 ],equipmentInventory:gear()});
 const fullSettings=context(complete);
 assert.equal(gearSelectionEffects(complete,fullSettings).petEquipmentCoverageComplete,true);
 assert.equal(gearSelectionEffects(partial,context(partial)).petEquipmentCoverageComplete,false);
 assert.equal(gearSelectionEffects(conflict,context(conflict)).petEquipmentCoverageComplete,false);
 assert.equal(petLevelEvidence(conflict).levels.Pet26,undefined);
 // Existing CT levels must remain protected whenever the pet roster is not trustworthy.
 for(const profile of [partial,conflict]){
  const known=gearSelectionEffects(profile,context(profile));
  const ctx={...context(profile),currentLevels:{CombatTechniques:10},
   equipmentPetSlotWeights:known.petEquipmentSlotWeights,
   equipmentPetPassiveWeights:known.petEquipmentPassiveWeights,
   equipmentPetCoverageComplete:known.petEquipmentCoverageComplete};
  // The skill may have a theoretical score from another modeled pet, but the
  // complete-coverage flag must still forbid destructive automatic removal.
  assert.equal(ctx.equipmentPetCoverageComplete,false);
  assert.ok(Number.isFinite(scoreAtLevel("CombatTechniques",10,ctx)));
 }
});

test("Pet import warning is translated and never reveals player identifiers",async()=>{
 const {translations}=await import("../src/i18n.js");
 const key="Pet import warning: {count} invalid, conflicting or unknown pet records were excluded from calculations.";
 for(const lang of ["fr","uk","ru"]){
  assert.ok(translations[lang][key]);
  assert.ok(translations[lang][key].includes("{count}"));
 }
 const app=(await import("node:fs")).readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.ok(app.includes("petLevelEvidence(profile)"));
 assert.ok(app.includes("el.dataset.incomplete"));
 assert.ok(!app.includes("record.playerName"));
});
