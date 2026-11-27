import test from "node:test";
import assert from "node:assert/strict";
import {factorizedGearSearch} from "../src/factorized-gear-search.js";
const slots=["Armor","Sword","Helmet","Slash","Aura"];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} vs ${b}`);
const target=aura=>aura?.target??null;
const score=(item,gear)=>item?item.base+(item.target?item.factor*(gear[item.target]?.weight??0):0):0;

function brute(options){
 let best=null,visited=0;
 function visit(index,gear){
  if(index===slots.length){
   const value=slots.reduce((sum,slot)=>sum+score(gear[slot],gear),0);
   visited++;
   if(!best||value>best.score)best={selected:{...gear},score:value};
   return;
  }
  for(const item of options[slots[index]])visit(index+1,{...gear,[slots[index]]:item});
 }
 visit(0,{});
 return {...best,visited};
}
test("factorized search agrees with full Cartesian reference including ties and missing slots",()=>{
 let seed=8129;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let trial=0;trial<120;trial++){
  const options=Object.fromEntries(slots.map(slot=>[slot,Array.from({length:1+rand(4)},(_,index)=>({
   id:slot+index,base:rand(20),weight:rand(4),
   ...(slot==="Aura"?{target:[null,"Sword","Helmet","Slash"][rand(4)],factor:rand(10)}:{})
  }))]));
  if(trial%5===0)options.Sword=[null];
  if(trial%7===0)options.Aura=[null];
  const expected=brute(options),actual=factorizedGearSearch(options,score,target);
  near(actual.score,expected.score);
  assert.deepEqual(actual.selected,expected.selected);
  assert.ok(actual.examinedConfigurations<=expected.visited);
 }
});
test("fourth-ranked standalone item wins through its aura dependency",()=>{
 const options={Armor:[null],Helmet:[null],Slash:[null],
  Sword:[{id:"s1",base:10,weight:0},{id:"s2",base:9,weight:0},
   {id:"s3",base:8,weight:0},{id:"s4",base:7,weight:1}],
  Aura:[{id:"a",base:0,target:"Sword",factor:20}]};
 const result=factorizedGearSearch(options,score,target);
 assert.equal(result.selected.Sword.id,"s4");
 assert.equal(result.score,27);
});
test("500 owned items need only 10400 slot evaluations for ten billion combinations",()=>{
 const options=Object.fromEntries(slots.map(slot=>[slot,Array.from({length:100},(_,i)=>({
  id:slot+i,base:i,weight:i,
  ...(slot==="Aura"?{target:"Sword",factor:1}:{})
 }))]));
 const result=factorizedGearSearch(options,score,target);
 assert.equal(result.examinedConfigurations,10000);
 assert.equal(result.slotEvaluations,10400);
 assert.equal(result.score,594);
 assert.equal(result.selected.Sword.id,"Sword99");
});
