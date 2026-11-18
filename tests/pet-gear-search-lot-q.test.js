import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {petCandidateGearWeightEnvelope,gearSelectionEffects} from "../src/equipment-scenarios.js";
import {recommendPets} from "../src/pet-scenarios.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {calculateModeledScenario} from "../src/calculation-ledger.js";

const item=(id,slot,bonusType,bonusAmount)=>({id,slot,bonusType,bonusAmount});
const cfg=(accountProfile,extra={})=>({
 accountProfile,damage:"Shadow Clone",gold:"Fairy",goldWeight:.7,
 skillPoints:0,currentLevels:{},minimums:{},maxStage:0,
 sets:{},qol:"none",selectedDamagePet:null,selectedGoldPet:null,...extra
});
test("Q source-based screening considers alternate Sword primaries",()=>{
 const p=parseAccountProfile({petLevels:{Pet26:50,Pet1:10},
  equipmentInventory:[item("Tap","Sword","TapDamage","1e220"),
   item("All","Sword","AllDamage","1e120")]});
 const settings=cfg(p);
 const initial=gearSelectionEffects(p,settings);
 assert.equal(initial.selected.Sword.name,"Tap");
 assert.equal(initial.petEquipmentSlotWeights.Sword,.6);
 const envelope=petCandidateGearWeightEnvelope(p,settings);
 assert.equal(envelope.slotWeights.Sword,1);
 assert.equal(envelope.screeningOnly,true);
 const candidates=recommendPets(p,{...settings,
  equipmentPetSlotWeights:envelope.slotWeights,
  equipmentPetPassiveWeights:envelope.passiveWeights},"damage",3);
 assert.ok(candidates.some(x=>x.id==="Pet26"));
});
test("Q Aura boost screening is tied to its genuine owned target primary",()=>{
 const p=parseAccountProfile({petLevels:{Pet29:50},
  equipmentInventory:[item("Slash","Slash","AllDamage","1e50"),
   item("Sword","Sword","TapDamage","1e140"),
   item("Aura","Aura","SwordBoost","1e30")]});
 const weights=petCandidateGearWeightEnvelope(p,cfg(p));
 assert.equal(weights.slotWeights.Aura,.6);
 assert.equal(weights.eligiblePrimaries.Aura,1);
 const missing=parseAccountProfile({petLevels:{Pet29:50},
  equipmentInventory:[item("Aura","Aura","SwordBoost","1e30")]});
 assert.equal(petCandidateGearWeightEnvelope(missing,cfg(missing)).slotWeights.Aura,undefined);
});
test("Q incomplete or unknown equipment creates no screening bonus",()=>{
 const blank=parseAccountProfile({petLevels:{Pet26:20}});
 assert.deepEqual(petCandidateGearWeightEnvelope(blank,cfg(blank)).slotWeights,{});
 const invalid=parseAccountProfile({equipmentInventory:[
  item("Unknown","Sword","NotCatalogued","1e9999")]});
 assert.deepEqual(petCandidateGearWeightEnvelope(invalid,cfg(invalid)).slotWeights,{});
 const long=parseAccountProfile({equipmentInventory:Array.from({length:513},(_,i)=>
  item("Sword"+i,"Sword","AllDamage","1e"+(i+5)))});
 const rejected=petCandidateGearWeightEnvelope(long,cfg(long));
 assert.deepEqual(rejected.slotWeights,{});
 assert.equal(rejected.source,"unverified-or-truncated-inventory");
});
test("Q all 18 routes preserve a single gear and active-pet contribution",()=>{
 const p=parseAccountProfile({petLevels:{Pet26:20,Pet1:20},
  equipmentInventory:[item("Tap","Sword","TapDamage","1e80"),
   item("All","Sword","AllDamage","1e60")]});
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings=cfg(p,{damage,gold,selectedDamagePet:"Pet26"});
  const gear=gearSelectionEffects(p,settings);
  const context={...settings,
   equipmentPetSlotWeights:gear.petEquipmentSlotWeights,
   equipmentPetPassiveWeights:gear.petEquipmentPassiveWeights,
   equipmentPetCoverageComplete:gear.petEquipmentCoverageComplete};
  const result=optimizeBuild(context);
  const ledger=calculateModeledScenario(result,context,gear);
  const expected=ledger.skillLog10+ledger.fixedAccountLog10+
   ledger.equippedGearLog10+ledger.activePetsAbovePassivesLog10+
   ledger.selectedSpellBaselineLog10;
  assert.ok(Number.isFinite(expected));
  assert.ok(Math.abs(ledger.totalLog10-expected)<1e-7);
  assert.equal(ledger.coverage.realStagePredictionValidated,false);
 }
 assert.equal(DAMAGE_TYPES.length*GOLD_TYPES.length,18);
});
