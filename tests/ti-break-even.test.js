import test from "node:test";
import assert from "node:assert/strict";
import {coefficientBreakEven} from "../src/ti-break-even.js";

test("exact threshold and winner direction for either ordering",()=>{
 const a=coefficientBreakEven(-4,12);
 assert.equal(a.status,"crossing");
 assert.equal(a.crossingFraction,.25);
 assert.equal(a.aboveThreshold,"positive");
 assert.equal(a.belowThreshold,"negative");
 assert.equal(a.deltaAtHalfWeight,4);
 const b=coefficientBreakEven(4,-12);
 assert.equal(b.crossingFraction,.25);
 assert.equal(b.aboveThreshold,"negative");
 assert.equal(b.belowThreshold,"positive");
 assert.equal(b.changesAllocation,false);
});
test("stable or tied comparisons never invent a crossing",()=>{
 for(const [a,b,status] of [[2,5,"positive-nonnegative-throughout"],[-1,-5,"negative-nonpositive-throughout"],[0,0,"indistinguishable"],[0,3,"positive-nonnegative-throughout"],[-5,0,"negative-nonpositive-throughout"],[1e-12,-1e-12,"indistinguishable"]]){
  const e=coefficientBreakEven(a,b);
  assert.equal(e.status,status);
  assert.equal(e.crossingFraction,null);
  assert.equal(e.aboveThreshold,null);
 }
 assert.equal(coefficientBreakEven(2,5).positiveStrictlyThroughout,true);
 assert.equal(coefficientBreakEven(-2,-5).negativeStrictlyThroughout,true);
});
test("seeded interpolation of 1000 crossings reconstructs ties",()=>{
 let seed=81284;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let i=0;i<1000;i++){
  const sign=i%2?1:-1,a=sign*(.01+rand()*1000),b=-sign*(.01+rand()*1000);
  const x=coefficientBreakEven(a,b);
  const f=x.crossingFraction;
  assert.ok(f>0&&f<1);
  assert.ok(Math.abs((1-f)*a+f*b)<1e-10);
  assert.equal(x.aboveThreshold,b>0?"positive":"negative");
  assert.equal(x.minimumDelta,Math.min(a,b));
  assert.equal(x.maximumDelta,Math.max(a,b));
  assert.equal(x.intervalIsConfidenceInterval,false);
 }
});
test("finite extremes do not overflow the threshold",()=>{
 assert.equal(coefficientBreakEven(-1e308,1e308).crossingFraction,.5);
 for(const a of [NaN,Infinity,-Infinity,null,"1"])
  assert.throws(()=>coefficientBreakEven(a,1),/Finite Tactical Insight/);
});
