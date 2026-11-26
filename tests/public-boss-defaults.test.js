import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {publicOptimizationSettings,modeledAstralOrbTaps}
 from "../src/public-optimization-policy.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {scoreAtLevel} from "../src/effects.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const retired=["push-attack-channel","push-stage-skip-target","push-frontier-enabled",
 "attack-damage-channel","attack-damage-frontier-enabled",
 "hayst-active","snap-active","astral-activations","coordinated-offensive-active",
 "flash-zip-at-boss","nightmare-at-boss","magnum-opus-at-boss",
 "exclude-unverified-tactical-insight","ti-cal-enabled","ti-cal-low-level",
 "ti-cal-high-level","ti-cal-low-damage","ti-cal-high-damage",
 "ti-cal-low-gold","ti-cal-high-gold"];

test("all four localized sites remove retired controls without removing manual skill editing",()=>{
 for(const page of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=read(page);
  for(const id of retired)assert.ok(!html.includes('id="'+id+'"'),page+": "+id);
  for(const id of ["skill-editor","protect-unmodeled-skills","preserve-current",
   "combat-assumptions-summary"]){
   assert.ok(html.includes('id="'+id+'"'),page+": "+id);
  }
 }
 const app=read("src/app.js");
 assert.doesNotMatch(app,/id="pet-compare"/);
 assert.doesNotMatch(app,/\$\("pet-compare"\)/);
 assert.match(app,/running\.postMessage\(\{type:"optimize",settings:requestContext\}\)/);
  assert.doesNotMatch(app,/type:compare\?/);
 for(const id of retired)assert.ok(!app.includes('$("'+id+'")'),"DOM reference "+id);
});

test("old URL and stored optional flags cannot override fixed public assumptions",()=>{
 const old={damage:"Pet",gold:"Fairy",skillPoints:22600,
  selectedDamagePet:"Pet1",selectedGoldPet:null,
  assumeHaystActive:false,assumeSnapActive:false,
  assumeCoordinatedOffensiveActive:false,assumeFlashZipAtBoss:false,
  assumeNightmareAtBoss:false,assumeMagnumOpusAtBoss:false,
  astralActivations:0,comparePetScenarios:true,
  tacticalInsightCalibration:{enabled:true,lowerLevel:1,upperLevel:2},
  excludeUnverifiedTacticalInsight:true,
  pushAttackChannelId:"lightning-burst",pushSourceStageSkipTarget:200,
  pushFrontierEnabled:true,attackDamageFrontierEnabled:true,
  attackDamageChannelId:"pet-qte"};
 const corrected=publicOptimizationSettings(old);
 for(const key of ["assumeHaystActive","assumeSnapActive",
  "assumeCoordinatedOffensiveActive","assumeFlashZipAtBoss",
  "assumeNightmareAtBoss","assumeMagnumOpusAtBoss"]){
  assert.equal(corrected[key],true,key);
 }
 assert.equal(corrected.astralActivations,5);
 assert.equal(corrected.comparePetScenarios,false);
 assert.equal(corrected.tacticalInsightCalibration,null);
 assert.equal(corrected.excludeUnverifiedTacticalInsight,false);
 assert.equal(corrected.pushAttackChannelId,"");
 assert.equal(corrected.pushSourceStageSkipTarget,0);
 assert.equal(corrected.pushFrontierEnabled,false);
 assert.equal(corrected.attackDamageFrontierEnabled,false);
 assert.equal(corrected.attackDamageChannelId,"");
 assert.equal(corrected.damage,"Pet");
 assert.equal(corrected.selectedDamagePet,"Pet1");
 assert.equal(old.assumeHaystActive,false,"do not mutate saved object");
});

