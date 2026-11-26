import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {skillInfo} from "../vendor/skills.js";
import {reductions} from "../vendor/reductions.js";
import {ambushSourceEventEvidence,GUIDE_BASE_MULTIPLE_TITAN_CHANCE}
 from "../src/ambush-native-score.js";
import {binaryExpectedMultiplierLog10}
 from "../src/conditional-probabilities.js";
import {scoreAtLevel} from "../src/effects.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints}
 from "../src/engine.js";

const base=(damage="Pet",gold="Chesterson",more={})=>({
 damage,gold,goldWeight:.7,skillPoints:500,maxStage:300000,
 sets:{},minimums:{},currentLevels:{},qol:"none",...more
});
const close=(a,b,desc)=>assert.ok(Number.isFinite(a)&&
 Number.isFinite(b)&&Math.abs(a-b)<1e-9,
 desc+": "+a+" vs "+b);

test("Ambush source A is conditional Multiple Titan Gold, B is MAX COUNT, never a percent",()=>{
 const row=skillInfo.MultiMonsters;
 assert.equal(row.Name,"Ambush");
 assert.equal(row.BonusTypeA,"MultiMonstersGold");
 assert.equal(row.BonusTypeB,"MultiMonstersMaxCount");
 assert.equal(GUIDE_BASE_MULTIPLE_TITAN_CHANCE,.01);
 const zero=ambushSourceEventEvidence(0);
 assert.equal(zero.sourceOnlyExpectedGoldLog10,0);
 assert.equal(zero.countIsNotChance,true);
 for(const value of [-1,51,1.5,NaN])
  assert.throws(()=>ambushSourceEventEvidence(value),/Invalid Ambush/);
});
test("18 routes and seven native Ambush levels: only Chesterson gets chance-weighted eligible-event gold",()=>{
 const levels=[0,1,2,5,10,20,30];
 let count=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  for(const level of levels){
   const row=ambushSourceEventEvidence(level);
   const multiplier=level===0?1:Number(skillInfo.MultiMonsters["A"+level]);
   const logA=level===0?0:Math.log10(multiplier);
   const expectation=level===0?0:binaryExpectedMultiplierLog10(.01,logA);
   close(row.sourceOnlyExpectedGoldLog10,expectation,
    damage+"/"+gold+"/"+level+" conditional event");
   const reduction=Number(reductions.MultiMonsters?.[gold]??0);
   const weighted=.7*reduction*expectation;
   close(scoreAtLevel("MultiMonsters",level,base(damage,gold)),weighted,
    damage+"/"+gold+"/"+level+" optimizer");
   assert.equal(row.sourceMaxMultipleTitanCount,
    Number(skillInfo.MultiMonsters["B"+level]));
   assert.equal(row.realEncounterRateVerified,false);
   assert.equal(row.countIsNotChance,true);
   assert.equal(row.predictsStages,false);
   if(gold!=="Chesterson")close(weighted,0,damage+"/"+gold);
   if(gold==="Chesterson"&&level>0)
    assert.ok(weighted<=.7*logA+1e-9);
   count++;
  }
 }
 assert.equal(count,18*levels.length);
});
test("Ambush level 1 is NOT unconditional group gold and B never becomes a chance",()=>{
 const ctx=base("Pet","Chesterson");
 const a=Number(skillInfo.MultiMonsters.A1),p=.01;
 const expected=.7*Math.log10(1-p+p*a);
 close(scoreAtLevel("MultiMonsters",1,ctx),expected,"level 1");
 assert.ok(expected<.7*Math.log10(a));
 const cap=ambushSourceEventEvidence(20).sourceMaxMultipleTitanCount;
 assert.equal(cap,20);
 assert.equal(ambushSourceEventEvidence(20).modeledBaseEncounterChance,.01);
});
test("imported account observations do not get reused to score a new Ambush talent tree",()=>{
 const chanceEvidence={families:{multipleTitan:{
  fraction:.80,status:"explicit-percent-observed"}}};
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const withAccount=base(damage,gold,{
   accountProfile:{chanceEvidence}});
  for(const n of [1,10,30])
   close(scoreAtLevel("MultiMonsters",n,withAccount),
    scoreAtLevel("MultiMonsters",n,base(damage,gold)),
    damage+"/"+gold+"/"+n+" unchanged");
 }
});
test("protects imported Ambush skill if actual multi-spawn frequency is unmodeled",()=>{
 const ctx=base("Dagger","Chesterson",{
  currentLevels:{MultiMonsters:1},skillPoints:500,
  protectUnmodeledSkills:true
 });
 const x=optimizeBuild(ctx);
 assert.ok(x.protectedSkills.includes("MultiMonsters"));
 assert.ok(x.levels.MultiMonsters>=1);
 assert.ok(spentPoints(x.levels)<=500);
 const record=x.investmentAudit.protectedEntries.find(
  e=>e.id==="MultiMonsters");
 assert.equal(record.reason,
  "ambush-multiple-titan-encounter-frequency-unverified");
 assert.equal(x.ambushSourceOnly.level,x.levels.MultiMonsters);
 assert.equal(x.ambushSourceOnly.realEncounterRateVerified,false);
 assert.equal(x.modelAttribution.nativeConditionalScoringGuards
  .ambushGoldNotCreditedOnEveryChestersonEvent,true);
 assert.equal(x.modelAttribution.nativeConditionalScoringGuards
  .ambushMaximumTitanCountNotUsedAsEncounterChance,true);
});
test("all 18 routes maintain feasible score and no leaked Ambush gold multipliers",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const x=optimizeBuild(base(damage,gold,{skillPoints:100}));
  assert.ok(spentPoints(x.levels)<=100);
  assert.equal(x.modelAttribution.additiveReconstructionMatches,true);
  assert.equal(x.ambushSourceOnly.realEncounterRateVerified,false);
  assert.equal(x.ambushSourceOnly.predictsStages,false);
 }
});
test("entrypoint caching, model identity, 4 locales and prohibition on GitHub Actions",()=>{
 const files=["src/app.js","src/result-details-ui.js","src/worker.js","src/engine.js",
  "src/tactical-insight-sensitivity.js","src/ti-alternative.js"];
 const code=Object.fromEntries(files.map(path=>[
  path,readFileSync(new URL("../"+path,import.meta.url),"utf8")]));
 const importId=(path,mod)=>code[path].match(new RegExp(
  mod.replaceAll(".","\\.")+"\\?([^\\\"]+)"))?.[1];
 assert.equal(importId("src/app.js","engine.js"),
  importId("src/worker.js","engine.js"));
 assert.equal(importId("src/engine.js","effects.js"),
  importId("src/tactical-insight-sensitivity.js","effects.js"));
 assert.equal(importId("src/engine.js","effects.js"),
  importId("src/ti-alternative.js","effects.js"));
 const tag="20261124-ambush-conditional-gold-r1";
 assert.ok(code["src/engine.js"].includes(tag));
 assert.ok(code["src/result-details-ui.js"].includes("ambushNotice"));
 assert.ok(code["src/app.js"].includes("createResultDetailRenderers"));
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const page=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.ok(page.includes("&amp;ambush="+tag),path);
 }
 assert.equal(existsSync(new URL("../.github/workflows/",import.meta.url)),false);
});
