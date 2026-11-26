import {test} from "node:test";
import assert from "node:assert/strict";
import {PETS} from "../vendor/pets.js";
import {TRANSCENDENT_PETS} from "../vendor/transcendent-pets.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {scoreAtLevel} from "../src/effects.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {ALL_PETS,availablePets,logPetBonus,activePetGain,petScenarioScore,petCombatTechniquesIncrement,recommendPets,resolvePetLevels,petPassiveEvidence,petArtifactAmplifiers,petTier,logPassivePetMultiplier,petEquipmentCombatTechniquesWeight,petWeight} from "../src/pet-scenarios.js";

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


test("Seasonal Transcendent pets, plus all permanent Legacy/Exotic, are recognized from exports",()=>{
 const p=parseAccountProfile({playerStats:{"Transcendence Season":13},petLevels:{
  Pet1:1500,Pet12:1500,Pet20:1300,
  SeasonalPet2:260,SeasonalPet7:260,SeasonalPet11:240,
  SeasonalPet12:180,SeasonalPet1:0
 }});
 assert.equal(Object.keys(PETS).length,30);
 assert.equal(Object.keys(TRANSCENDENT_PETS).length,15);
 assert.equal(Object.keys(ALL_PETS).length,45);
 const historical=availablePets(p,new Date("2026-11-20T12:00:00Z"));
 assert.ok(historical.some(x=>x.id==="SeasonalPet7"&&x.tier==="Transcendent"&&x.level===260));
 const present=availablePets(p);
 assert.ok(!present.some(x=>x.tier==="Transcendent"));
 assert.ok(present.some(x=>x.id==="Pet20"&&x.tier==="Exotic"));
 assert.ok(present.some(x=>x.id==="Pet1"&&x.tier==="Legacy"));
 assert.ok(!present.some(x=>x.id==="SeasonalPet1"));
 const settings={damage:"Pet",gold:"Fairy",goldWeight:0.7,accountProfile:p,sets:{}};
 assert.ok(recommendPets(p,settings,"damage",3).every(x=>!x.id.startsWith("SeasonalPet")));
 assert.ok(recommendPets(p,settings,"gold",3).every(x=>!x.id.startsWith("SeasonalPet")));
 assert.equal(petCombatTechniquesIncrement({...settings,selectedDamagePet:"SeasonalPet7",
  selectedGoldPet:"SeasonalPet2"},30),0);
});
test("Transcendent improvements every five levels, permanent every twenty",()=>{
 const seasonal=TRANSCENDENT_PETS.SeasonalPet7;
 const delta=(p,a,b)=>logPetBonus(p,b)-logPetBonus(p,a);
 assert.ok(delta(seasonal,4,5)>Math.log10(60));
 assert.ok(delta(seasonal,9,10)>Math.log10(60));
 assert.ok(delta(seasonal,10,14)<0.5);
 assert.ok(delta(seasonal,14,15)>Math.log10(60));
 assert.equal(activePetGain(seasonal,100,0),0);
 assert.ok(activePetGain(seasonal,100,0.25)>0);
 assert.ok(delta(PETS.Pet1,119,120)>Math.log10(1.5));
 assert.ok(delta(PETS.Pet1,139,140)>Math.log10(1.5));
 assert.ok(delta(PETS.Pet1,1599,1600)>Math.log10(1.5));
});
test("Seasonal pets reset to zero and must not be recommended from an old season",()=>{
 const p=parseAccountProfile({petLevels:{Pet1:1200,Pet12:1200,SeasonalPet7:0,SeasonalPet2:0}});
 const context={damage:"Pet",gold:"Fairy",goldWeight:0.7,accountProfile:p,sets:{}};
 assert.ok(availablePets(p).every(x=>x.tier!=="Transcendent"));
 assert.equal(recommendPets(p,context,"damage",3)[0].id,"Pet1");
 assert.equal(recommendPets(p,context,"gold",3)[0].id,"Pet12");
});