test("five Astral orb taps are allowed only after purchasing Astral Awakening",()=>{
 assert.equal(modeledAstralOrbTaps({}),0);
 assert.equal(modeledAstralOrbTaps({HelperDmgQTE:0}),0);
 assert.equal(modeledAstralOrbTaps({HelperDmgQTE:1}),5);
 assert.equal(modeledAstralOrbTaps({HelperDmgQTE:30}),5);
 assert.equal(modeledAstralOrbTaps({HelperDmgQTE:1},2),2);
 assert.equal(modeledAstralOrbTaps({HelperDmgQTE:1},100),5);
 const basis={damage:"Pet",gold:"Fairy",goldWeight:.7};
 assert.equal(scoreAtLevel("HelperDmgQTE",0,{...basis,astralActivations:5}),0);
 const one=scoreAtLevel("HelperDmgQTE",5,{...basis,astralActivations:1});
 const five=scoreAtLevel("HelperDmgQTE",5,{...basis,astralActivations:5});
 assert.ok(one>0);
 assert.ok(Math.abs(five-5*one)<1e-8);
});

test("all 18 routes use the ideal-boss scenario and still produce a valid SP tree",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const cfg=publicOptimizationSettings({damage,gold,goldWeight:.7,
   skillPoints:100,qol:"none",sets:{},currentLevels:{},minimums:{},
   maxStage:180000});
  const result=optimizeBuild(cfg);
  assert.ok(Number.isFinite(result.score),damage+"/"+gold);
  assert.ok(result.spent<=100,damage+"/"+gold);
  assert.equal(result.modelAttribution.additiveReconstructionMatches,true);
  const a=result.combatAssumptions;
  for(const key of ["hayst","snap","coordinatedOffensive",
   "flashZipAtBoss","nightmareAtBoss","magnumOpusAtBoss"]){
   assert.equal(a[key],true,damage+"/"+gold+"/"+key);
  }
  assert.equal(a.astralActivations,modeledAstralOrbTaps(result.levels));
  assert.equal(a.actualBossUptimeVerified,false);
  assert.equal(result.pushSkipTarget.enabled,false);
 }
});

test("ideal boss flags are score-monotonic for source-correct skill contributions",()=>{
 const gated=[
  ["ClanQTE","assumeCoordinatedOffensiveActive"],
  ["BossDmgQTE","assumeFlashZipAtBoss"],
  ["PuppetMaster","assumeNightmareAtBoss"],
  ["MagnumOpus","assumeMagnumOpusAtBoss"],
  ["PhilosophersFlux","assumeSnapActive"],
  ["QuickFortune","assumeHaystActive"]
 ];
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const cfg={damage,gold,goldWeight:.7};
  for(const [skill,flag] of gated){
   const off=scoreAtLevel(skill,1,{...cfg,[flag]:false});
   const on=scoreAtLevel(skill,1,{...cfg,[flag]:true});
   assert.ok(Number.isFinite(off)&&Number.isFinite(on),damage+"/"+gold+"/"+skill);
   assert.ok(on+1e-10>=off,damage+"/"+gold+"/"+skill+" must be monotonic");
  }
 }
});

test("the public worker selects owned active pets without comparison mode",async()=>{
 const messages=[];
 globalThis.self={postMessage:msg=>messages.push(msg),onmessage:null};
 await import("../src/worker.js?public-ideal-boss-test=20261126");
 const profile=parseAccountProfile({petLevels:{
  Pet1:230,Pet7:230,Pet12:140,Pet20:140
 }});
 const settings=publicOptimizationSettings({accountProfile:profile,
  damage:"Pet",gold:"Fairy",goldWeight:.7,skillPoints:100,
  qol:"none",sets:{},currentLevels:{},minimums:{},maxStage:0});
 self.onmessage({data:{type:"optimize",settings:{
  ...settings,comparePetScenarios:true,assumeHaystActive:false}}});
 const response=messages.findLast(x=>x.ok!==undefined);
 assert.equal(response?.ok,true,response?.error);
 assert.ok(response.selectedPets.damage,"damage pet");
 assert.ok(response.selectedPets.gold,"gold pet");
 assert.equal(response.result.petSelection.comparedPairs,false);
 assert.equal(response.result.combatAssumptions.hayst,true);
 assert.equal(response.result.modeledScenario.selectedDamagePet,response.selectedPets.damage);
 assert.equal(response.result.modeledScenario.selectedGoldPet,response.selectedPets.gold);
 assert.deepEqual(response.petComparisons,{damage:[],gold:[]});
 assert.ok(!messages.some(x=>x.progress?.phase==="pet-scenarios"));
});
