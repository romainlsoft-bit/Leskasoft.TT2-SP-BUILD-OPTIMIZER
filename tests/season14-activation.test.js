import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {currentPostSeasonMode,capCurrentMaxStage,
 CURRENT_MAIN_GAME_STAGE_CAP} from "../src/current-season-policy.js";
import {resolveTranscendenceAge} from "../src/account-temporal.js";
import {resolveMonumentEvidence} from "../src/account-monuments.js";
import {availablePets} from "../src/pet-scenarios.js";
import {parseExport,optimizeBuild} from "../src/engine.js";

const nov25=new Date("2026-11-25T23:59:59.000Z");
const nov26=new Date("2026-11-26T00:00:00.000Z");
const newAccount=(petLevels={SeasonalPet2:7,SeasonalPet7:9,Pet1:120})=>
 parseAccountProfile({
  playerStats:{"Transcendence Season":14},
  petLevels,
  monuments:{SeasonalArtifact34:{level:50,enchanted:false},
   SeasonalArtifact1:{level:6,enchanted:false}}
 });
const archivedAccount=()=>parseAccountProfile({
 playerStats:{"Transcendence Season":13},
 petLevels:{SeasonalPet2:120,SeasonalPet7:120,Pet1:120},
 monuments:{SeasonalArtifact34:{level:90,enchanted:false}}
});

test("season 14 starts 26 November and resets only its own season age",()=>{
 assert.equal(currentPostSeasonMode(nov25),true);
 assert.equal(currentPostSeasonMode(nov26),false);
 const current=resolveTranscendenceAge(newAccount(),nov26);
 assert.equal(current.season,"14");
 assert.equal(current.days,0);
 assert.equal(current.betweenSeasons,false);
 assert.equal(current.estimatedSeasonEnded,false);
 const old=resolveTranscendenceAge(archivedAccount(),nov26);
 assert.equal(old.estimatedSeasonEnded,true);
});

test("180k is the entry threshold, not a season-14 maximum",()=>{
 const current=newAccount();
 const old=archivedAccount();
 assert.equal(CURRENT_MAIN_GAME_STAGE_CAP,180000);
 assert.equal(capCurrentMaxStage(281456,current,false,nov26),281456);
 assert.equal(capCurrentMaxStage(281456,current,false,nov25),180000);
 assert.equal(capCurrentMaxStage(281456,old,false,nov26),180000);
 assert.equal(capCurrentMaxStage(281456,null,false,nov26),180000);
 assert.equal(capCurrentMaxStage(281456,null,true,nov26),281456);
 assert.equal(capCurrentMaxStage(281456,null,true,nov25),180000);
 const imported=parseExport({
  Skills:{TapDmg:1},playerStats:{"Transcendence Season":14,
   "Max Prestige Stage":281456,"Skill Points Owned":400}
 });
 assert.equal(imported.maxStage,281456);
 const config={accountProfile:current,damage:"Pet",gold:"Fairy",
  skillPoints:0,goldWeight:.7,maxStage:281456,sets:{},
  currentLevels:{},minimums:{},qol:"none"};
 const result=optimizeBuild(config);
 assert.equal(result.effectiveMaxStage,281456);
 assert.equal(result.mainGameStageCap,180000);
});

test("season 14 accepts only fresh, stamped and plausible pet observations",()=>{
 const current=newAccount();
 const active=availablePets(current,nov26).map(x=>x.id);
 assert.ok(active.includes("SeasonalPet2"));
 assert.ok(active.includes("SeasonalPet7"));
 assert.ok(active.includes("Pet1"));
 assert.ok(availablePets(current,nov25).every(x=>!x.id.startsWith("SeasonalPet")));
 const old=availablePets(archivedAccount(),nov26);
 assert.ok(old.every(x=>!x.id.startsWith("SeasonalPet")));
 const unstamped=parseAccountProfile({petLevels:{
  SeasonalPet2:200,Pet1:20}});
 assert.deepEqual(availablePets(unstamped,nov26).map(x=>x.id),["Pet1"]);
 const tooMany=Object.fromEntries(Array.from({length:11},
  (_,i)=>["SeasonalPet"+(i+1),10]));
 const impossible=availablePets(newAccount(tooMany),nov26);
 assert.equal(impossible.filter(x=>x.tier==="Transcendent").length,0);
});

test("season 14 monument categories are recognized, but old coefficients are never scored",()=>{
 const present=resolveMonumentEvidence(newAccount(),nov26);
 assert.equal(present.season,"14");
 assert.equal(present.betweenSeasons,false);
 assert.equal(present.seasonVerified,false);
 assert.equal(present.modeled,0);
 assert.ok(present.entries.length>=2);
 assert.ok(present.entries.every(x=>!x.damageEligible&&!x.appliedToScore));
 assert.ok(present.entries.every(x=>
  x.formulaStatus==="unverified-season14-monument-coefficients"));
});
