import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {resolveGemstoneEvidence} from "../src/account-gemstones.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {equipmentPrimaryAmplifiers,gearSelectionEffects} from "../src/equipment-scenarios.js";
import {resourceResearchEvidence} from "../src/account-research-resources.js";
import {accountDependencyGraph} from "../src/account-dependencies.js";
import {DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";

const settings=(profile,damage="Pet",gold="Fairy")=>({
 damage,gold,goldWeight:0.7,accountProfile:profile,sets:{}});
const sword={id:"SwordA",slot:"Sword",bonusType:"AllDamage",bonusAmount:"1e200"};
const twoGemstones=()=>parseAccountProfile({gemstones:[
 {id:"Gem0",level:500,primary:"PetDamage:1e40",secondary:["GoldAll:2e50"]},
 {id:"Gem1",level:500,primary:"SwordBoost:1e60",secondary:["ManaRegen:10"]}
]});

test("Game-exported gemstones split into direct, equipment and unresolved effects",()=>{
 const p=twoGemstones(),e=resolveGemstoneEvidence(p);
 assert.equal(e.present,true);
 assert.equal(e.recorded,2);
 assert.equal(e.directEffects,2);
 assert.equal(e.equipmentEffects,1);
 assert.equal(e.unresolvedEffects,1);
 assert.equal(e.entries.length,4);
 assert.equal(e.byType.PetDamage,40);
 assert.ok(Math.abs(e.byType.GoldAll-Math.log10(2e50))<1e-9);
 assert.equal(e.byType.SwordBoost,60);
 assert.equal(e.byType.ManaRegen,undefined);
 assert.ok(e.unknown.some(x=>x.bonusType==="ManaRegen"));
 assert.equal(e.researchLevelsAddedToExportedValues,false);
 assert.equal(e.effectiveGemstoneLevel,null);
 assert.equal(resolveGemstoneEvidence(p),e,"stable account snapshot should be cached");
 const power=extractFixedAccountPower(p);
 assert.equal(power.byType.SwordBoost,60);
 assert.equal(power.byType.ManaRegen,undefined);
 assert.equal(power.gemstones.directEffects,2);
 assert.equal(power.gemstones.equipmentEffects,1);
 assert.ok(power.unsupported.some(x=>x.reason==="dependent-or-unknown-bonus-type"));
 const graph=accountDependencyGraph(p);
 assert.equal(graph.gemstones.equipmentEffects,1);
});

test("Fixed-score source reductions never apply pet-only gemstones to other builds",()=>{
 const p=twoGemstones(),power=extractFixedAccountPower(p);
 assert.equal(DAMAGE_TYPES.length*GOLD_TYPES.length,18);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s=fixedAccountScore(power,{damage,gold,goldWeight:1});
  assert.equal(s.damageLog10,damage==="Pet"?40:0,damage+" "+gold);
  assert.ok(Math.abs(s.goldLog10-Math.log10(2e50))<1e-9);
  assert.equal(s.types.includes("SwordBoost"),false,
   "equipment-only bonus must never be added as direct damage");
 }
});

test("A gemstone SwordBoost amplifies only the selected sword primary",()=>{
 const p=parseAccountProfile({gemstones:[{id:"Gem1",primary:"SwordBoost:1e60"}],
  equipmentInventory:[sword],petLevels:{Pet26:100}});
 const noGem=parseAccountProfile({equipmentInventory:[sword],petLevels:{Pet26:100}});
 const amp=equipmentPrimaryAmplifiers(p).bySlot;
 assert.ok(Math.abs(amp.Sword.gemstoneLog10-60)<1e-9);
 for(const slot of ["Helmet","Armor","Aura","Slash"])
  assert.equal(amp[slot].gemstoneLog10,0,slot+" should not inherit SwordBoost");
 const gain=gearSelectionEffects(p,settings(p)).independentScore-
  gearSelectionEffects(noGem,settings(noGem)).independentScore;
 assert.ok(Math.abs(gain-60)<1e-9,
  "gemstone must amplify equipped sword primary once, not twice");
 assert.equal(fixedAccountScore(extractFixedAccountPower(p),settings(p)).damageLog10,0,
  "SwordBoost is not standalone Pet Damage");
});

