import {test} from "node:test";
import assert from "node:assert/strict";
import {exactConvolution,optimizeExact,branchDynamicProgram,upperConcaveEnvelope} from "../src/solver-core.js";
import {SKILLS,SKILL_IDS,GAME_VERSION,DAMAGE_TYPES,GOLD_TYPES,parseExport,exportBuild,spentPoints,optimizeBuild,ownedSetFlags} from "../src/engine.js";
import {scoreAtLevel,assertFiniteScores} from "../src/effects.js";
import {observedPetFairy} from "./fixtures/pet-fairy-comparison-20261116.js";
const defaults={damage:"Clan Ship",gold:"Fairy",goldWeight:0.7,skillPoints:0,qol:"none",sets:{},minimums:{},currentLevels:{},maxStage:0,craftingPower:1,timeToKill:8,sClone:30};
let seed=712367;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
function bruteConvolution(a,b){return a.map((_,budget)=>Math.max(...Array.from({length:budget+1},(_,i)=>a[i]+b[budget-i])))}
test("72 skills have supported numeric costs and prerequisites",()=>{
 assert.equal(SKILL_IDS.length,72);
 for(let id of SKILL_IDS){
   const s=SKILLS[id];assert.ok(s.MaxLevel>0);
   assert.ok(s.TalentReq==="None" || SKILLS[s.TalentReq],id+" parent missing");
   for(let l=0;l<s.MaxLevel;l++)assert.ok(Number.isInteger(Number(s["Co"+l])),id+" cost "+l);
 }
});
test("TT2 export import and export roundtrip",()=>{
 const data={playerStats:{"Skill Points Owned":600,"Max Prestige Stage":14000,"Crafting Power":2},skillTree:{TapDmg:3,PetDmg:1},equipmentSets:["MultiCast","DarkAngel"]};
 const parsed=parseExport(JSON.stringify(data));
 assert.equal(parsed.skillPoints,600);assert.equal(parsed.levels.TapDmg,3);assert.equal(parsed.sets.FB,true);assert.equal(parsed.sets.tFA,true);
 const again=parseExport(exportBuild(parsed.levels,GAME_VERSION));
 assert.equal(again.levels.TapDmg,3);assert.equal(again.levels.PetDmg,1);
 assert.throws(()=>parseExport("{bad"),/JSON/);
});
test("Scores are finite for all 72 skills and all six build types",()=>{
 for(let damage of DAMAGE_TYPES)for(let gold of GOLD_TYPES){
   assert.deepEqual(assertFiniteScores(SKILL_IDS,{...defaults,damage,gold}),[]);
 }
});
test("Exact convolution is equivalent to exhaustive O(S²) search",()=>{
 for(let attempt=0;attempt<60;attempt++){
   let a=[0],b=[0];for(let i=1;i<=50;i++){
     a.push(a.at(-1)+rng()*3);b.push(b.at(-1)+rng()*3);
   }
   const exact=exactConvolution(a,b).values,expected=bruteConvolution(a,b);
   for(let i=0;i<exact.length;i++)assert.ok(Math.abs(exact[i]-expected[i])<1e-7,`case ${attempt} SP ${i}`);
 }
});
test("Tier prerequisites and zero-level eligibility are enforced",()=>{
 const skills=[
  {id:"a",branch:"A",parent:"None",spReq:0,min:0,max:2,costs:[0,1,3]},
  {id:"b",branch:"A",parent:"a",spReq:3,min:0,max:2,costs:[0,1,2]},
  {id:"c",branch:"A",parent:"b",spReq:4,min:0,max:1,costs:[0,1]}
 ];
 const value=(s,l)=>({a:[0,1,2],b:[0,1,20],c:[0,30]}[s.id][l]);
 for(let budget=0;budget<=8;budget++){
  let expected=-Infinity;
  for(let a=0;a<=2;a++)for(let b=0;b<=2;b++)for(let c=0;c<=1;c++){
    const ca=skills[0].costs[a],cb=skills[1].costs[b],cc=skills[2].costs[c];
    if(ca+cb+cc>budget)continue;
    if(b>0 && (a===0||ca<3))continue;
    if(c>0 && (b===0||ca+cb<4))continue;
    expected=Math.max(expected,value(skills[0],a)+value(skills[1],b)+value(skills[2],c));
  }
  const actual=optimizeExact(skills,budget,value);
  assert.ok(Math.abs(actual.score-expected)<1e-7,`budget=${budget}`);
 }
});
test("Random tiny tree instances match exhaustive enumeration",()=>{
 for(let t=0;t<80;t++){
  const skills=[
   {id:"root",branch:"A",parent:"None",spReq:0,min:0,max:2,costs:[0,1,3]},
   {id:"child",branch:"A",parent:"root",spReq:2,min:0,max:2,costs:[0,1,2]},
   {id:"other",branch:"B",parent:"None",spReq:0,min:0,max:2,costs:[0,1,3]}
  ];
  const weights=Array.from({length:3},()=>[0,1+rng()*7,2+rng()*12]);
  const budget=1+Math.floor(rng()*9);
  const score=(s,l)=>weights[["root","child","other"].indexOf(s.id)][l];
  let expected=-Infinity;
  for(let a=0;a<=2;a++)for(let b=0;b<=2;b++)for(let c=0;c<=2;c++){
   if(skills[0].costs[a]+skills[1].costs[b]+skills[2].costs[c]>budget)continue;
   if(b>0&&(a===0||skills[0].costs[a]<2))continue;
   expected=Math.max(expected,score(skills[0],a)+score(skills[1],b)+score(skills[2],c));
  }
  const actual=optimizeExact(skills,budget,score);
  assert.ok(Math.abs(actual.score-expected)<1e-7,`random test ${t} at SP=${budget}: ${actual.score} vs ${expected}`);
 }
});
test("Real model respects budgets and skill prerequisites",()=>{
 for(let budget of [0,25,100,400]){
   const out=optimizeBuild({...defaults,skillPoints:budget});
   assert.ok(out.spent<=budget);
   assert.equal(spentPoints(out.levels),out.spent);
   for(let id of SKILL_IDS){
    let s=SKILLS[id];if(out.levels[id]>0&&s.TalentReq!=="None")assert.ok(out.levels[s.TalentReq]>0);
   }
 }
});
test("Required levels fail clearly if budget is insufficient",()=>{
 assert.throws(()=>optimizeBuild({...defaults,skillPoints:2,minimums:{TapDmg:20}}),/more SP/);
});

