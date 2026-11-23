import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {skillInfo} from "../vendor/skills.js";
import {reductions} from "../vendor/reductions.js";
import {ACTIVE_SPELL_CAPS} from "../vendor/active-spell-caps.js";
import {MULTICAST_SKILL_SPELLS,multicastSkillEvidence}
 from "../src/spell-scenarios.js";
import {nativeMulticastSkillScore} from "../src/multicast-native-score.js";
import {scoreAtLevel} from "../src/effects.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints}
 from "../src/engine.js";

const settings=(damage="Pet",gold="Fairy",more={})=>({
 damage,gold,goldWeight:.7,skillPoints:300,maxStage:300000,
 currentLevels:{},minimums:{},qol:"none",sets:{},...more
});
const close=(x,y,label)=>assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&
 Math.abs(x-y)<=1e-9,label+": "+x+" vs "+y);
const ids=Object.keys(MULTICAST_SKILL_SPELLS);
const selectedContext=(id,damage,gold,rest={})=>{
 const spell=MULTICAST_SKILL_SPELLS[id];
 const required=ACTIVE_SPELL_CAPS[spell].required;
 return settings(damage,gold,{selectedSpells:[spell],
  minimums:required==="None"?{}:{[required]:1},...rest});
};

test("all ten source multicasts have per-stack A and stack-count B",()=>{
 assert.equal(ids.length,10);
 for(const id of ids){
  assert.ok(skillInfo[id].BonusTypeA.endsWith("StacksBonus"),id);
  assert.ok(skillInfo[id].BonusTypeB.endsWith("Stacks"),id);
  assert.equal(skillInfo[id].MaxLevel,3);
 }
 assert.equal(skillInfo.TwilightGatheringMultiCastSkill.BonusTypeC,
  "TwilightFairyGloomBonusDamage");
});
test("all ten multicast skills × 18 routes × three levels score ONLY source A times available charges",()=>{
 let cases=0;
 for(const id of ids)for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const ctx=selectedContext(id,damage,gold);
  const weight=Number(reductions[id]?.[damage]??0)+
   ctx.goldWeight*Number(reductions[id]?.[gold]??0);
  for(const level of [1,2,3]){
   const evidence=multicastSkillEvidence(id,level,ctx);
   assert.equal(evidence.modeled,true,id+"/"+damage+"/"+gold);
   const value=nativeMulticastSkillScore(id,level,evidence,weight);
   const expected=weight*evidence.modeledCharges*
    Math.log10(Number(skillInfo[id]["A"+level]));
   close(value.scoreLog10,expected,id+"/"+damage+"/"+gold+"/"+level);
   close(scoreAtLevel(id,level,ctx),expected,
    "solver "+id+"/"+damage+"/"+gold+"/"+level);
   assert.equal(value.excludedInventedTenfoldPerCharge,true);
   assert.equal(value.guessedOtherGoldExcluded,true);
   assert.equal(value.unverifiedSpecialCExcluded,true);
   assert.equal(value.activeUptimeVerified,false);
   cases++;
  }
 }
 assert.equal(cases,540);
});
test("all ten talents score zero when their actual spell is absent, inactive or no charges are available",()=>{
 for(const id of ids){
  const spell=MULTICAST_SKILL_SPELLS[id];
  const wrong=selectedContext(id,"Pet","Fairy",{
   selectedSpells:[spell==="BurstDamage"?"ShadowClone":"BurstDamage"]});
  const selected=selectedContext(id,"Pet","Fairy");
  assert.equal(scoreAtLevel(id,3,wrong),0,id+" not selected");
  assert.equal(scoreAtLevel(id,3,{...selected,assumeMaxSpells:false}),0,
   id+" max level not assumed");
  assert.equal(scoreAtLevel(id,3,{...selected,multicastAvailableCharges:{
   [spell]:0}}),0,id+" no available charges");
 }
});
test("source A is scalable; no invented Midas gold multiplier or Twilight Gloom special damage",()=>{
 const level=3,spell="HandOfMidas";
 for(const gold of GOLD_TYPES){
  const ctx=selectedContext("HandOfMidasMultiCastSkillBoost","Pet",gold);
  const evidence=multicastSkillEvidence("HandOfMidasMultiCastSkillBoost",level,ctx);
  const weight=.7*Number(reductions.HandOfMidasMultiCastSkillBoost[gold]);
  const expected=weight*evidence.modeledCharges*
   Math.log10(Number(skillInfo.HandOfMidasMultiCastSkillBoost.A3));
  close(scoreAtLevel("HandOfMidasMultiCastSkillBoost",level,ctx),
   expected,gold+" source Midas gold");
 }
 for(const damage of ["Shadow Clone","Heavenly Strike"]){
  const ctx=selectedContext("TwilightGatheringMultiCastSkill",damage,"Fairy");
  const row=skillInfo.TwilightGatheringMultiCastSkill;
  const evidence=multicastSkillEvidence("TwilightGatheringMultiCastSkill",3,ctx);
  const expected=evidence.modeledCharges*Math.log10(Number(row.A3));
  close(scoreAtLevel("TwilightGatheringMultiCastSkill",3,ctx),expected,
   damage+" excludes conditional Gloom C");
  assert.ok(Math.log10(Number(row.C3))>0);
 }
});
test("source-set multicast charge extension and observed cast limit are the only charge factors",()=>{
 const id="TapBoostMultiCastSkill",spell="TapBoost",level=3;
 const normal=selectedContext(id,"Pet","Fairy");
 const equipped={...normal,sets:{FB:true,FF:true}};
 const standard=multicastSkillEvidence(id,level,normal);
 const extended=multicastSkillEvidence(id,level,equipped);
 assert.equal(standard.modeledCharges,3);
 assert.equal(extended.modeledCharges,5);
 close(scoreAtLevel(id,level,equipped),
  scoreAtLevel(id,level,normal)*5/3,"two set charges");
 const limited={...equipped,multicastAvailableCharges:{[spell]:2}};
 const evidence=multicastSkillEvidence(id,level,limited);
 assert.equal(evidence.modeledCharges,2);
 close(scoreAtLevel(id,level,limited),
  scoreAtLevel(id,level,normal)*2/3,"explicit cast count");
});
test("optimizer protects imported Twilight multicast special Gloom effect; no invented score in its audit",()=>{
 const ctx=settings("Shadow Clone","Fairy",{
  skillPoints:800,maxStage:300000,
  selectedSpells:["TwilightFairy"],
  currentLevels:{TwilightGatheringMultiCastSkill:1},
  protectUnmodeledSkills:true
 });
 const result=optimizeBuild(ctx);
 assert.ok(result.protectedSkills.includes("TwilightGatheringMultiCastSkill"));
 assert.ok(result.levels.TwilightGatheringMultiCastSkill>=1);
 assert.ok(spentPoints(result.levels)<=800);
 const protectedRow=result.investmentAudit.protectedEntries
  .find(e=>e.id==="TwilightGatheringMultiCastSkill");
 assert.equal(protectedRow.reason,"twilight-gloom-target-activation-unverified");
 assert.equal(result.modelAttribution.nativeConditionalScoringGuards
  .multicastInventedTenfoldPerChargeRemoved,true);
 assert.equal(result.modelAttribution.nativeConditionalScoringGuards
  .multicastGuessedMidasGoldTableRemoved,true);
 assert.equal(result.modelAttribution.nativeConditionalScoringGuards
  .twilightGloomSpecialCNotScoredWithoutEvidence,true);
});
test("module identity, all localized entrypoints, and permanent ban on GitHub Actions",()=>{
 const files=["src/engine.js","src/worker.js","src/app.js",
  "src/tactical-insight-sensitivity.js","src/ti-alternative.js"];
 const source=Object.fromEntries(files.map(path=>[
  path,readFileSync(new URL("../"+path,import.meta.url),"utf8")]));
 const find=(src,file)=>src.match(new RegExp(file.replaceAll(".","\\.")+
  "\\?([^\\\"]+)"))?.[1];
 assert.equal(find(source["src/app.js"],"engine.js"),
  find(source["src/worker.js"],"engine.js"));
 assert.equal(find(source["src/engine.js"],"effects.js"),
  find(source["src/ti-alternative.js"],"effects.js"));
 assert.equal(find(source["src/engine.js"],"effects.js"),
  find(source["src/tactical-insight-sensitivity.js"],"effects.js"));
 const tag="20261123-multicast-no-guessed-x10-r1";
 assert.ok(source["src/engine.js"].includes(tag));
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.ok(html.includes("&amp;mc="+tag),path);
 }
 assert.equal(existsSync(new URL("../.github/workflows/",import.meta.url)),false);
});
