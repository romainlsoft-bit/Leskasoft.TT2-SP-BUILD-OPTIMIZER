import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {heroProgressionEvidence} from "../src/hero-progression.js";
import {clanScrollEvidence} from "../src/account-scrolls.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {calculatePermanentArtifactEffects} from "../src/account-artifacts.js";
import {ARTIFACT_CATALOG,EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js";
import {HERO_ROSTER} from "../vendor/hero-roster.js";
import {CLAN_SCROLLS} from "../vendor/clan-scrolls.js";
import {optimizeBuild} from "../src/engine.js";
const heroes=n=>Object.fromEntries(HERO_ROSTER.map(id=>[id,n]));
const scrolls=n=>Object.fromEntries(CLAN_SCROLLS.map(x=>[x.id,n]));
const close=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9, String(a)+" != "+String(b));

test("8.4 catalog has CP-independent MythicSmith x1.25 pair; ScrollTutor is additive",()=>{
 const rows=EQUIPMENT_SET_CATALOG.MythicSmith.bonuses;
 assert.deepEqual(rows.filter(x=>x.type.startsWith("HelperWeapon")).map(x=>Number(x.amount)),[1.25,1.25]);
 assert.equal(rows.find(x=>x.type==="HelperWeaponBoost").inc,"1");
 assert.equal(EQUIPMENT_SET_CATALOG.ScrollTutor.bonuses.find(x=>x.type==="ClanScrollBoost").amount,"0.25");
 assert.equal(Object.keys(EQUIPMENT_SET_CATALOG).some(id=>/worldshaper/i.test(id)),false);
});
test("completed MythicSmith boosts full 37-hero sets once after inventory sale",()=>{
 const profile=parseAccountProfile({heroWeapons:heroes(3),equipmentSets:["MythicSmith"]});
 const e=heroProgressionEvidence(profile);
 assert.equal(e.mythicSmith.applied,true);
 close(e.baseSetLog10,3*Math.log10(6.25));
 close(e.individual[0].boostedWeaponLog10,3*Math.log10(1.875));
 const power=extractFixedAccountPower(profile);
 close(power.byType.BaseHeroDamage,e.baseSetLog10);
 assert.equal(power.entries.filter(row=>row.id==="full-hero-weapon-sets").length,1);
});
test("Morgelai and MythicSmith only change individual weapons; Ringing changes sets",()=>{
 const p=parseAccountProfile({heroWeapons:heroes(2),equipmentSets:["MythicSmith"],
  artifacts:{Artifact71:{level:50,enchanted:false},Artifact91:{level:50,enchanted:false}}});
 const e=heroProgressionEvidence(p,calculatePermanentArtifactEffects(p,ARTIFACT_CATALOG));
 close(e.baseSetLog10,2*Math.log10(9.375));
 close(e.individual[0].boostedWeaponLog10,2*Math.log10(2.8125));
 assert.equal(e.individual.every(x=>x.inGlobalDamageScore===false),true);
});
test("Worldshaper aliases the internal MythicSmith bonus without fabricating a full roster",()=>{
 const profile=parseAccountProfile({heroWeapons:{H01:5},equipmentSets:["The Worldshaper"]});
 const e=heroProgressionEvidence(profile);
 assert.deepEqual(profile.ownedSetIds,["MythicSmith"]);
 assert.equal(e.worldshaper.owned,true);
 assert.equal(e.worldshaper.applied,true);
 assert.equal(e.entries.length,0);
 const noSet=heroProgressionEvidence(parseAccountProfile({heroWeapons:heroes(2),equipmentSets:{MythicSmith:false}}));
 assert.equal(noSet.mythicSmith.applied,false);
 close(noSet.baseSetLog10,2*Math.log10(5));
});
test("Quill boosts individual scroll exponent, Stamp only verified complete-set fraction",()=>{
 const p=parseAccountProfile({clanScrolls:scrolls(2),
  artifacts:{Artifact92:{level:50,enchanted:false},Artifact93:{level:50,enchanted:false}}});
 const e=clanScrollEvidence(p);
 assert.equal(e.quill.applied,true);
 assert.equal(e.stamp.applied,true);
 close(e.quill.factor,1.25);
 close(e.stamp.factor,1.25);
 close(e.enhancedSetBonusPercent,0.15*1.25);
 close(e.entries.find(x=>x.id==="ScrollId2").setBoostedLog10,
  2*Math.log10(1.43)*1.25*(1+0.15*1.25));
 assert.equal(e.entries.find(x=>x.id==="ScrollId14").setBoostedLog10,null);
});
test("partial scroll roster cannot synthesize Stamp set count",()=>{
 const p=parseAccountProfile({clanScrolls:{ScrollId2:2},
  artifacts:{Artifact92:{level:50,enchanted:false},Artifact93:{level:50,enchanted:false}}});
 const e=clanScrollEvidence(p);
 assert.equal(e.completeRoster,false);
 assert.equal(e.stamp.applied,false);
 assert.equal(e.enhancedSetBonusPercent,null);
 close(e.entries.find(x=>x.id==="ScrollId2").setBoostedLog10,2*Math.log10(1.43)*1.25);
});
test("conflicting Quill data is diagnosed and cannot be applied",()=>{
 const p=parseAccountProfile({clanScrolls:{ScrollId2:3},artifacts:[
  {id:"Artifact92",level:48,enchanted:false},{id:"Artifact92",level:50,enchanted:false}]});
 const e=clanScrollEvidence(p);
 assert.equal(e.quill.verified,false);
 assert.equal(e.boostStackComplete,false);
 assert.ok(e.unknown.some(x=>x.reason==="unverified-scroll-amplifier"));
 close(e.entries.find(x=>x.id==="ScrollId2").setBoostedLog10,3*Math.log10(1.43));
});
test("Dragon Weaver additive 0.25 is +25%, never x0.25",()=>{
 const p=parseAccountProfile({clanScrolls:scrolls(2),equipmentSets:["Dragon Weaver"]});
 const e=clanScrollEvidence(p);
 assert.equal(e.scrollTutor.owned,true);
 assert.deepEqual(e.scrollTutor.amounts,["0.25","0.25"]);
 assert.equal(e.scrollTutor.applied,true);
 assert.equal(e.boostStackComplete,true);
 close(e.entries.find(x=>x.id==="ScrollId2").setBoostedLog10,
  2*Math.log10(1.43)*1.25*(1+0.15*1.25));
});
test("18 fixed-account score routes base hero once and amplified scrolls by source type",()=>{
 const p=parseAccountProfile({heroWeapons:heroes(2),equipmentSets:["MythicSmith"],
  clanScrolls:scrolls(1),artifacts:{Artifact91:{level:50,enchanted:false},
   Artifact92:{level:50,enchanted:false},Artifact93:{level:50,enchanted:false}}});
 const power=extractFixedAccountPower(p);
 close(power.byType.BaseHeroDamage,2*Math.log10(9.375));
 for(const damage of ["Pet","Clan Ship","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"])
  for(const gold of ["Fairy","HoG","Chesterson"]){
   const settings={damage,gold,goldWeight:0.7};
   const full=fixedAccountScore(power,settings);
   const without=fixedAccountScore({...power,byType:{...power.byType,BaseHeroDamage:0}},settings);
   close(full.damageLog10-without.damageLog10,2*Math.log10(9.375));
   assert.equal(full.types.filter(x=>x==="BaseHeroDamage").length,1);
  }
});
test("18 native optimizeBuild integrations preserve immutable account score and coverage gaps",()=>{
 const p=parseAccountProfile({heroWeapons:heroes(2),equipmentSets:["MythicSmith","ScrollTutor"],
  clanScrolls:scrolls(1),artifacts:{Artifact91:{level:50,enchanted:false},
   Artifact92:{level:50,enchanted:false},Artifact93:{level:50,enchanted:false}}});
 for(const damage of ["Pet","Clan Ship","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"])
  for(const gold of ["Fairy","HoG","Chesterson"]){
   const settings={damage,gold,goldWeight:.7,skillPoints:80,maxStage:0,qol:"none",
    currentLevels:{},minimums:{},sets:{},craftingPower:1,timeToKill:8,
    sClone:30,accountProfile:p};
   const r=optimizeBuild(settings);
   assert.equal(r.accountIntegration.heroProgression.mythicSmith.applied,true);
   assert.equal(r.accountIntegration.clanScrollPower.quill.applied,true);
   assert.equal(r.accountIntegration.clanScrollPower.scrollTutor.applied,false);
   close(r.fixedAccount.damageLog10,
    fixedAccountScore(extractFixedAccountPower(p),settings).damageLog10);
   close(r.accountAdjustedScore-r.score,r.fixedAccount.weightedLog10);
   assert.equal(r.fixedAccount.complete,false);
  }
});