test("50,000 SP input is valid, 50,001 and non-integers are rejected",()=>{
 const one=[{id:"only",branch:"A",parent:"None",spReq:0,min:0,max:1,costs:[0,1]}];
 assert.doesNotThrow(()=>optimizeExact(one,50000,(_,lvl)=>lvl));
 assert.throws(()=>optimizeExact(one,50001,(_,lvl)=>lvl),/50,000/);
 assert.throws(()=>optimizeBuild({...defaults,skillPoints:50001}),/50,000/);
});

test("Variable branch capacity convolution agrees with exhaustive oracle",()=>{
 for(let trial=0;trial<160;trial++){
  const lengthA=1+Math.floor(rng()*35),lengthB=1+Math.floor(rng()*35),cap=Math.floor(rng()*(lengthA+lengthB+3));
  const startA=Math.floor(rng()*Math.min(lengthA,4)),startB=Math.floor(rng()*Math.min(lengthB,4));
  const a=new Float64Array(lengthA).fill(-Infinity),b=new Float64Array(lengthB).fill(-Infinity);
  let scoreA=0,scoreB=0;
  for(let i=startA;i<lengthA;i++){scoreA+=Math.floor(rng()*9)*.21;a[i]=scoreA;}
  for(let i=startB;i<lengthB;i++){scoreB+=Math.floor(rng()*11)*.31;b[i]=scoreB;}
  const result=exactConvolution(a,b,cap);
  for(let sp=0;sp<result.values.length;sp++){
    let expected=-Infinity;
    for(let split=Math.max(0,sp-lengthB+1);split<=Math.min(sp,lengthA-1);split++)
      expected=Math.max(expected,a[split]+b[sp-split]);
    const got=result.values[sp];
    if(!Number.isFinite(expected))assert.equal(got,expected);
    else assert.ok(Math.abs(got-expected)<1e-7,`trial ${trial}, budget ${sp}, expected ${expected}, got ${got}`);
  }
 }
});

