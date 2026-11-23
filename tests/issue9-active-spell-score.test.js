import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints} from "../src/engine.js";
import {scoreAtLevel} from "../src/effects.js";
import {ACTIVE_SOURCE_SKILL_SPELLS,spellEffectScorable} from "../src/spell-scenarios.js";
import {skillInfo} from "../vendor/skills.js";
import {reductions} from "../vendor/reductions.js";

const settings=(damage="Pet",gold="Fairy",more={})=>({
 damage,gold,goldWeight:.7,skillPoints:500,maxStage:300000,
 qos:"none",qol:"none",currentLevels:{},minimums:{},...more
});
const nativeWeight=(id,damage,gold)=>
 Number(reductions[id]?.[damage]??0)+.7*Number(reductions[id]?.[gold]??0);

test("the seven active-spell source bonuses are not permanent skill damage",()=>{
 assert.deepEqual(Object.keys(ACTIVE_SOURCE_SKILL_SPELLS).sort(),[
  "Backstab","CritSkillBoostDmg","DualPetBoost","FireTapSkillBoost",
  "MidasSkillBoost","TwilightBell","TwilightGathering"].sort());
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const opts=settings(damage,gold,{selectedSpells:["ShadowClone"]});
  for(const id of Object.keys(ACTIVE_SOURCE_SKILL_SPELLS)){
   assert.equal(scoreAtLevel(id,5,opts),0,
    damage+"/"+gold+"/"+id+" absent active spell");
  }
 }
});

test("equipped and supported spells contribute their native A bonus without guessing uptime",()=>{
 const spells={
  FireTapSkillBoost:["TapBoost","Pet","Fairy",{}],
  CritSkillBoostDmg:["CritBoost","Dagger","Fairy",{}],
  Backstab:["CritBoost","Pet","Fairy",{}],
  TwilightGathering:["TwilightFairy","Shadow Clone","Fairy",{TwilightGathering:1}],
  TwilightBell:["TwilightFairy","Shadow Clone","Fairy",{TwilightGathering:1}],
  DualPetBoost:["DualPet","Pet","Fairy",{DualPetBoost:1}],
  MidasSkillBoost:["HandOfMidas","Pet","Fairy",{}]
 };
 for(const [id,[spell,damage,gold,minimums]] of Object.entries(spells)){
  const opts=settings(damage,gold,{selectedSpells:[spell],minimums});
  assert.equal(spellEffectScorable(spell,opts),true,id);
  const got=scoreAtLevel(id,5,opts);
  const native=nativeWeight(id,damage,gold)*
   Math.log10(Number(skillInfo[id].A5));
  assert.ok(got+1e-9>=native,id+" native gain at known slot");
  assert.ok(got>0,id+" positive observed score");
  assert.equal(scoreAtLevel(id,5,{...opts,assumeMaxSpells:false}),0,
   id+" unknown spell level cannot be treated as maximum");
 }
});

test("Coordinated Offensive is conditioned on active clanmate at the boss",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const opts=settings(damage,gold);
  assert.equal(scoreAtLevel("ClanQTE",5,opts),0);
  const enabled=scoreAtLevel("ClanQTE",5,
   {...opts,assumeCoordinatedOffensiveActive:true});
  const expected=nativeWeight("ClanQTE",damage,gold)*
   Math.log10(Number(skillInfo.ClanQTE.A5));
  assert.ok(Math.abs(enabled-expected)<1e-9);
 }
});

test("imported conditional skills remain protected even when inactive",()=>{
 for(const id of ["FireTapSkillBoost","Backstab","DualPetBoost","ClanQTE"]){
  const opts=settings("Pet","Fairy",{
   skillPoints:500,selectedSpells:["ShadowClone"],
   currentLevels:{[id]:1}
  });
  const solved=optimizeBuild(opts);
  assert.ok(solved.protectedSkills.includes(id),id);
  assert.ok(solved.levels[id]>=1,id);
  assert.ok(spentPoints(solved.levels)<=500,id);
  assert.ok(solved.investmentAudit.protectedEntries.some(x=>
   x.id===id&&x.protectedSp>0),id);
 }
});

test("eighteen damage/gold routes enforce budget and disclose all active spell gates",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const solved=optimizeBuild(settings(damage,gold));
  assert.ok(spentPoints(solved.levels)<=500);
  assert.equal(solved.modelAttribution.additiveReconstructionMatches,true);
  const audit=solved.modelAttribution.nativeConditionalScoringGuards;
  assert.equal(audit.coordinatedOffensiveActiveAssumed,false);
  for(const id of Object.keys(ACTIVE_SOURCE_SKILL_SPELLS))
   assert.equal(audit.sourceSpellScoringBySkill[id],false,damage+"/"+gold+"/"+id);
  assert.equal(solved.modelAttribution.gameplayCalibrationVerified,false);
 }
});

test("four localized pages, UI persistence, and summary show boss assumptions",()=>{
 for(const page of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=readFileSync(new URL("../"+page,import.meta.url),"utf8");
  assert.equal((html.match(/id="coordinated-offensive-active"/g)||[]).length,1,page);
  assert.ok(html.includes("src/app.js?v=20261123-ti-measured-r1"),page);
 }
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.match(app,/state\.assumeCoordinatedOffensiveActive=\$\("coordinated-offensive-active"\)\.checked/);
 assert.match(app,/co:state\.assumeCoordinatedOffensiveActive===true/);
 assert.match(app,/assumeCoordinatedOffensiveActive:payload\.co===true/);
});
