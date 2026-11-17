import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {mergeTitanResearch,resourceResearchEvidence} from "../src/account-research-resources.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {RESOURCE_RESEARCH_CATALOG} from "../vendor/account-research-resources.js";
import {ACCOUNT_SCALING} from "../vendor/account-scaling.js";
import {DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {modeledScenarioCoverage} from "../src/calculation-ledger.js";

const asProfile=data=>parseAccountProfile(data);
const entry=(id,level)=>({id,level});

test("TT2 8.4 exposes 169 gemstone-level and 62 Titan Souls resource nodes",()=>{
 assert.equal(RESOURCE_RESEARCH_CATALOG.gemstoneLevel.length,169);
 assert.equal(RESOURCE_RESEARCH_CATALOG.titanSouls.length,62);
 for(const row of [...RESOURCE_RESEARCH_CATALOG.gemstoneLevel,...RESOURCE_RESEARCH_CATALOG.titanSouls]){
  assert.equal(row.baseEffect,0);
  assert.equal(row.growthExpo,0);
  assert.ok(row.effectPerLevel>0);
  assert.ok(Number.isSafeInteger(row.maxLevel)&&row.maxLevel>0);
 }
});

test("All 169 gemstone-level coefficients aggregate from actual source rows",()=>{
 const rows=RESOURCE_RESEARCH_CATALOG.gemstoneLevel;
 const profile=asProfile({gemstonesResearch:rows.map(row=>entry(row.id,row.maxLevel))});
 const r=resourceResearchEvidence(profile);
 const expected=rows.reduce((sum,row)=>sum+row.maxLevel*row.effectPerLevel,0);
 assert.equal(r.gemstones.extraLevelsFromResearch,expected);
 assert.equal(r.gemstones.matchedNodes,169);
 assert.equal(r.audit.validatedGemstoneNodes,169);
 assert.equal(r.audit.incomplete,false);
 assert.equal(r.gemstones.effectiveGemstoneLevel,null);
 assert.equal(r.entries.filter(x=>x.bonusType==="GemstoneLevel").length,169);
 assert.ok(r.entries.every(x=>x.appliedToDamageScore===false));
});

test("All 62 source Titan Souls nodes aggregate per category without scoring damage",()=>{
 const rows=RESOURCE_RESEARCH_CATALOG.titanSouls;
 const p=asProfile({titanResearch:rows.map(row=>entry(row.id,row.maxLevel))});
 const r=resourceResearchEvidence(p);
 const sum=kind=>rows.filter(row=>row.type===kind)
  .reduce((total,row)=>total+row.maxLevel*row.effectPerLevel,0);
 assert.equal(r.titanSouls.matchedNodes,62);
 assert.equal(r.titanSouls.bonusPerDay,sum("TitanSoulsPerDay"));
 assert.equal(r.titanSouls.bonusPerPrestige,sum("TitanSoulsPerPrestige"));
 assert.ok(Math.abs(r.titanSouls.rawChanceBonusFraction-sum("TitanSoulsChance"))<1e-10);
 assert.equal(r.titanSouls.dropChanceAfterCaps,null);
 assert.equal(r.titanSouls.totalGainPerDay,null);
 assert.equal(r.titanSouls.bonusAppliedToDamageScore,false);
});

test("Necrobear mirrored aliases score each purchase once; disjoint IDs are unioned",()=>{
 const p=asProfile({
  titanResearch:[entry("1",2),entry("6",1)],
  forbiddenResearch:[entry("1","2"),entry("5",1)]
 });
 const m=mergeTitanResearch(p),r=resourceResearchEvidence(p);
 assert.equal(m.records.length,3);
 assert.equal(m.mirroredPurchases,1);
 assert.equal(r.audit.incomplete,false);
 assert.equal(r.titanSouls.rawChanceBonusFraction,0.004);
 assert.equal(r.titanSouls.bonusPerPrestige,25);
 assert.equal(r.titanSouls.bonusPerDay,10);
});

test("Conflicting cross-section levels are excluded; aggregate totals are unknown, not zero",()=>{
 const p=asProfile({
  titanResearch:[entry("1",2),entry("6",1)],
  forbiddenResearch:[entry("1",3)]
 });
 const m=mergeTitanResearch(p),r=resourceResearchEvidence(p);
 assert.ok(m.unknown.some(x=>x.id==="1"&&x.reason==="conflicting-export-levels"));
 assert.equal(m.records.some(x=>x.id==="1"),false);
 assert.equal(r.titanSouls.bonusPerDay,null);
 assert.equal(r.titanSouls.rawChanceBonusFraction,null);
 assert.equal(r.audit.incomplete,true);
 assert.ok(r.entries.some(x=>x.id==="6"&&x.amount===10));
});

test("Duplicate IDs within Titan Research are excluded from resource and fixed multiplier score",()=>{
 const p=asProfile({
  titanResearch:[entry("1",2),entry("1",2),entry("6",1)]
 });
 const m=mergeTitanResearch(p);
 assert.ok(m.unknown.some(x=>x.id==="1"&&x.reason==="duplicate-source-id"));
 assert.equal(m.records.filter(x=>x.id==="1").length,0);
 assert.equal(resourceResearchEvidence(p).titanSouls.bonusPerDay,null);
 assert.equal(extractFixedAccountPower(p).entries.some(x=>
  x.system==="titanResearch"&&x.id==="1"),false);
});

test("Invalid, fractional and over-cap resource levels are rejected, even with valid siblings",()=>{
 const p=asProfile({
  gemstonesResearch:[entry("0","1.5"),entry("2",31),entry("5",3)],
  titanResearch:[entry("1",-2),entry("6",1)]
 });
 const r=resourceResearchEvidence(p);
 assert.equal(r.gemstones.extraLevelsFromResearch,null);
 assert.equal(r.titanSouls.bonusPerDay,null);
 assert.ok(r.unknown.some(x=>x.system==="gemstoneResearch"&&x.id==="0"));
 assert.ok(r.unknown.some(x=>x.system==="gemstoneResearch"&&x.id==="2"));
 assert.ok(r.entries.some(x=>x.id==="5"&&x.amount===3));
 assert.ok(r.entries.some(x=>x.id==="6"&&x.amount===10));
});

test("Missing research sections are unknown, but a present valid empty section totals zero",()=>{
 const none=resourceResearchEvidence(asProfile({}));
 assert.equal(none.gemstones.extraLevelsFromResearch,null);
 assert.equal(none.titanSouls.bonusPerDay,null);
 const empty=resourceResearchEvidence(asProfile({
  gemstonesResearch:[],titanResearch:[]
 }));
 assert.equal(empty.gemstones.extraLevelsFromResearch,0);
 assert.equal(empty.titanSouls.bonusPerDay,0);
 assert.equal(empty.titanSouls.rawChanceBonusFraction,0);
});

test("A truncated 2048-row gemstone research export scores no damage and no resource total",()=>{
 const source=[entry("1",20),entry("0",20),
  ...Array.from({length:2047},(_,i)=>entry("unknown"+i,1))];
 const p=asProfile({gemstonesResearch:source});
 assert.equal(p.sections.mysticResearch.truncated,true);
 const r=resourceResearchEvidence(p),power=extractFixedAccountPower(p);
 assert.equal(r.gemstones.extraLevelsFromResearch,null);
 assert.equal(r.audit.truncatedSections.includes("mysticResearch"),true);
 assert.equal(power.entries.filter(x=>x.system==="gemstoneResearch").length,0);
 assert.ok(power.unsupported.some(x=>x.system==="gemstoneResearch"&&
  x.reason==="truncated-research-export"));
});

test("A truncated Necrobear alias blocks both resource and fixed research score",()=>{
 const source=[entry("1",2),entry("6",1),
  ...Array.from({length:2047},(_,i)=>entry("unknown"+i,1))];
 const p=asProfile({titanResearch:source,forbiddenResearch:[entry("5",1)]});
 assert.equal(p.sections.titanResearch.truncated,true);
 const merged=mergeTitanResearch(p);
 assert.equal(merged.records.length,0);
 assert.equal(merged.truncated,true);
 const r=resourceResearchEvidence(p);
 assert.equal(r.titanSouls.bonusPerPrestige,null);
 assert.equal(r.audit.incomplete,true);
 assert.equal(extractFixedAccountPower(p).entries.filter(x=>x.system==="titanResearch").length,0);
});

test("A truncated Titan Card export never contributes a partial fixed multiplier",()=>{
 const card=ACCOUNT_SCALING.titanCards[0];
 const p=asProfile({titanCards:[entry(card.id,10),
  ...Array.from({length:512},(_,i)=>entry("extra"+i,1))]});
 assert.equal(p.sections.titanCards.truncated,true);
 const power=extractFixedAccountPower(p);
 assert.equal(power.entries.some(x=>x.system==="titanCards"),false);
 assert.ok(power.unsupported.some(x=>x.system==="titanCards"&&
  x.reason==="truncated-research-export"));
});

test("Source AllDamage research is scored exactly once across all 18 builds",()=>{
 const p=asProfile({gemstonesResearch:[entry("1",2)]});
 const power=extractFixedAccountPower(p);
 const expected=2*Math.log10(1.5945);
 assert.equal(power.entries.filter(x=>x.system==="gemstoneResearch").length,1);
 assert.equal(DAMAGE_TYPES.length*GOLD_TYPES.length,18);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const score=fixedAccountScore(power,{damage,gold,goldWeight:0.7});
  assert.ok(Math.abs(score.damageLog10-expected)<1e-12);
  assert.equal(score.goldLog10,0);
 }
});

