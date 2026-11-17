import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {extractFixedAccountPower,fixedAccountScore,formatLogMultiplier} from "../src/account-power.js";
import {accountDependencyGraph,bonusDependence,invalidateAccountNodes,validateAccountGraph} from "../src/account-dependencies.js";
import {ARTIFACT_CATALOG,EQUIPMENT_SET_CATALOG,SEASON_ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {ACCOUNT_SCALING} from "../vendor/account-scaling.js";
import {resolveSetCompletionDates,resolveTranscendenceAge,heroWeaponEvidence} from "../src/account-temporal.js";
import {optimizeBuild} from "../src/engine.js";

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
test("fifth separately dated equipment slot completes the set",()=>{
 const pieces=["Sword","Helmet","Armor","Aura","Slash"].map((slot,index)=>({
  id:"piece"+index,setId:"StainGlass",slot,acquiredAt:"2026-10-"+String(index+1).padStart(2,"0")}));
 const full=parseAccountProfile({equipmentSets:["StainGlass"],equipmentInventory:pieces});
 const date=resolveSetCompletionDates(full,new Date("2026-10-09T00:00:00Z")).StainGlass;
 assert.equal(date.completedAt,"2026-10-05T00:00:00.000Z");
 assert.equal(date.days,4);
 assert.equal(date.source,"five-equipment-acquisitions");
 const missing=parseAccountProfile({equipmentSets:["StainGlass"],equipmentInventory:pieces.slice(0,4)});
 assert.equal(resolveSetCompletionDates(missing).StainGlass.days,null);
 const undated=parseAccountProfile({equipmentSets:["StainGlass"],equipmentInventory:
  pieces.map(({acquiredAt,...item})=>item)});
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
