import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {heroWeaponEvidence} from "../src/account-temporal.js";
import {heroProgressionEvidence} from "../src/hero-progression.js";
import {clanScrollEvidence} from "../src/account-scrolls.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {equipmentEffectReduction} from "../src/equipment-reductions.js";
import {HERO_ROSTER} from "../vendor/hero-roster.js";
import {CLAN_SCROLLS} from "../vendor/clan-scrolls.js";
import {optimizeBuild} from "../src/engine.js";
const heroes=n=>Object.fromEntries(HERO_ROSTER.map(id=>[id,n]));
const scrolls=n=>Object.fromEntries(CLAN_SCROLLS.map(x=>[x.id,n]));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test("pinned 8.4 catalog 37 heroes, 18 scrolls",()=>{
 assert.equal(HERO_ROSTER.length,37);
 assert.equal(new Set(HERO_ROSTER).size,37);
 assert.equal(CLAN_SCROLLS.length,18);
 assert.equal(new Set(CLAN_SCROLLS.map(x=>x.id)).size,18);
 assert.equal(CLAN_SCROLLS.find(x=>x.id==="ScrollId3").bonusType,"AllHelperDamage");
});
test("complete hero weapon sets score verified All Hero Damage only once",()=>{
 const p=parseAccountProfile({heroWeapons:heroes(3)});
 const e=heroProgressionEvidence(p),power=extractFixedAccountPower(p);
 assert.equal(e.weapons.completeSets,3);
 assert.equal(e.entries.length,1);
 close(power.byType.AllHelperDamage,3*Math.log10(5));
 assert.equal(power.byType.AllDamage||0,0);
 assert.equal(e.individualWeaponsScored,false);
});
test("missing, duplicate, unrecognized, invalid and truncated rosters exclude set bonus",()=>{
 const p=x=>parseAccountProfile({heroWeapons:x});
 assert.equal(heroProgressionEvidence(p(Object.fromEntries(HERO_ROSTER.slice(1).map(id=>[id,3])))).entries.length,0);
 assert.equal(heroProgressionEvidence(p([...HERO_ROSTER.map(id=>({id,level:3})),{id:"H01",level:2}])).entries.length,0);
 assert.equal(heroProgressionEvidence(p({...heroes(3),H38:2})).entries.length,0);
 assert.equal(heroProgressionEvidence(p(HERO_ROSTER.map((id,i)=>({id,level:i===0?-1:3})))).entries.length,0);
 const huge=p(Array.from({length:2050},(_,i)=>({id:HERO_ROSTER[i%37],level:2})));
 assert.equal(huge.sections.heroWeapons.truncated,true);
 assert.equal(heroProgressionEvidence(huge).entries.length,0);
 assert.equal(heroWeaponEvidence(p({...heroes(3),H01:0})).completeSets,0);
});
test("four artifact and two mythic amplifiers are evidence not scored",()=>{
 const p=parseAccountProfile({heroWeapons:heroes(2),
  artifacts:Object.fromEntries(["Artifact71","Artifact91","Artifact92","Artifact93"].map(id=>[id,{level:50,enchanted:false}])),
  equipmentSets:["MythicSmith","ScrollTutor"]});
 const e=heroProgressionEvidence(p);
 assert.equal(e.artifactBoosters.filter(x=>x.owned).length,4);
 assert.equal(e.mythicBoosts.filter(x=>x.owned).length,2);
 assert.equal(e.amplifiersScored,false);
 close(extractFixedAccountPower(p).byType.AllHelperDamage,2*Math.log10(5));
});
test("18 damage/gold combinations route All Hero Damage using source reductions",()=>{
 const power=extractFixedAccountPower(parseAccountProfile({heroWeapons:heroes(2),clanScrolls:scrolls(1)}));
 const source=power.byType.AllHelperDamage;
 assert.ok(source>2*Math.log10(5));
 for(const damage of ["Pet","Clan Ship","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"])
  for(const gold of ["Fairy","HoG","Chesterson"]){
   const settings={damage,gold,goldWeight:0.7};
   const ratio=equipmentEffectReduction("AllHelperDamage",settings).weight;
   const noHero=fixedAccountScore({...power,byType:{...power.byType,AllHelperDamage:0}},settings);
   const hero=fixedAccountScore(power,settings);
   close(hero.damageLog10-noHero.damageLog10,source*ratio);
   assert.equal(hero.types.filter(x=>x==="AllHelperDamage").length,1);
  }
});
test("partial Clan Scroll values do not prove a set; truncated sources score no fragment",()=>{
 const p=parseAccountProfile({clanScrolls:{ScrollId2:4,ScrollId3:3}});
 close(extractFixedAccountPower(p).byType.AllHelperDamage,3*Math.log10(1.108));
 assert.equal(clanScrollEvidence(p).setBonusPercent,null);
 const huge=parseAccountProfile({clanScrolls:Array.from({length:2050},(_,i)=>({id:CLAN_SCROLLS[i%18].id,level:1}))});
 assert.equal(clanScrollEvidence(huge).entries.length,0);
 assert.equal(extractFixedAccountPower(huge).entries.some(x=>x.system==="clanScrolls"),false);
});
test("actual optimizeBuild includes full sets in fixed score, not marginal SP",()=>{
 const profile=parseAccountProfile({heroWeapons:heroes(2)});
 const settings={damage:"Pet",gold:"Fairy",goldWeight:0.7,skillPoints:300,maxStage:0,qol:"none",
  currentLevels:{},minimums:{},sets:{},craftingPower:1,timeToKill:8,
  sClone:30,accountProfile:profile};
 const r=optimizeBuild(settings);
 assert.equal(r.accountIntegration.heroProgression.fullSets,2);
 assert.equal(r.accountIntegration.heroProgression.baseBonusScored,true);
 close(r.accountAdjustedScore-r.score,r.fixedAccount.weightedLog10);
 close(r.fixedAccount.damageLog10,2*Math.log10(5)*equipmentEffectReduction("AllHelperDamage",settings).weight);
 assert.equal(r.fixedAccount.complete,false);
});