test("Case-insensitive identical export mirrors are scored only once",()=>{
 const p=parseAccountProfile({gemstones:[
  {id:"Gem0",level:500,primary:"AllDamage:1e90",secondary:["GoldAll:1e60"]},
  {id:"gem0",level:500,primary:"AllDamage:1e90",secondary:["GoldAll:1e60"]}
 ]});
 const e=resolveGemstoneEvidence(p);
 assert.equal(e.duplicateMirrors,1);
 assert.equal(e.entries.length,2);
 assert.equal(e.byType.AllDamage,90);
 assert.equal(e.byType.GoldAll,60);
});

test("Conflicting duplicates exclude every version of the affected gemstone",()=>{
 const p=parseAccountProfile({gemstones:[
  {id:"Gem0",level:300,primary:"AllDamage:1e90"},
  {id:"GEM0",level:301,primary:"AllDamage:1e9999"},
  {id:"Gem1",level:200,primary:"GoldAll:1e70"}
 ]});
 const e=resolveGemstoneEvidence(p);
 assert.equal(e.excluded,1);
 assert.equal(e.byType.AllDamage,undefined);
 assert.equal(e.byType.GoldAll,70);
 assert.ok(e.unknown.some(x=>x.reason==="conflicting-gemstone-records"));
 const fixed=extractFixedAccountPower(p);
 assert.equal(fixed.byType.AllDamage,undefined);
 assert.equal(fixed.byType.GoldAll,70);
});

test("Truncated gemstone exports do not score any fragmentary fixed bonuses",()=>{
 const p=parseAccountProfile({gemstones:Array.from({length:513},(_,i)=>({
  id:"Gem"+i,level:i+1,primary:"AllDamage:1e100"
 }))});
 assert.equal(p.sections.gemstones.truncated,true);
 const e=resolveGemstoneEvidence(p);
 assert.equal(e.entries.length,0);
 assert.ok(e.unknown.some(x=>x.reason==="truncated-gemstone-export"));
 assert.equal(extractFixedAccountPower(p).entries.some(x=>x.system==="gemstones"),false);
});

test("Scientific exponents are safe and malformed, zero or subunit bonuses are rejected",()=>{
 const p=parseAccountProfile({gemstones:[
  {id:"Gem1",primary:"AllDamage:1e9999"},
  {id:"Gem2",primary:"AllDamage:0"},
  {id:"Gem3",primary:"AllDamage:1e-9999"},
  {id:"Gem4",primary:"AllDamage:-2"},
  {id:"Gem5",primary:"GoldAll:3e40"},
  {id:"Gem6",level:-1,primary:"AllDamage:1e30"}
 ]});
 const e=resolveGemstoneEvidence(p);
 assert.equal(e.byType.AllDamage,9999);
 assert.ok(Math.abs(e.byType.GoldAll-(Math.log10(3)+40))<1e-9);
 assert.ok(e.unknown.some(x=>x.reason==="invalid-or-subunit-multiplier"));
 assert.ok(e.unknown.some(x=>x.reason==="invalid-gemstone-level"));
 assert.equal(e.entries.filter(x=>x.bonusType==="AllDamage").length,1);
});

test("Never double-apply research levels to explicit gemstone multipliers",()=>{
 const p=parseAccountProfile({gemstones:[{id:"Gem0",level:500,primary:"PetDamage:1e40"}],
  gemstonesResearch:{"0":{level:30},"2":{level:7},"503":{level:5}},
  playerStats:{"Gemstone Level":8000}});
 const research=resourceResearchEvidence(p),e=resolveGemstoneEvidence(p);
 assert.equal(research.gemstones.extraLevelsFromResearch,42);
 assert.equal(research.gemstones.reportedLevel,8000);
 assert.equal(research.gemstones.basePlusResearchHypothesis,8042);
 assert.equal(research.gemstones.effectiveGemstoneLevel,null);
 assert.equal(e.byType.PetDamage,40);
 assert.equal(extractFixedAccountPower(p).byType.PetDamage,40);
 assert.equal(extractFixedAccountPower(p).researchResources.gemstones.scoreAdjusted,false);
});

