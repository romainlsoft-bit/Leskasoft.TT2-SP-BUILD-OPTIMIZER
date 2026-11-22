import test from "node:test";
import assert from "node:assert/strict";
import {ATTACK_BUILD_TYPES,attackChannelEvidence,compareAttackChannels}
 from "../src/attack-channels.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild} from "../src/engine.js";
import {skillInfo} from "../vendor/skills.js";

test("attack channels cover all six builds and all 18 damage/gold pairings",()=>{
 assert.deepEqual([...ATTACK_BUILD_TYPES].sort(),[...DAMAGE_TYPES].sort());
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const levels=Object.fromEntries(Object.keys(skillInfo).map(id=>[id,1]));
  const report=attackChannelEvidence({damage,gold,maxStage:800000},levels);
  assert.equal(report.damage,damage);
  assert.equal(report.gold,gold);
  assert.equal(report.sourceDataVersion,"8.4.0");
  assert.ok(report.channels.length>=1);
  assert.ok(report.channels.some(x=>x.role==="normal"||x.role==="burst"));
  assert.equal(report.scoreChanged,false);
  assert.equal(report.stagePredictionValidated,false);
  for(const channel of report.channels){
   assert.ok(channel.skillId in skillInfo);
   assert.equal(channel.level,1);
   assert.ok(["source-eligible","unverified-spell-selection"].includes(channel.status));
   for(const field of [...channel.skip,...channel.mechanics,
     ...(channel.sourceDamageModifier?[channel.sourceDamageModifier]:[])]){
    assert.ok(field.skillId in skillInfo);
    assert.equal(skillInfo[field.skillId]["BonusType"+(field.sourceField==="BonusAmountD"?"D":field.sourceField[0])],field.sourceBonusType);
    assert.equal(field.level,1);
    assert.equal(field.status,"source-tabulated");
    assert.ok(Number.isFinite(field.value));
   }
  }
 }
});
test("attack channels never treat Stage Skip as a damage multiplier",()=>{
 const pet=attackChannelEvidence({damage:"Pet",gold:"Fairy",selectedSpells:["BurstDamage"]},
  {PetDmg:2,PetQTE:4,BossDmgQTE:3});
 const burst=pet.channels.find(x=>x.id==="lightning-burst");
 const charged=pet.channels.find(x=>x.id==="flash-zip-charged");
 assert.equal(burst.role,"burst");
 assert.equal(charged.role,"charged");
 assert.equal(burst.sourceDamageModifier.sourceBonusType,"PetAttackQTEDamage");
 assert.equal(charged.sourceDamageModifier.sourceBonusType,"PetBossQTEDamage");
 assert.equal(burst.skip.find(x=>x.kind==="stage").sourceBonusType,"PetQTEStageSkip");
 assert.equal(charged.skip.find(x=>x.kind==="stage").sourceBonusType,"PetAttackStageSkip");
 assert.equal(charged.mechanics[0].kind,"cooldown-multiplier");
 const clone=attackChannelEvidence({damage:"Shadow Clone"},
  {CloneDmg:1,CloneSkillBoost:1});
 assert.equal(clone.channels[0].mechanics[0].sourceField,"BonusAmountD");
 assert.equal(clone.channels[0].mechanics[0].value,.15);
 assert.equal(pet.sourceModifiersAreNotIndependentDps,true);
 assert.equal(pet.cooldownAndSkipNeverAddedToDamage,true);
 assert.equal(burst.actualActivationVerified,false);
});
test("attack channels require real spell evidence rather than assume selection",()=>{
 const chosen={damage:"Clan Ship",gold:"Fairy",
  selectedSpells:["ThunderVolley","BurstDamage"]};
 const equipped=attackChannelEvidence(chosen,{ClanShipVoltage:1});
 assert.equal(equipped.channels[1].spellStatus,"equipped");
 assert.ok(equipped.channels[1].sourceModifierLog10>0);
 const removed=attackChannelEvidence({...chosen,
  selectedSpells:["BurstDamage"]},{ClanShipVoltage:1});
 assert.equal(removed.channels[1].status,"spell-not-equipped");
 assert.equal(removed.channels[1].sourceModifierLog10,null);
 const unknown=attackChannelEvidence({damage:"Clan Ship"},
  {ClanShipVoltage:1});
 assert.equal(unknown.channels[1].status,"unverified-spell-selection");
 assert.equal(unknown.channels[1].sourceModifierLog10,null);
});
test("before/after attack evidence is source-specific and non-predictive",()=>{
 const before={PetQTE:1,BossDmgQTE:1,PetDmg:1};
 const after={PetQTE:5,BossDmgQTE:2,PetDmg:3};
 const diff=compareAttackChannels({damage:"Pet",gold:"Fairy"},before,after);
 const burst=diff.channels.find(x=>x.id==="lightning-burst");
 const zip=diff.channels.find(x=>x.id==="flash-zip-charged");
 assert.equal(burst.priorLevel,1);
 assert.equal(burst.level,5);
 assert.ok(burst.sourceDamageModifierLog10Delta>0);
 assert.ok(burst.skip.some(x=>x.kind==="stage"&&x.delta>=0));
 assert.ok(zip.skip.some(x=>x.kind==="stage"&&x.delta>=0));
 assert.equal(diff.stageGainPredicted,false);
});
test("source diagnostics remain bounded and reject inconsistent levels",()=>{
 assert.throws(()=>attackChannelEvidence({damage:"unknown"},{}),/Unknown damage/);
 assert.throws(()=>attackChannelEvidence({damage:"Pet"},{PetQTE:99}),/Invalid source attack level/);
 for(const damage of DAMAGE_TYPES){
  const empty=attackChannelEvidence({damage,gold:"Chesterson"},{});
  assert.ok(empty.channels.every(x=>x.status==="not-invested"));
  assert.ok(empty.channels.every(x=>x.sourceModifierLog10===null));
 }
});
test("every optimizer build embeds attack channels without adding them to the SP objective",()=>{
 for(const damage of DAMAGE_TYPES){
  const settings={damage,gold:"Fairy",goldWeight:.7,skillPoints:20,
   maxStage:800000,qol:"none",currentLevels:{},minimums:{}};
  const result=optimizeBuild(settings);
  assert.equal(result.attackChannels.damage,damage);
  assert.equal(result.attackChannelChanges.damage,damage);
  assert.equal(result.attackChannels.scoreChanged,false);
  assert.equal(result.attackChannelChanges.scoreChanged,false);
  assert.equal(result.modelAttribution.schema,"tt2-skill-model-attribution-v1");
  assert.equal(result.modelAttribution.optimizerScoreChanged,false);
  assert.equal(result.modelAttribution.additiveReconstructionMatches,true);
  assert.ok(Math.abs(result.modelAttribution.scoredTotalLog10-result.score)<=1e-7*Math.max(1,Math.abs(result.score)));
  assert.equal(result.modelAttribution.entries.length,
    Object.values(result.levels).filter(x=>x>0).length);
  assert.ok(result.optimality.upperBound>=result.score-1e-7);
 }
});
