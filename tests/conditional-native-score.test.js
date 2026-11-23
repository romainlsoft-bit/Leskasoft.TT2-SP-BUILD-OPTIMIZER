import test from "node:test";
import assert from "node:assert/strict";
import {scoreAtLevel} from "../src/effects.js";
import {spellEffectScorable,spellCapGainEligible} from "../src/spell-scenarios.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES,spentPoints} from "../src/engine.js";
import {skillInfo} from "../vendor/skills.js";

const base=(damage="Pet",gold="Fairy",extra={})=>({
 damage,gold,goldWeight:.7,skillPoints:150,maxStage:300000,
 currentLevels:{},minimums:{},qol:"none",...extra
});
const eq=(actual,expected,what)=>assert.ok(Math.abs(actual-expected)<1e-9,
 what+": "+actual+" versus "+expected);

test("Heroic Might is a War Cry effect, not unconditional hero damage",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const opts=base(damage,gold);
  assert.equal(scoreAtLevel("HelperDmgSkillBoost",5,opts),0);
  assert.equal(scoreAtLevel("HelperDmgSkillBoost",5,{
   ...opts,selectedSpells:["BurstDamage"]}),0);
  const active={...opts,selectedSpells:["HelperBoost"]};
  assert.equal(spellEffectScorable("HelperBoost",active),true);
  const modeled=scoreAtLevel("HelperDmgSkillBoost",5,active);
  const reduction=({
   "Clan Ship":1,"Shadow Clone":.6,"Heavenly Strike":.5,
   "Pet":.5,"Dagger":.5,"Gold Gun":.9
  })[damage];
  eq(modeled,reduction*Math.log10(Number(skillInfo.HelperDmgSkillBoost.A5)),
    damage+"/"+gold);
  assert.equal(scoreAtLevel("HelperDmgSkillBoost",5,{
   ...active,assumeMaxSpells:false}),0);
 }
});

test("Thunder Volley source multipliers require a confirmed active spell and special hit",()=>{
 const s=base("Clan Ship","Fairy");
 const level=5;
 const none=scoreAtLevel("ClanShipVoltage",level,s);
 assert.equal(none,0);
 const notEquipped=scoreAtLevel("ClanShipVoltage",level,{
  ...s,selectedSpells:["BurstDamage"],minimums:{ClanShipVoltage:1}
 });
 assert.equal(notEquipped,0);
 const selected={...s,selectedSpells:["ThunderVolley"],
  minimums:{ClanShipVoltage:1}};
 assert.equal(spellEffectScorable("ThunderVolley",selected),true);
 eq(scoreAtLevel("ClanShipVoltage",level,selected),
  Math.log10(Number(skillInfo.ClanShipVoltage.A5)),"Thunder Volley standard");
 eq(scoreAtLevel("ClanShipVoltage",level,{
  ...selected,assumeThunderVolleySpecialHit:true
 }),Math.log10(Number(skillInfo.ClanShipVoltage.A5))+
    Math.log10(Number(skillInfo.ClanShipVoltage.B5)),"Thunder Volley special");
 assert.equal(spellEffectScorable("ThunderVolley",{
  ...selected,minimums:{}}),false);
 assert.equal(spellCapGainEligible("ClanShipVoltageMultiCastSkill",
  "ThunderVolley",selected),false);
});

test("Weakpoint Throw uses distinct Stream of Blades and target-mark mechanics",()=>{
 const s=base("Dagger","Fairy");
 assert.equal(scoreAtLevel("CriticalHit",5,s),0);
 const equipped={...s,selectedSpells:["StreamOfBlades"],
  minimums:{CriticalHit:1}};
 eq(scoreAtLevel("CriticalHit",5,equipped),
  Math.log10(Number(skillInfo.CriticalHit.A5)),"Stream of Blades");
 const marked={...s,assumeDaggerTargetMarked:true};
 eq(scoreAtLevel("CriticalHit",5,marked),
  Math.log10(Number(skillInfo.CriticalHit.B5)),"marked target");
 eq(scoreAtLevel("CriticalHit",5,{
  ...equipped,assumeDaggerTargetMarked:true
 }),Math.log10(Number(skillInfo.CriticalHit.A5))+
    Math.log10(Number(skillInfo.CriticalHit.B5)),
  "both distinct effects");
 assert.equal(scoreAtLevel("CriticalHit",5,{
  ...equipped,assumeMaxSpells:false}),0);
});

test("Searing Light inspired count never becomes another unconditional multiplier",()=>{
 const s=base("Clan Ship","Fairy");
 assert.equal(scoreAtLevel("HelperInspiredWeaken",7,s),0);
 const x=scoreAtLevel("HelperInspiredWeaken",7,{
  ...s,assumeInspiredHelpersActive:true
 });
 eq(x,Math.log10(Number(skillInfo.HelperInspiredWeaken.A7)),
   "only active sourced inspired damage");
});

test("Shadow Clone rate no longer assumes 4 attacks per second",()=>{
 const s=base("Shadow Clone","Fairy");
 for(const level of [1,5,20,40,60]){
  const score=scoreAtLevel("CloneDmg",level,s);
  eq(score,Math.log10(Number(skillInfo.CloneDmg["A"+level])),
    "native clone damage at level "+level);
 }
});

test("unmeasured conditional talents imported by a player are preserved",()=>{
 for(const id of ["HelperDmgSkillBoost","HelperInspiredWeaken",
                  "ClanShipVoltage","CriticalHit"]){
  const s=base("Pet","Fairy",{
   skillPoints:300,currentLevels:{[id]:1}
  });
  const result=optimizeBuild(s);
  assert.ok(result.protectedSkills.includes(id),id);
  assert.ok(result.levels[id]>=1,id);
  assert.ok(spentPoints(result.levels)<=300,id);
  assert.ok(result.investmentAudit.protectedEntries.some(e=>e.id===id),id);
 }
});

test("native gating does not change budgets or source requirements across 18 routes",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const r=optimizeBuild(base(damage,gold));
  assert.ok(spentPoints(r.levels)<=150,damage+"/"+gold);
  assert.equal(r.modelAttribution.additiveReconstructionMatches,true);
  assert.equal(r.modelAttribution.gameplayCalibrationVerified,false);
  const guards=r.modelAttribution.nativeConditionalScoringGuards;
  assert.equal(guards.warCryScoredOnlyWhenSelected,false);
  assert.equal(guards.thunderVolleyScoredOnlyWhenSelected,false);
  assert.equal(guards.streamOfBladesScoredOnlyWhenSelected,false);
  assert.equal(guards.heroInspiredCountNotMultipliedIntoDamage,true);
  assert.equal(guards.shadowCloneAttackRateNotConvertedToDamage,true);
  assert.equal(guards.verifiedRealStageImprovement,false);
 }
});
