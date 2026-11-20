import test from "node:test";
import assert from "node:assert/strict";
import {rerankVisitedContractPetPairs as rerank} from "../src/contract-pet-rerank.js";
const timeline={enabled:true,startingMana:1000,manaCapacity:1000,
 passiveRegenPerSecond:0,durationSeconds:5,
 freeTicks:{ForbiddenContract:0,RoyalContract:0}};
const opts={goldWeight:.7,contractTimeline:timeline,
 contractMultiScenario:{enabled:true,activeFraction:1,pactAtMaxDuringFundedTicks:true}};
const make=(d,g,baseScore,fc=0)=>({
 damagePet:d,goldPet:g,adjustedScore:baseScore,
 result:{levels:{ForbiddenContract:fc,RoyalContract:fc,TerrifyingPact:fc}},
 gearSelection:{selected:{}},context:opts
});
test("a nonwinner under the conservative proxy may win the declared contract scenario",()=>{
 const base=make("Pet1","Pet6",100,0);
 const contract=make("Pet2","Pet6",60,15);
 const decisions=[];
 const result=rerank([base,contract],opts,{original:base,
  resolve:choice=>{decisions.push(choice);return {...choice.result,
   contractMultiScenario:{status:"ranked",appliedToRecommendation:false,
    winnerId:"conservative",rows:[{id:"conservative",
     scenarioWeightedLog10:choice===base?100:200}]}};}});
 assert.equal(result.status,"ranked-visited-shortlist");
 assert.equal(result.selected,contract);
 assert.equal(result.selectedResult.contractMultiScenario.status,"ranked");
 assert.equal(result.visitedPairs,2);
 assert.equal(result.shortlistedPairs,2);
 assert.equal(result.originalPairRetained,false);
 assert.equal(result.originalPetSearchBoundsNotApplicable,true);
 assert.equal(result.scenarioRankingCertified,false);
 assert.equal(result.globallyOptimal,false);
 assert.equal(decisions.length,2);
});
test("bounded shortlist always contains original pair and no more than three expensive reoptimizations",()=>{
 const choices=[
  make("A","0",100,0),
  make("B","0",99,15),
  make("C","0",98,15),
  make("D","0",97,15),
  make("E","0",96,15)
 ];
 const resolved=[];
 const x=rerank(choices,opts,{original:choices[0],maxRefinements:3,
  resolve:choice=>{resolved.push(choice);return {...choice.result,
   contractMultiScenario:{status:"unresolved"}};}});
 assert.equal(x.visitedPairs,5);
 assert.equal(x.shortlistedPairs,3);
 assert.ok(resolved.includes(choices[0]));
 assert.equal(x.compared.length,3);
 assert.equal(x.unexploredAlternativesRemain,true);
});
test("invalid input and missing fraction never become a falsely measured probability",()=>{
 const original=make("A","B",20,0);
 const scenarios=[
  {...opts,contractMultiScenario:{enabled:true,activeFraction:""}},
  {...opts,contractTimeline:null},
  {...opts,assumeContractsAtMax:true}
 ];
 for(const settings of scenarios){
  const x=rerank([original],settings,{original,
   resolve:()=>{throw Error("invalid scenario must not trigger extra work")}});
  assert.equal(x.status,"unresolved");
  assert.equal(x.globallyOptimal,false);
 }
 assert.equal(rerank([original],{},{}).status,"not-requested");
});
test("duplicate pet pairs are evaluated once, tied scores compare deterministically",()=>{
 const a=make("A","B",20,0),b=make("B","A",20,0);
 const calls=[];
 const x=rerank([b,a,a,b],opts,{original:a,resolve:choice=>{
  calls.push(choice);return {...choice.result,contractMultiScenario:{status:"unresolved"}};
 }});
 assert.equal(x.visitedPairs,2);
 assert.equal(calls.length,2);
 assert.equal(x.originalPairRetained,true);
 assert.equal(x.selected,a);
});
test("a failing alternative leaves the base scenario feasible and does not invent a winning candidate",()=>{
 const a=make("A","B",20,0),b=make("C","D",19,15);
 const x=rerank([a,b],opts,{original:a,resolve:choice=>{
  if(choice===b)throw new Error("SP minimum not feasible");
  return {...choice.result,contractMultiScenario:{status:"unresolved"}};
 }});
 assert.equal(x.status,"ranked-visited-shortlist");
 assert.equal(x.compared.find(c=>c.damagePet==="C").refinementStatus,
  "only-conservative-feasible");
 assert.equal(x.scenarioRankingCertified,false);
});
