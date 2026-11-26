import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {PETS} from "../vendor/pets.js";
import {TRANSCENDENT_PETS} from "../vendor/transcendent-pets.js";
import {CURRENT_MAIN_GAME_STAGE_CAP,POST_SEASON13_UTC,
 CURRENT_PET_SOURCE_PROVENANCE,currentPostSeasonMode,capCurrentMaxStage}
 from "../src/current-season-policy.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {resolveTranscendenceAge} from "../src/account-temporal.js";
import {resolveMonumentEvidence} from "../src/account-monuments.js";
import {monumentDerivedPower} from "../src/account-monument-derived.js";
import {monumentSeasonDayEvidence} from "../src/monument-season-day.js";
import {availablePets,petPassiveEvidence,petScenarioScore,recommendPets}
 from "../src/pet-scenarios.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {parseExport,optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";

const before=new Date("2026-11-23T23:59:59.000Z");
const after=new Date("2026-11-24T07:00:00.000Z");
const archived=()=>parseAccountProfile({
 playerStats:{"Transcendence Season":13},
 petLevels:{SeasonalPet2:145,SeasonalPet7:145,Pet1:150,Pet6:200},
 monuments:{SeasonalArtifact34:{level:50,enchanted:false},
  SeasonalArtifact36:{level:100,enchanted:false}}
});
const unknown=()=>parseAccountProfile({
 petLevels:{SeasonalPet2:100,SeasonalPet7:100,Pet1:130,Pet6:150},
 monuments:{SeasonalArtifact34:{level:50,enchanted:false}}
});
const cfg=(accountProfile,damage="Pet",gold="Fairy",other={})=>({
 accountProfile,damage,gold,skillPoints:0,goldWeight:.7,
 maxStage:300000,sets:{},currentLevels:{},minimums:{},qol:"none",...other
});

