import test from "node:test";
import assert from "node:assert/strict";
import {log10OnePlusPower,computeArtifactEffect}
 from "../src/account-artifacts.js";

const near=(a,b,rel=1e-12)=>Math.abs(a-b)<=
 rel*Math.max(Math.abs(a),Math.abs(b),Number.MIN_VALUE);
test("tiny positive artifact effects use log1p and avoid cancellation",()=>{
 for(const exponent of [-3,-6,-9,-12,-14,-16,-20,-100,-300]){
  const actual=log10OnePlusPower(exponent);
  const expected=Math.log1p(Math.pow(10,exponent))/Math.LN10;
  assert.ok(near(actual,expected),exponent+": "+actual+" vs "+expected);
  assert.ok(actual>0,exponent+": small bonuses must not be lost");
 }
 assert.equal(log10OnePlusPower(-500),0);
 assert.equal(log10OnePlusPower(Infinity),null);
 assert.equal(log10OnePlusPower(-Infinity),null);
});
test("giant scientific levels remain representable without exponent overflow",()=>{
 for(const exponent of [0,10,16,17,308,9999]){
  const actual=log10OnePlusPower(exponent);
  const expected=exponent>16?exponent+
   Math.log1p(Math.pow(10,-exponent))/Math.LN10:
   Math.log1p(Math.pow(10,exponent))/Math.LN10;
  assert.ok(near(actual,expected),exponent+": "+actual);
  assert.ok(Number.isFinite(actual));
 }
 const source={perLevel:"1e-12",growthExpo:0,maxLevel:0,
  enchantedMagnitude:"1"};
 const effect=computeArtifactEffect(source,"1",false);
 assert.equal(effect.status,"computed-main-effect");
 assert.ok(near(effect.log10,Math.log1p(1e-12)/Math.LN10));
});
