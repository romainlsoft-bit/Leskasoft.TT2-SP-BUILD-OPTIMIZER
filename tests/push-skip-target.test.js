import test from "node:test";
import assert from "node:assert/strict";
import {ATTACK_BUILD_TYPES,sourcedStageSkipChannels}
 from "../src/attack-channels.js";
import {stageSkipAtLevel,resolvePushSkipTarget,verifyPushSkipTarget}
 from "../src/push-skip-target.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints}
 from "../src/engine.js";
import {skillInfo} from "../vendor/skills.js";
import {readFileSync} from "node:fs";

test("source-only attack Stage Skip targets exist for all 18 build/gold combinations",()=>{
 assert.deepEqual([...ATTACK_BUILD_TYPES].sort(),[...DAMAGE_TYPES].sort());
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const channels=sourcedStageSkipChannels(damage);
  assert.ok(channels.length>0,damage);
  for(const channel of channels){
   const info=skillInfo[channel.sourceSkillId];
   assert.equal(info["BonusType"+channel.sourceColumn],channel.sourceBonusType);
   assert.match(channel.sourceBonusType,/StageSkip/);
  }
  const channel=channels[0];
  const first=Array.from({length:skillInfo[channel.sourceSkillId].MaxLevel},
   (_,i)=>i+1).find(lvl=>
    stageSkipAtLevel(channel.sourceSkillId,channel.sourceColumn,lvl)>0);
  assert.ok(first>0,damage);
  const target=stageSkipAtLevel(channel.sourceSkillId,channel.sourceColumn,first);
  const request=resolvePushSkipTarget({damage,gold,pushAttackChannelId:channel.id,
   pushSourceStageSkipTarget:target,maxStage:800000});
  assert.equal(request.damage,damage);
  assert.equal(request.gold,gold);
  assert.ok(request.requiredLevel>0);
  assert.ok(request.sourceValueAtRequiredLevel>=target);
  assert.equal(request.includesGlobalStageSkip,false);
  assert.equal(request.stageGainPredicted,false);
  assert.equal(request.optimizerScoreAltered,false);
  assert.deepEqual(Object.keys(request.requiredLevels),[channel.sourceSkillId]);
  assert.equal(verifyPushSkipTarget(request,{
   [channel.sourceSkillId]:request.requiredLevel}).satisfied,true);
 }
});
test("push target rejects impossible levels, invalid attack and unsupported guesses",()=>{
 assert.equal(resolvePushSkipTarget({damage:"Pet",pushSourceStageSkipTarget:0}).enabled,false);
 assert.equal(resolvePushSkipTarget({damage:"Pet",pushSourceStageSkipTarget:""}).enabled,false);
 assert.throws(()=>resolvePushSkipTarget({damage:"Pet",pushSourceStageSkipTarget:1}),
  /Select an attack channel/);
 assert.throws(()=>resolvePushSkipTarget({damage:"Dagger",pushAttackChannelId:"lightning-burst",pushSourceStageSkipTarget:1}),
  /Select an attack channel/);
 assert.throws(()=>resolvePushSkipTarget({damage:"Pet",pushAttackChannelId:"lightning-burst",
  pushSourceStageSkipTarget:"2.5"}),/integer/);
 assert.throws(()=>resolvePushSkipTarget({damage:"Pet",pushAttackChannelId:"lightning-burst",
  pushSourceStageSkipTarget:10000}),/source maximum/);
 assert.throws(()=>stageSkipAtLevel("PetQTE","C",-1),/level/);
 assert.throws(()=>stageSkipAtLevel("PetQTE","C",500),/level/);
 assert.throws(()=>stageSkipAtLevel("PetQTE","D",1),/definition/);
});
test("verified spell loadout excludes missing spell but unknown spell state is honest",()=>{
 assert.throws(()=>resolvePushSkipTarget({damage:"Clan Ship",gold:"Fairy",
  selectedSpells:["BurstDamage"],
  pushAttackChannelId:"thunder-volley",pushSourceStageSkipTarget:1}),
  /not equipped/);
 const known=resolvePushSkipTarget({damage:"Clan Ship",gold:"Fairy",
  selectedSpells:["ThunderVolley"],pushAttackChannelId:"thunder-volley",
  pushSourceStageSkipTarget:1});
 assert.equal(known.spellLoadoutEvidence,"equipped");
 const unknown=resolvePushSkipTarget({damage:"Clan Ship",gold:"Fairy",
  pushAttackChannelId:"thunder-volley",pushSourceStageSkipTarget:1});
 assert.equal(unknown.spellLoadoutEvidence,"unverified");
 assert.equal(unknown.unconditionalActivationProven,false);
});
test("all six damage builds preserve source floors while optimizing remaining SP",()=>{
 for(const damage of DAMAGE_TYPES){
  const channel=sourcedStageSkipChannels(damage)[0];
  const req={damage,gold:"Fairy",goldWeight:.7,skillPoints:150,
   maxStage:800000,qol:"none",currentLevels:{},minimums:{},
   pushAttackChannelId:channel.id,pushSourceStageSkipTarget:1};
  const result=optimizeBuild(req);
  const audit=result.pushSkipTarget;
  assert.equal(audit.enabled,true);
  assert.equal(audit.satisfied,true);
  assert.ok(audit.actualSourceStageSkip>=1);
  assert.ok(result.levels[audit.sourceSkillId]>=audit.requiredLevel);
  assert.ok(spentPoints(result.levels)<=150);
  assert.equal(result.attackChannels.damage,damage);
  assert.equal(result.modelAttribution.additiveReconstructionMatches,true);
  assert.ok(result.optimality.upperBound>=result.score-1e-8);
 }
});
test("the default unrequested target remains disabled on every gold source",()=>{
 for(const gold of GOLD_TYPES){
  const basic={damage:"Pet",gold,skillPoints:20,maxStage:800000,
   goldWeight:.7,qol:"none",currentLevels:{},minimums:{}};
  const plain=optimizeBuild(basic);
  const disabled=optimizeBuild({...basic,pushAttackChannelId:"lightning-burst",
    pushSourceStageSkipTarget:0});
  assert.equal(plain.pushSkipTarget.enabled,false);
  assert.equal(disabled.pushSkipTarget.enabled,false);
  assert.deepEqual(plain.levels,disabled.levels);
  assert.equal(plain.score,disabled.score);
 }
});
test("higher requested source Stage Skip cannot silently count unverified globals",()=>{
 const base={damage:"Pet",gold:"Fairy",
  pushAttackChannelId:"lightning-burst",pushSourceStageSkipTarget:14};
 const target=resolvePushSkipTarget(base);
 assert.equal(target.sourceBonusType,"PetQTEStageSkip");
 assert.equal(target.sourceSkillId,"PetQTE");
 assert.ok(target.sourceValueAtRequiredLevel>=14);
 assert.equal(target.includesGlobalStageSkip,false);
 assert.equal(target.realBossKillVerified,false);
 assert.throws(()=>verifyPushSkipTarget(target,{PetQTE:0}),/unmet source Stage Skip target/);
});

