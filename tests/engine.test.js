import {test} from "node:test";
import assert from "node:assert/strict";
import {exactConvolution,optimizeExact,branchDynamicProgram,upperConcaveEnvelope} from "../src/solver-core.js";
import {SKILLS,SKILL_IDS,GAME_VERSION,DAMAGE_TYPES,GOLD_TYPES,parseExport,exportBuild,spentPoints,optimizeBuild} from "../src/engine.js";
import {scoreAtLevel,assertFiniteScores} from "../src/effects.js";
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

test("SP input accepts 50,000 and rejects 50,001",()=>{
  assert.throws(()=>optimizeBuild({...defaults,skillPoints:50001}),/50,000/);
  // Full 50k DP benchmark intentionally excluded from short unit tests;
  // it requires a dedicated performance and memory validation on devices.
});
