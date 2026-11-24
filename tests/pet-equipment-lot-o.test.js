import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {petPassiveEvidence,petWeight,petCandidateEnvelope,availablePets,petSlotScore} from "../src/pet-scenarios.js";
import {equipmentPrimaryAmplifiers,gearSelectionEffects} from "../src/equipment-scenarios.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {equipmentEffectReduction} from "../src/equipment-reductions.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild} from "../src/engine.js";
import {calculateModeledScenario} from "../src/calculation-ledger.js";

const helmet={id:"HelmetA",slot:"Helmet",name:"Elder Snow Cap",
 bonusType:"AllDamage",bonusAmount:"1e100"};
const cfg=(profile,damage="Pet",gold="Fairy")=>({
 accountProfile:profile,damage,gold,goldWeight:.7,sets:{},
 skillPoints:0,qol:"none",currentLevels:{},maxStage:20000,
 equipmentPetSlotWeights:{},equipmentPetPassiveWeights:{}
});
const near=(a,b,label)=>assert.ok(
 Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b)),
 label+": "+a+" vs "+b);

test("Postseason permanent All Hero and Tap passives route through all 18 damage/gold contexts",()=>{
 const p=parseAccountProfile({petLevels:{Pet2:100,Pet13:100,SeasonalPet3:40,SeasonalPet4:40}});
 const passive=petPassiveEvidence(p);
 assert.ok(passive.byType.AllHelperDamage>0&&passive.byType.TapDamage>0);
 assert.equal(passive.seasonalImported,0);
 assert.equal(passive.seasonalDirect,0);
 const power=extractFixedAccountPower(p);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s=cfg(p,damage,gold);
  const hero=equipmentEffectReduction("AllHelperDamage",s).weight;
  const tap=equipmentEffectReduction("TapDamage",s).weight;
  near(fixedAccountScore(power,s).damageLog10,
   passive.byType.AllHelperDamage*hero+passive.byType.TapDamage*tap,
   "fixed score "+damage+"/"+gold);
  near(petWeight({type:"AllHelperDamage",equipType:"Damage"},"damage",s),
   hero,"active hero "+damage);
  near(petWeight({type:"TapDamage",equipType:"Damage"},"damage",s),
   tap,"active tap "+damage);
 }
 assert.equal(DAMAGE_TYPES.length*GOLD_TYPES.length,18);
});

test("Active Hero pets and fractional Gold Gun Tap candidates are eligible, unowned pets are not",()=>{
 const p=parseAccountProfile({petLevels:{Pet2:100,Pet13:100,Pet20:100,SeasonalPet3:55}});
 const s=cfg(p,"Gold Gun","Fairy");
 assert.ok(petCandidateEnvelope(s,"Pet2","damage"));
 assert.ok(petCandidateEnvelope(s,"Pet13","damage"));
 assert.equal(petCandidateEnvelope(s,"SeasonalPet3","damage"),null);
 assert.equal(petCandidateEnvelope(s,"Pet14","damage"),null);
 // Level 100 has a complete passive bonus (official Game Hive FAQ).
 assert.equal(petSlotScore({...s,selectedDamagePet:"Pet2"},"Pet2","damage"),0);
 const partial=parseAccountProfile({petLevels:{Pet2:20}});
 assert.ok(petSlotScore({...cfg(partial,"Gold Gun"),selectedDamagePet:"Pet2"},
  "Pet2","damage")>0);
 assert.equal(petCandidateEnvelope(cfg(p,"Clan Ship"),"Pet13","damage"),null);
 assert.ok(petCandidateEnvelope(cfg(p,"Clan Ship"),"Pet2","damage"));
});

test("A seasonal equipment pet alone affects its matching gear primary",()=>{
 const p=parseAccountProfile({petLevels:{SeasonalPet6:100},equipmentInventory:[helmet]});
 const amplifier=equipmentPrimaryAmplifiers(p,cfg(p)).bySlot.Helmet;
 assert.equal(amplifier.petLog10,0);
 assert.deepEqual(amplifier.petSources,[]);
 const gear=gearSelectionEffects(p,cfg(p));
 assert.equal(gear.petPrimarySourcesCount,0);
 near(gear.selected.Helmet.primaryAmplifierLog10,amplifier.log10,
  "primary only");
});

test("The exotic and seasonal pets sharing HelmetBoost each count once, never only the first",()=>{
 const a=parseAccountProfile({petLevels:{SeasonalPet6:100},equipmentInventory:[helmet]});
 const b=parseAccountProfile({petLevels:{Pet27:100},equipmentInventory:[helmet]});
 const both=parseAccountProfile({petLevels:{Pet27:100,SeasonalPet6:100},equipmentInventory:[helmet]});
 const amp=p=>equipmentPrimaryAmplifiers(p,cfg(p)).bySlot.Helmet;
 near(amp(both).petLog10,amp(a).petLog10+amp(b).petLog10,"distinct source logs");
 assert.deepEqual(amp(both).petSources.map(x=>x.id).sort(),["Pet27"]);
});

