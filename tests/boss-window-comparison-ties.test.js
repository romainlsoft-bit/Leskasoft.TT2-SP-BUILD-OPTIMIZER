import test from "node:test";
import assert from "node:assert/strict";
import {compareMeasuredBossWindows} from "../src/boss-combat-window.js";

const candidate=(id,second,damage="1e100")=>({
 id,
 settings:{damage:"Pet",gold:"Fairy",maxStage:1000},
 levels:{PetDmg:1},
 scenario:{enabled:true,windowSeconds:30,stage:1000,
  events:[{channelId:"pet-attack",second,damage}]}
});

test("equally fast robust boss kills remain tied regardless of input order",()=>{
 for(const contenders of [
  [candidate("alpha",4),candidate("beta",4)],
  [candidate("beta",4),candidate("alpha",4)]
 ]){
  const output=compareMeasuredBossWindows(contenders);
  assert.equal(output.status,"compared-independent-events");
  assert.equal(output.fastestRobustObservedId,null);
  assert.equal(output.fastestRobustObservedSecond,4);
  assert.equal(output.tiedFastestRobustObservation,true);
  assert.deepEqual(new Set(output.fastestRobustObservedIds),
   new Set(["alpha","beta"]));
  assert.equal(output.stageGainPredicted,false);
 }
});

test("the fastest observed robust kill is unique only with a strictly earlier second",()=>{
 const output=compareMeasuredBossWindows([
  candidate("slow",7),candidate("fast",3),candidate("slower",12)
 ]);
 assert.equal(output.fastestRobustObservedId,"fast");
 assert.deepEqual(output.fastestRobustObservedIds,["fast"]);
 assert.equal(output.fastestRobustObservedSecond,3);
 assert.equal(output.tiedFastestRobustObservation,false);
});

test("no robust kill does not produce a winner or a timing",()=>{
 const output=compareMeasuredBossWindows([
  candidate("weakA",3,"1e1"),candidate("weakB",5,"1e1")
 ]);
 assert.equal(output.status,"compared-independent-events");
 assert.equal(output.fastestRobustObservedId,null);
 assert.deepEqual(output.fastestRobustObservedIds,[]);
 assert.equal(output.fastestRobustObservedSecond,null);
 assert.equal(output.tiedFastestRobustObservation,false);
});

test("duplicate or ambiguous candidate identifiers cannot masquerade as independent measures",()=>{
 assert.throws(()=>compareMeasuredBossWindows([
  candidate("same",1),candidate("same",2)
 ]),/unique ID/);
 assert.throws(()=>compareMeasuredBossWindows([
  candidate(1,1),candidate("1",2)
 ]),/unique ID/);
 assert.throws(()=>compareMeasuredBossWindows([
  candidate(" ",1),candidate("valid",2)
 ]),/unique ID/);
});
