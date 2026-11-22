import test from "node:test";
import assert from "node:assert/strict";
import {parseExport,optimizeBuild,spentPoints} from "../src/engine.js";
import {parseExportCounter} from "../src/import-numbers.js";
import {resetAccountDependentOptions} from "../src/import-session-reset.js";
import {readFileSync} from "node:fs";
import {scoreAtLevel} from "../src/effects.js";
import {multicastSkillEvidence,resolveSpellScenario} from "../src/spell-scenarios.js";
import {goldSourceReduction} from "../src/gold-source-reductions.js";
import {fixedAccountScore} from "../src/account-power.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {gearSelectionEffects} from "../src/equipment-scenarios.js";
import {activationCountInWindow} from "../src/flash-zip.js";
import {optimizeExact} from "../src/solver-core.js";
import {modeledCandidateUpperBound,rankVisitedCandidateBounds,visitedScoreEnvelope} from "../src/model-score-bounds.js";
import {enumerateJointGearAndSkills} from "../src/joint-candidate-search.js";
import {selectPetPair} from "../src/pet-pair-search.js";

const near=(a,b,m)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8,m??`${a} != ${b}`);
const pet={damage:"Pet",gold:"Fairy",goldWeight:.7,skillPoints:1000,
 maxStage:800000,sets:{},qol:"none",currentLevels:{},minimums:{}};

