import test from "node:test";
import assert from "node:assert/strict";
import {simulateBossCombatWindow,compareMeasuredBossWindows,log10Add}
 from "../src/boss-combat-window.js";
import {attackChannelEvidence} from "../src/attack-channels.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild}
 from "../src/engine.js";

test("log-space hit accumulation handles huge TT2 exponents",()=>{
 assert.equal(log10Add(-Infinity,10000),10000);
 assert.ok(Math.abs(log10Add(30000,30000)-(30000+Math.log10(2)))<1e-10);
 assert.equal(log10Add(30000,1),30000);
 assert.throws(()=>log10Add(Infinity,1),/Invalid logarithmic/);
});

test("all 18 damage/gold pairs can evaluate an explicitly measured attack window",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const source=attackChannelEvidence({damage,gold},{}).channels
   .find(c=>c.role!=="charged");
  const levels={[source.skillId]:1};
  const settings={damage,gold,maxStage:1000,
   selectedSpells:source.requiredSpell?[source.requiredSpell]:[]};
  const result=simulateBossCombatWindow(settings,levels,{
   enabled:true,stage:1000,windowSeconds:30,
   events:[{channelId:source.id,second:1,damage:"1e1000"}]
  });
  assert.equal(result.status,"simulated-explicit-events",damage+" "+gold);
  assert.equal(result.build,damage);
  assert.equal(result.gold,gold);
  assert.equal(result.hitsProvided,1);
  assert.equal(result.robustKillWithUnmodifiedHp,true);
  assert.equal(result.firstKillByHpRoll.max.second,1);
  assert.equal(result.firstKillByHpRoll.max.winningAttack,source.id);
  assert.equal(result.predictsInGameStages,false);
  assert.equal(result.affectsOptimization,false);
  assert.equal(result.sourceStageSkipNeverAddedToDamage,true);
 }
});

test("several weaker attacks accumulate then the actual killing hit owns Stage Skip",()=>{
 const levels={PetDmg:1,PetQTE:3,BossDmgQTE:3};
 const scenario={enabled:true,stage:1000,windowSeconds:30,events:[
  {channelId:"pet-attack",second:0,damage:"1e67",count:2},
  {channelId:"pet-attack",second:1,damage:"1e67",count:2},
  {channelId:"lightning-burst",second:3,damage:"1e70"}
 ]};
 const result=simulateBossCombatWindow({damage:"Pet",gold:"Fairy",maxStage:1000},levels,scenario);
 assert.equal(result.status,"simulated-explicit-events");
 assert.equal(result.firstKillByHpRoll.max.second,3);
 assert.equal(result.firstKillByHpRoll.max.winningAttack,"lightning-burst");
 assert.ok(result.firstKillByHpRoll.max.stageSkipSources.some(x=>
  x.bonusType==="PetQTEStageSkip"));
 assert.equal(result.events[0].count,2);
 assert.equal(result.events[2].cumulativeDamageLog10>result.events[1].cumulativeDamageLog10,true);
 assert.equal(result.assumptions.allAttacksAndHitCountsCovered,false);
});

test("an unverified spell cannot be used as though equipped",()=>{
 const levels={BurstSkillBoost:1};
 const settings={damage:"Heavenly Strike",gold:"Fairy",maxStage:1000};
 const scenario={enabled:true,windowSeconds:30,
  events:[{channelId:"heavenly-strike",second:0,damage:"1e200"}]};
 assert.match(simulateBossCombatWindow(settings,levels,scenario).reason,
  /attack-availability-unverified/);
 const ok=simulateBossCombatWindow({...settings,
  selectedSpells:["BurstDamage"]},levels,scenario);
 assert.equal(ok.status,"simulated-explicit-events");
});

test("charged state cannot be a killing event or create Stage Skip",()=>{
 const result=simulateBossCombatWindow({damage:"Pet",gold:"Fairy",maxStage:1000},
  {BossDmgQTE:5},{enabled:true,windowSeconds:10,
   events:[{channelId:"flash-zip-charged",second:1,damage:"1e999"}]});
 assert.equal(result.reason,"charged-state-is-not-a-hit");
});

test("one-hit observed damage never implies repeat frequency or bonus",()=>{
 const a=simulateBossCombatWindow({damage:"Pet",maxStage:1000},
  {PetDmg:1},{enabled:true,windowSeconds:30,
   events:[{channelId:"pet-attack",second:0,damage:"1e67"}]});
 const b=simulateBossCombatWindow({damage:"Pet",maxStage:1000},
  {PetDmg:1},{enabled:true,windowSeconds:30,
   events:[{channelId:"pet-attack",second:0,damage:"1e67",count:100}]});
 assert.equal(a.killWithNominalUnmodifiedHp,false);
 assert.equal(b.killWithNominalUnmodifiedHp,true);
 assert.equal(a.events.length,1);
 assert.equal(b.events.length,1);
 assert.equal(b.hitsProvided,100);
 assert.equal(a.appliedContractBonusEvents,0);
});

