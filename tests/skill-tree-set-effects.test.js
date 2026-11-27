import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {skillInfo} from "../vendor/skills.js";
import {EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {scoreAtLevel} from "../src/effects.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints,SKILL_IDS} from "../src/engine.js";
import {resolveSkillTreeSetEffects,pointsSpentInSkill,
 skillTreeSetScore,skillTreeSetAllocationEvidence,SKILL_TREE_SET_FAMILIES}
 from "../src/skill-tree-set-effects.js";

const ids=["FairyKnight","FireKnight","ElectricWarlord",
 "WaterSorcerer","EarthRogue","SteampunkKnight"];
const branch=["BranchRed","BranchOrange","BranchYellow",
 "BranchBlue","BranchGreen","BranchPurple"];
const sample=(sets=ids,other={})=>parseAccountProfile({
 equipmentSets:sets,playerStats:{"Crafting Power":9},...other
});
const cfg=(accountProfile,damage="Pet",gold="Fairy")=>({
 accountProfile,damage,gold,goldWeight:.7,skillPoints:180,
 craftingPower:9,maxStage:0,timeToKill:8,sClone:30,
 qol:"none",sets:{},minimums:{},currentLevels:{}
});
const near=(actual,expected,message="")=>assert.ok(
 Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*1e-9,
 message+" got "+actual+" expected "+expected);

test("six distinct 8.4 source sets each belong to exactly one skill tree",()=>{
 assert.equal(Object.keys(SKILL_TREE_SET_FAMILIES).length,6);
 for(let i=0;i<ids.length;i++){
  const source=EQUIPMENT_SET_CATALOG[ids[i]];
  assert.equal(source.type,"Mythic");
  const bonuses=source.bonuses.filter(x=>Object.hasOwn(SKILL_TREE_SET_FAMILIES,x.type));
  assert.equal(bonuses.length,1,ids[i]);
  assert.equal(SKILL_TREE_SET_FAMILIES[bonuses[0].type],branch[i]);
  assert.equal(bonuses[0].amount,"1.01");
  assert.equal(Number(bonuses[0].inc),1);
  assert.equal(Number(bonuses[0].expo),1);
 }
 const evidence=resolveSkillTreeSetEffects(sample());
 assert.equal(evidence.applied,6);
 assert.equal(evidence.recognized,6);
 assert.equal(evidence.unknown.length,0);
 for(const b of branch)near(evidence.byBranch[b],Math.log10(1.01));
 assert.equal(evidence.passiveAccountScoreAdded,false);
});

test("same skill level receives only its OWN branch's purchased-SP multiplier",()=>{
 const fromSets=sample(),fromNone=sample([]),log=Math.log10(1.01);
 for(let i=0;i<branch.length;i++){
  const id=Object.keys(skillInfo).find(k=>skillInfo[k].Branch===branch[i]);
  assert.ok(id,"skill in "+branch[i]);
  const level=Math.min(9,Number(skillInfo[id].MaxLevel));
  const score=scoreAtLevel(id,level,cfg(fromSets));
  const absent=scoreAtLevel(id,level,cfg(fromNone));
  const sp=pointsSpentInSkill(id,level);
  assert.ok(sp>level,"tier costs must be cumulative SP, not allocated levels");
  near(score-absent,sp*log,id);
  near(skillTreeSetScore(id,level,cfg(fromSets)),sp*log);
  assert.equal(skillTreeSetScore(id,0,cfg(fromSets)),0);
  assert.equal(scoreAtLevel(id,0,cfg(fromSets)),0);
  // Only the source matching this branch contributes, despite 6 set sources.
  const ownedOne=sample([ids[i]]);
  near(scoreAtLevel(id,level,cfg(ownedOne))-absent,sp*log);
 }
});

test("no owned set and inventory-only pieces cannot manufacture a per-SP bonus",()=>{
 const missing=sample([],{equipmentInventory:[
  {id:"piece",setId:"FairyKnight",slot:"Sword",
   bonusType:"AllDamage",bonusAmount:"1e12"}]});
 const evidence=resolveSkillTreeSetEffects(missing);
 assert.equal(evidence.applied,0);
 assert.equal(evidence.byBranch.BranchRed,0);
 const withoutSection=parseAccountProfile({Version:"8.4"});
 assert.equal(resolveSkillTreeSetEffects(withoutSection).applied,0);
 assert.equal(skillTreeSetScore("TapDmg",10,cfg(withoutSection)),0);
 assert.throws(()=>pointsSpentInSkill("not-a-skill",5),/Unknown/);
 assert.throws(()=>pointsSpentInSkill("TapDmg",1000000),/Unknown/);
});

test("owned-set duplicate records and sales cannot compound the branch multiplier",()=>{
 const single=sample(["FairyKnight"]);
 const repeated=sample(["FairyKnight","FairyKnight"]);
 const sold=sample(["FairyKnight"],{equipmentInventory:[]});
 for(const profile of [repeated,sold]){
  const value=resolveSkillTreeSetEffects(profile);
  assert.equal(value.applied,1);
  near(value.byBranch.BranchRed,
   resolveSkillTreeSetEffects(single).byBranch.BranchRed);
 }
});

test("truncated ownership collection does not fabricate unobserved sets",()=>{
 const records=["FairyKnight",...Array.from({length:512},(_,i)=>"Other"+i)];
 const p=sample(records);
 assert.equal(p.sections.equipmentSets.truncated,true);
 const e=resolveSkillTreeSetEffects(p);
 assert.equal(e.applied,1);
 assert.ok(e.unknown.some(x=>x.reason.includes("partial-owned")));
 assert.equal(e.byBranch.BranchRed,Math.log10(1.01));
 assert.equal(e.byBranch.BranchOrange,0);
});

test("a cloned build's account baseline is never boosted by the same per-SP set",()=>{
 const owned=sample(ids),none=sample([]);
 const context=cfg(owned);
 const alloc=Object.fromEntries(SKILL_IDS.map(id=>[id,0]));
 alloc.TapDmg=11;alloc.PetDmg=12;alloc.ForbiddenContract=3;
 const set=skillTreeSetAllocationEvidence(owned,alloc);
 const no=skillTreeSetAllocationEvidence(none,alloc);
 assert.equal(no.damageLog10,0);
 assert.equal(set.applied,6);
 let total=0;
 for(const id of SKILL_IDS)total+=skillTreeSetScore(id,alloc[id],context);
 near(set.damageLog10,total);
 near(set.damageLog10,
  Object.keys(set.byBranch).reduce((sum,b)=>
   sum+set.spentByBranch[b]*set.byBranch[b],0));
 assert.equal(set.includedInSkillScore,true);
 assert.equal(set.addedToAccountFixedScore,false);
});

test("18 build combinations optimize with per-SP source bonuses accounted exactly once",()=>{
 const p=sample(ids);
 const empty=sample([]);
 assert.equal(DAMAGE_TYPES.length*GOLD_TYPES.length,18);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings=cfg(p,damage,gold);
  const optimized=optimizeBuild(settings);
  const baseline=optimizeBuild({...settings,accountProfile:empty});
  const ledger=skillTreeSetAllocationEvidence(p,optimized.levels);
  const report=optimized.accountIntegration.skillTreeSetPower;
  assert.ok(optimized.spent<=settings.skillPoints);
  assert.equal(report.applied,6);
  near(report.skillScoreLog10,ledger.damageLog10);
  assert.equal(report.addedToFixedAccount,false);
  assert.equal(report.includedInSkillScore,true);
  assert.equal(optimized.spent,spentPoints(optimized.levels));
  // These six Mythic sets contain no unconditional AllDamage main effect.
  // Their AllDamage-per-SP values are in the tree objective only.
  near(optimized.fixedAccount.weightedLog10,
   baseline.fixedAccount.weightedLog10,damage+"/"+gold+" fixed-score double count");
  assert.equal(optimized.accountIntegration.newlyResolvedSetEffects,6);
  assert.ok(optimized.accountIntegration.unmodeledEffects>=0);
  assert.ok(optimized.score>=baseline.score-1e-7,
   damage+"/"+gold+" should not lose modeled objective when a positive set effect is added");
  assert.ok(Number.isFinite(optimized.accountAdjustedScore));
  const baseLevels=Object.fromEntries(Object.entries(optimized.levels).map(([id,v])=>[id,v]));
  let independentlyCalculated=0;
  for(const id of SKILL_IDS)independentlyCalculated+=
   scoreAtLevel(id,baseLevels[id],settings);
  near(optimized.score,independentlyCalculated,damage+"/"+gold);
 }
});

test("source ledger is not silently applied to equipment or fixed-account score",()=>{
 const engine=readFileSync(new URL("../src/engine.js",import.meta.url),"utf8");
 const effects=readFileSync(new URL("../src/effects.js",import.meta.url),"utf8");
 assert.ok(effects.includes("return baseline+skillTreeSetScore(id,level,settings)"));
 const accountBaseline=readFileSync(new URL("../src/optimization-account-baseline.js",import.meta.url),"utf8");
 assert.ok(engine.includes("buildAccountBaseline(settings,result.levels)"));
 assert.ok(accountBaseline.includes("skillTreeSetAllocationEvidence(settings.accountProfile,levels)"));
 assert.ok(engine.includes("addedToFixedAccount:false"));
 assert.ok(engine.includes("newlyResolvedSetEffects"));
});
