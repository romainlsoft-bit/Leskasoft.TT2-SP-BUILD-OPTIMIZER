import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {equipmentSetAliasEvidence,canonicalEquipmentSetId} from "../src/equipment-set-aliases.js";
import {heroLevelEvidence} from "../src/hero-levels.js";
import {heroProgressionEvidence} from "../src/hero-progression.js";
import {clanScrollEvidence} from "../src/account-scrolls.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {resolvePermanentSetPower} from "../src/account-permanent-sets.js";
import {HERO_ROSTER} from "../vendor/hero-roster.js";
import {CLAN_SCROLLS} from "../vendor/clan-scrolls.js";
import {EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js";
import {optimizeBuild} from "../src/engine.js";
const heroes=n=>Object.fromEntries(HERO_ROSTER.map(id=>[id,n]));
const scrolls=n=>Object.fromEntries(CLAN_SCROLLS.map(x=>[x.id,n]));
const close=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8, `${a} != ${b}`);
const build={skillPoints:30,maxStage:0,qol:"none",currentLevels:{},
 minimums:{},sets:{},craftingPower:1,timeToKill:8,sClone:30,goldWeight:0.7};
function heroSnapshot(withDps=true){
 return HERO_ROSTER.map((id,i)=>({id,level:i%6000,ascension:3,
  ...(withDps?{dps:i===0?"3e+9999":"1e+9980"}:{})}));
}
test("patch-note primary rows identify both display names without altering internal catalog",()=>{
 assert.equal(canonicalEquipmentSetId("The Worldshaper"),"MythicSmith");
 assert.equal(canonicalEquipmentSetId("Worldshaper"),"MythicSmith");
 assert.equal(canonicalEquipmentSetId("Dragon Weaver"),"ScrollTutor");
 assert.equal(canonicalEquipmentSetId("Unknown Set"),"Unknown Set");
 const world=EQUIPMENT_SET_CATALOG.MythicSmith.bonuses;
 const dragon=EQUIPMENT_SET_CATALOG.ScrollTutor.bonuses;
 assert.deepEqual(world.slice(0,2).map(x=>x.amount),["1.25","1.25"]);
 assert.deepEqual(dragon.slice(0,2).map(x=>x.amount),["0.25","0.25"]);
 assert.equal(dragon.slice(0,2).every(x=>x.inc==="1"&&x.expo==="1"),true);
});
test("Worldshaper + its internal ID are one owned set, permanently after sale",()=>{
 const p=parseAccountProfile({heroWeapons:heroes(4),
  equipmentSets:["The Worldshaper","MythicSmith"]});
 assert.deepEqual(p.ownedSetIds,["MythicSmith"]);
 assert.deepEqual(equipmentSetAliasEvidence(p).mirroredIds,["MythicSmith"]);
 const h=heroProgressionEvidence(p);
 assert.equal(h.worldshaper.applied,true);
 assert.equal(h.mythicSmith.applied,true);
 close(h.baseSetLog10,4*Math.log10(6.25));
 assert.equal(extractFixedAccountPower(p).entries.filter(x=>
  x.id==="full-hero-weapon-sets").length,1);
 const owned=resolvePermanentSetPower(p,{craftingPower:1});
 assert.equal(owned.ownedSetCount,1);
});
test("Dragon Weaver standalone applies independent +25% to scroll and completed-set lanes",()=>{
 const p=parseAccountProfile({equipmentSets:["Dragon Weaver"],clanScrolls:scrolls(2)});
 const e=clanScrollEvidence(p);
 assert.equal(e.scrollTutor.verified,true);
 assert.equal(e.scrollTutor.appliedToIndividual,true);
 assert.equal(e.scrollTutor.appliedToSet,true);
 assert.equal(e.boostStackComplete,true);
 close(e.enhancedSetBonusPercent,0.15*1.25);
 close(e.entries.find(x=>x.id==="ScrollId2").setBoostedLog10,
  2*Math.log10(1.43)*1.25*(1+0.15*1.25));
 assert.equal(e.entries.find(x=>x.id==="ScrollId14").setBoostedLog10,null);
});
test("Dragon Weaver + Quill only: set lane scored, independent Quill individual lane preserved",()=>{
 const p=parseAccountProfile({equipmentSets:["Dragon Weaver"],clanScrolls:scrolls(2),
  artifacts:{Artifact92:{level:50}}});
 const e=clanScrollEvidence(p);
 assert.equal(e.scrollTutor.appliedToIndividual,false);
 assert.equal(e.scrollTutor.appliedToSet,true);
 assert.equal(e.boostStackComplete,false);
 assert.ok(e.unknown.some(x=>x.reason==="dragon-weaver-artifact-cross-stack-unverified"));
 close(e.entries.find(x=>x.id==="ScrollId2").setBoostedLog10,
  2*Math.log10(1.43)*1.25*(1+0.15*1.25));
});
test("Dragon Weaver + Stamp only: individual lane scored, verified Stamp set lane preserved",()=>{
 const p=parseAccountProfile({equipmentSets:["Dragon Weaver"],clanScrolls:scrolls(2),
  artifacts:{Artifact93:{level:50}}});
 const e=clanScrollEvidence(p);
 assert.equal(e.scrollTutor.appliedToIndividual,true);
 assert.equal(e.scrollTutor.appliedToSet,false);
 assert.equal(e.boostStackComplete,false);
 close(e.entries.find(x=>x.id==="ScrollId2").setBoostedLog10,
  2*Math.log10(1.43)*1.25*(1+0.15*1.25));
});
test("with both Quill and Stamp, Dragon Weaver is not speculatively double-counted",()=>{
 const p=parseAccountProfile({equipmentSets:["ScrollTutor","Dragon Weaver"],
  clanScrolls:scrolls(2),
  artifacts:{Artifact92:{level:50},Artifact93:{level:50}}});
 const e=clanScrollEvidence(p);
 assert.deepEqual(p.ownedSetIds,["ScrollTutor"]);
 assert.equal(e.scrollTutor.applied,false);
 assert.equal(e.boostStackComplete,false);
 close(e.entries.find(x=>x.id==="ScrollId2").setBoostedLog10,
  2*Math.log10(1.43)*1.25*(1+0.15*1.25));
});
test("partial or truncated scroll roster never fabricates a completed-set count",()=>{
 const partial=clanScrollEvidence(parseAccountProfile({
  equipmentSets:["Dragon Weaver"],clanScrolls:{ScrollId2:2}}));
 assert.equal(partial.fullSets,null);
 assert.equal(partial.scrollTutor.appliedToIndividual,true);
 assert.equal(partial.scrollTutor.appliedToSet,false);
 const huge=parseAccountProfile({equipmentSets:["Dragon Weaver"],
  clanScrolls:Array.from({length:2050},(_,i)=>({id:CLAN_SCROLLS[i%18].id,level:1}))});
 const truncated=clanScrollEvidence(huge);
 assert.equal(truncated.truncated,true);
 assert.equal(truncated.scrollTutor.applied,false);
});
test("hero snapshots stay diagnostic, current DPS log-sum-exp supports e9999",()=>{
 const p=parseAccountProfile({heroLevels:heroSnapshot(),dominantHeroId:"H18"});
 const h=heroLevelEvidence(p);
 assert.equal(h.completeRoster,true);
 assert.equal(h.dpsComplete,true);
 assert.equal(h.parsedCount,37);
 assert.equal(h.currentTopHero,HERO_ROSTER[0]);
 assert.equal(h.dominantConflict,false);
 close(h.totalCurrentDpsLog10,9999+Math.log10(3));
 close(Object.values(h.classShares).reduce((a,b)=>a+b,0),1);
 assert.equal(h.scored,false);
 assert.equal(heroProgressionEvidence(p).entries.length,0);
});
test("hero snapshot rejects duplicate, missing, invalid ascensions and conflicting dominant",()=>{
 const rows=heroSnapshot();
 assert.equal(heroLevelEvidence(parseAccountProfile({heroLevels:rows.slice(1)})).completeRoster,false);
 const dup=heroLevelEvidence(parseAccountProfile({heroLevels:[...rows.slice(1),rows[1]]}));
 assert.equal(dup.completeRoster,false);
 assert.ok(dup.duplicates.length>0);
 const bad=heroLevelEvidence(parseAccountProfile({heroLevels:rows.map((x,i)=>
  i===0?{...x,ascension:-1}:x)}));
 assert.equal(bad.completeRoster,false);
 const conflict=heroLevelEvidence(parseAccountProfile({heroLevels:rows,
  dominantHeroId:HERO_ROSTER[1]}));
 assert.equal(conflict.dominantConflict,true);
});
test("zero DPS is a noncontributing hero, not a fabricated multiplier",()=>{
 const rows=heroSnapshot().map((x,i)=>({...x,dps:i===0?"0":x.dps}));
 const h=heroLevelEvidence(parseAccountProfile({heroLevels:rows}));
 assert.equal(h.dpsComplete,true);
 assert.equal(h.entries[0].currentDpsLog10,-Infinity);
 assert.equal(h.scored,false);
});
test("18 score routes apply standalone Worldshaper and Dragon Weaver once",()=>{
 const p=parseAccountProfile({heroWeapons:heroes(2),clanScrolls:scrolls(2),
  equipmentSets:["The Worldshaper","Dragon Weaver"]});
 const pw=extractFixedAccountPower(p);
 close(pw.byType.BaseHeroDamage,2*Math.log10(6.25));
 const onlyBase=pw.byType.BaseHeroDamage;
 for(const damage of ["Pet","Clan Ship","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"])
  for(const gold of ["Fairy","HoG","Chesterson"]){
   const settings={damage,gold,goldWeight:0.7};
   const full=fixedAccountScore(pw,settings);
   const without=fixedAccountScore({...pw,byType:{...pw.byType,BaseHeroDamage:0}},settings);
   close(full.damageLog10-without.damageLog10,onlyBase);
   assert.equal(full.types.filter(x=>x==="BaseHeroDamage").length,1);
  }
});
test("18 native optimizeBuild routes preserve fixed bonuses and do not score hero current DPS",()=>{
 const p=parseAccountProfile({heroWeapons:heroes(1),clanScrolls:scrolls(1),
  equipmentSets:["The Worldshaper","Dragon Weaver"],heroLevels:heroSnapshot()});
 const power=extractFixedAccountPower(p);
 for(const damage of ["Pet","Clan Ship","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"])
  for(const gold of ["Fairy","HoG","Chesterson"]){
   const settings={...build,damage,gold,accountProfile:p};
   const x=optimizeBuild(settings);
   assert.equal(x.accountIntegration.heroProgression.worldshaper.applied,true);
   assert.equal(x.accountIntegration.clanScrollPower.scrollTutor.applied,true);
   assert.equal(x.accountIntegration.heroProgression.heroLevels.scored,false);
   close(x.fixedAccount.damageLog10,fixedAccountScore(power,settings).damageLog10);
   close(x.accountAdjustedScore-x.score,x.fixedAccount.weightedLog10);
  }
});