test("contract ramp uses existing native mana simulator, not maximum always-on",()=>{
 const settings={damage:"Pet",gold:"Fairy",maxStage:1000};
 const levels={PetDmg:1,ForbiddenContract:1};
 const events=[0,1,2].map(second=>({
  channelId:"pet-attack",second,damage:"1e68"
 }));
 const scenario={enabled:true,windowSeconds:4,events,
  damageExcludesContractEffects:true,
  contractMana:{enabled:true,startingMana:0,manaCapacity:100,
   passiveRegenPerSecond:0,freeTicks:{ForbiddenContract:2}}};
 const output=simulateBossCombatWindow(settings,levels,scenario);
 assert.equal(output.status,"simulated-explicit-events");
 assert.equal(output.manaTimeline.simulatedActiveSeconds,2);
 assert.equal(output.manaTimeline.firstUnfundedSecond,2);
 assert.ok(output.events[0].contractHypothesisLog10>0);
 assert.ok(output.events[1].contractHypothesisLog10>0);
 assert.equal(output.events[2].contractHypothesisLog10,0);
 assert.equal(output.appliedContractBonusEvents,2);
 const unresolved=simulateBossCombatWindow(settings,levels,{
  ...scenario,damageExcludesContractEffects:false
 });
 assert.equal(unresolved.reason,"contract-hit-damage-baseline-not-confirmed");
});
test("unfunded mana and hypothetical Pact cannot be mistaken for a verified proc",()=>{
 const settings={damage:"Pet",maxStage:1000};
 const a=simulateBossCombatWindow(settings,{PetDmg:1},{enabled:true,
  windowSeconds:3,events:[{channelId:"pet-attack",second:0,damage:"1e75"}],
  assumeFullPactDuringFundedTicks:true});
 assert.equal(a.reason,"pact-needs-explicit-mana-timeline");
 const b=simulateBossCombatWindow(settings,{PetDmg:1,ForbiddenContract:1},
  {enabled:true,windowSeconds:3,
   events:[{channelId:"pet-attack",second:0,damage:"1e75"}],
   damageExcludesContractEffects:true,
   contractMana:{enabled:true,startingMana:0,manaCapacity:10,
    passiveRegenPerSecond:0,freeTicks:{}}});
 assert.match(b.reason,/invalid-contract-mana-timeline/);
});
test("invalid hit sequences are rejected, not silently normalized",()=>{
 const settings={damage:"Pet",gold:"Fairy",maxStage:1000};
 const levels={PetDmg:1};
 const calc=events=>simulateBossCombatWindow(settings,levels,{
  enabled:true,windowSeconds:30,events});
 for(const row of [
  {channelId:"pet-attack",second:30,damage:"1e100"},
  {channelId:"pet-attack",second:-1,damage:"1e100"},
  {channelId:"pet-attack",second:0,damage:"NaN"},
  {channelId:"heavenly-strike",second:0,damage:"1e100"},
  {channelId:"pet-attack",second:0,count:0,damage:"1e100"}
 ])assert.throws(()=>calc([row]));
 assert.equal(calc([]).reason,"explicit-attack-events-required");
});

test("only independently measured build windows may be compared",()=>{
 const settings={damage:"Pet",gold:"Fairy",maxStage:1000};
 const candidate=(id,damage,second)=>({id,settings,levels:{PetDmg:1},
  scenario:{enabled:true,windowSeconds:30,stage:1000,
   events:[{channelId:"pet-attack",second,damage}]}});
 const ranking=compareMeasuredBossWindows([
  candidate("fast","1e100",1),candidate("slow","1e100",6)
 ]);
 assert.equal(ranking.status,"compared-independent-events");
 assert.equal(ranking.fastestRobustObservedId,"fast");
 assert.equal(ranking.producesNewSkillPointAllocation,false);
 const incompatible=compareMeasuredBossWindows([
  candidate("a","1e100",1),
  {...candidate("b","1e100",5),scenario:{enabled:true,windowSeconds:28,
   events:[{channelId:"pet-attack",second:5,damage:"1e100"}]}}
 ]);
 assert.equal(incompatible.reason,"incompatible-boss-windows");
});

test("push combat window does not change the legacy SP optimizer's objective",()=>{
 const options={damage:"Pet",gold:"Fairy",goldWeight:.7,
  skillPoints:30,maxStage:1000,qol:"none",currentLevels:{},minimums:{}};
 const result=optimizeBuild(options);
 assert.equal(result.pushSkipTarget.enabled,false);
 assert.equal(result.bossPushCurrent.comparesOneObservedHitOnly,true);
 assert.equal(result.bossPushProposed.affectsOptimization,undefined);
});