test("Raw scientific Titan Souls balances and effective gemstone exports never multiply research",()=>{
 const p=asProfile({
  playerStats:{"Titan Souls":"1.2e9999","Gemstone Level":8000},
  gemstones:[{id:"Gem0",level:500,primary:"PetDamage:1e50"}],
  gemstonesResearch:[entry("0",30)]
 });
 const r=resourceResearchEvidence(p),power=extractFixedAccountPower(p);
 assert.equal(r.titanSouls.balance,"1.2e9999");
 assert.equal(r.gemstones.reportedLevel,8000);
 assert.equal(r.gemstones.extraLevelsFromResearch,30);
 assert.equal(r.gemstones.basePlusResearchHypothesis,8030);
 assert.equal(r.gemstones.effectiveGemstoneLevel,null);
 assert.equal(power.byType.PetDamage,50);
 assert.equal(power.researchResources.gemstones.scoreAdjusted,false);
});

test("Scenario coverage exposes source ambiguity across all damage/gold settings",()=>{
 const p=asProfile({
  gemstonesResearch:[entry("0",5),entry("0",6)],
  titanResearch:[entry("1",1)],forbiddenResearch:[entry("1",2)]
 });
 const r=resourceResearchEvidence(p);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const coverage=modeledScenarioCoverage({
   score:0,accountIntegration:{researchResources:{
    gemstones:r.gemstones,titanSouls:r.titanSouls,unknownNodes:r.unknown.length,
    audit:r.audit
   }}
  },{damage,gold,accountProfile:p});
  assert.ok(coverage.gaps.includes("incomplete-resource-research-export"));
  assert.ok(coverage.researchUnresolvedNodes>=2);
  assert.equal(coverage.complete,false);
 }
});
