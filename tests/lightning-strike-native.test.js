import {test} from "node:test";
import assert from "node:assert/strict";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild} from "../src/engine.js";
import {scoreAtLevel} from "../src/effects.js";
import {lightningStrikeSkillScore,lightningStrikeEvidence}
 from "../src/lightning-strike-evidence.js";
import {skillInfo} from "../vendor/skills.js";

const options={sets:{},goldWeight:0.7,craftingPower:1,
 timeToKill:8,sClone:30};
test("Native source IDs 329/330/331 cannot imply an observed proc rate",()=>{
 const x=lightningStrikeEvidence({CritSkillBoost:10},options);
 assert.equal(x.sourceOnlyScenario,false);
 assert.equal(x.status,"missing-observed-lightning-strike-count");
 assert.equal(x.countInferredFromShadowClone,false);
 assert.equal(x.modeledScoreLog10,0);
 assert.equal(x.actualUptimeVerified,false);
});
test("No invented 0.022*clone*kill-time gain across all 18 routes",()=>{
 let count=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={...options,damage,gold};
  for(const level of [0,1,15,30]){
   assert.equal(scoreAtLevel("CritSkillBoost",level,settings),0);
   count++;
  }
  const withClone={...settings,craftingPower:30,
   sClone:35,timeToKill:100000};
  assert.equal(scoreAtLevel("CritSkillBoost",30,withClone),0);
 }
 assert.equal(count,72);
});
test("Opt-in source-only hit count reproduces compounding boss-HP fractions",()=>{
 const level=1,source=skillInfo.CritSkillBoost;
 const a=Number(source.A1),b=Number(source.B1);
 const opts={...options,assumeSourceOnlyLightningStrike:true,
  lightningStrikeHits:3};
 const expected=-[a,a*b,a*b*b].reduce((sum,p)=>sum+Math.log10(1-p),0);
 assert.ok(Math.abs(lightningStrikeSkillScore(level,opts)-expected)<1e-12);
 const x=lightningStrikeEvidence({CritSkillBoost:level},opts);
 assert.equal(x.hitsAssumed,3);
 assert.equal(x.status,"explicit-unverified-hit-scenario");
 assert.equal(x.predictsStageGain,false);
});
test("Out-of-range source values or hit counts never invent an effect",()=>{
 assert.throws(()=>lightningStrikeSkillScore(-1,{}),/level/);
 assert.equal(lightningStrikeSkillScore(20,{...options,
  assumeSourceOnlyLightningStrike:true,lightningStrikeHits:NaN}),0);
 assert.equal(lightningStrikeSkillScore(20,{...options,
  assumeSourceOnlyLightningStrike:true,lightningStrikeHits:-1}),0);
 assert.equal(lightningStrikeSkillScore(20,{...options,
  assumeSourceOnlyLightningStrike:true,lightningStrikeHits:2001}),0);
});
test("Existing Lightning Strike investment is protected by default",()=>{
 const result=optimizeBuild({...options,damage:"Pet",gold:"Fairy",
  skillPoints:130,qol:"none",minimums:{},currentLevels:{CritSkillBoost:1},
  protectUnmodeledSkills:true,maxStage:15000});
 assert.ok(result.levels.CritSkillBoost>=1);
 assert.equal(result.lightningStrike.actualUptimeVerified,false);
 assert.equal(result.lightningStrike.sourceOnlyScenario,false);
});
