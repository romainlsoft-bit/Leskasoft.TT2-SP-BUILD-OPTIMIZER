import test from "node:test";
import assert from "node:assert/strict";
import {ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {parseAccountProfile,PROFILE_SECTION_NAMES} from "../src/account-profile.js";
import {computeArtifactEffect,isDirectBonusType} from "../src/account-artifacts.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {resourceResearchEvidence} from "../src/account-research-resources.js";
import {resolvePermanentSetPower} from "../src/account-permanent-sets.js";
import {resolveSpellCaps} from "../src/spell-caps.js";
import {optimizeBuild,DAMAGE_TYPES} from "../src/engine.js";

test("R Drunken Hammer's source TapDamage is applied once, reduced by build",()=>{
 const artifact=ARTIFACT_CATALOG.Artifact29;
 assert.equal(artifact.name,"Drunken Hammer");
 assert.equal(artifact.bonusType,"TapDamage");
 assert.equal(isDirectBonusType("TapDamage"),true);
 const p=parseAccountProfile({artifacts:[{id:"Artifact29",level:100,enchanted:false}]});
 const calculated=computeArtifactEffect(artifact,100,false);
 const power=extractFixedAccountPower(p);
 const row=power.entries.find(e=>e.system==="artifacts"&&e.id==="Artifact29");
 assert.ok(row,"Drunken Hammer is included in normalized scored entries");
 assert.ok(power.byType.TapDamage>0,
  "TapDamage enters the actual fixed-account scoring ledger");
 assert.ok(Math.abs(row.log10-calculated.log10)<1e-8);
 for(const damage of DAMAGE_TYPES){
  const settings={damage,gold:"Fairy",goldWeight:.7};
  const withTap=fixedAccountScore(power,settings);
  const without=fixedAccountScore({...power,byType:{...power.byType,TapDamage:0}},
   settings);
  assert.ok(withTap.damageLog10>=without.damageLog10);
  assert.ok(Number.isFinite(withTap.weightedLog10));
 }
});
test("R contradictory resource trees never pretend an exact zero or partial total",()=>{
 const p=parseAccountProfile({
  titanResearch:[{id:"2",level:3},{id:"6",level:1},{id:"6",level:1}],
  forbiddenResearch:[{id:"2",level:5},{id:"17",level:2}]
 });
 const evidence=resourceResearchEvidence(p);
 assert.equal(evidence.titanSouls.totalsVerifiable,false);
 assert.equal(evidence.titanSouls.bonusPerDay,null);
 assert.ok(evidence.entries.some(x=>x.id==="17"&&x.amount===20));
});
test("R optimizer exposes real per-rarity counted set effects without a second score",()=>{
 const profile=parseAccountProfile({
  equipmentSets:["Mech","Collector","Midas","Diamond","Blacksmith","Retaliator"],
  playerStats:{"Crafting Power":5}
 });
 const power=resolvePermanentSetPower(profile);
 const input={accountProfile:profile,damage:"Pet",gold:"Fairy",goldWeight:.7,
  skillPoints:0,qol:"none",sets:{},currentLevels:{},minimums:{},maxStage:0};
 const result=optimizeBuild(input);
 assert.equal(result.accountIntegration.permanentSetPower.countedEffectsApplied,
  power.countedEffectsApplied);
 assert.deepEqual(result.accountIntegration.permanentSetPower.ownedCounts,power.ownedCounts);
 assert.equal(result.accountIntegration.permanentSetPower.ownedRosterComplete,true);
 assert.equal(PROFILE_SECTION_NAMES.length,19);
 assert.equal(new Set(PROFILE_SECTION_NAMES).size,19);
 assert.equal(result.accountIntegration.releaseReady,false);
});
test("R source spell caps do not prove actual spell selection or uptime",()=>{
 const caps=resolveSpellCaps({maxStage:22000,sets:{tFA:true}},{TwilightBell:30});
 assert.equal(caps.spells.BurstDamage.cap,40);
 assert.equal(caps.spells.BurstDamage.tabulatedLevel,40);
 assert.equal(caps.complete,false);
 assert.equal(caps.activeStateVerified,false);
 assert.equal(caps.equippedSlotsVerified,false);
});
