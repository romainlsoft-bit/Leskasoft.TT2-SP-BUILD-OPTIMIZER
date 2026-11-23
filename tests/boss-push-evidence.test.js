import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalTitanHpLog10,unmodifiedBossHpLog10,
 parseObservedHitLog10,bossPushEvidence} from "../src/boss-push-evidence.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild} from "../src/engine.js";
import {attackChannelEvidence,sourcedStageSkipChannels} from "../src/attack-channels.js";

test("boss HP matches sourced log10 formula at representative stages",()=>{
 assert.ok(Math.abs(normalTitanHpLog10(1)-Math.log10(17.5*1.38))<1e-12);
 for(const s of [100,101,1000,10000,100000,180000,300000,800000]){
  const expected=Math.log10(17.5)+Math.min(s,100)*Math.log10(1.38)+
   .03*Math.max(s-100,0)**1.098-
   .03*Math.max(s-180000,0)**1.0002*Math.log10(1.2);
  assert.ok(Math.abs(normalTitanHpLog10(s)-expected)<1e-9,s);
  assert.ok(unmodifiedBossHpLog10(s)>normalTitanHpLog10(s));
 }
 const stage=50000;
 const fifth=unmodifiedBossHpLog10(stage);
 const baseline=normalTitanHpLog10(stage);
 assert.ok(Math.abs(fifth-baseline-Math.log10(500*8))<1e-9);
 assert.ok(Math.abs(unmodifiedBossHpLog10(stage+1)-normalTitanHpLog10(stage+1)-Math.log10(500*2))<1e-9);
 assert.ok(Number.isFinite(unmodifiedBossHpLog10(1_000_000)));
 for(const s of [0,-1,3.1,10_000_001,Infinity,NaN])
  assert.throws(()=>unmodifiedBossHpLog10(s),/Boss stage/);
});

test("scientific notation parses huge TT2 damage without Infinity",()=>{
 assert.equal(parseObservedHitLog10("1e30000"),30000);
 assert.ok(Math.abs(parseObservedHitLog10("1.25e30000")-(30000+Math.log10(1.25)))<1e-10);
 assert.equal(parseObservedHitLog10("1000"),3);
 assert.equal(parseObservedHitLog10(""),null);
 assert.equal(parseObservedHitLog10(null),null);
 for(const bad of ["-1e40","0","0e4000","NaN","Infinity","1e999999999","1e2x","1,000","1e-10000001"]){
  assert.throws(()=>parseObservedHitLog10(bad),/Observed hit|Invalid/);
 }
});

test("boss evidence routes attacks independently for all 18 build and gold sources",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const report=bossPushEvidence({damage,gold,maxStage:300000},{});
  const attack=attackChannelEvidence({damage,gold},{}).channels;
  assert.equal(report.damage,damage);
  assert.equal(report.gold,gold);
  assert.equal(report.channels.length,attack.length);
  assert.equal(report.includesSharedStageSkip,false);
  assert.equal(report.predictsRealMaxStage,false);
  assert.equal(report.modifiesSkillPointAllocation,false);
  assert.ok(Number.isFinite(report.unmodifiedBossHpLog10));
  assert.ok(report.channels.every(x=>x.observed===null));
 }
});

test("a single eligible hit is compared ONLY against unmodified boss HP",()=>{
 const stage=1000;
 const plus=bossPushEvidence({damage:"Pet",gold:"Fairy",maxStage:stage,
  pushObservedAttackChannelId:"lightning-burst",
  pushObservedHitDamage:"1e80"},{PetQTE:1});
 const burst=plus.channels.find(x=>x.id==="lightning-burst");
 assert.equal(burst.observed.status,"above-unmodified-upper-roll");
 assert.equal(burst.observed.compared,true);
 assert.equal(burst.observed.fullCombatWindowModeled,false);
 assert.equal(burst.sourceStageSkip[0].bonusType,"PetQTEStageSkip");
 assert.equal(plus.channels.filter(x=>x.observed!==null).length,1);
 const low=bossPushEvidence({damage:"Pet",gold:"Fairy",maxStage:stage,
  pushObservedAttackChannelId:"lightning-burst",pushObservedHitDamage:"1e10"},
  {PetQTE:1});
 assert.equal(low.channels.find(x=>x.id==="lightning-burst").observed.status,
  "below-unmodified-lower-roll");
});
test("charged state is not an independently measured boss-killing hit",()=>{
 const e=bossPushEvidence({damage:"Pet",maxStage:1000,
  pushObservedAttackChannelId:"flash-zip-charged",
  pushObservedHitDamage:"1e5000"},{BossDmgQTE:5});
 const channel=e.channels.find(x=>x.id==="flash-zip-charged");
 assert.equal(channel.eligibleForObservedHit,false);
 assert.equal(channel.observed.status,"not-an-attack");
 assert.equal(channel.observed.compared,false);
 assert.ok(!sourcedStageSkipChannels("Pet").some(c=>c.id==="flash-zip-charged"));
 assert.ok(sourcedStageSkipChannels("Pet").some(c=>c.id==="lightning-burst"));
});

