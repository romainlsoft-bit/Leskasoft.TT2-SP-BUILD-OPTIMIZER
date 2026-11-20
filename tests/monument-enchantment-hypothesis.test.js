import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {resolveMonumentEvidence} from "../src/account-monuments.js";
import {monumentDerivedPower} from "../src/account-monument-derived.js";
import {extractFixedAccountPower} from "../src/account-power.js";

const at=new Date("2026-11-20T00:00:00Z");
const make=monuments=>parseAccountProfile({
 playerStats:{"Transcendence Season":13},monuments
});
test("known enchanted monument delta is source-only and never added to AllDamage twice",()=>{
 const profile=make({
  SeasonalArtifact34:{level:100,enchanted:true},
  SeasonalArtifact36:{level:100,enchanted:true}
 });
 const report=monumentDerivedPower(profile,
  resolveMonumentEvidence(profile,at));
 const raw=report.poolLog10;
 assert.equal(report.enchantmentSourceHypothesisComplete,true);
 assert.ok(Number.isFinite(raw));
 assert.ok(report.hypotheticalEnchantedPoolLog10>raw);
 assert.ok(report.hypotheticalEnchantmentDeltaLog10>0);
 assert.ok(Math.abs(report.hypotheticalEnchantedPoolLog10-raw-
  report.hypotheticalEnchantmentDeltaLog10)<1e-8);
 assert.equal(report.hypotheticalEnchantmentIncludedInScore,false);
 assert.equal(report.enchantmentMultIncluded,false);
 const actual=extractFixedAccountPower(profile,at);
 assert.equal(actual.monumentEffects.additiveDamageLog10,raw);
 assert.equal(actual.monumentEffects.hypotheticalEnchantedPoolLog10,
  report.hypotheticalEnchantedPoolLog10);
 assert.equal(actual.monumentEffects.hypotheticalEnchantmentIncludedInScore,false);
 assert.equal(actual.entries.filter(x=>x.system==="monumentDamage").length,1);
 assert.equal(actual.entries.find(x=>x.system==="monumentDamage").log10,raw);
});
test("unknown monument enchantment state cannot generate a fabricated hypothetical delta",()=>{
 const profile=make({SeasonalArtifact34:{level:100}});
 const report=monumentDerivedPower(profile,resolveMonumentEvidence(profile,at));
 assert.ok(Number.isFinite(report.poolLog10));
 assert.equal(report.hypotheticalEnchantedPoolLog10,null);
 assert.equal(report.hypotheticalEnchantmentDeltaLog10,null);
 assert.equal(report.enchantmentSourceHypothesisComplete,false);
 assert.equal(report.entries.length,1);
});
test("an expired or unknown season has no current Monument Damage what-if",()=>{
 for(const profile of [
  make({SeasonalArtifact34:{level:100,enchanted:true}}),
  parseAccountProfile({monuments:{SeasonalArtifact34:{level:100,enchanted:true}}})
 ]){
  const validSeason=profile.stats.transcendenceSeason==="13";
  const now=validSeason?new Date("2026-11-25T00:00:00Z"):at;
  const report=monumentDerivedPower(profile,resolveMonumentEvidence(profile,now));
  assert.equal(report.poolLog10,null);
  assert.equal(report.hypotheticalEnchantedPoolLog10,null);
  assert.equal(report.hypotheticalEnchantmentDeltaLog10,null);
  assert.equal(report.enchantmentMultIncluded,false);
 }
});
