import test from "node:test";
import assert from "node:assert/strict";
import {proposeContractScenarioBuild} from "../src/contract-multi-scenarios.js";

const timeline={enabled:true,startingMana:1000,manaCapacity:1000,
 passiveRegenPerSecond:0,durationSeconds:5,
 freeTicks:{ForbiddenContract:0,RoyalContract:0}};
test("invalid optimistic seed cannot crash a feasible base optimizer result",()=>{
 const settings={goldWeight:.7,contractTimeline:timeline,
  contractMultiScenario:{enabled:true,activeFraction:1,
   pactAtMaxDuringFundedTicks:true}};
 const base={levels:{ForbiddenContract:0,RoyalContract:0,TerrifyingPact:0}};
 for(const broken of [null,undefined,{}, {levels:null},{levels:[]} ]){
  const candidate=proposeContractScenarioBuild({settings,baseline:base,
   solve:()=>broken,score:()=>100});
  assert.equal(candidate.result,base);
  assert.equal(candidate.selection.status,"only-conservative-feasible");
  assert.equal(candidate.selection.reason,"invalid-optimistic-contract-seed");
  assert.equal(candidate.selection.appliedToRecommendation,false);
 }
});
