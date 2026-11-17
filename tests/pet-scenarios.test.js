import {test} from "node:test";
import assert from "node:assert/strict";
import {PETS} from "../vendor/pets.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {scoreAtLevel} from "../src/effects.js";
import {optimizeBuild} from "../src/engine.js";
import {availablePets,logPetBonus,activePetGain,petScenarioScore,petCombatTechniquesIncrement,recommendPets,resolvePetLevels} from "../src/pet-scenarios.js";

const sample=()=>parseAccountProfile({
 Version:"8.4.0",
 petLevels:{Pet1:210,Pet7:305,Pet6:200,Pet12:260,Pet13:299,Pet14:140,Pet20:230,Pet22:120},
 equipmentSets:["Samurai"],playerStats:{"Titan Souls":"1e240"}
});
const settings=()=>({damage:"Pet",gold:"Fairy",goldWeight:0.7,skillPoints:400,
 qol:"none",sets:{},currentLevels:{},minimums:{},maxStage:0,
 craftingPower:1,timeToKill:8,sClone:30,accountProfile:sample()});

test("30 source pet IDs include independently equipped Damage and Gold pets",()=>{
 assert.equal(Object.keys(PETS).length,30);
 assert.equal(PETS.Pet1.name,"Nova");assert.equal(PETS.Pet7.name,"Demos");
 assert.equal(PETS.Pet12.type,"GoldAll");assert.equal(PETS.Pet20.name,"Jaws");
 assert.equal(PETS.Pet20.type,"FairyGold");
 assert.equal(PETS.Pet20.equipType,"Support");
 assert.equal(PETS.Pet7.equipType,"Damage");
 assert.equal(availablePets(sample()).length,8);
});
test("base -> active level boosts -> pet bonus dependency uses actual levels",()=>{
 const pet=PETS.Pet20;
 assert.equal(activePetGain(pet,100,0),0);
 assert.ok(activePetGain(pet,100,0.25)>0);
 assert.ok(activePetGain(pet,30,0)>0);
 assert.ok(logPetBonus(pet,200)>logPetBonus(pet,100));
 const resolved=resolvePetLevels(settings(),28);
 assert.ok(resolved.effective.Pet7>resolved.base.Pet7);
 assert.equal(resolved.base.Pet7,305);
});
test("two independently equipped pets contribute separately to Combat Techniques",()=>{
 const base=settings(),active={...base,selectedDamagePet:"Pet1",selectedGoldPet:"Pet20"};
 assert.equal(petCombatTechniquesIncrement(base,25),0);
 assert.ok(petCombatTechniquesIncrement(active,25)>0);
 assert.ok(scoreAtLevel("CombatTechniques",25,active)>
  scoreAtLevel("CombatTechniques",25,base));
 assert.ok(petScenarioScore(active,25)>petScenarioScore(active,0));
 assert.equal(petScenarioScore({...active,selectedDamagePet:"Pet999"},25),
  petScenarioScore({...active,selectedDamagePet:null},25));
});
test("at most 3 Damage and 3 Gold pets are ranked separately, without 3x3 pairing",()=>{
 const s=settings(),damage=recommendPets(s.accountProfile,s,"damage",3),
  gold=recommendPets(s.accountProfile,s,"gold",3);
 assert.equal(damage.length,3);assert.equal(gold.length,3);
 assert.ok(damage.every(x=>x.equipType==="Damage"));
 assert.ok(gold.every(x=>x.equipType==="Support"));
 const valid=new Set(availablePets(s.accountProfile).map(x=>x.id));
 for(const p of [...damage,...gold])assert.ok(valid.has(p.id));
 const ctx={...s,selectedDamagePet:damage[0].id,selectedGoldPet:gold[0].id};
 const actual=optimizeBuild(ctx);
 assert.ok(actual.spent<=s.skillPoints);
 assert.ok(Number.isFinite(actual.score+petScenarioScore(ctx,0)));
});
test("no pet data cannot manufacture recommendations or score boosts",()=>{
 const blank={...settings(),accountProfile:parseAccountProfile({Version:"8.4.0"})};
 assert.deepEqual(recommendPets(blank.accountProfile,blank,"gold"),[]);
 assert.deepEqual(recommendPets(blank.accountProfile,blank,"damage"),[]);
 assert.equal(petScenarioScore({...blank,selectedDamagePet:"Pet1"},29),0);
});

test("changing pet scenarios reuses DP frontiers of unaffected branches",()=>{
 const s=settings(),damage=recommendPets(s.accountProfile,s,"damage",3),
  gold=recommendPets(s.accountProfile,s,"gold",3);
 const cache=new Map();
 const first=optimizeBuild({...s,selectedDamagePet:damage[0].id,selectedGoldPet:gold[0].id},undefined,cache);
 const knight=cache.get("BranchRed").solution;
 const summoner=cache.get("BranchOrange").solution;
 const second=optimizeBuild({...s,selectedDamagePet:damage[1].id,selectedGoldPet:gold[0].id},undefined,cache);
 assert.equal(cache.get("BranchRed").solution,knight);
 assert.notEqual(cache.get("BranchOrange").solution,summoner);
 assert.ok(first.spent<=s.skillPoints);
 assert.ok(second.spent<=s.skillPoints);
});