test("Unresolved gemstones keep the Combat Techniques coverage flag conservative",()=>{
 const inventory=[
  sword,{id:"HatA",name:"Ranged helmet",slot:"Helmet",bonusType:"AllDamage",bonusAmount:"1e120"},
  {id:"ArmorA",slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e120"},
  {id:"AuraA",slot:"Aura",bonusType:"AllDamage",bonusAmount:"1e120"},
  {id:"SlashA",slot:"Slash",bonusType:"AllDamage",bonusAmount:"1e120"}
 ];
 const petLevels={Pet26:100,Pet27:100,Pet28:100,Pet29:100,Pet30:100};
 const clean=parseAccountProfile({petLevels,equipmentInventory:inventory,
  gemstones:[{id:"Gem1",primary:"SwordBoost:1e10"}]});
 const conflict=parseAccountProfile({petLevels,equipmentInventory:inventory,
  gemstones:[{id:"Gem1",primary:"SwordBoost:1e10"},
   {id:"Gem1",primary:"SwordBoost:1e999"}]});
 assert.equal(gearSelectionEffects(clean,settings(clean)).petEquipmentCoverageComplete,true);
 assert.equal(gearSelectionEffects(conflict,settings(conflict)).petEquipmentCoverageComplete,false);
});

test("AllEquipmentEffect gemstone boosts five selected primary slots once each",()=>{
 const inventory=[
  sword,{id:"Helm",name:"Ranged helmet",slot:"Helmet",bonusType:"AllDamage",bonusAmount:"1e120"},
  {id:"Armor",slot:"Armor",bonusType:"GoldAll",bonusAmount:"1e120"},
  {id:"Aura",slot:"Aura",bonusType:"AllDamage",bonusAmount:"1e120"},
  {id:"Slash",slot:"Slash",bonusType:"AllDamage",bonusAmount:"1e120"}
 ];
 const plain=parseAccountProfile({equipmentInventory:inventory});
 const boosted=parseAccountProfile({gemstones:[{id:"Gem2",primary:"AllEquipmentEffect:1e12"}],
  equipmentInventory:inventory});
 const a=gearSelectionEffects(plain,settings(plain));
 const b=gearSelectionEffects(boosted,settings(boosted));
 assert.ok(Math.abs((b.independentScore-a.independentScore)-
  (4+0.7)*12)<1e-9);
 assert.equal(fixedAccountScore(extractFixedAccountPower(boosted),settings(boosted)).damageLog10,0);
 assert.equal(resolveGemstoneEvidence(boosted).equipmentEffects,1);
});


test("explicit exported TapDamage/AllHeroDamage/CritDamage gemstones use existing source reductions",()=>{
 const p=parseAccountProfile({gemstones:[
  {id:"Gem1",primary:"TapDamage:1e60",secondary:[
   "AllHeroDamage:1e35","CritDamage:1e70"]}
 ]});
 const source=resolveGemstoneEvidence(p);
 assert.equal(source.directEffects,3);
 assert.equal(source.unresolvedEffects,0);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={damage,gold,goldWeight:.7};
  const reduced=extractFixedAccountPower(p);
  const actual=fixedAccountScore(reduced,settings);
  const tap=equipmentEffectReduction("TapDamage",settings).weight??0;
  const hero=equipmentEffectReduction("AllHeroDamage",settings).weight??0;
  const crit=equipmentEffectReduction("CritDamage",settings).weight??0;
  const expected=60*tap+35*hero+70*crit;
  assert.ok(Math.abs(actual.damageLog10-expected)<1e-9,
   damage+"/"+gold);
 }
});
