import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {scoreAtLevel} from "../src/effects.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES,spentPoints} from "../src/engine.js";
import {skillInfo} from "../vendor/skills.js";
import {reductions} from "../vendor/reductions.js";
import {resetAccountDependentOptions} from "../src/import-session-reset.js";

const cases=Object.freeze([
 {id:"BossDmgQTE",flag:"assumeFlashZipAtBoss",ui:"flash-zip-at-boss",
  source:"PetBossQTEDamage",name:"Flash Zip"},
 {id:"PuppetMaster",flag:"assumeNightmareAtBoss",ui:"nightmare-at-boss",
  source:"ShadowCloneSkillSpecialDamage",name:"Nightmare Puppeteer"},
 {id:"MagnumOpus",flag:"assumeMagnumOpusAtBoss",ui:"magnum-opus-at-boss",
  source:"MagnumOpusDamage",name:"Magnum Opus"}
]);
const base=(damage,gold,extra={})=>({
 damage,gold,skillPoints:500,maxStage:300000,goldWeight:.7,
 qol:"none",currentLevels:{},minimums:{},...extra
});
const weight=(id,settings)=>
 Number(reductions[id]?.[settings.damage]??0)+
 settings.goldWeight*Number(reductions[id]?.[settings.gold]??0);
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+" != "+b);

test("all three specialized boss sources match pinned Unity A bonus types",()=>{
 for(const spec of cases){
  const info=skillInfo[spec.id];
  assert.equal(info.BonusTypeA,spec.source);
  assert.ok(Number(info.A5)>1,spec.id);
 }
 assert.equal(skillInfo.PuppetMaster.BonusTypeB,"ShadowCloneSkillSpecialRate");
 assert.equal(skillInfo.BossDmgQTE.BonusTypeB,"PetQTECooldownMult");
 assert.equal(skillInfo.MagnumOpus.BonusTypeB,"GoldGunStageSkip");
});
test("18 damage/gold routes do not award temporary boss special damage by default",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const context=base(damage,gold);
  for(const spec of cases){
   assert.equal(scoreAtLevel(spec.id,5,context),0,damage+"/"+gold+"/"+spec.id);
   const enabled=scoreAtLevel(spec.id,5,{...context,[spec.flag]:true});
   approx(enabled,weight(spec.id,context)*
    Math.log10(Number(skillInfo[spec.id].A5)));
  }
 }
});
test("each explicit boss state only changes its own special source score",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const normal=base(damage,gold);
  for(const spec of cases){
   const active={...normal,[spec.flag]:true};
   for(const other of cases.filter(x=>x.id!==spec.id))
    assert.equal(scoreAtLevel(other.id,5,active),0,other.id);
   for(const id of ["PetQTE","PetDmg","GoldGun","CloneDmg","UltraDagger"]){
    assert.equal(scoreAtLevel(id,5,active),scoreAtLevel(id,5,normal),
     damage+"/"+gold+"/"+id);
   }
  }
 }
});
test("imported investments are protected when their boss special is unverified",()=>{
 for(const spec of cases){
  const damage=spec.id==="BossDmgQTE"?"Pet":
   spec.id==="PuppetMaster"?"Shadow Clone":"Gold Gun";
  const context=base(damage,"Fairy",{
   skillPoints:500,currentLevels:{[spec.id]:1}
  });
  const result=optimizeBuild(context);
  assert.ok(result.protectedSkills.includes(spec.id),spec.id);
  assert.ok(result.levels[spec.id]>=1,spec.id);
  assert.ok(spentPoints(result.levels)<=500,spec.id);
  assert.ok(result.investmentAudit.protectedEntries.some(e=>
   e.id===spec.id&&e.protectedSp>0),spec.id);
 }
});
test("solver budgets and stage-attribution safeguards hold across eighteen routes",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const result=optimizeBuild(base(damage,gold));
  assert.ok(spentPoints(result.levels)<=500,damage+"/"+gold);
  assert.equal(result.modelAttribution.additiveReconstructionMatches,true);
  const report=result.modelAttribution.nativeConditionalScoringGuards;
  assert.equal(report.flashZipChargedAtBossAssumed,false);
  assert.equal(report.nightmareSpecialAtBossAssumed,false);
  assert.equal(report.magnumOpusActiveAtBossAssumed,false);
  assert.equal(report.specialAttemptRateNeverCountedAsHitDamage,true);
  assert.equal(report.specialCooldownOpportunitiesNotAddedToDamageScore,true);
  assert.equal(result.modelAttribution.gameplayCalibrationVerified,false);
 }
});
test("special boss assumptions remain enabled when importing another account",()=>{
 const state={assumeFlashZipAtBoss:true,assumeNightmareAtBoss:true,
  assumeMagnumOpusAtBoss:true};
 resetAccountDependentOptions(state);
 for(const spec of cases)assert.equal(state[spec.flag],true,spec.flag);
});
test("all four languages hide the retired toggles and shared links cannot revive them",()=>{
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  for(const spec of cases)
   assert.equal((html.match(new RegExp('id="'+spec.ui+'"',"g"))||[]).length,0,
    path+"/"+spec.ui);
  assert.ok(html.includes("src/app.js?v=20261123-boss-specials-r1"));
 }
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 for(const spec of cases)
  assert.ok(!app.includes('state.'+spec.flag+'=$("'+spec.ui+'").checked'));
 for(const code of ["fz","nm","mo"])
  assert.doesNotMatch(app,new RegExp("payload\\."+code+"===true"));
});
