import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {skillInfo} from "../vendor/skills.js";
import {reductions} from "../vendor/reductions.js";
import {binaryExpectedMultiplierLog10} from "../src/conditional-probabilities.js";
import {cleavingStrikeSourceEvidence} from "../src/cleaving-strike-native.js";
import {scoreAtLevel} from "../src/effects.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints}
 from "../src/engine.js";

const base=(damage="Pet",gold="Fairy",extra={})=>({
 damage,gold,skillPoints:500,goldWeight:.7,maxStage:300000,
 currentLevels:{},minimums:{},qol:"none",sets:{},...extra
});
const close=(a,b,msg)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<1e-9,msg+": "+a+" vs "+b);
const LEVELS=[0,1,5,10,20,30,40,50];

test("native Cleaving Strike has distinct CritDamage A and CritChance B",()=>{
 assert.equal(skillInfo.HeavyStrikes.Name,"Cleaving Strike");
 assert.equal(skillInfo.HeavyStrikes.BonusTypeA,"CritDamage");
 assert.equal(skillInfo.HeavyStrikes.BonusTypeB,"CritChance");
 assert.equal(skillInfo.HeavyStrikes.MaxLevel,50);
 for(const bad of [-1,51,1.5,NaN])
  assert.throws(()=>cleavingStrikeSourceEvidence(bad,"Pet"),
   /Invalid Cleaving Strike/);
});
test("all 18 damage/gold paths and eight source levels use chance-weighted crit except guaranteed Heavenly Strike",()=>{
 let count=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  for(const level of LEVELS){
   const evidence=cleavingStrikeSourceEvidence(level,damage);
   const chance=level===0?0:Number(skillInfo.HeavyStrikes["B"+level]);
   const multiplier=level===0?1:Number(skillInfo.HeavyStrikes["A"+level]);
   const actualCrit=damage==="Heavenly Strike";
   const p=actualCrit?1:chance;
   const expected=level===0?0:binaryExpectedMultiplierLog10(
    p,Math.log10(multiplier));
   const observed=scoreAtLevel("HeavyStrikes",level,base(damage,gold));
   const r=Number(reductions.HeavyStrikes[damage]??0);
   close(observed,r*expected,damage+"/"+gold+"/"+level);
   close(evidence.sourceExpectedLog10,expected,
    "source "+damage+"/"+gold+"/"+level);
   assert.equal(evidence.guaranteedByHeavenlyStrike,actualCrit);
   assert.equal(evidence.accountExpectationVerified,false);
   assert.equal(evidence.predictsStages,false);
   if(level>0){
    assert.equal(evidence.sourceCriticalChance,chance);
    assert.equal(evidence.effectiveHypotheticalChance,p);
    assert.ok(observed<=r*Math.log10(multiplier)+1e-9);
   }
   count++;
  }
 }
 assert.equal(count,144);
});
test("non-Heavenly Strike's low-level crit score is not full unconditional CritDamage",()=>{
 const at=5;
 const pet=scoreAtLevel("HeavyStrikes",at,base());
 const hs=scoreAtLevel("HeavyStrikes",at,base("Heavenly Strike"));
 assert.ok(hs>pet);
 const sourceA=Math.log10(Number(skillInfo.HeavyStrikes.A5));
 close(hs,sourceA,"Heavenly Strike always critical");
 close(pet,Math.log10(1-.05+.05*Number(skillInfo.HeavyStrikes.A5)),
  "Pet hypothetical per-event crit");
});
test("imported observed critical probability is not copied to a candidate tree",()=>{
 const fake={chanceEvidence:{families:{critical:{
  fraction:.99,status:"explicit-percent-observed"}}}};
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  for(const level of [1,20,50]){
   const without=scoreAtLevel("HeavyStrikes",level,base(damage,gold));
   const withAccount=scoreAtLevel("HeavyStrikes",level,base(damage,gold,{
    accountProfile:fake}));
   close(without,withAccount,damage+"/"+gold+"/"+level);
  }
 }
});
test("imported Cleaving Strike remains protected for non-HS when total crit chance is unknown",()=>{
 const s=base("Pet","Fairy",{currentLevels:{
  TapDmg:5,TapDmgFromHelpers:5,HeavyStrikes:5
 },protectUnmodeledSkills:true,skillPoints:500});
 const x=optimizeBuild(s);
 assert.ok(x.protectedSkills.includes("HeavyStrikes"));
 assert.ok(x.levels.HeavyStrikes>=5);
 assert.ok(spentPoints(x.levels)<=500);
 const protectedRow=x.investmentAudit.protectedEntries.find(
  item=>item.id==="HeavyStrikes");
 assert.equal(protectedRow.reason,
  "cleaving-strike-critical-chance-not-verified-for-account");
 assert.equal(x.criticalSourceOnly.level,x.levels.HeavyStrikes);
 assert.equal(x.criticalSourceOnly.guaranteedByHeavenlyStrike,false);
 assert.equal(x.modelAttribution.nativeConditionalScoringGuards
  .cleavingStrikeOtherBuildsUseSourceOnlyCritChance,true);
});
test("Heavenly Strike guaranteed crit is not reported as an uncertain protected effect",()=>{
 const s=base("Heavenly Strike","Fairy",{currentLevels:{
  TapDmg:5,TapDmgFromHelpers:5,HeavyStrikes:5
 },skillPoints:500,protectUnmodeledSkills:true});
 const x=optimizeBuild(s);
 assert.equal(x.protectedSkills.includes("HeavyStrikes"),false);
 assert.equal(x.criticalSourceOnly.guaranteedByHeavenlyStrike,true);
 assert.equal(x.criticalSourceOnly.effectiveHypotheticalChance,1);
});
test("all 18 routes produce feasible full builds with consistent marginal model",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const result=optimizeBuild(base(damage,gold,{skillPoints:100}));
  assert.ok(spentPoints(result.levels)<=100);
  assert.equal(result.modelAttribution.additiveReconstructionMatches,true);
  assert.equal(result.criticalSourceOnly.accountExpectationVerified,false);
  assert.equal(result.modelAttribution.nativeConditionalScoringGuards
   .cleavingStrikeGuaranteedCritOnlyForHeavenlyStrike,true);
  assert.equal(result.modelAttribution.nativeConditionalScoringGuards
   .importedCriticalChanceNotUsedForAlternativeTrees,true);
 }
});
test("all language entrypoints and module graphs update; no GitHub Actions",()=>{
 const paths=["src/app.js","src/result-details-ui.js","src/worker.js","src/engine.js",
  "src/tactical-insight-sensitivity.js","src/ti-alternative.js"];
 const code=Object.fromEntries(paths.map(path=>[
  path,readFileSync(new URL("../"+path,import.meta.url),"utf8")]));
 const rx=mod=>new RegExp(mod.replaceAll(".","\\.")+"\\?([^\\\"]+)");
 const read=(path,mod)=>code[path].match(rx(mod))?.[1];
 assert.equal(read("src/app.js","engine.js"),read("src/worker.js","engine.js"));
 assert.equal(read("src/engine.js","effects.js"),
  read("src/ti-alternative.js","effects.js"));
 assert.equal(read("src/engine.js","effects.js"),
  read("src/tactical-insight-sensitivity.js","effects.js"));
 const tag="20261124-cleaving-crit-event-r1";
 assert.ok(code["src/engine.js"].includes(tag));
 assert.ok(code["src/result-details-ui.js"].includes("result.criticalSourceOnly"));
 assert.ok(code["src/app.js"].includes("createResultDetailRenderers"));
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const content=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.ok(content.includes("&amp;crit="+tag),path);
 }
 assert.equal(existsSync(new URL("../.github/workflows/",import.meta.url)),false);
});
