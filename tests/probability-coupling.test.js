import test from "node:test";
import assert from "node:assert/strict";
import {probabilityCouplingSkillScore,probabilityCouplingEvidence} from "../src/probability-coupling.js";
import {skillInfo} from "../vendor/skills.js";
const cfg={damage:"Pet",gold:"Chesterson",goldWeight:.7,assumeHaystActive:true};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+" vs "+b);
const row=skillInfo.MultiMonsters;
const direct=(p,m)=>Math.log10(1-p+p*m);
test("Love Potion uses the guaranteed Ambush floor, not the imported tree or guessed chance",()=>{
 const s={...cfg,minimums:{MultiMonsters:10},currentLevels:{MultiMonsters:50}};
 for(let n=0;n<=9;n++){
  const m=Number(row.A10),p=.01+Number(skillInfo.LovePotion["B"+n]);
  near(probabilityCouplingSkillScore("LovePotion",n,s),.7*(direct(p,m)-direct(.01,m)));
 }
 assert.equal(probabilityCouplingSkillScore("LovePotion",9,{...s,minimums:{}}),0);
 assert.equal(probabilityCouplingSkillScore("LovePotion",9,{...s,gold:"Fairy"}),0);
});
test("Loaded Dice increases eligible source event chances only during Hayst",()=>{
 const floors={HeavyStrikes:20,Transmutation:20,MultiMonsters:20,LovePotion:9};
 const s={...cfg,minimums:floors};
 const e=probabilityCouplingEvidence({...floors,LoadedDice:30},s);
 near(e.haystFactor,1.085);
 near(e.rows.find(r=>r.id==="MultiMonsters").probabilityWithHayst,.21*1.085);
 near(e.creditedIncrementLog10,e.sourceOnlyJointIncrementLog10);
 near(e.residualUnscoredLog10,0);
 assert.ok(e.loadedDice.creditedIncrementLog10>0);
 assert.equal(probabilityCouplingSkillScore("LoadedDice",30,{...s,assumeHaystActive:false}),0);
 const hs=probabilityCouplingEvidence({...floors,LoadedDice:30},{...s,damage:"Heavenly Strike"});
 assert.equal(hs.rows.find(r=>r.id==="HeavyStrikes").probabilityWithHayst,1);
 assert.ok(hs.loadedDice.creditedIncrementLog10<e.loadedDice.creditedIncrementLog10);
 assert.equal(e.accountProcRatesVerified,false);
});
test("floor-anchored score never exceeds complete source-only coupling on seeded feasible trees",()=>{
 const max={HeavyStrikes:50,Transmutation:60,MultiMonsters:50,LovePotion:9,LoadedDice:30};
 let seed=81284;
 const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let trial=0;trial<1000;trial++){
  const levels=Object.fromEntries(Object.entries(max).map(([id,m])=>[id,rand(m+1)]));
  const minimums=Object.fromEntries(Object.entries(levels).map(([id,n])=>[id,rand(n+1)]));
  const settings={...cfg,minimums,damage:trial%2?"Pet":"Heavenly Strike",
   gold:["Fairy","HoG","Chesterson"][trial%3],assumeHaystActive:trial%5!==0};
  const e=probabilityCouplingEvidence(levels,settings);
  assert.ok(e.creditedIncrementLog10<=e.sourceOnlyJointIncrementLog10+1e-8);
  near(e.creditedIncrementLog10+e.residualUnscoredLog10,e.sourceOnlyJointIncrementLog10);
  assert.equal(e.residualAddedToScore,false);
 }
});
test("maximum source-only coupling remains finite and small for Hayst",()=>{
 const levels={HeavyStrikes:50,Transmutation:60,MultiMonsters:50,LovePotion:9,LoadedDice:30};
 const e=probabilityCouplingEvidence(levels,{...cfg,minimums:levels});
 assert.ok(e.loadedDice.jointIncrementLog10<=2.4*Math.log10(1.085)+1e-8);
 assert.ok(e.lovePotion.jointIncrementLog10>0.9);
});
