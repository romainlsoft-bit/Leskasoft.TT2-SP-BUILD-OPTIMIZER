import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {scoreAtLevel} from "../src/effects.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES,spentPoints} from "../src/engine.js";

const options=(damage,gold,extra={})=>({
 damage,gold,goldWeight:.7,skillPoints:150,maxStage:300000,
 currentLevels:{},minimums:{},qol:"none",...extra
});

test("Tactical Insight community proxy remains the unchanged default",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const before=scoreAtLevel("HelperBoost",5,options(damage,gold));
  const explicit=scoreAtLevel("HelperBoost",5,
   options(damage,gold,{excludeUnverifiedTacticalInsight:false}));
  assert.equal(before,explicit,damage+"/"+gold);
  const conservative=scoreAtLevel("HelperBoost",5,
   options(damage,gold,{excludeUnverifiedTacticalInsight:true}));
  assert.equal(conservative,0,damage+"/"+gold);
 }
});

test("uncertainty policy changes only this unverified coefficient, not other native talents",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const normal=options(damage,gold);
  const experiment={...normal,excludeUnverifiedTacticalInsight:true};
  for(const skill of ["PetDmg","TapDmg","FairyGold","HelperDmgSkillBoost"]){
   assert.equal(scoreAtLevel(skill,1,experiment),
    scoreAtLevel(skill,1,normal),damage+"/"+gold+"/"+skill);
  }
 }
});

test("both allocation policies obey real budget, source constraints and report uncertainty",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const normal=optimizeBuild(options(damage,gold));
  const experiment=optimizeBuild(options(damage,gold,{
   excludeUnverifiedTacticalInsight:true
  }));
  assert.ok(spentPoints(normal.levels)<=150);
  assert.ok(spentPoints(experiment.levels)<=150);
  assert.equal(normal.modelAttribution.tacticalInsightCommunityWeightExcluded,false);
  assert.equal(experiment.modelAttribution.tacticalInsightCommunityWeightExcluded,true);
  assert.equal(experiment.modelAttribution.gameplayCalibrationVerified,false);
  assert.equal(experiment.modelAttribution.optimizerScoreChanged,true);
  assert.equal(experiment.model,"TT2 weighted log-damage/gold proxy; not a gameplay performance guarantee");
 }
});

test("the optional sensitivity switch exists in every locale and refreshes modules",()=>{
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.equal((html.match(/id="exclude-unverified-tactical-insight"/g)||[]).length,1,path);
  assert.ok(html.includes("src/app.js?v=20261123-native-attack-r1"),path);
 }
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.match(app,/state\.excludeUnverifiedTacticalInsight=\$\("exclude-unverified-tactical-insight"\)\.checked/);
 assert.match(app,/tiExperiment:state\.excludeUnverifiedTacticalInsight===true/);
});
