import {test} from "node:test";
import assert from "node:assert/strict";
import {contractNativeTickSchedule as trace} from "../src/contract-native-ticks.js";

test("native 1Hz contract ramp is exponential, not linear interpolation",()=>{
 const x=trace({maximum:"1e120",baseManaCost:.5,timeUntilMax:10,
  freeTicks:0,tickSamples:[0,1,5,10,30]});
 assert.equal(x.status,"source-only-illustration");
 assert.deepEqual(x.samples.map(s=>s.bonusLog10),[0,12,60,120,120]);
 assert.deepEqual(x.samples.map(s=>s.manaSpentIfNoFreeTicks),
  [0,.5,7.5,27.5,232.5]);
 assert.equal(x.addedToSkillScore,false);
 assert.equal(x.actualUptimeVerified,false);
});
test("free ticks advance ramp without charging mana",()=>{
 const x=trace({maximum:"1e30",baseManaCost:2,timeUntilMax:5,
  freeTicks:3,tickSamples:[1,3,4,5]});
 assert.deepEqual(x.samples.map(s=>s.bonusLog10),[6,18,24,30]);
 assert.deepEqual(x.samples.map(s=>s.manaSpentIfKnownFreeTicks),[0,0,2,6]);
 assert.deepEqual(x.samples.map(s=>s.chargedTicksIfKnownFreeTicks),[0,0,1,2]);
});
test("no exported free-tick evidence remains explicitly unknown",()=>{
 const x=trace({maximum:"10",baseManaCost:2,timeUntilMax:1,
  tickSamples:[1,5]});
 assert.equal(x.freeTicksKnown,false);
 assert.deepEqual(x.samples.map(s=>s.manaSpentIfKnownFreeTicks),[null,null]);
 assert.deepEqual(x.samples.map(s=>s.manaSpentIfNoFreeTicks),[2,30]);
 assert.deepEqual(x.samples.map(s=>s.bonusLog10),[1,1]);
});
test("1e9999 bonus and invalid inputs never overflow into fabricated score",()=>{
 const huge=trace({maximum:"1e9999",baseManaCost:.25,
  timeUntilMax:100,tickSamples:[1,50,100]});
 assert.equal(huge.sourceMaxMultiplierLog10,9999);
 assert.ok(huge.samples.every(s=>Number.isFinite(s.bonusLog10)));
 for(const invalid of [
  {maximum:0,baseManaCost:1,timeUntilMax:5},
  {maximum:1,baseManaCost:-1,timeUntilMax:5},
  {maximum:10,baseManaCost:1,timeUntilMax:0},
  {maximum:10,baseManaCost:1,timeUntilMax:2,freeTicks:1.2}
 ])assert.equal(trace(invalid).status,"unresolved-native-tick-input");
});
