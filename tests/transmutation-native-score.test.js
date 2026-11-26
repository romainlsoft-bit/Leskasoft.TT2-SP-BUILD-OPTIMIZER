import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {skillInfo} from "../vendor/skills.js";
import {scoreAtLevel} from "../src/effects.js";
import {binaryExpectedMultiplierLog10} from "../src/conditional-probabilities.js";
import {transmutationSourceEventEvidence} from "../src/transmutation-native.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints} from "../src/engine.js";

const options=(damage="Pet",gold="Fairy",extra={})=>({
 damage,gold,goldWeight:.7,skillPoints:200,maxStage:300000,
 currentLevels:{},minimums:{},qol:"none",sets:{},...extra
});
const near=(actual,expected,where)=>assert.ok(Number.isFinite(actual)&&
 Number.isFinite(expected)&&Math.abs(actual-expected)<1e-9,
 where+": "+actual+" != "+expected);

test("Transmutation source names identify a chance-gated Jackpot multiplier",()=>{
 const row=skillInfo.Transmutation;
 assert.equal(row.BonusTypeA,"JackpotGold");
 assert.equal(row.BonusTypeB,"JackpotGoldChance");
 assert.equal(Number(row.MaxLevel),60);
 assert.equal(transmutationSourceEventEvidence(0).sourceOnlyExpectedGoldLog10,0);
 assert.throws(()=>transmutationSourceEventEvidence(-1),/Invalid/);
 assert.throws(()=>transmutationSourceEventEvidence(61),/Invalid/);
 assert.throws(()=>transmutationSourceEventEvidence(1.2),/Invalid/);
});
test("18 source routes × 7 levels use native event expectation, not permanent Jackpot Gold",()=>{
 let total=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  for(const level of [0,1,5,10,20,30,60]){
   const result=transmutationSourceEventEvidence(level);
   const p=level===0?0:Number(skillInfo.Transmutation["B"+level]);
   const multiplier=level===0?1:Number(skillInfo.Transmutation["A"+level]);
   const expected=level===0?0:
    Math.log10((1-p)+p*multiplier);
   near(result.sourceOnlyExpectedGoldLog10,expected,
    damage+"/"+gold+"/"+level+" event");
   near(scoreAtLevel("Transmutation",level,options(damage,gold)),
    .7*expected,damage+"/"+gold+"/"+level+" weighted");
   if(level>0){
    assert.equal(result.nativeJackpotChance,p);
    assert.equal(result.accountExpectationVerified,false);
    assert.equal(result.appliesToEveryAttackHit,false);
    assert.equal(result.stageGainPredicted,false);
    assert.ok(result.sourceOnlyExpectedGoldLog10<=Math.log10(multiplier)+1e-9);
   }
   total++;
  }
 }
 assert.equal(total,18*7);
});
test("source-only Jackpot probability is stable, finite, and unaffected by imported observed chance",()=>{
 for(const level of [1,5,20,60]){
  const p=Number(skillInfo.Transmutation["B"+level]);
  const log=Math.log10(Number(skillInfo.Transmutation["A"+level]));
  const native=transmutationSourceEventEvidence(level);
  near(native.sourceOnlyExpectedGoldLog10,
   binaryExpectedMultiplierLog10(p,log),"native expected event "+level);
 }
 const profile={chanceEvidence:{families:{
  jackpot:{fraction:.95,status:"explicit-percent-observed"}}}};
 const bare=scoreAtLevel("Transmutation",20,options());
 const imported=scoreAtLevel("Transmutation",20,options("Pet","Fairy",{
  accountProfile:profile
 }));
 assert.equal(bare,imported);
 assert.equal(transmutationSourceEventEvidence(60).nativeJackpotChance,.35);
});
test("imported Transmutation protected rather than erased by an incomplete probability model",()=>{
 const s=options("Pet","Fairy",{
  currentLevels:{Transmutation:10},protectUnmodeledSkills:true
 });
 const x=optimizeBuild(s);
 assert.ok(x.protectedSkills.includes("Transmutation"));
 assert.ok(x.levels.Transmutation>=10);
 assert.ok(spentPoints(x.levels)<=200);
 const row=x.investmentAudit.protectedEntries.find(
  v=>v.id==="Transmutation");
 assert.equal(row.reason,"jackpot-event-probability-not-verified-for-account");
 assert.equal(x.modelAttribution.nativeConditionalScoringGuards
  .transmutationDoesNotCreditFullJackpotAsAlwaysOn,true);
 assert.equal(x.jackpotSourceOnly.level,x.levels.Transmutation);
 assert.equal(x.jackpotSourceOnly.accountExpectationVerified,false);
});
test("18 routes remain feasible at 100 SP with valid model attribution",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const x=optimizeBuild(options(damage,gold,{skillPoints:100}));
  assert.ok(spentPoints(x.levels)<=100);
  assert.equal(x.modelAttribution.additiveReconstructionMatches,true);
  assert.equal(x.modelAttribution.nativeConditionalScoringGuards
   .transmutationIsConditionalEventExpectation,true);
  assert.equal(x.jackpotSourceOnly.accountExpectationVerified,false);
  assert.equal(x.jackpotSourceOnly.stageGainPredicted,false);
 }
});
test("locale cache versions and GH Actions prohibition",()=>{
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
 const engine=readFileSync(new URL("../src/engine.js",import.meta.url),"utf8");
 const ti=readFileSync(new URL("../src/tactical-insight-sensitivity.js",import.meta.url),"utf8");
 const alt=readFileSync(new URL("../src/ti-alternative.js",import.meta.url),"utf8");
 const extract=(s,mod)=>s.match(new RegExp(mod+"\\?([^\\\"]+)"))?.[1];
 assert.equal(extract(app,"engine\\.js"),extract(worker,"engine\\.js"));
 assert.equal(extract(engine,"effects\\.js"),extract(ti,"effects\\.js"));
 assert.equal(extract(engine,"effects\\.js"),extract(alt,"effects\\.js"));
 assert.ok(engine.includes("20261123-native-jackpot-expectation-r1"));
 const details=readFileSync(new URL("../src/result-details-ui.js",import.meta.url),"utf8");
  assert.ok(details.includes("result.jackpotSourceOnly"));
  assert.ok(app.includes("createResultDetailRenderers"));
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  assert.ok(readFileSync(new URL("../"+path,import.meta.url),"utf8")
   .includes("&amp;jackpot=20261123-native-jackpot-expectation-r1"));
 }
 assert.equal(existsSync(new URL("../.github/workflows/",import.meta.url)),false);
});
