import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {PETS} from "../vendor/pets.js";
import {TRANSCENDENT_PETS} from "../vendor/transcendent-pets.js";
import {petArtifactAmplifiers,verifiedEquipmentPetAmplifierTarget} from "../src/pet-amplifiers.js";
import {petSlotScore,petScenarioEvidence,activePetSetLevelBonus,
 petScenarioScore} from "../src/pet-scenarios.js";
import {gearSelectionEffects,bestEquipmentByCategory,ownedEquipment,
 equipmentSecondaryEvidence} from "../src/equipment-scenarios.js";
import {modeledScenarioCoverage,calculateModeledScenario} from "../src/calculation-ledger.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {observedPetFairy} from "./fixtures/pet-fairy-comparison-20261116.js";

const swordAll={id:"SwordAll",slot:"Sword",bonusType:"AllDamage",bonusAmount:"5.2480746025e71"};
const swordTap={id:"SwordTap",slot:"Sword",bonusType:"TapDamage",bonusAmount:"1e120"};
const data=overrides=>parseAccountProfile({petLevels:{Pet26:20,Pet1:5},
 equipmentInventory:[swordTap,swordAll],...overrides});
const cfg=(accountProfile,extra={})=>({
 accountProfile,damage:"Shadow Clone",gold:"Fairy",goldWeight:.7,
 selectedDamagePet:null,selectedGoldPet:null,skillPoints:0,
 currentLevels:{},minimums:{},maxStage:0,sets:{},qol:"none",...extra
});
const close=(a,b,msg)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),msg+":"+a+" ≠ "+b);

test("Rune Heart/gemstone equipment-pet target identity is not bonus-family identity",()=>{
 for(const id of ["Pet26","Pet27","Pet28","Pet29","Pet30"])
  assert.equal(verifiedEquipmentPetAmplifierTarget(PETS[id]),true,id);
 for(const id of ["SeasonalPet1","SeasonalPet6","SeasonalPet14","SeasonalPet15"])
  assert.equal(verifiedEquipmentPetAmplifierTarget(TRANSCENDENT_PETS[id]),false,id);
 assert.equal(verifiedEquipmentPetAmplifierTarget(PETS.Pet1),false);
});

test("An actively equipped seasonal helmet pet never gains the unverified rune or gemstone cross boost",()=>{
 const source={petLevels:{SeasonalPet6:20,Pet27:20},equipmentInventory:[{
  id:"HelmetA",slot:"Helmet",name:"Elder Snow Cap",bonusType:"AllDamage",bonusAmount:"1e50"
 }]};
 const plain=parseAccountProfile(source);
 const amplified=parseAccountProfile({...source,
  artifacts:[{id:"Artifact46",level:150,enchanted:false}],
  gemstones:[{id:"GemA",level:2,primary:"EquipmentPetEffect:1e12"}]});
 const base=cfg(plain,{damage:"Pet",selectedDamagePet:"SeasonalPet6",
  equipmentPetSlotWeights:{Helmet:1}});
 const upgraded=cfg(amplified,{damage:"Pet",selectedDamagePet:"SeasonalPet6",
  equipmentPetSlotWeights:{Helmet:1}});
 close(petSlotScore(base,"SeasonalPet6","damage"),
  petSlotScore(upgraded,"SeasonalPet6","damage"),"seasonal unknown amp excluded");
 const evidence=petScenarioEvidence(upgraded);
 assert.equal(evidence.unverifiedCrossStack,true);
 assert.deepEqual(evidence.excludedSeasonalEquipmentRune,["SeasonalPet6"]);
 const exoticBase={...base,selectedDamagePet:"Pet27"};
 const exoticUpgraded={...upgraded,selectedDamagePet:"Pet27"};
 assert.ok(petSlotScore(exoticUpgraded,"Pet27","damage")>
  petSlotScore(exoticBase,"Pet27","damage"));
 assert.ok(petArtifactAmplifiers(amplified).equipmentPetEffectLog10>12);
});

test("Unexported old Samurai flags never grant Active Pet Level",()=>{
 const p=data({equipmentSets:undefined});
 assert.equal(activePetSetLevelBonus(cfg(p,{sets:{Samurai:true}})).bonusPct,0);
 const owned=data({equipmentSets:["Samurai"]});
 assert.ok(activePetSetLevelBonus(cfg(owned)).bonusPct>0);
 const noManual=activePetSetLevelBonus(cfg(owned,{sets:{Samurai:false}}));
 close(noManual.bonusPct,activePetSetLevelBonus(cfg(owned)).bonusPct,"export owns");
});

test("Selecting an active Sword pet changes the best primary: independent versus coupled gear",()=>{
 const p=data();
 const base=cfg(p);
 const first=gearSelectionEffects(p,base);
 assert.equal(first.selected.Sword.name,"SwordTap");
 const paired=cfg(p,{selectedDamagePet:"Pet26"});
 const second=gearSelectionEffects(p,paired);
 assert.equal(second.selected.Sword.name,"SwordAll");
 assert.equal(second.petGearCoupledScreening,true);
 assert.ok(second.petEquipmentSlotWeights.Sword>first.petEquipmentSlotWeights.Sword);
 assert.equal(bestEquipmentByCategory(p,paired,2).Sword[0].id,"SwordAll");
 const score=(settings,gear)=>gear.independentScore+
  petScenarioScore({...settings,equipmentPetSlotWeights:gear.petEquipmentSlotWeights},0);
 assert.ok(score(paired,second)>score(paired,first),
  "winner must be better after including selected active pet");
});