test("Bounded 50k solver finishes for large gaps in skill costs",()=>{
 const skills=[
 {id:"a",branch:"A",parent:"None",spReq:0,min:0,max:2,costs:[0,1,50000]},
 {id:"b",branch:"B",parent:"None",spReq:0,min:0,max:2,costs:[0,2,50000]},
 {id:"c",branch:"C",parent:"None",spReq:0,min:0,max:2,costs:[0,3,50000]}
 ];
 const r=optimizeExact(skills,50000,(item,lvl)=>lvl===2?100+item.id.charCodeAt(0):lvl);
 assert.equal(r.solver,"bounded-grid-dp");
 assert.equal(r.score,199);
 assert.ok(r.optimality.upperBound>=r.score);
 assert.ok(skills.reduce((sum,s)=>sum+s.costs[r.levels[s.id]],0)<=50000);
});

test("Bounded cross-tree score is bracketed by rigorous bounds (oracle)",()=>{
 for(let caseNum=0;caseNum<100;caseNum++){
  const skills=[
   {id:"first",branch:"A",parent:"None",spReq:0,min:Math.floor(rng()*2),max:3,costs:[0,2,5,10]},
   {id:"second",branch:"B",parent:"None",spReq:0,min:Math.floor(rng()*2),max:3,costs:[0,1,4,9]},
   {id:"third",branch:"C",parent:"None",spReq:0,min:Math.floor(rng()*2),max:3,costs:[0,3,6,13]}
  ];
  const gains=skills.map(()=>Array.from({length:4},(_,lvl)=>lvl* (1+Math.floor(rng()*5))));
  const score=(skill,lvl)=>gains[skills.indexOf(skill)][lvl];
  const budget=15+Math.floor(rng()*20);
  let expected=-Infinity;
  for(let a=skills[0].min;a<=3;a++)for(let b=skills[1].min;b<=3;b++)for(let c=skills[2].min;c<=3;c++){
    const used=skills[0].costs[a]+skills[1].costs[b]+skills[2].costs[c];
    if(used<=budget)expected=Math.max(expected,gains[0][a]+gains[1][b]+gains[2][c]);
  }
  const result=optimizeExact(skills,budget,score,"power",()=>{},{gridThreshold:5,gridTarget:5});
  const spent=skills.reduce((sum,s)=>sum+s.costs[result.levels[s.id]],0);
  assert.ok(spent<=budget);
  assert.ok(result.score<=expected+1e-9);
  assert.ok(result.optimality.upperBound+1e-9>=expected);
 }
});

test("Conditional Hayst and Snap bonuses must be active to count for Pet/Fairy boss push",()=>{
 const settings={...defaults,damage:"Pet",gold:"Fairy"};
 for(const level of [1,12,20]){
   assert.equal(scoreAtLevel("QuickFortune",level,settings),0);
   assert.equal(scoreAtLevel("PhilosophersFlux",level,settings),0);
   assert.ok(scoreAtLevel("QuickFortune",level,{...settings,assumeHaystActive:true})>0);
   assert.ok(scoreAtLevel("PhilosophersFlux",level,{...settings,assumeSnapActive:true})>0);
 }
 assert.ok(scoreAtLevel("LoadedDice",12,settings)>0);
 assert.equal(scoreAtLevel("LoadedDice",12,settings),
   scoreAtLevel("LoadedDice",12,{...settings,assumeHaystActive:true}));
});
test("Astral Awakening uses actual orb taps (0 to 5) instead of permanently assuming five",()=>{
 const settings={...defaults,damage:"Pet",gold:"Fairy"};
 const gain=n=>scoreAtLevel("HelperDmgQTE",12,{...settings,astralActivations:n});
 assert.equal(gain(0),0);
 assert.ok(gain(1)>0);
 assert.ok(Math.abs(gain(5)-5*gain(1))<1e-9);
});
test("Combat conditions survive optimization and out-of-range taps are rejected",()=>{
 for(const n of [-1,1.5,6])
  assert.throws(()=>optimizeBuild({...defaults,skillPoints:50,astralActivations:n}),/between 0 and 5/);
 const out=optimizeBuild({...defaults,skillPoints:50,damage:"Pet",gold:"Fairy",
  assumeSnapActive:true,assumeHaystActive:false,astralActivations:2});
 assert.deepEqual(out.combatAssumptions,{hayst:false,snap:true,
   coordinatedOffensive:false,flashZipAtBoss:false,
   nightmareAtBoss:false,magnumOpusAtBoss:false,
   astralActivations:0,astralMaxAvailable:5,
   idealBossAssumptionsOnly:false,actualBossUptimeVerified:false,
   contractsAtMax:false});
});