test("Shadow Clone plain splash is chance-based, special attack is guaranteed after kill",()=>{
 const plain=bossPushEvidence({damage:"Shadow Clone",gold:"Fairy",
  maxStage:1000,selectedSpells:["ShadowClone"]},
  {CloneDmg:1,CloneSkillBoost:1,PuppetMaster:1});
 const common=plain.channels.find(x=>x.id==="shadow-clone");
 const special=plain.channels.find(x=>x.id==="nightmare-puppeteer");
 assert.ok(Math.abs(common.shadowCloneSplash.chanceIfBossKilled-
  (.15-.01)/.99)<1e-12);
 assert.equal(special.shadowCloneSplash.chanceIfBossKilled,1);
 assert.equal(common.shadowCloneSplash.verifiedUptime,false);
});
test("unequipped spells cannot be passed as an observed available hit",()=>{
 const absent=bossPushEvidence({damage:"Heavenly Strike",maxStage:1000,
  selectedSpells:["ShadowClone"],
  pushObservedAttackChannelId:"heavenly-strike",
  pushObservedHitDamage:"1e20000"},{BurstSkillBoost:2});
 assert.equal(absent.channels[0].observed.status,"spell-not-equipped");
 assert.equal(absent.channels[0].observed.compared,false);
});

test("new evidence cannot affect SP allocations and never credits a hit to the proposal",()=>{
 for(const damage of DAMAGE_TYPES){
  const base={damage,gold:"Fairy",skillPoints:20,maxStage:1000,
   goldWeight:.7,qol:"none",currentLevels:{},minimums:{}};
  const a=optimizeBuild(base);
  const channel=attackChannelEvidence(base,{}).channels.find(x=>x.role!=="charged");
  const b=optimizeBuild({...base,pushObservedAttackChannelId:channel.id,
   pushObservedHitDamage:"1e15000"});
  assert.equal(b.score,a.score);
  assert.deepEqual(b.levels,a.levels);
  assert.equal(b.bossPushCurrent.selectedAttack,channel.id);
  assert.equal(b.bossPushProposed.observedHitSupplied,false);
  assert.equal(b.bossPushProposed.modifiesSkillPointAllocation,false);
  assert.equal(b.bossPushCurrent.comparesOneObservedHitOnly,true);
 }
});
test("missing max stage is not interpreted as a zero-HP boss",()=>{
 const b=optimizeBuild({damage:"Pet",gold:"Fairy",skillPoints:20,
  goldWeight:.7,qol:"none",maxStage:0,currentLevels:{},minimums:{}});
 assert.equal(b.bossPushCurrent,null);
 assert.equal(b.bossPushProposed,null);
});
test("localized UI no longer requests a measured attack or hit damage",()=>{
 for(const p of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const s=readFileSync(new URL("../"+p,import.meta.url),"utf8");
  for(const id of ["push-observed-attack","push-observed-stage","push-observed-damage"])
   assert.ok(!s.includes('id="'+id+'"'),p+": "+id);
  assert.ok(s.includes('id="push-attack-channel"'),p);
 }
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.ok(!app.includes('$("push-observed-'),"Removed DOM control remains referenced");
 for(const key of ["pushObservedAttackChannelId","pushObservedHitDamage","pushBossStage"])
  assert.ok(app.includes("delete state."+key+";"),"Outdated hit not discarded");
});