test("Linked Aura and secondary bonuses do not receive active equipment pet boost twice",()=>{
 const p=data({equipmentInventory:[swordAll,{id:"AuraA",slot:"Aura",
  bonusType:"SwordBoost",bonusAmount:"1e40"},{
  id:"SwordUnknown",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e10",
  SecondaryEffects:[{type:"JackpotGold",amount:"1e9999"},
   {type:"CritChance",amount:"1e9"}]}]});
 const s=cfg(p,{selectedDamagePet:"Pet26"});
 const gear=gearSelectionEffects(p,s);
 assert.ok(Number.isFinite(gear.independentScore));
 assert.equal(gear.selected.Aura.linkedPrimaryTarget,"Sword");
 assert.equal(gear.selected.Sword.secondaryKnown,0);
 assert.ok(gear.independentScore<200,"conditional secondaries are not added as AllDamage");
});

test("Chance, critical and conditional gold secondary rolls are explicit unscored evidence",()=>{
 const p=parseAccountProfile({equipmentInventory:[{
  id:"SwordS",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e80",
  SecondaryEffects:[{type:"JackpotGold",amount:"1e9999"},
   {type:"CriticalDamage",amount:"1e40"},
   {type:"AllProbabilityBoost",amount:"1e15"},
   {type:"TapDamage",amount:"1e30"}]}]});
 const s=cfg(p,{damage:"Pet"});
 const record=ownedEquipment(p)[0];
 const secondaries=equipmentSecondaryEvidence(record,s);
 assert.equal(secondaries.recorded,4);
 assert.equal(secondaries.conditional.length,3);
 assert.equal(secondaries.known.length,1);
 assert.equal(secondaries.unknown.length,3);
 close(secondaries.score,30,"only TapDamage source-reduced");
 const gear=gearSelectionEffects(p,s);
 assert.equal(gear.secondaryConditionalCount,3);
 const coverage=modeledScenarioCoverage({accountIntegration:{}},s,gear);
 assert.ok(coverage.gaps.includes("unverified-conditional-equipment-secondaries"));
 assert.equal(coverage.conditionalGearSecondaries,3);
 assert.equal(coverage.realStagePredictionValidated,false);
});

test("All 18 source damage/gold routes score one pet-selected gear without duplicating active pet",()=>{
 const p=data();
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s=cfg(p,{damage,gold,selectedDamagePet:"Pet26"});
  const gear=gearSelectionEffects(p,s);
  const combined={...s,equipmentPetSlotWeights:gear.petEquipmentSlotWeights,
   equipmentPetPassiveWeights:gear.petEquipmentPassiveWeights,
   equipmentPetCoverageComplete:gear.petEquipmentCoverageComplete};
  const result=optimizeBuild(combined);
  const ledger=calculateModeledScenario(result,combined,gear);
  close(ledger.totalLog10,ledger.skillLog10+ledger.fixedAccountLog10+
   ledger.equippedGearLog10+ledger.activePetsAbovePassivesLog10+
   ledger.selectedSpellBaselineLog10,"18 route score "+damage+"/"+gold);
  assert.equal(ledger.coverage.petGearCoupledScreening,true);
  assert.equal(ledger.coverage.realStagePredictionValidated,false);
 }
 assert.equal(DAMAGE_TYPES.length*GOLD_TYPES.length,18);
});

test("Previously measured real Pet/Fairy regression remains a blocked release gate",()=>{
 assert.ok(observedPetFairy.observedStageDifference>0);
 const p=data();
 const scenario=cfg(p,{damage:"Pet",gold:"Fairy",selectedDamagePet:"Pet26"});
 const gear=gearSelectionEffects(p,scenario);
 const result=optimizeBuild({...scenario,
  equipmentPetSlotWeights:gear.petEquipmentSlotWeights,
  equipmentPetPassiveWeights:gear.petEquipmentPassiveWeights});
 const modeled=calculateModeledScenario(result,{...scenario,
  equipmentPetSlotWeights:gear.petEquipmentSlotWeights},gear);
 assert.equal(modeled.optimizedForActualStages,false);
 assert.equal(modeled.coverage.realStagePredictionValidated,false);
});

let loads=0;
async function launchWorker(){
 const messages=[];
 globalThis.self={onmessage:null,postMessage:message=>messages.push(message)};
 await import("../src/worker.js?pet-gear-lot-p-worker="+(++loads));
 return (kind,settings)=>{
  messages.length=0;
  globalThis.self.onmessage({data:{type:kind,settings}});
  return messages.findLast(x=>x.ok!==undefined);
 };
}
test("Worker evaluates the selected pair with its own re-ranked equipment and coherent ledger",async()=>{
 const worker=await launchWorker(),p=data();
 const s=cfg(p,{damage:"Shadow Clone"});
 const response=worker("optimize-pet-scenarios",s);
 assert.equal(response?.ok,true,response?.error);
 assert.equal(response?.selectedPets?.damage,"Pet26");
 assert.equal(response?.gearSelection?.selected?.Sword?.name,"SwordAll");
 const final={...s,selectedDamagePet:response.selectedPets.damage,
  selectedGoldPet:response.selectedPets.gold};
 const fresh=gearSelectionEffects(p,final);
 assert.equal(fresh.selected.Sword.name,response.gearSelection.selected.Sword.name);
 close(fresh.independentScore,response.gearSelection.independentScore,
  "returned gear is from winning pair");
 close(response.result.modeledScenario.equippedGearLog10,
  response.gearSelection.independentScore,"ledger gear");
 assert.equal(response.result.petSearch.shortlistOnly,false);
 assert.equal(response.result.petSearch.exhaustiveAmongEligiblePetPairs,true);
 assert.equal(response.result.modeledScenario.optimizedForActualStages,false);
});