test("Max-ramped contracts require explicit peak activation at the boss",()=>{
 const s={...defaults,damage:"Pet",gold:"Fairy"};
 for(const id of ["ForbiddenContract","RoyalContract","TerrifyingPact"])
   assert.equal(scoreAtLevel(id,20,s),0,id+" must be inactive by default");
 assert.ok(scoreAtLevel("ForbiddenContract",20,{...s,assumeContractsAtMax:true})>0);
 assert.ok(scoreAtLevel("RoyalContract",20,{...s,assumeContractsAtMax:true})>0);
 assert.equal(scoreAtLevel("TerrifyingPact",20,{...s,assumeContractsAtMax:true}),0);
 assert.ok(scoreAtLevel("TerrifyingPact",20,{...s,assumeContractsAtMax:true,minimums:{ForbiddenContract:1,RoyalContract:1}})>0);
});
test("Explicit peak-contract scenario includes both required contracts",()=>{
 const r=optimizeBuild({...defaults,damage:"Pet",gold:"Fairy",skillPoints:400,qol:"none",assumeContractsAtMax:true});
 assert.ok(r.levels.ForbiddenContract>=1);
 assert.ok(r.levels.RoyalContract>=1);
 assert.equal(r.combatAssumptions.contractsAtMax,true);
 assert.ok(r.spent<=400);
 const conservative=optimizeBuild({...defaults,damage:"Pet",gold:"Fairy",skillPoints:400,qol:"none"});
 assert.equal(conservative.combatAssumptions.contractsAtMax,false);
});
test("Observed Pet/Fairy stage regression compares equally affordable trees",()=>{
 const {better,optimizer,observedStageDifference}=observedPetFairy;
 assert.equal(observedStageDifference,750);
 assert.equal(spentPoints(better),22640);
 assert.equal(spentPoints(optimizer),22642);
 const costIn=(levels,branch)=>SKILL_IDS.filter(id=>SKILLS[id].Branch===branch)
  .reduce((sum,id)=>sum+spentPoints({[id]:levels[id]||0}),0);
 assert.equal(costIn(better,"BranchYellow"),1650);
 assert.equal(costIn(optimizer,"BranchYellow"),1414);
 assert.equal(costIn(better,"BranchBlue"),2989);
 assert.equal(costIn(optimizer,"BranchBlue"),3728);
 const scenario={...defaults,damage:"Pet",gold:"Fairy",goldWeight:0.7,
  assumeHaystActive:false,assumeSnapActive:false,astralActivations:0,
  assumeContractsAtMax:false};
 const score=levels=>SKILL_IDS.reduce((sum,id)=>sum+scoreAtLevel(id,levels[id]||0,scenario),0);
 // Agreement in a proxy metric cannot validate the observed 750-stage gain.
 assert.ok(score(better)>score(optimizer));
});

test("Retired efficiency objective cannot discard the SP budget",()=>{
 const s={...defaults,damage:"Pet",gold:"Fairy",skillPoints:400,qol:"none"};
 const full=optimizeBuild({...s,mode:"power"}),legacy=optimizeBuild({...s,mode:"efficiency"});
 assert.deepEqual(legacy.levels,full.levels);
 assert.equal(legacy.spent,full.spent);
 assert.ok(full.spent>=350,`400 SP reduced to ${full.spent}`);
});
test("Legacy direct solver ratio mode is normalized to full-budget power",()=>{
 const skills=[{id:"root",branch:"A",parent:"None",spReq:0,min:0,max:3,costs:[0,1,2,3]}];
 const result=optimizeExact(skills,3,(_,level)=>[0,10,11,12][level],"efficiency");
 assert.equal(result.levels.root,3);
 assert.equal(result.score,12);
});