test("#30: import counters preserve explicit zero and parse grouped integers",()=>{
 assert.equal(parseExportCounter(0),0);
 assert.equal(parseExportCounter("0"),0);
 assert.equal(parseExportCounter("22,600"),22600);
 assert.equal(parseExportCounter("792,100"),792100);
 assert.equal(parseExportCounter("22 600"),22600);
 assert.equal(parseExportCounter("22\u202f600"),22600);
 for(const v of ["22,60","22.600","1,2,3","-50","1 234,567"]){
  assert.throws(()=>parseExportCounter(v),/Ambiguous|Invalid/);
 }
 assert.equal(parseExportCounter(undefined),null);
 const a=parseExport({Skills:{TapDmg:1},playerStats:{"Skill Points Owned":"22,600","Max Prestige Stage":"792,100"}});
 assert.equal(a.skillPoints,22600);
 assert.equal(a.maxStage,792100);
 assert.equal(a.budgetSource,"declared");
 assert.equal(a.budgetInconsistent,false);
 const missing=parseExport({Skills:{TapDmg:1}});
 assert.equal(missing.skillPoints,null);
 assert.equal(missing.skillPointsSpent,spentPoints(missing.levels));
 assert.equal(missing.budgetSource,"inferred");
 assert.equal(missing.skillPointsSpent,1);
 const zero=parseExport({Skills:{},SkillPoints:0});
 assert.equal(zero.skillPoints,0);
 assert.equal(zero.budgetSource,"declared");
 assert.equal(zero.budgetInconsistent,false);
 const conflict=parseExport({Skills:{TapDmg:1},SkillPoints:0});
 assert.equal(conflict.budgetInconsistent,true);
});
test("#30: two successive imports, explicit zero, mismatch and manual edits reach worker settings",async()=>{
 const {readFileSync}=await import("node:fs");
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 const extract=(begin,end)=>app.slice(app.indexOf(begin),app.indexOf(end,app.indexOf(begin)));
 const importSource=extract("function importRaw(raw){","function offerManualPaste(");
 const readSource=extract("function readInputs(){","function optimize(){");
 const controls=new Map();
 const $=id=>{
  if(!controls.has(id))controls.set(id,{value:"",checked:false,textContent:""});
  return controls.get(id);
 };
 const statusMessages=[],state={skillPoints:9000};
 const fillInputs=()=>{$("skill-points").value=state.skillPoints??"";};
 const importRaw=new Function("parseExport","resetAccountDependentOptions","state",
  "$","fillInputs","remember","status","tr",
  importSource+"\nreturn importRaw;")(
  parseExport,resetAccountDependentOptions,state,$,fillInputs,()=>{},
  (message)=>statusMessages.push(message),x=>x);
 importRaw({Skills:{TapDmg:1},playerStats:{"Skill Points Owned":"22,600"}});
 assert.equal(state.skillPoints,22600);
 assert.equal(state.budgetSource,"declared");
 importRaw({Skills:{TapDmg:1}});
 assert.equal(state.skillPoints,1);
 assert.equal($("skill-points").value,1);
 assert.equal(state.budgetSource,"inferred");
 assert.match(statusMessages.at(-1),/No SP budget/);
 importRaw({Skills:{},SkillPoints:0});
 assert.equal(state.skillPoints,0);
 assert.equal($("skill-points").value,0);
 assert.equal(state.budgetSource,"declared");
 importRaw({Skills:{TapDmg:1},SkillPoints:0});
 assert.equal(state.budgetInconsistent,true);
 assert.match(statusMessages.at(-1),/lower than/);
 $("skill-points").value="125";
 const readInputs=new Function("state","$","keepContractsConservative","persist",
  readSource+"\nreturn readInputs;")(state,$,x=>x,()=>{});
 readInputs();
 assert.equal(state.skillPoints,125);
 assert.equal(state.budgetSource,"manual");
 assert.equal(state.budgetInconsistent,false);
 assert.match(app,/settings:requestContext/);
 assert.match(app,/const requestContext=keepContractsConservative\(structuredClone\(state\)\)/);
});
test("#30: multiscast bonus requires a selected and unlocked spell",()=>{
 const absent={...pet,selectedSpells:["BurstDamage","CritBoost","HandOfMidas","HelperBoost","ShadowClone","StreamOfBlades"]};
 near(scoreAtLevel("TapBoostMultiCastSkill",3,absent),0);
 near(scoreAtLevel("DualPetMultiCast",3,absent),0);
 assert.equal(multicastSkillEvidence("TapBoostMultiCastSkill",3,absent).status,"spell-absent");
 assert.equal(multicastSkillEvidence("TapBoostMultiCastSkill",3,pet).status,"unknown-loadout");
 near(scoreAtLevel("TapBoostMultiCastSkill",3,pet),0);
 const selected={...pet,selectedSpells:["TapBoost"]};
 assert.ok(scoreAtLevel("TapBoostMultiCastSkill",1,selected)>0);
 near(scoreAtLevel("TapBoostMultiCastSkill",1,{...selected,multicastAvailableCharges:{TapBoost:0}}),0);
 const two={...selected,multicastAvailableCharges:{TapBoost:2}};
 assert.ok(scoreAtLevel("TapBoostMultiCastSkill",1,two)>=scoreAtLevel("TapBoostMultiCastSkill",1,selected));
 const m=multicastSkillEvidence("TapBoostMultiCastSkill",3,selected);
 assert.equal(m.maximumCharges,3);
 assert.equal(m.sourceDurationSeconds,30);
 assert.equal(m.actualUptimeVerified,false);
 const locked={...pet,selectedSpells:["DualPet"]};
 near(scoreAtLevel("DualPetMultiCast",1,locked),0);
 assert.equal(multicastSkillEvidence("DualPetMultiCast",1,locked).status,"spell-locked");
 const unlocked={...locked,minimums:{DualPetBoost:1}};
 assert.ok(scoreAtLevel("DualPetMultiCast",1,unlocked)>0);
 const noAssumption={...selected,assumeMaxSpells:false};
 near(scoreAtLevel("TapBoostMultiCastSkill",1,noAssumption),0);
});
test("#30: specialized multicast branches obey the identical spell context",()=>{
 const missing={...pet,selectedSpells:["TapBoost"]};
 near(scoreAtLevel("TwilightGatheringMultiCastSkill",3,missing),0);
 near(scoreAtLevel("HandOfMidasMultiCastSkillBoost",3,missing),0);
 const tw={...pet,damage:"Shadow Clone",selectedSpells:["TwilightFairy"],minimums:{TwilightGathering:1}};
 const mid={...pet,selectedSpells:["HandOfMidas"]};
 assert.equal(multicastSkillEvidence("TwilightGatheringMultiCastSkill",1,tw).status,"modeled");
 assert.ok(scoreAtLevel("TwilightGatheringMultiCastSkill",1,tw)>0);
 assert.ok(scoreAtLevel("TwilightGatheringMultiCastSkill",1,{...tw,damage:"Heavenly Strike"})>0);
 near(scoreAtLevel("TwilightGatheringMultiCastSkill",1,{...tw,damage:"Pet"}),0);
 assert.ok(scoreAtLevel("HandOfMidasMultiCastSkillBoost",1,mid)>0);
 assert.equal(resolveSpellScenario(mid,{HandOfMidasMultiCastSkillBoost:1})
  .multicast.HandOfMidasMultiCastSkillBoost.modeled,true);
});
test("#30: 1000-SP optimizer does not buy unselected Pet multicasts for phantom damage",()=>{
 const input={...pet,selectedSpells:["BurstDamage","CritBoost","HandOfMidas","HelperBoost","ShadowClone","StreamOfBlades"]};
 const result=optimizeBuild(input);
 assert.ok(result.spent<=1000);
 assert.ok(result.optimality.upperBound>=result.score);
 assert.equal(result.spellScenario.multicast.TapBoostMultiCastSkill.status,"spell-absent");
 assert.equal(result.spellScenario.multicast.DualPetMultiCast.status,"spell-absent");
 // Prerequisite investments are legal and must NOT be forbidden arbitrarily.
 for(const id of ["TapBoostMultiCastSkill","DualPetMultiCast"])
  if(result.levels[id]>0) assert.ok(result.levels[id]<=3);
});
test("#30: 22,600 SP builds preserve unknown multicast investments and score none for absent spells",()=>{
 const noLoadout=optimizeBuild({...pet,skillPoints:1000,
  currentLevels:{TapBoostMultiCastSkill:1}});
 assert.ok(noLoadout.protectedSkills.includes("TapBoostMultiCastSkill"));
 assert.ok(noLoadout.levels.TapBoostMultiCastSkill>=1);
 const missing=["BurstDamage","CritBoost","HandOfMidas","HelperBoost","ShadowClone","StreamOfBlades"];
 const ctx={...pet,skillPoints:22600,selectedSpells:missing};
 const result=optimizeBuild(ctx);
 assert.ok(result.spent<=22600);
 assert.equal(result.spellScenario.multicast.TapBoostMultiCastSkill.status,"spell-absent");
 assert.equal(result.spellScenario.multicast.DualPetMultiCast.status,"spell-absent");
 near(scoreAtLevel("TapBoostMultiCastSkill",result.levels.TapBoostMultiCastSkill,ctx),0);
 near(scoreAtLevel("DualPetMultiCast",result.levels.DualPetMultiCast,ctx),0);
});
test("#30: Chesterson amount is routed once to Fairy and Chesterson, not HoG",()=>{
 const power={available:true,byType:{ChestAmount:2,GoldChesterson:1,GoldAll:.5}};
 for(const gold of ["Fairy","Chesterson","HoG"]){
  const output=fixedAccountScore(power,{...pet,gold});
  const expected=gold==="HoG"?.5:3.5;
  near(output.goldLog10,expected);
  near(output.weightedLog10-output.damageLog10,pet.goldWeight*expected);
 }
 for(const type of ["ChestAmount","GoldChesterson"]){
  assert.equal(goldSourceReduction(type,"Fairy"),1);
  assert.equal(goldSourceReduction(type,"Chesterson"),1);
  assert.equal(goldSourceReduction(type,"HoG"),0);
 }
 assert.equal(goldSourceReduction("ChestersonGoldStageAmount","Fairy"),null);
 near(scoreAtLevel("ChestGold",1,pet),.7*Math.log10(1.8));
 near(scoreAtLevel("ChestGold",1,{...pet,gold:"HoG"}),0);
 near(scoreAtLevel("ChestGold",1,{...pet,goldWeight:0}),0);
 const noGold=fixedAccountScore(power,{...pet,goldWeight:0});
 near(noGold.weightedLog10,noGold.damageLog10);
});
test("#30: Pet/Fairy gear chooses verified ChestAmount over weaker GoldAll",()=>{
 const profile=parseAccountProfile({equipmentInventory:[
  {id:"ChestArmor",slot:"Armor",name:"Chest x100",bonusType:"ChestAmount",bonusAmount:"100"},
  {id:"GoldArmor",slot:"Armor",name:"All x2",bonusType:"GoldAll",bonusAmount:"2"}]});
 const selected=gearSelectionEffects(profile,pet);
 assert.equal(selected.selected.Armor.name,"Chest x100");
 assert.ok(selected.selected.Armor.primaryReduction>0);
 const hog=gearSelectionEffects(profile,{...pet,gold:"HoG"});
 assert.equal(hog.selected.Armor.name,"All x2");
});
test("#30: Flash Zip damage per activation cannot be penalized by faster cooldown",()=>{
 const reference=scoreAtLevel("BossDmgQTE",1,pet);
 near(reference,Math.log10(2));
 assert.equal(activationCountInWindow(9.8,10,.993),1);
 assert.equal(activationCountInWindow(9.95,10,.993),2);
 near(scoreAtLevel("BossDmgQTE",1,{...pet,
  flashZipBaseCooldownSeconds:10,flashZipWindowSeconds:9.8}),reference);
 near(scoreAtLevel("BossDmgQTE",1,{...pet,
  flashZipBaseCooldownSeconds:10,flashZipWindowSeconds:9.95}),
  reference+Math.log10(2));
 const hog={...pet,gold:"HoG",
  heartOfGoldBaseCooldownSeconds:10,heartOfGoldWindowSeconds:9.95};
 assert.ok(scoreAtLevel("BossDmgQTE",1,hog)>=reference);
});
test("#30: grid starts at prerequisite-complete reachable branch minima",()=>{
 const skills=[
  {id:"parentA",branch:"A",parent:"None",spReq:0,min:0,max:1,costs:[0,5999]},
  {id:"childA",branch:"A",parent:"parentA",spReq:0,min:1,max:1,costs:[0,1]},
  {id:"parentB",branch:"B",parent:"None",spReq:0,min:0,max:1,costs:[0,6000]},
  {id:"childB",branch:"B",parent:"parentB",spReq:0,min:1,max:1,costs:[0,1]}
 ];
 const value=(_,lvl)=>lvl;
 const exact=optimizeExact(skills,12001,value,"power",()=>{}, {gridThreshold:50000});
 const grid=optimizeExact(skills,12001,value);
 assert.equal(exact.score,4);
 assert.equal(grid.score,4);
 assert.equal(grid.optimality.upperBound,4);
 for(const skill of skills)assert.equal(grid.levels[skill.id],1);
 assert.throws(()=>optimizeExact(skills,12000,value),/budget|minimum|allocation/i);
});
test("#30: every visited equipment upper bound survives pet-pair ranking",()=>{
 const models={A:{One:[100,100],Two:[90,90]},
  B:{One:[99,99],Two:[98,105]}};
 const run=damagePet=>{
  const result=enumerateJointGearAndSkills({damagePet},{
   assignments:[{Sword:"One"},{Sword:"Two"}],
   gearFor:ctx=>({selected:{Sword:{id:ctx.selectedEquipment.Sword}},
    petEquipmentSlotWeights:{},petEquipmentPassiveWeights:{}}),
   solve:ctx=>{
    const [score,upperBound]=models[ctx.damagePet][ctx.selectedEquipment.Sword];
    return {score,levels:{CombatTechniques:0},
     optimality:{mode:"bounded-power",upperBound}};
   },
   score:result=>result.score,
   upperBoundOf:modeledCandidateUpperBound
  });
  return {adjustedScore:result.best.adjustedScore,
   scoreUpperBound:result.best.scoreUpperBound,
   boundUnresolved:result.best.boundUnresolved};
 };
 const a=run("A"),b=run("B");
 near(a.adjustedScore,100);near(a.scoreUpperBound,100);
 near(b.adjustedScore,99);near(b.scoreUpperBound,105);
 let ranking=selectPetPair([{id:"A"},{id:"B"}],[{id:"Gold"}],
  d=>run(d),{exhaustiveShortlist:true,entireEligibleRoster:true});
 assert.equal(ranking.best.damagePet,"A");
 assert.equal(ranking.comparisonBounds.certifiedWithinVisited,false);
 near(ranking.comparisonBounds.largestPossibleChallengerGain,5);
 models.B.Two[1]=100;
 ranking=selectPetPair([{id:"A"},{id:"B"}],[{id:"Gold"}],
  d=>run(d),{exhaustiveShortlist:true,entireEligibleRoster:true});
 assert.equal(ranking.comparisonBounds.certifiedWithinVisited,true);
 assert.equal(visitedScoreEnvelope([{adjustedScore:99,scoreUpperBound:null}]).unresolved,true);
 const unknown=rankVisitedCandidateBounds([{adjustedScore:100,scoreUpperBound:100},
  {adjustedScore:99,scoreUpperBound:null}],
  {adjustedScore:100,scoreUpperBound:100});
 assert.equal(unknown.certifiedWithinVisited,false);
});

test("#30: benchmark and worker share the envelope used for pet-pair upper bounds",()=>{
 const bench=readFileSync(new URL("../scripts/benchmark-22k.mjs",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
 const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
 assert.match(bench,/scoreUpperBound:joint\.best\.scoreUpperBound/);
 assert.match(worker,/scoreUpperBound:winning\.scoreUpperBound/);
 assert.match(pkg.scripts["bench:issue30"],/--sp 22600/);
 assert.match(pkg.scripts["bench:issue30"],/--sp 50000/);
});