test("upstream 2026-11-24 pet catalog is complete, verified and separated from seasonal",()=>{
 assert.equal(Object.keys(PETS).length,30);
 assert.equal(Object.keys(TRANSCENDENT_PETS).length,15);
 assert.deepEqual(Object.keys(PETS),Array.from({length:30},(_,i)=>"Pet"+(i+1)));
 assert.deepEqual(Object.keys(TRANSCENDENT_PETS),
  Array.from({length:15},(_,i)=>"SeasonalPet"+(i+1)));
 assert.equal(CURRENT_PET_SOURCE_PROVENANCE.permanentPetCount,30);
 assert.equal(CURRENT_PET_SOURCE_PROVENANCE.archivedTranscendentPetCount,15);
 assert.equal(CURRENT_PET_SOURCE_PROVENANCE.permanentPetInfoGitSha,
  "c6f367e2ec38d7348c44974edde7de3c679ce300");
 assert.equal(CURRENT_PET_SOURCE_PROVENANCE.transcendentPetInfoGitSha,
  "b2e8ffe778f22f6742447284ac05ede113f6c992");
 assert.equal(PETS.Pet1.name,"Nova");
 assert.equal(PETS.Pet20.name,"Jaws");
 assert.equal(PETS.Pet30.name,"Taffy");
});
test("season-13 final UTC boundary closes seasonal pets even with missing export season metadata",()=>{
 assert.equal(POST_SEASON13_UTC,"2026-11-24T00:00:00.000Z");
 assert.equal(currentPostSeasonMode(before),false);
 assert.equal(currentPostSeasonMode(after),true);
 assert.equal(currentPostSeasonMode(new Date("2026-11-25T00:00:00Z")),true);
 for(const profile of [archived(),unknown()]){
  const previous=availablePets(profile,before);
  const now=availablePets(profile,after);
  assert.ok(previous.some(p=>p.id==="SeasonalPet2"));
  assert.ok(now.every(p=>!p.id.startsWith("SeasonalPet")));
  assert.deepEqual(now.map(p=>p.id),["Pet1","Pet6"]);
  const timeline=resolveTranscendenceAge(profile,after);
  assert.equal(timeline.betweenSeasons,true);
  assert.equal(timeline.mainGameStageCap,180000);
 }
});
test("archived seasonal pets cannot survive fixed passives, active pet scores or recommendations",()=>{
 const profile=archived();
 const current=availablePets(profile);
 assert.deepEqual(current.map(p=>p.id),["Pet1","Pet6"]);
 const passive=petPassiveEvidence(profile);
 assert.equal(passive.seasonalImported,0);
 assert.equal(passive.seasonalDirect,0);
 const baseline=extractFixedAccountPower(profile);
 assert.equal(baseline.petPassives.seasonalImported,0);
 const settings=cfg(profile,"Pet","Fairy");
 assert.equal(petScenarioScore({...settings,selectedDamagePet:"SeasonalPet7",
  selectedGoldPet:"SeasonalPet2"},0),0);
 assert.ok(recommendPets(profile,settings,"damage").every(
  p=>!p.id.startsWith("SeasonalPet")));
 assert.ok(recommendPets(profile,settings,"gold").every(
  p=>!p.id.startsWith("SeasonalPet")));
});
test("monuments and additive monument pool are ignored after reset, without removing historical catalog",()=>{
 const p=archived();
 const old=resolveMonumentEvidence(p,before);
 assert.equal(old.seasonVerified,true);
 assert.ok(old.entries.some(r=>r.appliedToScore));
 const current=resolveMonumentEvidence(p,after);
 assert.equal(current.betweenSeasons,true);
 assert.equal(current.seasonVerified,false);
 assert.ok(current.entries.length>=2);
 assert.ok(current.entries.every(r=>!r.appliedToScore&&!r.damageEligible));
 assert.ok(current.entries.every(r=>r.formulaStatus==="ignored-post-season13-reset"));
 const derived=monumentDerivedPower(p,current);
 assert.deepEqual(derived.entries,[]);
 assert.equal(derived.poolLog10,null);
 const daily=monumentSeasonDayEvidence(current);
 assert.equal(daily.totalEntries,0);
 assert.equal(daily.addedToScore,false);
 const account=extractFixedAccountPower(p,after);
 assert.equal(account.monumentEffects.scored,0);
 assert.equal(account.monumentEffects.additiveDamageApplied,false);
 assert.equal(account.entries.filter(e=>["monuments","monumentDamage"].includes(e.system)).length,0);
});
test("stale season-13 records without a season number never restore monuments or seasonal pets",()=>{
 const p=unknown();
 assert.deepEqual(availablePets(p,after).map(p=>p.id),["Pet1","Pet6"]);
 const monument=resolveMonumentEvidence(p,after);
 assert.equal(monument.modeled,0);
 assert.equal(monument.entries.some(r=>r.appliedToScore),false);
 assert.equal(monument.entries.some(r=>r.damageEligible),false);
 const power=extractFixedAccountPower(p,after);
 assert.equal(power.monumentEffects.additiveDamageApplied,false);
 assert.equal(power.petPassives.seasonalDirect,0);
});
test("max stage 180000 applies to old imports, direct optimization and persisted values",()=>{
 assert.equal(CURRENT_MAIN_GAME_STAGE_CAP,180000);
 for(const [input,expected] of [[0,0],[179999,179999],
  [180000,180000],[180001,180000],[250000,180000],
  [999999,180000],[-1,0],["foo",0]])
  assert.equal(capCurrentMaxStage(input),expected);
 const imported=parseExport({
  Skills:{TapDmg:1},
  playerStats:{"Max Prestige Stage":286712,"Skill Points Owned":400}
 });
 assert.equal(imported.maxStage,180000);
 for(const x of [180000,286712,999999]){
  const result=optimizeBuild(cfg(archived(),"Pet","Fairy",{
   maxStage:x,skillPoints:0
  }));
  assert.equal(result.effectiveMaxStage,180000);
  assert.equal(result.mainGameStageCap,180000);
 }
});
test("all 18 damage-gold routes ignore stale monuments / Transcendent pets in the real optimizer",()=>{
 const stale=parseAccountProfile({
  playerStats:{"Transcendence Season":13},
  petLevels:{SeasonalPet7:99,SeasonalPet2:99},
  monuments:{SeasonalArtifact34:{level:100,enchanted:false}}
 });
 const clean=parseAccountProfile({});
 let count=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const config=cfg(stale,damage,gold,{maxStage:300000});
  const result=optimizeBuild(config);
  const expected=optimizeBuild(cfg(clean,damage,gold,{
   maxStage:180000
  }));
  assert.equal(result.effectiveMaxStage,180000);
  assert.equal(result.accountIntegration.monuments.scored,0);
  assert.equal(result.accountIntegration.monuments.additiveDamageApplied,false);
  assert.equal(result.accountIntegration.petPassives.seasonalImported,0);
  assert.equal(result.fixedAccount.weightedLog10,
   expected.fixedAccount.weightedLog10,damage+"/"+gold+" fixed score");
  assert.equal(result.modelAttribution.additiveReconstructionMatches,true);
  count++;
 }
 assert.equal(count,18);
});
test("all four localized frontends enforce cap, module identities are unique and no Actions exist",()=>{
 const files=["src/app.js","src/worker.js","src/engine.js",
  "src/pet-scenarios.js","src/account-power.js","src/account-dependencies.js"];
 const code=Object.fromEntries(files.map(path=>[
  path,readFileSync(new URL("../"+path,import.meta.url),"utf8")]));
 const id=(path,name)=>code[path].match(new RegExp(
  name.replaceAll(".","\\.")+"\\?([^\\\"]+)"))?.[1];
 assert.equal(id("src/app.js","engine.js"),id("src/worker.js","engine.js"));
 assert.equal(id("src/app.js","pet-scenarios.js"),
  id("src/worker.js","pet-scenarios.js"));
 assert.equal(id("src/engine.js","account-power.js"),
  id("src/account-dependencies.js","account-power.js")??id("src/engine.js","account-power.js"));
 assert.ok(code["src/app.js"].includes("capCurrentMaxStage"));
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.ok(html.includes('id="max-stage" type="number" min="0"'),path);
  assert.ok(!html.includes('id="max-stage" type="number" min="0" max="180000"'),path);
  assert.ok(html.includes("&amp;season=20261126-season14-r1"),path);
 }
 assert.equal(existsSync(new URL("../.github/workflows/",import.meta.url)),false);
});
