import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveTacticalInsightLocal,tacticalInsightLocalScore}
 from "../src/tactical-insight-local.js";
import {scoreAtLevel} from "../src/effects.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES,spentPoints} from "../src/engine.js";
import {skillInfo} from "../vendor/skills.js";

const calibration=(damage="Pet",gold="Fairy",more={})=>({
 enabled:true,damage,gold,
 lowerLevel:1,upperLevel:3,
 lowerDamage:"1.25e10000",upperDamage:"2.50e10000",
 lowerGold:"2e9500",upperGold:"4e9500",...more
});
const setting=(damage="Pet",gold="Fairy",more={})=>({
 damage,gold,goldWeight:.7,maxStage:300000,
 skillPoints:250,qol:"none",currentLevels:{},minimums:{},
 tacticalInsightCalibration:calibration(damage,gold),...more
});
const close=(x,y)=>assert.ok(Math.abs(x-y)<1e-8,x+" vs "+y);

test("measured Tactical Insight uses log-safe observations and both source bonus types",()=>{
 const s=setting();
 const meta=resolveTacticalInsightLocal(s);
 assert.equal(meta.enabled,true);
 assert.equal(meta.mode,"measured-local");
 assert.equal(meta.sourceAType,"HelperMultiplicativeSkillBoost");
 assert.equal(meta.sourceBType,"HelperAdditiveSkillBoost");
 close(meta.damageGainLog10,Math.log10(2));
 close(meta.goldGainLog10,Math.log10(2));
 close(tacticalInsightLocalScore(1,s),0);
 close(tacticalInsightLocalScore(3,s),Math.log10(2)*1.7);
 const a1=Math.log1p(Number(skillInfo.HelperBoost.A1));
 const a2=Math.log1p(Number(skillInfo.HelperBoost.A2));
 const a3=Math.log1p(Number(skillInfo.HelperBoost.A3));
 close(tacticalInsightLocalScore(2,s),
  ((a2-a1)/(a3-a1))*Math.log10(2)*1.7);
 assert.equal(meta.extrapolationAllowed,false);
 assert.equal(meta.gameplayCalibrationVerified,false);
});

test("outside the observed bracket score table clamps but solver never selects such a level",()=>{
 const s=setting();
 // Score-table requests include 0..MaxLevel even when the solver's hard
 // minimum and maximum exclude these values.
 close(tacticalInsightLocalScore(0,s),0);
 close(tacticalInsightLocalScore(30,s),tacticalInsightLocalScore(3,s));
 const r=optimizeBuild(s);
 assert.ok(r.levels.HelperBoost>=1&&r.levels.HelperBoost<=3);
 assert.ok(spentPoints(r.levels)<=250);
 assert.equal(r.modelAttribution.tacticalInsightMode,"measured-local");
 assert.equal(r.modelAttribution.tacticalInsightCommunityWeightExcluded,true);
 assert.equal(r.modelAttribution.gameplayCalibrationVerified,false);
 assert.equal(r.modelAttribution.tacticalInsightLocal.upperLevel,3);
 assert.equal(r.modelAttribution.additiveReconstructionMatches,true);
});

test("measured local score overrides community weight independently for 18 build/gold routes",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s=setting(damage,gold);
  const expected=Math.log10(2)*(1+.7);
  close(scoreAtLevel("HelperBoost",3,s),expected);
  const r=optimizeBuild(s);
  assert.ok(r.levels.HelperBoost>=1&&r.levels.HelperBoost<=3);
  assert.ok(spentPoints(r.levels)<=250);
  assert.equal(r.modelAttribution.tacticalInsightMode,"measured-local");
  assert.equal(r.modelAttribution.gameplayCalibrationVerified,false);
 }
});

test("reject invalid or contradictory measured comparisons without fallback",()=>{
 const s=setting();
 const fail=(more,pattern)=>assert.throws(()=>
  resolveTacticalInsightLocal(setting("Pet","Fairy",{
   tacticalInsightCalibration:calibration("Pet","Fairy",more)
  })),pattern);
 fail({lowerLevel:4,upperLevel:3},/upper calibration level/);
 fail({upperLevel:31},/source talent levels/);
 fail({lowerDamage:""},/lower damage/);
 fail({lowerDamage:"1e999",upperDamage:"1e998"},/identical conditions/);
 fail({lowerGold:"1e10",upperGold:"2e9"},/identical conditions/);
 fail({upperDamage:"1e40000000"},/upper damage/);
 assert.throws(()=>resolveTacticalInsightLocal({
  ...s,excludeUnverifiedTacticalInsight:true
 }),/either measured/);
 assert.throws(()=>resolveTacticalInsightLocal({
  ...s,gold:"HoG"
 }),/different damage\/gold/);
 assert.throws(()=>optimizeBuild({
  ...s,minimums:{HelperBoost:4}
 }),/cannot reach the required minimum/);
 assert.throws(()=>optimizeBuild({
  ...s,skillPoints:0
 }),/more SP than available/);
});

test("disabled calibration preserves existing community and exclusion policies",()=>{
 const base=setting("Pet","Fairy",{tacticalInsightCalibration:null});
 const normal=scoreAtLevel("HelperBoost",3,base);
 assert.ok(normal>0);
 close(scoreAtLevel("HelperBoost",3,{...base,excludeUnverifiedTacticalInsight:true}),0);
 assert.equal(resolveTacticalInsightLocal(base).enabled,false);
});

test("measured TI remains a pure calculation API, not a public setting",()=>{
 const ids=["ti-cal-enabled","ti-cal-low-level","ti-cal-high-level",
  "ti-cal-low-damage","ti-cal-high-damage","ti-cal-low-gold","ti-cal-high-gold"];
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  for(const id of ids)assert.ok(!html.includes('id="'+id+'"'),path+"/"+id);
 }
 const policy=readFileSync(new URL("../src/public-optimization-policy.js",import.meta.url),"utf8");
 assert.match(policy,/tacticalInsightCalibration:null/);
 assert.match(policy,/excludeUnverifiedTacticalInsight:false/);
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.doesNotMatch(app,/tiMeasurementOmitted:/);
 assert.doesNotMatch(app,/lowerDamage:state\.tacticalInsightCalibration\?\./);
});
