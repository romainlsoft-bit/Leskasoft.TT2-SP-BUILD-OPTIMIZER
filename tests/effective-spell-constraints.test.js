import test from "node:test";
import assert from "node:assert/strict";
import {optimizeBuild,spentPoints,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {multicastSkillEvidence} from "../src/spell-scenarios.js";

const cfg={damage:"Pet",gold:"Fairy",goldWeight:.7,skillPoints:1000,
 maxStage:180000,qol:"none",sets:{},currentLevels:{},minimums:{},
 protectUnmodeledSkills:true,assumeMaxSpells:true};
const gated=[
 ["DualPetMultiCast","DualPet","DualPetBoost","Pet"],
 ["ClanShipVoltageMultiCastSkill","ThunderVolley","ClanShipVoltage","Clan Ship"],
 ["StreamOfBladesMultiCastSkill","StreamOfBlades","CriticalHit","Dagger"]
];

test("confirmed equipped multicasts are reoptimized under their guaranteed unlocks",()=>{
 for(const [id,spell,unlock,damage] of gated)for(const route of [damage,"Gold Gun"]){
  const settings={...cfg,damage:route,selectedSpells:[spell],currentLevels:{[id]:3}};
  assert.equal(multicastSkillEvidence(id,3,settings).status,"spell-locked");
  const auto=optimizeBuild(settings);
  const explicit=optimizeBuild({...settings,minimums:{[unlock]:1}});
  const free=optimizeBuild({...settings,protectUnmodeledSkills:false});
  assert.ok(auto.selectedSpellUnlocks.includes(unlock),id);
  assert.ok(auto.levels[unlock]>=1,id);
  assert.equal(auto.protectedSkills.includes(id),false,id);
  assert.equal(auto.investmentAudit.protectedEntries.some(e=>e.id===id),false,id);
  assert.deepEqual(auto.levels,explicit.levels,id+" implicit and explicit unlocks");
  assert.deepEqual(auto.levels,free.levels,id+" no false protected floor");
  assert.equal(auto.score,free.score,id);
  assert.ok(spentPoints(auto.levels)<=cfg.skillPoints,id);
  assert.equal(auto.modelAttribution.additiveReconstructionMatches,true,id);
  assert.deepEqual(settings.minimums,{},id+" input settings unchanged");
 }
});

test("unknown, absent or inactive spells retain their original protection policy",()=>{
 for(const [id,spell,,damage] of gated){
  for(const evidence of [{},{selectedSpells:["BurstDamage"]},
   {selectedSpells:[spell],assumeMaxSpells:false}]){
   const result=optimizeBuild({...cfg,damage,currentLevels:{[id]:1},...evidence});
   assert.ok(result.protectedSkills.includes(id),id);
   assert.ok(result.levels[id]>=1,id);
   assert.ok(result.spent<=cfg.skillPoints,id);
  }
 }
});

test("unverified Twilight Gloom is still protected exactly once, even with missing selection",()=>{
 for(const evidence of [{},{selectedSpells:["TwilightFairy"]}]){
  const result=optimizeBuild({...cfg,damage:"Shadow Clone",
   currentLevels:{TwilightGatheringMultiCastSkill:1},...evidence});
  assert.equal(result.protectedSkills.filter(id=>id==="TwilightGatheringMultiCastSkill").length,1);
  assert.ok(result.levels.TwilightGatheringMultiCastSkill>=1);
  assert.equal(result.investmentAudit.protectedEntries.find(e=>e.id==="TwilightGatheringMultiCastSkill").reason,
   "twilight-gloom-target-activation-unverified");
 }
});

test("all eighteen routes use identical implicit and explicit unlock protection",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={...cfg,damage,gold,selectedSpells:["DualPet"],
   currentLevels:{DualPetMultiCast:1},skillPoints:500};
  const auto=optimizeBuild(settings);
  const explicit=optimizeBuild({...settings,minimums:{DualPetBoost:1}});
  assert.equal(auto.protectedSkills.includes("DualPetMultiCast"),false,damage+"/"+gold);
  assert.deepEqual(auto.levels,explicit.levels,damage+"/"+gold);
  assert.equal(auto.score,explicit.score);
 }
});