test("public UI removes Stage Skip targets but keeps the diagnostic code",()=>{
 const root=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const version=root.match(/src\/app\.js\?v=([A-Za-z0-9_-]+)/)?.[1];
 assert.ok(version);
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.doesNotMatch(html,/id="push-attack-channel"/);
  assert.doesNotMatch(html,/id="push-stage-skip-target"/);
  assert.ok(html.includes("app.js?v="+version));
 }
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
 assert.doesNotMatch(app,/function renderPushStageSkipOptions/);
 const view=readFileSync(new URL("../src/result-details-ui.js",import.meta.url),"utf8");
  assert.doesNotMatch(view,/function renderPushSkipComparison\(result\)/);
  assert.doesNotMatch(app,/renderPushSkipComparison\(result\)/);
  assert.match(app,/createResultDetailRenderers/);
 assert.match(worker,/const withPushComparison=\(choice,selected\)=>/);
});
test("the generic benchmark script can exercise constrained full build matrices",()=>{
 const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
 const benchmark=readFileSync(
  new URL("../scripts/benchmark-22k.mjs",import.meta.url),"utf8");
 assert.match(pkg.scripts["bench:push"],/--all --sp 22600 --push-source-skip/);
 assert.match(benchmark,/pushSourceSkip\?1:0/);
 assert.match(benchmark,/assert\.equal\(result\.pushSkipTarget\.satisfied,true\)/);
});
