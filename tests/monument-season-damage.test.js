import {test} from "node:test";
import assert from "node:assert/strict";
import {SEASON_ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {resolveMonumentEvidence} from "../src/account-monuments.js";
import {rawDamageLog10,additiveDamageEvidence,log10Sum} from "../src/account-damage-pools.js";
import {monumentDerivedPower} from "../src/account-monument-derived.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {resolvePermanentSetPower} from "../src/account-permanent-sets.js";

const NOW=new Date("2026-11-17T00:00:00Z");
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b));
function evidence(raw){
 const profile=parseAccountProfile(raw);
 const monuments=resolveMonumentEvidence(profile,NOW);
 const derived=monumentDerivedPower(profile,monuments);
 return {profile,monuments,derived};
}
const row=(mon,id)=>mon.entries.find(x=>x.id===id);

test("8.4 catalog has 52 unique monuments and season 13 only accepts 3 categories",()=>{
 assert.equal(Object.keys(SEASON_ARTIFACT_CATALOG).length,52);
 const {monuments}=evidence({playerStats:{"Transcendence Season":13},
  monuments:{
   SeasonalArtifact8:{level:20,enchanted:false},
   SeasonalArtifact22:{level:20,enchanted:false},
   SeasonalArtifact45:{level:100,enchanted:false},
   SeasonalArtifact36:{level:100,enchanted:false}
  }});
 assert.equal(monuments.seasonVerified,true);
 assert.equal(monuments.seasonDays,97);
 assert.equal(row(monuments,"SeasonalArtifact8").categoryAllowed,false);
 assert.equal(row(monuments,"SeasonalArtifact22").categoryAllowed,true);
 assert.equal(row(monuments,"SeasonalArtifact45").categoryAllowed,true);
 assert.equal(row(monuments,"SeasonalArtifact36").categoryAllowed,true);
 assert.equal(row(monuments,"SeasonalArtifact8").appliedToScore,false);
});
test("monument damage exponent multiplies log10(base) by level^expo, not log-level",()=>{
 const info=SEASON_ARTIFACT_CATALOG.SeasonalArtifact34;
 const expected=Math.log10(Number(info.damageBonus))*
  Math.pow(19410,Number(info.damageExpo));
 assert.ok(close(rawDamageLog10(info,"19410","monument"),expected));
 const wrong=Math.log10(Number(info.damageBonus))+
  Number(info.damageExpo)*Math.log10(19410);
 assert.ok(expected>wrong*100);
 assert.equal(rawDamageLog10(info,"1e9999","monument"),null);
 assert.ok(Number.isFinite(rawDamageLog10(info,"1e300","monument")));
});
test("monument damage additive sum matches two comparable 8.4 source components",()=>{
 const {profile,monuments,derived}=evidence({
  playerStats:{"Transcendence Season":13},
  monuments:{SeasonalArtifact34:{level:100,enchanted:false},
   SeasonalArtifact36:{level:100,enchanted:false}}
 });
 const a=rawDamageLog10(SEASON_ARTIFACT_CATALOG.SeasonalArtifact34,
  "100","monument");
 const b=rawDamageLog10(SEASON_ARTIFACT_CATALOG.SeasonalArtifact36,
  "100","monument");
 assert.equal(derived.eligibleComponents,2);
 assert.ok(close(derived.poolLog10,log10Sum([a,b])));
 assert.equal(derived.entries.length,1);
 assert.equal(derived.entries[0].bonusType,"AllDamage");
 assert.equal(derived.entries[0].appliedToScore,true);
 const power=extractFixedAccountPower(profile,NOW);
 assert.equal(power.entries.filter(x=>x.system==="monumentDamage").length,1);
 assert.ok(close(power.byType.AllDamage,derived.poolLog10));
 assert.equal(row(monuments,"SeasonalArtifact36").appliedToScore,true);
 assert.equal(row(monuments,"SeasonalArtifact34").appliedToScore,false);
 assert.equal(derived.complete,false);
});
test("enchantments have separate main and Monument Damage factors, not two score entries",()=>{
 const {profile,monuments,derived}=evidence({playerStats:{"Transcendence Season":13},
  monuments:{SeasonalArtifact36:{level:100,enchanted:"True"},
   SeasonalArtifact34:{level:100,enchanted:"True"}}});
 assert.equal(row(monuments,"SeasonalArtifact36").enchanted,true);
 assert.equal(row(monuments,"SeasonalArtifact34").enchanted,true);
 assert.equal(row(monuments,"SeasonalArtifact34").enchantmentMagnitude,"1.00E+01");
 assert.equal(row(monuments,"SeasonalArtifact34").enchantmentMult,"1.00E+01");
 const pool=additiveDamageEvidence({entries:[]},monuments,{},
  SEASON_ARTIFACT_CATALOG);
 assert.ok(pool.monuments.candidateEnchantedPoolLog10>
  pool.monuments.unenchantedPoolLog10);
 assert.ok(close(derived.poolLog10,pool.monuments.unenchantedPoolLog10));
 const power=extractFixedAccountPower(profile,NOW);
 assert.equal(power.entries.filter(x=>x.system==="monumentDamage").length,1);
 assert.equal(power.monumentEffects.enchantmentMultIncluded,false);
 assert.equal(power.monumentEffects.additiveDamageConservative,true);
});
test("an unknown enchantment still yields a source-known raw damage lower bound",()=>{
 const {monuments,derived}=evidence({playerStats:{"Transcendence Season":13},
  monuments:{SeasonalArtifact36:{level:100}}});
 assert.equal(row(monuments,"SeasonalArtifact36").formulaStatus,
  "unknown-enchantment-state");
 assert.equal(row(monuments,"SeasonalArtifact36").appliedToScore,false);
 assert.equal(derived.entries.length,1);
 assert.ok(Number.isFinite(derived.poolLog10));
 assert.equal(derived.rawPool.candidateEnchantedPoolLog10,null);
 assert.equal(derived.unresolvedEnchantments,1);
});
test("no known current season cannot use a historical CSV IsActive flag",()=>{
 const {monuments,derived}=evidence({
  monuments:{SeasonalArtifact36:{level:100,enchanted:false}}});
 assert.equal(monuments.seasonVerified,false);
 assert.equal(monuments.modeled,0);
 assert.equal(derived.entries.length,0);
 assert.ok(derived.unmodeled.includes("unknown-transcendence-season"));
});
test("old-season markers and non-rotating monuments never enter additive pool",()=>{
 const {monuments,derived}=evidence({
  playerStats:{"Transcendence Season":13},
  monuments:[
   {id:"SeasonalArtifact36",level:100,enchanted:false,season:12},
   {id:"SeasonalArtifact8",level:40,enchanted:false},
   {id:"SeasonalArtifact34",level:100,enchanted:false}
  ]});
 assert.equal(row(monuments,"SeasonalArtifact36").formulaStatus,
  "ignored-wrong-transcendence-season");
 assert.equal(row(monuments,"SeasonalArtifact8").categoryAllowed,false);
 assert.equal(derived.eligibleComponents,1);
 assert.ok(derived.poolLog10>0);
 assert.equal(monuments.conflicts,1);
});
test("mirrored monument sections deduplicate exactly and conflicting levels exclude both",()=>{
 const same=evidence({playerStats:{"Transcendence Season":13},
  monuments:{SeasonalArtifact36:{level:100,enchanted:false}},
  seasonArtifacts:{"Emblem of Worlds":{level:100,enchanted:false}}});
 assert.equal(same.monuments.recognized,1);
 assert.equal(same.derived.eligibleComponents,1);
 assert.equal(same.monuments.importedRecords,2);
 const conflict=evidence({playerStats:{"Transcendence Season":13},
  monuments:{SeasonalArtifact36:{level:100,enchanted:false}},
  seasonArtifacts:{"Emblem of Worlds":{level:110,enchanted:false}}});
 assert.equal(conflict.monuments.conflicts,1);
 assert.equal(conflict.derived.entries.length,0);
 assert.equal(row(conflict.monuments,"SeasonalArtifact36").appliedToScore,false);
});
test("explicit salvaged/unowned monuments never contribute to damage",()=>{
 const {monuments,derived}=evidence({playerStats:{"Transcendence Season":13},
  monuments:[
   {id:"SeasonalArtifact36",level:100,enchanted:false,salvaged:"True"},
   {id:"SeasonalArtifact34",level:100,enchanted:false,owned:"False"},
   {id:"SeasonalArtifact43",level:100,enchanted:false}
  ]});
 assert.equal(monuments.explicitlyUnowned,2);
 assert.equal(monuments.recognized,1);
 assert.equal(derived.eligibleComponents,1);
});
test("truncated sections reject main and additive monument scores",()=>{
 const list=Array.from({length:513},()=>({
  id:"SeasonalArtifact36",level:100,enchanted:false
 }));
 const {profile,monuments,derived}=evidence({
  playerStats:{"Transcendence Season":13},monuments:list});
 assert.equal(profile.sections.monuments.truncated,true);
 assert.equal(monuments.truncatedSections.length,1);
 assert.equal(monuments.modeled,0);
 assert.equal(derived.entries.length,0);
 assert.equal(extractFixedAccountPower(profile,NOW).entries
  .filter(x=>["monuments","monumentDamage"].includes(x.system)).length,0);
});
test("per-season-day main effects are not unconditional despite known season age",()=>{
 const {monuments,derived}=evidence({
  playerStats:{"Transcendence Season":13},
  monuments:{
   SeasonalArtifact22:{level:20,enchanted:false},
   SeasonalArtifact29:{level:20,enchanted:false}
  }});
 assert.equal(row(monuments,"SeasonalArtifact22").seasonDays,97);
 assert.equal(row(monuments,"SeasonalArtifact29").seasonDays,97);
 assert.equal(row(monuments,"SeasonalArtifact22").appliedToScore,false);
 assert.equal(row(monuments,"SeasonalArtifact29").appliedToScore,false);
 assert.equal(derived.eligibleComponents,2,"raw Monument Damage is independent of per-day main effect");
});
test("number-of-completed-set monuments need an exact unlocked roster",()=>{
 const raw={playerStats:{"Transcendence Season":13},
  monuments:{SeasonalArtifact23:{level:12,enchanted:false},
   SeasonalArtifact30:{level:12,enchanted:false}}};
 const present=evidence({...raw,equipmentSets:["Mech","Blacksmith"]});
 const cobra=row(present.monuments,"SeasonalArtifact23");
 const guild=row(present.monuments,"SeasonalArtifact30");
 assert.equal(cobra.countedSetKind,"Mythic");
 assert.equal(cobra.countedSetCount,1);
 assert.equal(guild.countedSetCount,2);
 assert.equal(cobra.appliedToScore,true);
 assert.equal(guild.appliedToScore,true);
 assert.ok(close(guild.log10,guild.baseEffectLog10*2));
 assert.ok(close(cobra.log10,cobra.baseEffectLog10));
 const power=extractFixedAccountPower(present.profile,NOW);
 assert.ok(power.byType.GoldAll>0);
 assert.ok(power.byType.AllDamage>0);
 const absent=evidence(raw);
 for(const id of ["SeasonalArtifact23","SeasonalArtifact30"]){
  const x=row(absent.monuments,id);
  assert.equal(x.formulaStatus,"unknown-completed-set-count");
  assert.equal(x.appliedToScore,false);
 }
 assert.equal(absent.derived.eligibleComponents,2,
  "additive Monument Damage does not require the separate set count");
});
test("source scientific extremes are guarded and never produce Infinity/NaN",()=>{
 const {monuments,derived}=evidence({
  playerStats:{"Transcendence Season":13},
  monuments:{SeasonalArtifact36:{level:"1e9999",enchanted:false},
   SeasonalArtifact34:{level:100,enchanted:false}}});
 assert.ok(Number.isFinite(row(monuments,"SeasonalArtifact36").log10));
 assert.ok(Number.isFinite(derived.poolLog10));
 assert.equal(derived.rejected.length,1);
 assert.equal(derived.excludedComponents,1);
});
for(const scenario of [
 {name:"active season 13",at:NOW,season:13,expected:1},
 {name:"between seasons",at:new Date("2026-11-25T12:00:00Z"),season:13,expected:0},
 {name:"expired season 13",at:new Date("2026-11-26T12:00:00Z"),season:13,expected:0},
 {name:"active season 14",at:new Date("2026-11-26T12:00:00Z"),season:14,expected:1}
])test(`all 18 damage/gold combinations: ${scenario.name} routes ${scenario.expected} additive Monument Damage pool`,(t)=>{
 t.mock.timers.enable({apis:["Date"],now:scenario.at});
 const profile=parseAccountProfile({Version:"8.4.0",
  playerStats:{"Transcendence Season":scenario.season},
  equipmentSets:["Mech","Blacksmith"],
  monuments:scenario.season===14?{
   SeasonalArtifact1:{level:20,enchanted:false},
   SeasonalArtifact2:{level:100,enchanted:false}
  }:{
   SeasonalArtifact34:{level:100,enchanted:false},
   SeasonalArtifact36:{level:100,enchanted:true},
   SeasonalArtifact23:{level:12,enchanted:false},
   SeasonalArtifact30:{level:12,enchanted:false}
  }});
 const base=extractFixedAccountPower(profile);
 assert.equal(base.entries.filter(x=>x.system==="monumentDamage").length,scenario.expected);
 assert.equal(base.monumentEffects.countedSetApplied,scenario.season===13&&scenario.expected===1?2:0);
 assert.equal(base.monumentEffects.additiveDamageApplied,scenario.expected===1);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={accountProfile:profile,damage,gold,goldWeight:.7,
   skillPoints:30,qol:"none",sets:{},minimums:{},currentLevels:{},
   craftingPower:1,maxStage:0,timeToKill:8,sClone:30};
  const optimized=optimizeBuild(settings);
  const baseline=fixedAccountScore(base,settings);
  const permanent=resolvePermanentSetPower(profile,settings);
  const sets=fixedAccountScore({available:permanent.appliedDirect>0,
   byType:permanent.byType},settings);
  const expected={
   damageLog10:baseline.damageLog10+sets.damageLog10,
   goldLog10:baseline.goldLog10+sets.goldLog10,
   weightedLog10:baseline.weightedLog10+sets.weightedLog10
  };
  assert.ok(close(optimized.fixedAccount.damageLog10,expected.damageLog10),
   damage+"/"+gold+" damage");
  assert.ok(close(optimized.fixedAccount.goldLog10,expected.goldLog10),
   damage+"/"+gold+" gold");
  assert.ok(close(optimized.fixedAccount.weightedLog10,expected.weightedLog10));
  assert.equal(optimized.accountIntegration.monuments.additiveDamageApplied,scenario.expected===1);
  assert.equal(optimized.accountIntegration.monuments.scored,base.monumentEffects.scored);
  assert.equal(optimized.accountIntegration.releaseReady,false);
  assert.ok(Number.isFinite(optimized.accountAdjustedScore));
 }
});