test("passive pet bonus starts at 5 levels and is 100 percent at 100",()=>{
 const p=PETS.Pet1,full=logPetBonus(p,100);
 assert.equal(logPassivePetMultiplier(logPetBonus(p,4),4),0);
 assert.ok(Math.abs(logPassivePetMultiplier(logPetBonus(p,5),5)-
  Math.log10(1+.05*(Math.pow(10,logPetBonus(p,5))-1)))<1e-12);
 assert.equal(logPassivePetMultiplier(full,100),full);
 assert.ok(Number.isFinite(logPassivePetMultiplier(30000,60)));
});
test("passives from all Legacy/Exotic pets contribute without selection",()=>{
 const profile=parseAccountProfile({petLevels:{Pet1:100,Pet7:125,Pet12:100,Pet20:100,Pet22:90}});
 const p=petPassiveEvidence(profile);
 assert.equal(p.imported,5);assert.equal(p.scored,5);
 assert.equal(p.entries.find(x=>x.id==="Pet20").tier,"Exotic");
 assert.ok(Math.abs(p.byType.AllDamage-logPetBonus(PETS.Pet1,100)-
  logPetBonus(PETS.Pet7,125))<1e-12);
 const score=fixedAccountScore(extractFixedAccountPower(profile),
  {damage:"Pet",gold:"Fairy",goldWeight:.7});
 assert.ok(score.goldLog10>=p.byType.GoldAll+p.byType.FairyGold);
 assert.ok(score.damageLog10>=p.byType.AllDamage);
});
test("Legacy and Exotic artifacts amplify only matching pet families",()=>{
 const profile=parseAccountProfile({petLevels:{Pet1:100,Pet12:100,Pet20:100,Pet22:100},
  artifacts:{
   Artifact52:{level:100,e:1},Artifact53:{level:100,e:1},
   Artifact96:{level:100,e:1},Artifact97:{level:100,e:1}}
 });
 const amp=petArtifactAmplifiers(profile);
 assert.ok(amp.byTier.Legacy.damage>1);
 assert.ok(amp.byTier.Legacy.gold>1);
 assert.ok(amp.byTier.Exotic.damage>1);
 assert.ok(amp.byTier.Exotic.gold>1);
 const p=petPassiveEvidence(profile);
 assert.equal(p.entries.find(x=>x.id==="Pet1").amplifierLog10,amp.byTier.Legacy.damage);
 assert.equal(p.entries.find(x=>x.id==="Pet12").amplifierLog10,amp.byTier.Legacy.gold);
 assert.equal(p.entries.find(x=>x.id==="Pet20").amplifierLog10,amp.byTier.Exotic.gold);
 assert.equal(p.entries.find(x=>x.id==="Pet22").amplifierLog10,amp.byTier.Exotic.damage);
 assert.equal(petTier(PETS.Pet20),"Exotic");
 assert.equal(petTier(TRANSCENDENT_PETS.SeasonalPet2),"Transcendent");
});

test("Combat Techniques cannot fabricate Equipment Pet Effect without eligible gear",()=>{
 const p=parseAccountProfile({petLevels:{Pet1:100,Pet20:100}});
 const context={...settings(),accountProfile:p};
 assert.equal(petEquipmentCombatTechniquesWeight(context),0);
 assert.equal(petWeight(PETS.Pet26,"damage",context),0);
 assert.equal(scoreAtLevel("CombatTechniques",20,context),0);
});
test("Combat Techniques score reflects verified Sword and Armor exotic pets",()=>{
 const context={...settings(),
  accountProfile:parseAccountProfile({petLevels:{Pet26:100,Pet28:100}}),
  equipmentPetSlotWeights:{Sword:1,Armor:.7},
  equipmentPetPassiveWeights:{Sword:1,Armor:.7},
  selectedDamagePet:"Pet26"
 };
 assert.ok(Math.abs(petEquipmentCombatTechniquesWeight(context)-1.7)<1e-12);
 assert.equal(petWeight(PETS.Pet26,"damage",context),1);
 assert.equal(petWeight(PETS.Pet28,"gold",context),.7);
 const baseline={...context,equipmentPetSlotWeights:{},
  equipmentPetPassiveWeights:{},selectedDamagePet:null};
 assert.ok(scoreAtLevel("CombatTechniques",20,context)>
  scoreAtLevel("CombatTechniques",20,baseline));
});
test("unknown equipment inventory protects existing Combat Techniques SP from destructive reset",()=>{
 const context={...settings(),accountProfile:parseAccountProfile({}),
  currentLevels:{CombatTechniques:8}};
 const result=optimizeBuild(context);
 assert.ok(result.protectedSkills.includes("CombatTechniques"));
 assert.ok(result.levels.CombatTechniques>=8);
});

test("no phantom Combat Techniques contribution in any of 18 Damage/Gold build combinations",()=>{
 const noEquipment={...settings(),
  accountProfile:parseAccountProfile({petLevels:{Pet1:110,Pet12:110}})};
 assert.equal(DAMAGE_TYPES.length*GOLD_TYPES.length,18);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const current={...noEquipment,damage,gold,
   equipmentPetSlotWeights:{},equipmentPetPassiveWeights:{}};
  assert.equal(petEquipmentCombatTechniquesWeight(current),0);
  assert.equal(scoreAtLevel("CombatTechniques",20,current),0,
   damage+" / "+gold+" must not get free Equipment Pet Effect");
 }
});

test("Restored Rune Heart amplifies an active low-level Exotic equipment pet",()=>{
 const p=parseAccountProfile({petLevels:{Pet26:4},
  artifacts:{Artifact46:{level:100,e:0}}});
 const context={...settings(),accountProfile:p,
  selectedDamagePet:"Pet26",equipmentPetSlotWeights:{Sword:1}};
 const scoreWithRune=petScenarioScore(context,0);
 const withoutRune={...context,accountProfile:parseAccountProfile({petLevels:{Pet26:4}})};
 const scoreWithoutRune=petScenarioScore(withoutRune,0);
 assert.ok(scoreWithRune>scoreWithoutRune);
});