test("Real Pet/Fairy regression: unknown contracts remain at their already-invested levels",()=>{
 const {better}=observedPetFairy;
 const settings={...defaults,damage:"Pet",gold:"Fairy",skillPoints:22642,
  qol:"recommended",maxStage:300000,currentLevels:better,
  assumeContractsAtMax:false,assumeHaystActive:false,
  assumeSnapActive:false,astralActivations:0};
 const protectedBuild=optimizeBuild(settings);
 for(const id of ["ForbiddenContract","RoyalContract","TerrifyingPact",
                   "QuickFortune","PhilosophersFlux","HelperDmgQTE"]){
   assert.ok(protectedBuild.levels[id]>=better[id],
     id+" was removed even though its real activation is not modeled");
   assert.ok(protectedBuild.protectedSkills.includes(id));
 }
 assert.ok(protectedBuild.spent<=settings.skillPoints);
 // No Warlord limit is imposed: preserving the missing contract value alone
 // recovers its SP. The old model misplaced those SP elsewhere.
 const unsafe=optimizeBuild({...settings,protectUnmodeledSkills:false});
 assert.ok(unsafe.levels.ForbiddenContract<better.ForbiddenContract);
 // The unprotected optimizer is free to reallocate SP among any branches;
  // no particular Warlord direction is guaranteed by the score model.
  assert.ok(unsafe.spent<=settings.skillPoints);
 assert.deepEqual(unsafe.protectedSkills,[]);
});
test("Unknown conditional skills are only protected when already imported and unmodeled",()=>{
 const s={...defaults,damage:"Pet",gold:"Fairy",skillPoints:400,qol:"none",
  currentLevels:{ForbiddenContract:1,RoyalContract:1,QuickFortune:2,PhilosophersFlux:1}};
 const guarded=optimizeBuild(s);
 assert.ok(guarded.levels.ForbiddenContract>=1);
 assert.ok(guarded.levels.RoyalContract>=1);
 assert.ok(guarded.levels.QuickFortune>=2);
 assert.ok(guarded.levels.PhilosophersFlux>=1);
 const active=optimizeBuild({...s,assumeContractsAtMax:true,
  assumeHaystActive:true,assumeSnapActive:true});
 assert.ok(!active.protectedSkills.includes("ForbiddenContract"));
 assert.ok(!active.protectedSkills.includes("QuickFortune"));
 assert.ok(!active.protectedSkills.includes("PhilosophersFlux"));
 const noHistory=optimizeBuild({...defaults,damage:"Pet",gold:"Fairy",
  skillPoints:400,qol:"none"});
 assert.deepEqual(noHistory.protectedSkills,[]);
});

test("only exported completed sets enable equipment perks, not old stats or UI state",()=>{
 const parsed=parseExport(JSON.stringify({
  skillTree:{TapDmg:1},playerStats:{FB:true,tFA:true},
  equipmentSets:{DarkAngel:true,MultiCast:false,Valkyrie:{completed:false},Samurai:true}
 }));
 assert.equal(parsed.setOwnershipKnown,true);
 assert.equal(parsed.sets.tFA,true);
 assert.equal(parsed.sets.FB,false);
 assert.equal(parsed.sets.FF,false);
 assert.equal(parsed.profile.ownedSetIds.includes("Samurai"),true);
 assert.deepEqual(ownedSetFlags(parsed.profile),parsed.sets);
 const noCollection=parseExport(JSON.stringify({
  skillTree:{TapDmg:1},playerStats:{FB:true,tFA:true}
 }));
 assert.equal(noCollection.setOwnershipKnown,false);
 assert.equal(noCollection.sets.FB,false);
 assert.equal(noCollection.sets.tFA,false);
 assert.deepEqual(ownedSetFlags(null),ownedSetFlags(noCollection.profile));
});
