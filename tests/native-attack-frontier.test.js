import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints} from "../src/engine.js";
import {sourcedDamageChannels} from "../src/attack-channels.js";
import {nativeAttackModifierLog10,exploreNativeAttackDamageFrontier}
 from "../src/attack-damage-frontier.js";
import {skillInfo} from "../vendor/skills.js";

test("source registry covers all six build families without treating charged/skip states as hits",()=>{
 assert.deepEqual(new Set(DAMAGE_TYPES),new Set([
  "Clan Ship","Pet","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"]));
 for(const damage of DAMAGE_TYPES){
  const channels=sourcedDamageChannels(damage);
  assert.ok(channels.length>=1,damage);
  for(const x of channels){
   assert.ok(["normal","burst"].includes(x.role));
   assert.equal(skillInfo[x.sourceSkillId]["BonusType"+x.sourceColumn],
    x.sourceBonusType);
   assert.equal(nativeAttackModifierLog10(x,0),null);
   assert.ok(Number.isFinite(nativeAttackModifierLog10(x,1)));
  }
 }
 assert.ok(!sourcedDamageChannels("Pet").some(x=>x.id==="flash-zip-charged"));
 assert.ok(!sourcedDamageChannels("Gold Gun").some(x=>x.id==="golden-missile-skip"));
 assert.ok(!sourcedDamageChannels("Dagger").some(x=>x.id==="phantom-blades"));
 const thunder=sourcedDamageChannels("Clan Ship").find(x=>x.id==="thunder-volley");
 assert.equal(thunder.sourceColumn,"B");
 assert.equal(nativeAttackModifierLog10(thunder,1),
  Math.log10(Number(skillInfo.ClanShipVoltage.B1)));
});

test("native damage frontier is opt-in and missing selection never runs solver",()=>{
 const no=exploreNativeAttackDamageFrontier({damage:"Pet",gold:"Fairy"});
 assert.equal(no.status,"not-requested");
 const x=exploreNativeAttackDamageFrontier({
  damage:"Pet",gold:"Fairy",attackDamageFrontierEnabled:true
 },{
  solve:()=>{throw new Error("Must not solve without an attack");}
 });
 assert.equal(x.reason,"choose-native-damage-attack");
});

test("every damage/gold combination keeps the same feasible baseline with no guessed stage gain",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const source=sourcedDamageChannels(damage)[0];
  const options={damage,gold,skillPoints:150,goldWeight:.7,
   maxStage:300000,qol:"none",minimums:{},currentLevels:{},
   attackDamageFrontierEnabled:true,attackDamageChannelId:source.id};
  const baseline=optimizeBuild(options);
  const x=exploreNativeAttackDamageFrontier(options,{
   baselineResult:baseline,solve:optimizeBuild,maxConstrained:1
  });
  assert.equal(x.status,"explored",damage+"/"+gold);
  assert.equal(x.rows[0].id,"original");
  assert.deepEqual(x.rows[0].levels,baseline.levels);
  assert.equal(x.rows[0].scoreProxyLog10,baseline.score);
  assert.equal(x.sourceAttackId,source.id);
  assert.equal(x.stageGainPredicted,false);
  assert.equal(x.noAbsoluteHitDamageInferred,true);
  assert.equal(x.comparisonWithinOneAttackOnly,true);
  assert.ok(x.rows.length<=2);
  for(const row of x.rows){
   assert.ok(spentPoints(row.levels)<=options.skillPoints);
   assert.equal(row.observedHitTransferred,false);
   assert.equal(row.stageGainPredicted,false);
   assert.equal(row.sourceModifierIsNotTotalAttackDamage,true);
  }
 }
});

test("source attack Pareto yields different allocations with demonstrably higher native talent multiplier",()=>{
 const damage="Pet",gold="Fairy",source=sourcedDamageChannels(damage)
  .find(x=>x.id==="lightning-burst");
 const options={damage,gold,skillPoints:1000,
  attackDamageChannelId:source.id,attackDamageFrontierEnabled:true};
 const mockSolve=(settings)=>{
  const level=Math.max(1,Number(settings.minimums?.PetQTE??1));
  return {levels:{PetQTE:level},spent:level,branchTotals:{Summoner:level},
   score:100-level,optimality:{upperBound:100-level,mode:"exact"}};
 };
 const baseline=mockSolve({minimums:{}});
 const x=exploreNativeAttackDamageFrontier(options,{
  baselineResult:baseline,solve:mockSolve,maxConstrained:2
 });
 assert.equal(x.status,"explored");
 assert.ok(x.rows.length>1);
 assert.equal(x.changedTrees,true);
 for(const row of x.rows.slice(1)){
  assert.ok(row.sourceNativeModifierLog10>x.rows[0].sourceNativeModifierLog10);
  assert.ok(row.sourceSkillLevel>x.rows[0].sourceSkillLevel);
 }
 assert.ok(x.pareto.length>=2);
 assert.equal(x.recommendationByRealStages,false);
});

test("equipped spell exclusion and impossible requirements fail safely",()=>{
 const source=sourcedDamageChannels("Heavenly Strike")[0];
 const options={damage:"Heavenly Strike",gold:"Fairy",skillPoints:100,
  attackDamageChannelId:source.id,attackDamageFrontierEnabled:true,
  selectedSpells:[]};
 const x=exploreNativeAttackDamageFrontier(options,{
  solve:()=>{throw new Error("Must reject absent spell");}
 });
 assert.equal(x.reason,"required-attack-spell-not-equipped");
 assert.throws(()=>nativeAttackModifierLog10(source,-1));
 assert.throws(()=>exploreNativeAttackDamageFrontier({
  ...options,selectedSpells:null
 },{solve:()=>{},maxConstrained:4}),/one to three/);
});

test("native comparison is exposed in four languages and the final worker",()=>{
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.equal((html.match(/id="attack-damage-channel"/g)||[]).length,1,path);
  assert.equal((html.match(/id="attack-damage-frontier-enabled"/g)||[]).length,1,path);
  assert.ok(html.includes("src/app.js?v=20261123-native-attack-r1"));
 }
 const worker=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
 assert.match(worker,/exploreNativeAttackDamageFrontier\(fixed,/);
 assert.match(worker,/maxConstrained:2,baselineResult:result/);
});
