import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {PETS} from "../vendor/pets.js";
import {petCandidateEnvelope,recommendPets,petSlotScore,availablePets}
 from "../src/pet-scenarios.js";
import {skillInfo} from "../vendor/skills.js";

const input=accountProfile=>({
 accountProfile,damage:"Pet",gold:"Fairy",goldWeight:.7,sets:{},
 equipmentPetSlotWeights:{},equipmentPetPassiveWeights:{}
});

test("pet screening samples Combat Techniques from 0 to the current game cap",()=>{
 const profile=parseAccountProfile({petLevels:{Pet1:300,Pet20:200}});
 const e=petCandidateEnvelope(input(profile),"Pet1","damage");
 const max=Number(skillInfo.CombatTechniques.MaxLevel);
 assert.ok(max>=30);
 assert.deepEqual(e.samples.map(x=>x.combatTechniquesLevel),
  [0,Math.floor(max/4),Math.floor(max/2),Math.floor(3*max/4),max]);
 assert.equal(e.screeningOnly,true);
 assert.ok(e.samples.every(x=>Number.isFinite(x.score)));
 assert.equal(e.estimatedGain,Math.max(...e.samples.map(x=>x.score)));
 assert.ok(e.estimatedGain>=petSlotScore(input(profile),"Pet1","damage",0));
});

test("screening considers equipped Exotic Equipment Pet CT A bonuses",()=>{
 const profile=parseAccountProfile({petLevels:{Pet26:4}});
 const plain=input(profile);
 const sword={...plain,equipmentPetSlotWeights:{Sword:1}};
 assert.equal(petCandidateEnvelope(plain,"Pet26","damage"),null);
 const boosted=petCandidateEnvelope(sword,"Pet26","damage");
 assert.ok(boosted.samples.at(-1).score>
  petSlotScore(sword,"Pet26","damage",skillInfo.CombatTechniques.MaxLevel));
 assert.equal(boosted.samples[0].score,petSlotScore(sword,"Pet26","damage",0));
});

test("gold-pet slots obey the selected gold source, even during CT screening",()=>{
 const profile=parseAccountProfile({petLevels:{Pet12:100,Pet20:100,Pet22:100}});
 const fairy=input(profile),hog={...fairy,gold:"HoG"};
 assert.equal(petCandidateEnvelope(fairy,"Pet20","gold")?.petId,"Pet20");
 assert.equal(petCandidateEnvelope(hog,"Pet20","gold"),null);
 assert.equal(petCandidateEnvelope(fairy,"Pet22","gold"),null);
 assert.ok(recommendPets(profile,fairy,"gold",3).every(x=>
  [PETS.Pet12.id,PETS.Pet20.id].includes(x.id)));
 assert.ok(recommendPets(profile,hog,"gold",3).every(x=>x.id!=="Pet20"));
});

test("Transcendent 8.4 regression remains valid with multi-level screening",()=>{
 const profile=parseAccountProfile({petLevels:{
  Pet1:1500,Pet12:1500,Pet20:1300,SeasonalPet2:260,
  SeasonalPet7:260,SeasonalPet11:240,SeasonalPet12:180,SeasonalPet1:0
 }});
 const cfg=input(profile);
 assert.equal(availablePets(profile).length,7);
 const damage=recommendPets(profile,cfg,"damage",3),
  gold=recommendPets(profile,cfg,"gold",3);
 assert.equal(damage[0].id,"SeasonalPet7");
 assert.equal(gold[0].id,"SeasonalPet2");
 assert.ok(damage.every(x=>x.samples.length>=3&&x.screeningOnly));
 assert.equal(damage.length,3);
 assert.equal(gold.length,3);
});

test("invalid or missing pet account evidence never creates a screening bonus",()=>{
 const profile=parseAccountProfile({Version:"8.4.0"});
 const cfg=input(profile);
 assert.equal(petCandidateEnvelope(cfg,"Pet999","damage"),null);
 assert.deepEqual(recommendPets(profile,cfg,"damage"),[]);
 assert.deepEqual(recommendPets(profile,cfg,"gold"),[]);
});
