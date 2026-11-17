import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {extractFixedAccountPower,fixedAccountScore,formatLogMultiplier} from "../src/account-power.js";
import {accountDependencyGraph,bonusDependence,invalidateAccountNodes,validateAccountGraph} from "../src/account-dependencies.js";
import {ARTIFACT_CATALOG,EQUIPMENT_SET_CATALOG,SEASON_ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {ACCOUNT_SCALING} from "../vendor/account-scaling.js";
import {resolveSetCompletionDates,resolveTranscendenceAge,heroWeaponEvidence} from "../src/account-temporal.js";
import {clanScrollEvidence} from "../src/account-scrolls.js";
import {HERO_ROSTER} from "../vendor/hero-roster.js";
import {CLAN_SCROLLS} from "../vendor/clan-scrolls.js";
import {resolveSpellCaps,spellCapBonus,spellTableIndex} from "../src/spell-caps.js";
import {extractTimedSetPower} from "../src/account-set-bonuses.js";
import {spellInfo} from "../vendor/spells.js";
import {optimizeBuild} from "../src/engine.js";
import {resolveUniqueOwnership} from "../src/account-unique.js";
import {UNIQUE_EQUIPMENT_TO_SET} from "../vendor/unique-equipment.js";
import {resolveMonumentEvidence} from "../src/account-monuments.js";
import {computeArtifactEffect,calculatePermanentArtifactEffects,positiveLog10,log10OnePlusPower} from "../src/account-artifacts.js";
import {rawDamageLog10,additiveDamageEvidence,log10Sum} from "../src/account-damage-pools.js";
import {RESOURCE_RESEARCH_CATALOG} from "../vendor/account-research-resources.js";
import {mergeTitanResearch,resourceResearchEvidence} from "../src/account-research-resources.js";

const fixture=()=>parseAccountProfile({
 Version:"8.4.0",playerName:"HIDDEN",accountId:"PRIVATE",
 playerStats:{"Skill Points Owned":400},
 titanCards:{"Titan1":{lv:93,num:2}},
 gemstonesResearch:{"284":{lv:20}},
 gemstoneResearch:{ignored:1},
 titanResearch:{"2":{lv:3}},
 gemstones:{"Gem0":{lv:500,primary:"PetDamage:1e40",secondary:["GoldAll:2e50"]}},
 artifacts:{"Artifact38":{lv:"1e300",e:1}},
 seasonArtifacts:{"SeasonalArtifact1":{lv:40}},
 equipmentSets:["StainGlass","Samurai"],
 skillTree:{"PetDmg":1}
});

test("Ohohono and Mystic Research independently reproduce the player's screenshots",()=>{
 const power=extractFixedAccountPower(fixture());
 const card=power.entries.find(x=>x.system==="titanCards"&&x.id==="Titan1");
 const mystic=power.entries.find(x=>x.system==="gemstoneResearch"&&x.id==="284");
 assert.ok(card);assert.ok(mystic);
 assert.equal(formatLogMultiplier(card.log10),"×3.27e+11");
 assert.equal(formatLogMultiplier(mystic.log10),"×1.96e+23");
 assert.ok(Math.abs(card.log10-93*Math.log10(1.3299))<1e-12);
 assert.ok(Math.abs(mystic.log10-20*Math.log10(14.6089))<1e-12);
});
test("Scientific values, other explicit gemstone bonuses and research combine in log10 space",()=>{
 const profile=fixture(),power=extractFixedAccountPower(profile);
 const pet=fixedAccountScore(power,{damage:"Pet",gold:"Fairy",goldWeight:0.7});
 const other=fixedAccountScore(power,{damage:"Dagger",gold:"Fairy",goldWeight:0.7});
 assert.ok(Number.isFinite(pet.weightedLog10));
 assert.ok(pet.damageLog10>other.damageLog10+70);
 assert.ok(pet.goldLog10>=Math.log10(2e50)-1e-7);
 assert.equal(extractFixedAccountPower(profile),power); // exact identity = cached
 assert.equal(JSON.stringify(power).includes("PRIVATE"),false);
});
test("Research nodes are always fixed, never spendable SP",()=>{
 const profile=fixture(),power=extractFixedAccountPower(profile);
 assert.ok(profile.fixedSystemKeys.includes("mysticResearch"));
 assert.ok(profile.fixedSystemKeys.includes("titanResearch"));
 assert.ok(profile.fixedSystemKeys.includes("gemstones"));
 assert.ok(profile.fixedSystemKeys.includes("titanCards"));
 const opts={damage:"Pet",gold:"Fairy",goldWeight:0.7,
  skillPoints:400,maxStage:0,qol:"none",currentLevels:{},
  minimums:{},sets:{},craftingPower:1,timeToKill:8,sClone:30,
  accountProfile:profile};
 const result=optimizeBuild(opts);
 assert.ok(result.spent<=400);
 assert.ok(Math.abs(result.accountAdjustedScore-result.score-
  result.fixedAccount.weightedLog10)<1e-7);
 assert.ok(result.fixedAccount.available);
 assert.equal(result.fixedAccount.complete,false);
});
test("Collection metadata describes set-artifact level dependencies without guessing multiplier",()=>{
 const g=accountDependencyGraph(fixture());
 assert.ok(Object.keys(EQUIPMENT_SET_CATALOG).length>=210);
 assert.ok(Object.keys(ARTIFACT_CATALOG).length>=100);
 assert.ok(Object.keys(SEASON_ARTIFACT_CATALOG).length>=50);
 assert.ok(ACCOUNT_SCALING.titanCards.length>=110);
 assert.ok(g.sets.some(x=>x.id==="StainGlass"&&
  x.effects.some(e=>e.dependsOn==="gemstoneEffectiveLevels")));
 assert.ok(g.sets.some(x=>x.id==="Samurai"&&
  x.effects.some(e=>e.dependsOn==="petEffectiveLevels")));
 assert.ok(g.artifacts.some(x=>x.name==="Fruit of Eden"));
 assert.ok(g.artifacts.some(x=>x.kind===undefined||x.id==="SeasonalArtifact1"));
 assert.equal(g.ready,false);
 assert.ok(g.unmodeledEffects>=2);
 assert.equal(bonusDependence("GemstoneLevelMult"),"gemstoneEffectiveLevels");
});
test("Large research trees are retained, while rare gem inventories remain bounded",()=>{
 const profile=parseAccountProfile({
  gemstonesResearch:Object.fromEntries(Array.from({length:688},(_,i)=>[String(i),{lv:1}])),
  gemstones:Array.from({length:700},(_,i)=>({id:"G"+i,lv:1}))
 });
 assert.equal(profile.sections.mysticResearch.records.length,688);
 assert.equal(profile.sections.gemstones.records.length,512);
 assert.equal(profile.sections.gemstones.truncated,true);
});

test("Changing a helmet does not recalculate account inventory, artifacts or fixed research",()=>{
 const changed=invalidateAccountNodes(["equipmentEffectiveBonuses"]);
 assert.ok(changed.includes("skillEffects"));
 assert.ok(changed.includes("finalBuildPower"));
 assert.ok(!changed.includes("artifactEffects"));
 assert.ok(!changed.includes("gemstoneEffectiveLevels"));
 assert.ok(!changed.includes("accountInventory"));
 assert.ok(validateAccountGraph());
});
test("Graph rejects circular equipment/pet dependencies instead of looping",()=>{
 const cyclic=[
  {id:"petEffectiveLevels",after:["equipmentEffectiveBonuses"]},
  {id:"equipmentEffectiveBonuses",after:["petEffectiveLevels"]}
 ];
 assert.throws(()=>validateAccountGraph(cyclic),/Cyclic/);
});

test("set PerDay metadata is retained but never scored without a completion date",()=>{
 const p=parseAccountProfile({playerStats:{"Transcendence Season":13},
  equipmentSets:["StainGlass","Druid","PetGroomer"],heroWeapons:{"Hero1":3,"Hero2":2}});
 const report=accountDependencyGraph(p);
 assert.equal(report.transcendence.source,"official-season-calendar");
 const t=report.sets.find(s=>s.id==="StainGlass").effects.find(e=>e.type==="AllDamage");
 assert.equal(t.perDay,true);
 assert.equal(t.maxValue,"1.88E+64");
 assert.equal(t.numericalStatus,"ignored-missing-set-completion-date");
 assert.equal(report.sets.find(s=>s.id==="Druid").effects.filter(e=>e.perDay).length,2);
 assert.equal(report.heroWeapons.totalWeaponLevels,5);
 assert.equal(report.heroWeapons.completeSets,null);
});
test("fifth historically acquired equipment slot completes the set even after sale",()=>{
 const pieces=["Sword","Helmet","Armor","Aura","Slash"].map((slot,index)=>({
  id:"piece"+index,setId:"StainGlass",slot,acquiredAt:"2026-10-"+String(index+1).padStart(2,"0")}));
 const full=parseAccountProfile({
  equipmentSets:["StainGlass"],equipmentAcquisitionHistory:pieces,
  equipmentInventory:[]
 });
 const date=resolveSetCompletionDates(full,new Date("2026-10-09T00:00:00Z")).StainGlass;
 assert.equal(date.completedAt,"2026-10-05T00:00:00.000Z");
 assert.equal(date.days,4);
 assert.equal(date.source,"five-historical-acquisitions");
 assert.equal(accountDependencyGraph(full).sets.find(s=>s.id==="StainGlass").permanentAfterSale,true);
 const missing=parseAccountProfile({
  equipmentSets:["StainGlass"],equipmentAcquisitionHistory:pieces.slice(0,4)});
 assert.equal(resolveSetCompletionDates(missing).StainGlass.days,null);
 const undated=parseAccountProfile({
  equipmentSets:["StainGlass"],equipmentAcquisitionHistory:pieces.map(({acquiredAt,...item})=>item)});
 assert.equal(resolveSetCompletionDates(undated).StainGlass.days,null);
});
test("exported completion and Transcendence dates accepted without user prompts",()=>{
 const p=parseAccountProfile({equipmentSets:[{id:"Orca",completedAt:"2026-10-01"}],
  playerStats:{"Transcendence Season":13,"TranscendenceStartDate":"2026-08-12"}});
 assert.equal(resolveSetCompletionDates(p,new Date("2026-10-05T00:00:00Z")).Orca.days,4);
 assert.equal(resolveTranscendenceAge(p,new Date("2026-08-20T00:00:00Z")).days,8);
 const future=parseAccountProfile({equipmentSets:[{id:"Orca",completedAt:"2026-12-01"}]});
 assert.equal(resolveSetCompletionDates(future,new Date("2026-11-17T00:00:00Z")).Orca.days,null);
});
test("owned Unique items persist independently of selected equipment",()=>{
 const p=parseAccountProfile({equipmentSets:["AlphaHeart"],equippedEquipment:[],
  uniqueEquipment:[{id:"ElderSnow"}]});
 const graph=accountDependencyGraph(p);
 assert.ok(graph.uniquePermanentOwnership.includes("AlphaHeart"));
 assert.ok(graph.uniquePermanentOwnership.includes("ElderSnow"));
 assert.equal(heroWeaponEvidence(p).completeRosterVerified,false);
});

test("Clan Scrolls: 18 types, exact levels, unknown complete sets and additive rows",()=>{
 assert.equal(CLAN_SCROLLS.length,18);
 const profile=parseAccountProfile({clanScrolls:{"ScrollId1":2,"ScrollId2":3}});
 const scrolls=clanScrollEvidence(profile);
 assert.equal(scrolls.totalLevels,5);
 assert.equal(scrolls.fullSets,null);
 const entry=extractFixedAccountPower(profile).entries.find(e=>e.system==="clanScrolls"&&e.id==="ScrollId2");
 assert.ok(Math.abs(entry.log10-3*Math.log10(1.43))<1e-12);
 const full=parseAccountProfile({clanScrolls:Object.fromEntries(CLAN_SCROLLS.map(x=>[x.id,5]))});
 assert.equal(clanScrollEvidence(full).fullSets,5);
 assert.equal(clanScrollEvidence(full).boostsModeled,false);
 const additive=parseAccountProfile({clanScrolls:{"ScrollId14":9}});
 assert.equal(extractFixedAccountPower(additive).entries.filter(x=>x.system==="clanScrolls").length,0);
});
test("max spell caps: 30 base, +5 set, +5 tier five, A39 is level 40",()=>{
 const normal=resolveSpellCaps({maxStage:22000,sets:{}},{});
 assert.equal(normal.spells.BurstDamage.cap,30);
 assert.equal(spellCapBonus("TwilightBell",30),5);
 const full=resolveSpellCaps({maxStage:22000,sets:{tFA:true}},{TwilightBell:30});
 assert.equal(full.spells.BurstDamage.cap,40);
 assert.equal(full.spells.BurstDamage.tabulatedLevel,40);
 assert.equal(full.spells.BurstDamage.unmodeledLevels,0);
 assert.equal(full.spells.ShadowClone.cap,35);
 assert.equal(full.complete,true);
 assert.equal(resolveSpellCaps({maxStage:12000},{}).assumeAllActive,false);
});

test("ActiveSkillInfo A0 is spell level 1, A29 level 30 and A39 level 40",()=>{
 assert.equal(spellTableIndex(1),0);
 assert.equal(spellTableIndex(30),29);
 assert.equal(spellTableIndex(35),34);
 assert.equal(spellTableIndex(40),39);
 assert.equal(spellTableIndex(0),null);
 assert.equal(Number(spellInfo.BurstDamage.A0),100);
 assert.equal(Number(spellInfo.BurstDamage["A"+spellTableIndex(40)]),3.35e15);
});
test("date-backed PerDay set bonuses respect five-piece completion and max cap",()=>{
 const pieces=["Sword","Helmet","Armor","Aura","Slash"].map((slot,i)=>({
  id:"p"+i,slot,setId:"StainGlass",acquiredAt:"2026-01-"+String(i+1).padStart(2,"0")
 }));
 const profile=parseAccountProfile({equipmentSets:["StainGlass"],equipmentAcquisitionHistory:pieces});
 const day10=extractTimedSetPower(profile,new Date("2026-01-15T00:00:00Z"));
 assert.equal(day10.applied,1);
 assert.equal(day10.entries[0].days,10);
 assert.ok(Math.abs(day10.byType.AllDamage-10*Math.log10(1.5))<1e-12);
 const late=extractTimedSetPower(profile,new Date("2027-01-15T00:00:00Z"));
 assert.ok(Math.abs(late.byType.AllDamage-Math.log10(1.88e64))<1e-12);
 const missing=parseAccountProfile({equipmentSets:["StainGlass"]});
 const empty=extractTimedSetPower(missing,new Date("2026-11-17T00:00:00Z"));
 assert.equal(empty.applied,0);
 assert.equal(empty.entries[0].status,"ignored-missing-set-completion-date");
 assert.equal(empty.byType.AllDamage,undefined);
});
test("date-backed spell and equipment-dependent daily effects are computed but not double-scored",()=>{
 const p=parseAccountProfile({equipmentSets:[{id:"Eyeball",completedAt:"2026-10-01"}]});
 const r=extractTimedSetPower(p,new Date("2026-10-11T00:00:00Z"));
 assert.equal(r.entries.length,2);
 assert.equal(r.calculated,2);
 assert.equal(r.applied,2);
 assert.ok(r.entries.some(x=>x.bonusType==="BurstDamageSkillAmount"&&x.appliedToScore));
 assert.ok(r.entries.some(x=>x.bonusType==="AllDamage"&&x.appliedToScore));
 const unresolved=parseAccountProfile({equipmentSets:[{id:"Tortoise",completedAt:"2026-10-01"}]});
 const t=extractTimedSetPower(unresolved,new Date("2026-10-11T00:00:00Z"));
 assert.equal(t.calculated,1);
 assert.equal(t.applied,0);
 assert.equal(t.entries[0].status,"calculated-unscored-interaction");
});

test("all 37 hero weapon slots resolve full collections without making up damage",()=>{
 assert.equal(HERO_ROSTER.length,37);
 const p=parseAccountProfile({heroWeapons:Object.fromEntries(HERO_ROSTER.map((id,i)=>[id,i===0?4:5]))});
 const e=heroWeaponEvidence(p);
 assert.equal(e.completeRosterVerified,true);
 assert.equal(e.completeSets,4);
 assert.equal(e.uniqueKnownHeroes,37);
 assert.ok(Math.abs(e.unboostedFullSetLog10-4*Math.log10(5))<1e-12);
 assert.ok(Math.abs(e.individual.find(x=>x.id===HERO_ROSTER[0]).unboostedHeroLog10-4*Math.log10(1.5))<1e-12);
 assert.equal(e.boostsModeled,false);
 const partial=parseAccountProfile({heroWeapons:Object.fromEntries(HERO_ROSTER.slice(0,36).map(id=>[id,5]))});
 assert.equal(heroWeaponEvidence(partial).completeSets,null);
});
test("unknown hero names and duplicate IDs never trigger fabricated completed sets",()=>{
 const p=parseAccountProfile({heroWeapons:{H01:4,H02:4,Unknown:200}});
 const e=heroWeaponEvidence(p);
 assert.equal(e.completeSets,null);
 assert.deepEqual(e.unknownHeroIds,["Unknown"]);
 assert.equal(e.missingHeroes,35);
});

test("Clan Scroll full-set source applies first +5%, then +10% each, only for a complete roster",()=>{
 const zero=parseAccountProfile({clanScrolls:Object.fromEntries(CLAN_SCROLLS.map(x=>[x.id,0]))});
 assert.equal(clanScrollEvidence(zero).setBonusPercent,0);
 const one=parseAccountProfile({clanScrolls:Object.fromEntries(CLAN_SCROLLS.map(x=>[x.id,1]))});
 assert.equal(clanScrollEvidence(one).setBonusPercent,0.05);
 const two=parseAccountProfile({clanScrolls:Object.fromEntries(CLAN_SCROLLS.map(x=>[x.id,2]))});
 const evidence=clanScrollEvidence(two);
 assert.ok(Math.abs(evidence.setBonusPercent-0.15)<1e-12);
 const entry=evidence.entries.find(x=>x.id==="ScrollId2");
 assert.ok(Math.abs(entry.setBoostedLog10-2*Math.log10(1.43)*1.15)<1e-12);
 const fromScore=extractFixedAccountPower(two).entries.find(x=>x.system==="clanScrolls"&&x.id==="ScrollId2");
 assert.ok(Math.abs(fromScore.log10-entry.setBoostedLog10)<1e-12);
 assert.equal(fromScore.setBoostModeled,true);
 const missing=parseAccountProfile({clanScrolls:{"ScrollId2":2}});
 assert.equal(clanScrollEvidence(missing).setBonusPercent,null);
 const partial=extractFixedAccountPower(missing).entries.find(x=>x.system==="clanScrolls"&&x.id==="ScrollId2");
 assert.ok(Math.abs(partial.log10-2*Math.log10(1.43))<1e-12);
 assert.equal(partial.setBoostModeled,false);
});

test("duplicate owned-set records never stack the same timed bonus twice",()=>{
 const p=parseAccountProfile({equipmentSets:[
  {id:"StainGlass",completedAt:"2026-10-01"},
  {id:"StainGlass",completedAt:"2026-10-01"}
 ]});
 const result=extractTimedSetPower(p,new Date("2026-10-11T00:00:00Z"));
 assert.equal(result.entries.length,1);
 assert.equal(result.applied,1);
 assert.ok(Math.abs(result.byType.AllDamage-10*Math.log10(1.5))<1e-12);
 assert.equal(accountDependencyGraph(p).sets.length,1);
});
test("conflicting duplicate set completion dates disable only the time bonus",()=>{
 const p=parseAccountProfile({equipmentSets:[
  {id:"StainGlass",completedAt:"2026-10-01"},
  {id:"StainGlass",completedAt:"2026-10-02"}
 ]});
 const dated=resolveSetCompletionDates(p,new Date("2026-10-11T00:00:00Z"));
 assert.equal(dated.StainGlass.days,null);
 assert.equal(dated.StainGlass.unresolved,"conflicting-export-dates");
 const result=extractTimedSetPower(p,new Date("2026-10-11T00:00:00Z"));
 assert.equal(result.entries.length,1);
 assert.equal(result.applied,0);
});

test("graph diagnostic excludes direct PerDay effects once scored",()=>{
 const scored=parseAccountProfile({equipmentSets:[{id:"StainGlass",completedAt:"2026-10-01"}]});
 const unresolved=parseAccountProfile({equipmentSets:["StainGlass"]});
 const scoredGraph=accountDependencyGraph(scored);
 const unknownGraph=accountDependencyGraph(unresolved);
 assert.equal(scoredGraph.timedSetPower.applied,1);
 assert.equal(unknownGraph.timedSetPower.applied,0);
 assert.equal(unknownGraph.unmodeledEffects-scoredGraph.unmodeledEffects,1);
 assert.ok(scoredGraph.unmodeledEffects>=0);
});

test("duplicated Titan Cards and research nodes never inflate log10 account power",()=>{
 const p=parseAccountProfile({
  titanCards:[{id:"Titan1",level:93},{id:"Titan1",level:999}],
  gemstonesResearch:[{id:"284",level:20},{id:"284",level:19}],
  titanResearch:[{id:"2",level:3},{id:"2",level:999}]
 });
 const power=extractFixedAccountPower(p);
 for(const system of ["titanCards","gemstoneResearch","titanResearch"]){
  assert.equal(power.entries.filter(x=>x.system===system).length,0);
  assert.ok(power.unsupported.some(x=>x.system===system&&x.reason==="duplicate-source-id"));
 }
});
test("a duplicate Clan Scroll cannot be scored or complete a full scroll set",()=>{
 const levels=CLAN_SCROLLS.map(x=>({id:x.id,level:2}));
 levels.push({id:CLAN_SCROLLS[0].id,level:999});
 const p=parseAccountProfile({clanScrolls:levels});
 const evidence=clanScrollEvidence(p);
 assert.equal(evidence.completeRoster,false);
 assert.equal(evidence.fullSets,null);
 assert.equal(evidence.setBonusPercent,null);
 assert.equal(evidence.entries.some(x=>x.id===CLAN_SCROLLS[0].id),false);
 assert.equal(extractFixedAccountPower(p).entries.some(x=>x.system==="clanScrolls"&&x.id===CLAN_SCROLLS[0].id),false);
});

test("all 20 Unique IDs remain owned regardless of equipped selection",()=>{
 assert.equal(Object.keys(UNIQUE_EQUIPMENT_TO_SET).length,20);
 const p=parseAccountProfile({
  equipmentInventory:[{id:"Weapon_AlphaHeart"},{id:"Hat_ElderSnow",setId:"ElderSnow"}],
  equippedEquipment:{Slash:{Id:"Slash_Kronus",Level:10}},
  uniqueEquipment:["Weapon_Maple","non-unique"],
  equipmentSets:["ElderSnow"]
 });
 const u=resolveUniqueOwnership(p);
 assert.deepEqual(u.ownedIds,["AlphaHeart","ElderSnow","Kronus","Maple"]);
 assert.deepEqual(u.sourceBySet.Kronus,["equippedGear"]);
 assert.deepEqual(u.sourceBySet.ElderSnow,["completed-sets","equipmentInventory"]);
 assert.equal(u.permanentBonusesModeled,false);
 assert.equal(p.sections.equippedGear.records[0].id,"Slash_Kronus");
 assert.equal(p.sections.equippedGear.records[0].slot,"Slash");
 const graph=accountDependencyGraph(p);
 assert.deepEqual(graph.uniquePermanentOwnership,u.ownedIds);
 assert.equal(graph.uniqueEquipment.ownedCount,4);
 assert.equal(graph.unmodeledEffects,4);
});
test("unrecognized equipment cannot create a fictitious Unique bonus",()=>{
 const fake=parseAccountProfile({equipmentInventory:[{id:"Weapon_Imaginary",setId:"NotReal"}]});
 assert.equal(resolveUniqueOwnership(fake).ownedCount,0);
 assert.equal(accountDependencyGraph(fake).unmodeledEffects,0);
 const real=parseAccountProfile({equipmentInventory:[{id:"Weapon_AlphaHeart"}]});
 assert.deepEqual(resolveUniqueOwnership(real).ownedIds,["AlphaHeart"]);
 assert.equal(accountDependencyGraph(real).unmodeledEffects,1);
});

test("selling all five pieces never removes unlocked permanent set bonuses",()=>{
 const sold=parseAccountProfile({equipmentSets:["DarkAngel","Samurai","StainGlass"],
  equipmentInventory:[],equippedEquipment:{}});
 const graph=accountDependencyGraph(sold);
 assert.deepEqual(sold.ownedSetIds,["DarkAngel","Samurai","StainGlass"]);
 assert.equal(graph.sets.length,3);
 assert.equal(graph.sets.every(set=>set.permanentAfterSale),true);
 assert.equal(graph.sets.find(set=>set.id==="Samurai").effects.length>0,true);
 assert.equal(resolveSetCompletionDates(sold).StainGlass.days,null);
 assert.equal(extractTimedSetPower(sold).applied,0);
 assert.equal(graph.sets.find(s=>s.id==="StainGlass").effects.some(e=>
  e.numericalStatus==="ignored-missing-set-completion-date"),true);
 // A separately recorded completion date survives after every item is sold.
 const dated=parseAccountProfile({completedEquipmentSets:[
  {id:"StainGlass",completedAt:"2026-10-01"}],equipmentInventory:[]});
 const timed=extractTimedSetPower(dated,new Date("2026-10-11T00:00:00Z"));
 assert.equal(timed.applied,1);
 assert.equal(timed.entries[0].days,10);
});

test("re-acquiring all five live equipment items must not invent an old set date",()=>{
 const pieces=["Sword","Helmet","Armor","Aura","Slash"].map((slot,i)=>({
  id:"reacquired"+i,setId:"StainGlass",slot,acquiredAt:"2026-11-"+String(i+1).padStart(2,"0")}));
 const p=parseAccountProfile({equipmentSets:["StainGlass"],equipmentInventory:pieces});
 assert.equal(resolveSetCompletionDates(p,new Date("2026-11-17T00:00:00Z")).StainGlass.days,null);
 assert.equal(extractTimedSetPower(p,new Date("2026-11-17T00:00:00Z")).applied,0);
 assert.equal(accountDependencyGraph(p).sets.length,1);
});

test("52 monuments are canonicalized across two import sections without double counting",()=>{
 assert.equal(Object.keys(SEASON_ARTIFACT_CATALOG).length,52);
 const p=parseAccountProfile({playerStats:{"Transcendence Season":13},
  monuments:[{id:"SeasonalArtifact8",lv:12},{id:"Beast Hunter's Grave",lv:4}],
  seasonArtifacts:[{id:"Red Water Wreckage",lv:12}]
 });
 const m=resolveMonumentEvidence(p,new Date("2026-11-17T00:00:00Z"));
 assert.equal(m.catalogCount,52);
 assert.equal(m.activeInCatalog,33);
 assert.equal(m.importedRecords,3);assert.equal(m.recognized,2);
 assert.equal(m.entries.find(x=>x.id==="SeasonalArtifact8").seasonDays,97);
 assert.equal(m.entries.find(x=>x.id==="SeasonalArtifact8").duplicated,true);
 assert.ok(m.entries.find(x=>x.id==="SeasonalArtifact4"));
 assert.equal(m.entries.every(x=>!x.appliedToScore),true);
 const graph=accountDependencyGraph(p);
 assert.equal(graph.artifacts.filter(x=>x.monument).length,2);
 assert.equal(graph.monuments.recognized,2);
});
test("conflicting monument entries, mismatched seasons and invalid levels are excluded",()=>{
 const conflict=parseAccountProfile({
  monuments:{SeasonalArtifact8:12},seasonArtifacts:{"Red Water Wreckage":14}});
 assert.equal(resolveMonumentEvidence(conflict).entries[0].formulaStatus,"ignored-conflicting-export-records");
 const wrong=parseAccountProfile({playerStats:{"Transcendence Season":13},
  monuments:[{id:"SeasonalArtifact8",level:2,season:12}]});
 assert.equal(resolveMonumentEvidence(wrong).entries[0].formulaStatus,"ignored-wrong-transcendence-season");
 const over=parseAccountProfile({monuments:{SeasonalArtifact8:41}});
 assert.equal(resolveMonumentEvidence(over).entries[0].formulaStatus,"ignored-missing-or-invalid-level");
 const noAge=parseAccountProfile({monuments:{SeasonalArtifact8:3}});
 assert.equal(resolveMonumentEvidence(noAge).entries[0].formulaStatus,"ignored-missing-transcendence-age");
});
test("uncapped monuments preserve scientific levels and inactive monuments do not score",()=>{
 const p=parseAccountProfile({monuments:{
  SeasonalArtifact2:{level:"1e9999"},SeasonalArtifact22:{level:3}}});
 const m=resolveMonumentEvidence(p);
 assert.equal(m.entries.find(x=>x.id==="SeasonalArtifact2").level,"1e9999");
 assert.equal(m.entries.find(x=>x.id==="SeasonalArtifact22").formulaStatus,"inactive-in-8.4-catalog");
 assert.equal(m.modeled,0);
});

test("main artifact scaling and enchantments match TT2Master equation, not linear estimates",()=>{
 const row=ARTIFACT_CATALOG.Artifact31;
 const lv=100;
 const baseline=1+Number(row.perLevel)*lv**Number(row.growthExpo);
 const enchanted=1+Number(row.perLevel)*Number(row.enchantedMagnitude)*lv**Number(row.growthExpo);
 assert.ok(Math.abs(computeArtifactEffect(row,lv).log10-Math.log10(baseline))<1e-12);
 assert.ok(Math.abs(computeArtifactEffect(row,lv,true).log10-Math.log10(enchanted))<1e-12);
 assert.ok(computeArtifactEffect(row,lv,true).log10>computeArtifactEffect(row,lv).log10+11);
});
test("enchantment and scientific notation are numerically stable for huge artifact levels",()=>{
 const r=computeArtifactEffect(ARTIFACT_CATALOG.Artifact38,"1e9999",true);
 assert.equal(r.status,"computed-main-effect");
 assert.ok(Number.isFinite(r.log10));
 assert.ok(r.log10>19900);
 assert.equal(positiveLog10("1e9999"),9999);
 assert.ok(Math.abs(log10OnePlusPower(1e5)-1e5)<1e-12);
});
test("direct artifact gold/damage enter provisional account scoring but conditional skills do not",()=>{
 const p=parseAccountProfile({artifacts:{
  Artifact31:{lv:100,enchanted:true},Artifact20:{lv:100,enchanted:true},
  Artifact22:{lv:100,enchanted:true},Artifact38:{lv:100,enchanted:true}
 }});
 const eff=calculatePermanentArtifactEffects(p,ARTIFACT_CATALOG);
 assert.equal(eff.recognized,4);
 assert.equal(eff.scored,3);
 assert.ok(eff.byType.AllDamage>10);
 assert.ok(eff.byType.GoldAll>10);
 const power=extractFixedAccountPower(p);
 const score=fixedAccountScore(power,{damage:"Pet",gold:"Fairy",goldWeight:0.7});
 assert.ok(score.damageLog10>eff.byType.AllDamage+eff.byType.PetDamage-1e-10);
 assert.ok(score.goldLog10>=eff.byType.GoldAll);
 assert.equal(eff.entries.find(x=>x.id==="Artifact22").appliedToScore,false);
});
test("conflicting duplicate artifact levels or enchant flags never multiply bonuses twice",()=>{
 const p=parseAccountProfile({artifacts:[
  {id:"Artifact31",lv:100,enchanted:false},
  {id:"Divine Retribution",lv:101,enchanted:true}
 ]});
 const r=calculatePermanentArtifactEffects(p,ARTIFACT_CATALOG);
 assert.equal(r.recognized,1);
 assert.equal(r.scored,0);
 assert.equal(r.entries[0].status,"conflicting-source-records");
});
test("season 13 category rotation supersedes outdated CSV IsActive flags",()=>{
 const p=parseAccountProfile({playerStats:{"Transcendence Season":13},
  monuments:{
   SeasonalArtifact22:{lv:20,enchanted:true},
   SeasonalArtifact8:{lv:20,enchanted:true},
   SeasonalArtifact31:{lv:100,enchanted:true}
  }});
 const e=resolveMonumentEvidence(p,new Date("2026-11-17T00:00:00Z"));
 assert.equal(e.entries.find(x=>x.id==="SeasonalArtifact22").categoryAllowed,true);
 assert.equal(e.entries.find(x=>x.id==="SeasonalArtifact8").categoryAllowed,false);
 assert.equal(e.entries.find(x=>x.id==="SeasonalArtifact8").formulaStatus,
  "not-in-current-transcendence-rotation");
 assert.equal(e.entries.find(x=>x.id==="SeasonalArtifact22").seasonDays,97);
 assert.equal(e.entries.find(x=>x.id==="SeasonalArtifact22").appliedToScore,false);
});
test("monument enchantment magnitude, capped levels, category and conditional scores",()=>{
 const p=parseAccountProfile({playerStats:{"Transcendence Season":13},
  monuments:{SeasonalArtifact34:{level:100,enchanted:true},
   SeasonalArtifact31:{level:"1e100",enchanted:true}}});
 const m=resolveMonumentEvidence(p,new Date("2026-11-17T00:00:00Z"));
 const temper=m.entries.find(x=>x.id==="SeasonalArtifact34");
 assert.ok(temper.log10>0);
 assert.equal(temper.enchanted,true);
 assert.equal(temper.appliedToScore,false);
 assert.equal(temper.enchantmentDeltaLog10>0,true);
 assert.equal(m.entries.every(x=>x.appliedToScore===false),true);
});

test("missing enchant marker is unknown for enchantable permanent artifacts",()=>{
 const p=parseAccountProfile({artifacts:{Artifact31:{level:100}}});
 const r=calculatePermanentArtifactEffects(p,ARTIFACT_CATALOG);
 assert.equal(r.scored,0);
 assert.equal(r.entries[0].status,"unknown-enchantment-state");
 assert.equal(r.entries[0].enchanted,null);
 const known=parseAccountProfile({artifacts:{Artifact31:{level:100,e:0}}});
 const r2=calculatePermanentArtifactEffects(known,ARTIFACT_CATALOG);
 assert.equal(r2.scored,1);
 assert.equal(r2.entries[0].enchanted,false);
});
test("monuments retain genuine boolean enchantment state and unknown season blocks scoring",()=>{
 const p=parseAccountProfile({playerStats:{"Transcendence Season":13},
  monuments:{SeasonalArtifact34:{level:100,e:1}}});
 const r=resolveMonumentEvidence(p,new Date("2026-11-17T00:00:00Z"));
 assert.equal(r.entries[0].enchanted,true);
 assert.equal(r.entries[0].enchantmentDeltaLog10>0,true);
 const unknown=parseAccountProfile({monuments:{SeasonalArtifact10:{level:100,enchanted:true}}});
 const u=resolveMonumentEvidence(unknown);
 assert.equal(u.entries[0].formulaStatus,"unknown-season-category");
 assert.equal(u.modeled,0);
 const missing=parseAccountProfile({playerStats:{"Transcendence Season":13},
  monuments:{SeasonalArtifact34:{level:100}}});
 assert.equal(resolveMonumentEvidence(missing).entries[0].formulaStatus,"unknown-enchantment-state");
});

test("artifact damage is a separate linear pool, not repeated main artifact multiplier",()=>{
 const p=parseAccountProfile({artifacts:{
  Artifact31:{level:100,e:1},Artifact38:{level:100,e:0}
 }});
 const effects=calculatePermanentArtifactEffects(p,ARTIFACT_CATALOG);
 const additive=additiveDamageEvidence(effects,{entries:[]},ARTIFACT_CATALOG,SEASON_ARTIFACT_CATALOG);
 assert.equal(additive.artifacts.components,2);
 assert.ok(Math.abs(additive.artifacts.unenchantedPoolLog10-
  Math.log10((Number(ARTIFACT_CATALOG.Artifact31.damageBonus)+
   Number(ARTIFACT_CATALOG.Artifact38.damageBonus))*100))<1e-10);
 assert.equal(additive.appliedToScore,false);
});
test("additive Monument Damage uses DamageExpo and never multiplies monument components",()=>{
 const info=SEASON_ARTIFACT_CATALOG.SeasonalArtifact34;
 const mon={entries:[{id:"SeasonalArtifact34",level:"100",enchanted:true,
  categoryAllowed:true,formulaStatus:"computed-unscored-interaction"}]};
 const additive=additiveDamageEvidence({entries:[]},mon,ARTIFACT_CATALOG,SEASON_ARTIFACT_CATALOG);
 assert.equal(additive.monuments.components,1);
 assert.ok(Math.abs(additive.monuments.unenchantedPoolLog10-
  (Math.log10(Number(info.damageBonus))+
    Number(info.damageExpo)*Math.log10(100)))<1e-7);
 assert.ok(additive.monuments.candidateEnchantedPoolLog10-
  additive.monuments.unenchantedPoolLog10>19);
 assert.equal(info.enchantmentMagnitude,"1.00E+01");
 assert.equal(info.enchantmentMult,"1.00E+20");
});
test("large additive pools add in log-space without multiplying independent monuments",()=>{
 assert.ok(Math.abs(log10Sum([100,100])-(100+Math.log10(2)))<1e-12);
 assert.equal(log10Sum([]),null);
 const row=SEASON_ARTIFACT_CATALOG.SeasonalArtifact34;
 assert.ok(Math.abs(rawDamageLog10(row,"1e9999","monument")-
  (Math.log10(Number(row.damageBonus))+9999*Number(row.damageExpo)))<1e-8);
});

test("169 additive Mystic Research nodes grant exact gemstone levels without multiplying power",()=>{
 assert.equal(RESOURCE_RESEARCH_CATALOG.gemstoneLevel.length,169);
 const p=parseAccountProfile({
  gemstonesResearch:{0:{level:30},2:{level:7},503:{level:5}},
  playerStats:{"Gemstone Level":8000}
 });
 const e=resourceResearchEvidence(p);
 assert.equal(e.gemstones.extraLevelsFromResearch,42);
 assert.equal(e.gemstones.matchedNodes,3);
 assert.equal(e.gemstones.effectiveGemstoneLevel,null);
 assert.equal(e.gemstones.scoreAdjusted,false);
 assert.equal(p.stats.gemstoneLevel,"8000");
 assert.equal(extractFixedAccountPower(p).entries.filter(x=>x.bonusType==="GemstoneLevel").length,0);
});
test("62 Titan Soul utility nodes correctly sum days, prestige and chance separately",()=>{
 assert.equal(RESOURCE_RESEARCH_CATALOG.titanSouls.length,62);
 const p=parseAccountProfile({
  titanResearch:{"1":{level:3},"5":{level:2},"6":{level:3},"17":{level:4}},
  playerStats:{"Titan Souls":"1e900","Titan Souls Spent":"2e800"}
 });
 const e=resourceResearchEvidence(p);
 assert.equal(e.titanSouls.matchedNodes,4);
 assert.equal(e.titanSouls.bonusPerDay,70);
 assert.equal(e.titanSouls.bonusPerPrestige,50);
 assert.ok(Math.abs(e.titanSouls.rawChanceBonusFraction-0.006)<1e-12);
 assert.equal(e.titanSouls.balance,"1e900");
 assert.equal(e.titanSouls.lifetimeSpent,"2e800");
 assert.equal(e.titanSouls.bonusAppliedToDamageScore,false);
 assert.equal(e.titanSouls.totalGainPerDay,null);
});
test("mirror and disjoint Necrobear sections count each node exactly once",()=>{
 const p=parseAccountProfile({
  titanResearch:{"2":{level:3},"6":{level:2}},
  forbiddenResearch:{"2":{level:3},"17":{level:4}}
 });
 const merged=mergeTitanResearch(p);
 assert.deepEqual(merged.records.map(x=>x.id).sort(),["17","2","6"]);
 assert.equal(merged.unknown.length,0);
 const e=resourceResearchEvidence(p);
 assert.equal(e.titanSouls.bonusPerDay,60);
 const score=extractFixedAccountPower(p);
 assert.equal(score.entries.filter(x=>x.system==="titanResearch"&&x.id==="2").length,1);
});
test("inconsistent mirror research and same-section duplicates are excluded",()=>{
 const p=parseAccountProfile({
  titanResearch:[{id:"2",level:3},{id:"6",level:1},{id:"6",level:1}],
  forbiddenResearch:[{id:"2",level:5},{id:"17",level:2}]
 });
 const merged=mergeTitanResearch(p);
 assert.deepEqual(merged.records.map(x=>x.id),["17"]);
 assert.equal(merged.unknown.length,2);
 assert.equal(resourceResearchEvidence(p).titanSouls.bonusPerDay,20);
 assert.equal(extractFixedAccountPower(p).entries.filter(x=>x.system==="titanResearch"&&x.id==="2").length,0);
});
test("invalid research purchases never grant power or resource income",()=>{
 const p=parseAccountProfile({gemstonesResearch:[
  {id:"0",level:31},{id:"2",level:10},{id:"2",level:10}
 ],titanResearch:{"1":{level:4},"6":{level:-2}}});
 const e=resourceResearchEvidence(p);
 assert.equal(e.gemstones.extraLevelsFromResearch,0);
 assert.equal(e.titanSouls.bonusPerDay,0);
 assert.equal(e.titanSouls.rawChanceBonusFraction,0);
 assert.ok(e.unknown.length>=4);
 assert.equal(e.complete,false);
});
