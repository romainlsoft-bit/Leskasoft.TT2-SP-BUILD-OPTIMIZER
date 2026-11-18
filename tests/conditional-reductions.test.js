import {test} from "node:test";
import assert from "node:assert/strict";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild} from "../src/engine.js";
import {skillInfo} from "../vendor/skills.js";
import {scoreAtLevel} from "../src/effects.js";
import {conditionalSkillEvidence,CONDITIONAL_SKILL_SOURCES}
 from "../src/conditional-skill-evidence.js";
const base={goldWeight:.7,sets:{},minimums:{},currentLevels:{},
 maxStage:15000,craftingPower:1,timeToKill:8,sClone:30,qol:"none"};

test("TT2 8.4 Unity metadata identifies four nonpassive sources",()=>{
 const expected={
  ClanShipStun:"ClanShipStunDamage",
  BossTimer:"ShadowCloneAllSkillBoost",
  PoisonedBlade:"UltraDaggerPoisonBoost",
  KratosSummon:"KratosMonsterBonusAmount"
 };
 for(const [id,type] of Object.entries(expected)){
  assert.equal(skillInfo[id].BonusTypeA,type);
  assert.equal(CONDITIONAL_SKILL_SOURCES[id].primary,type);
 }
});

test("unverified conditional damage is excluded across all 18 scenarios",()=>{
 let checked=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={...base,damage,gold};
  for(const id of Object.keys(CONDITIONAL_SKILL_SOURCES)){
   const max=Number(skillInfo[id].MaxLevel);
   for(const n of new Set([0,1,Math.floor(max/2),max])){
    assert.equal(scoreAtLevel(id,n,settings),0,
     damage+"/"+gold+"/"+id+"/"+n);
    checked++;
   }
  }
 }
 assert.equal(checked,18*4*4);
});

test("explicit stunned-boss assumption is isolated and never implicit",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={...base,damage,gold,assumeBossStunned:true};
  const level=20;
  const expected=Math.log10(Number(skillInfo.ClanShipStun.A20)/
   Number(skillInfo.ClanShipStun.A0||1));
  const actual=scoreAtLevel("ClanShipStun",level,settings);
  assert.ok(Math.abs(actual-expected)<1e-8,damage+"/"+gold);
  assert.equal(scoreAtLevel("PoisonedBlade",level,settings),0);
  assert.equal(scoreAtLevel("BossTimer",level,settings),0);
  assert.equal(scoreAtLevel("KratosSummon",level,settings),0);
 }
});

test("conditional talent evidence reports raw source, not fictitious score",()=>{
 const levels={ClanShipStun:20,BossTimer:10,
  PoisonedBlade:10,KratosSummon:10};
 const x=conditionalSkillEvidence(levels,{});
 assert.equal(x.recognized,4);
 assert.equal(x.unverified,4);
 assert.equal(x.rows.find(y=>y.id==="PoisonedBlade").sourceAmount,
  skillInfo.PoisonedBlade.A10);
 assert.equal(x.rows.every(y=>!y.appliedToSkillScore),true);
 const scenario=conditionalSkillEvidence(levels,{assumeBossStunned:true});
 assert.equal(scenario.unverified,3);
 assert.equal(scenario.rows.find(y=>y.id==="ClanShipStun").appliedToSkillScore,true);
 assert.equal(scenario.fullActivationKnown,false);
});

test("solver publishes condition diagnostics; SP score remains finite",()=>{
 const out=optimizeBuild({...base,skillPoints:120,
  damage:"Clan Ship",gold:"Fairy"});
 assert.ok(out.conditionalSkills);
 assert.ok(Number.isFinite(out.score));
 assert.equal(out.conditionalSkills.addedToFixedAccountScore,false);
});
