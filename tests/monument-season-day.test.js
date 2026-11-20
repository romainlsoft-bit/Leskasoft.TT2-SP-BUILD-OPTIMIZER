import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {resolveMonumentEvidence} from "../src/account-monuments.js";
import {monumentSeasonDayEvidence} from "../src/monument-season-day.js";
import {extractFixedAccountPower} from "../src/account-power.js";
import {DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
const account=parseAccountProfile({
 playerStats:{"Transcendence Season":13},
 monuments:{SeasonalArtifact22:{level:20,enchanted:false},
  SeasonalArtifact29:{level:20,enchanted:false},
  SeasonalArtifact34:{level:120,enchanted:false}}
});
const now=new Date("2026-11-20T00:00:00Z");
test("season-13 dated monument sources remain separate from credited account multipliers",()=>{
 const monuments=resolveMonumentEvidence(account,now);
 const r=monumentSeasonDayEvidence(monuments,{damage:"Pet",gold:"Fairy",goldWeight:.7});
 assert.equal(r.totalEntries,3);
 assert.equal(r.seasonDays,100);
 assert.equal(r.nativeFormulaVerified,false);
 assert.equal(r.uncreditedEntries,3);
 assert.equal(r.addedToScore,false);
 for(const row of r.entries){
  assert.equal(row.appliedToAccountScore,false);
  assert.equal(row.appliedToOptimizationScore,false);
  assert.ok(row.sourcePerDayLog10>0);
  assert.ok(Math.abs(row.hypotheticalCompoundedSeasonLog10-
   row.sourcePerDayLog10*100)<1e-8);
 }
 assert.ok(r.entries.some(x=>x.sourceBonusType==="AllDamagePerSeasonDay"));
 assert.ok(r.entries.some(x=>x.sourceBonusType==="CritDamagePerSeasonDay"));
 const fixed=extractFixedAccountPower(account);
 // Those exact time-dependent primary effects must NOT be inserted
 // into the AllDamage score just because the 100 days are known.
 assert.equal(fixed.entries.filter(x=>x.system==="monuments"&&
  x.bonusType.endsWith("PerSeasonDay")).length,0);
});
test("crit season-day direct damage route is applicable only to guaranteed critical hit",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const r=monumentSeasonDayEvidence(resolveMonumentEvidence(account,now),
   {damage,gold,goldWeight:.7});
  const crit=r.entries.find(x=>x.sourceBonusType==="CritDamagePerSeasonDay");
  const all=r.entries.find(x=>x.id==="SeasonalArtifact22");
  assert.equal(crit.eligibleForCurrentSourceDamage,damage==="Heavenly Strike");
  assert.equal(all.eligibleForCurrentSourceDamage,true);
  assert.equal(crit.appliedToAccountScore,false);
  assert.equal(r.totalEntries,3);
 }
});
test("unknown or old Transcendence seasons do not invent a new daily bonus",()=>{
 const unknown=parseAccountProfile({monuments:{
  SeasonalArtifact22:{level:20,enchanted:false}}});
 const x=monumentSeasonDayEvidence(resolveMonumentEvidence(unknown,now),
  {damage:"Pet",gold:"Fairy",goldWeight:.7});
 assert.equal(x.seasonDays,null);
 assert.equal(x.illustrableEntries,0);
 assert.equal(x.uncreditedEntries,1);
 assert.equal(x.entries[0].hypotheticalCompoundedSeasonLog10,null);
 const stale=parseAccountProfile({playerStats:{"Transcendence Season":13},
  monuments:{SeasonalArtifact22:{level:20,enchanted:false,season:12}}});
 const y=monumentSeasonDayEvidence(resolveMonumentEvidence(stale,now));
 assert.equal(y.illustrableEntries,0);
});