test("Rune Heart and explicit EquipmentPetEffect gemstone amplify documented exotic pet, not unverified seasonal cross stack",()=>{
 const source={petLevels:{Pet27:100,SeasonalPet6:100},equipmentInventory:[helmet]};
 const plain=parseAccountProfile(source);
 const amplified=parseAccountProfile({...source,
  artifacts:[{id:"Artifact46",level:100,enchanted:false}],
  gemstones:[{id:"GemA",level:1,primary:"EquipmentPetEffect:1e9"}]});
 const before=equipmentPrimaryAmplifiers(plain).bySlot.Helmet;
 const after=equipmentPrimaryAmplifiers(amplified).bySlot.Helmet;
 const byId=(report,id)=>report.petSources.find(x=>x.id===id).passiveLog10;
 assert.equal(before.petSources.some(x=>x.id==="SeasonalPet6"),false);
 assert.equal(after.petSources.some(x=>x.id==="SeasonalPet6"),false);
 assert.ok(byId(after,"Pet27")>byId(before,"Pet27"));
 assert.equal(after.unknown.some(x=>x.reason==="seasonal-equipment-pet-rune-stack-unverified"),false);
});

test("Conflicted, missing and unowned pets never create speculative candidates",()=>{
 const empty=parseAccountProfile({});
 const conflict=parseAccountProfile({petLevels:[{id:"Pet2",level:100},{id:"Pet2",level:1}]});
 assert.deepEqual(availablePets(empty),[]);
 assert.equal(petCandidateEnvelope(cfg(empty),"Pet2","damage"),null);
 assert.equal(petCandidateEnvelope(cfg(conflict),"Pet2","damage"),null);
 assert.equal(petSlotScore({...cfg(conflict),selectedDamagePet:"Pet2"},"Pet2","damage"),0);
});

test("Gemstone 1e9999 equipment effect stays finite and does not become direct All Damage",()=>{
 const p=parseAccountProfile({petLevels:{Pet27:100,SeasonalPet6:100},
  equipmentInventory:[helmet],gemstones:[{id:"GemB",level:999,
   primary:"HelmetBoost:1e9999"}]});
 const fixed=fixedAccountScore(extractFixedAccountPower(p),cfg(p));
 assert.ok(Number.isFinite(fixed.damageLog10));
 assert.equal(fixed.damageLog10,0);
 const amp=equipmentPrimaryAmplifiers(p,cfg(p)).bySlot.Helmet;
 assert.ok(amp.gemstoneLog10>=9999);
 assert.equal(amp.petSources.length,1);
});

test("Permanent Drunken Hammer Tap Damage is reduced by the same source coefficient as a pet",()=>{
 const p=parseAccountProfile({artifacts:[{id:"Artifact29",level:100,enchanted:false}]});
 const power=extractFixedAccountPower(p);
 assert.ok(power.byType.TapDamage>0);
 for(const damage of DAMAGE_TYPES){
  const s=cfg(p,damage);
  // Artifact Damage and the artifact's own main effect occupy different
  // lanes: isolate the Tap term rather than assuming no additive pool.
  const noTap={...power,byType:{...power.byType,TapDamage:0}};
  const delta=fixedAccountScore(power,s).damageLog10-
   fixedAccountScore(noTap,s).damageLog10;
  near(delta,power.byType.TapDamage*
   equipmentEffectReduction("TapDamage",s).weight,"artifact Tap "+damage);
 }
});

test("18 native zero-SP optimizations and scenario ledgers remain uncalibrated",()=>{
 const p=parseAccountProfile({petLevels:{Pet2:100,Pet13:100,SeasonalPet3:20},
  equipmentInventory:[helmet]});
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s=cfg(p,damage,gold);
  const optimized=optimizeBuild(s);
  const fixed=fixedAccountScore(extractFixedAccountPower(p),s);
  near(optimized.fixedAccount.damageLog10,fixed.damageLog10,
   "optimizer "+damage+"/"+gold);
  const scenario=calculateModeledScenario(optimized,s,gearSelectionEffects(p,s));
  near(scenario.fixedAccountLog10,optimized.fixedAccount.weightedLog10,
   "ledger "+damage+"/"+gold);
  assert.equal(scenario.coverage.realStagePredictionValidated,false);
  assert.equal(scenario.optimizedForActualStages,false);
 }
});
