import {test} from "node:test";
import assert from "node:assert/strict";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild,spentPoints}
 from "../src/engine.js";
import {calculateModeledScenario} from "../src/calculation-ledger.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {scoreAtLevel} from "../src/effects.js";
import {resolveMonumentEvidence} from "../src/account-monuments.js";
import {SEASON_ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {skillInfo} from "../vendor/skills.js";

const createProfile=()=>parseAccountProfile({
 Version:"8.4.0",equipmentSets:[],petLevels:{},
 playerStats:{"Transcendence Season":13},
 monuments:{SeasonalArtifact1:{level:10,enchanted:false},
  SeasonalArtifact45:{level:10,enchanted:false}}
});
const base={skillPoints:100,goldWeight:0.7,qol:"none",
 minSP:0,sets:{},currentLevels:{},minimums:{},maxStage:16000,
 craftingPower:1,timeToKill:8,sClone:30,
 assumeContractsAtMax:false,assumeMaxSpells:false};
test("qualification: each of the 18 fixed damage/gold routes produces a bounded, finite ledger",()=>{
 const p=createProfile();let scenarios=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={...base,damage,gold,accountProfile:p};
  const result=optimizeBuild(settings);
  assert.ok(Number.isFinite(result.score),damage+"/"+gold);
  assert.ok(Number.isFinite(result.fixedAccount.weightedLog10),damage+"/"+gold);
  assert.ok(Number.isFinite(result.accountAdjustedScore),damage+"/"+gold);
  assert.ok(spentPoints(result.levels)<=settings.skillPoints,damage+"/"+gold);
  assert.ok(Math.abs(result.accountAdjustedScore-result.score-
   result.fixedAccount.weightedLog10)<1e-7*Math.max(1,
    Math.abs(result.accountAdjustedScore)),damage+"/"+gold+" duplicate fixed term");
  const scenario=calculateModeledScenario(result,settings,
   {selected:{},independentScore:0});
  assert.ok(Number.isFinite(scenario.totalLog10),damage+"/"+gold);
  assert.equal(scenario.optimizedForActualStages,false);
  assert.equal(scenario.supportsAutomaticCrossBuildSelection,false);
  assert.equal(scenario.coverage.complete,false);
  assert.equal(result.contractScenario.weightedLog10,0);
  assert.ok(result.conditionalSkills);
  assert.ok(result.lightningStrike);
  scenarios++;
 }
 assert.equal(scenarios,18);
});
test("qualification: Unity season-13 Celestial is active; Pirate is not",()=>{
 const profile=createProfile();
 const e=resolveMonumentEvidence(profile);
 assert.equal(e.season,13);
 assert.equal(e.seasonVerified,true);
 assert.equal(SEASON_ARTIFACT_CATALOG.SeasonalArtifact45.isActive,true);
 assert.equal(SEASON_ARTIFACT_CATALOG.SeasonalArtifact1.isActive,false);
 assert.equal(e.entries.find(x=>x.id==="SeasonalArtifact45").categoryAllowed,true);
 assert.equal(e.entries.find(x=>x.id==="SeasonalArtifact1").categoryAllowed,false);
 assert.equal(e.activeInCatalog,33);
});
test("qualification: missing activation evidence adds NO fictitious score in all 18 routes",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const options={...base,damage,gold};
  for(const id of ["MPCapacityBoost","ManaStealSkillBoost",
   "BossTimer","PoisonedBlade","KratosSummon","ClanShipStun","CritSkillBoost"]){
   const level=Number(skillInfo[id].MaxLevel);
   assert.equal(scoreAtLevel(id,level,options),0,damage+"/"+gold+"/"+id);
  }
 }
});
