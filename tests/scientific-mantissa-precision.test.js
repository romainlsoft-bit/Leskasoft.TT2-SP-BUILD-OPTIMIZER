import {test} from "node:test";
import assert from "node:assert/strict";
import {positiveLog10,computeArtifactEffect,log10OnePlusPower}
 from "../src/account-artifacts.js";

const near=(a,b,tol=1e-12)=>Math.abs(a-b)<=tol*
 Math.max(1,Math.abs(a),Math.abs(b));
test("underflow-safe decimal mantissas never become a false zero",()=>{
 assert.ok(near(positiveLog10("0."+"0".repeat(500)+"1"),-501));
 assert.ok(near(positiveLog10("0."+"0".repeat(650)+"1e900"),249));
 assert.ok(near(positiveLog10("0."+"0".repeat(1000)+"25e1234"),
  1234-1002+Math.log10(25)));
 assert.ok(near(positiveLog10(".000001"),-6));
});
test("overflow-safe decimal mantissas preserve order without allocating 10^N",()=>{
 assert.ok(near(positiveLog10("1"+"0".repeat(900)),900));
 assert.ok(near(positiveLog10("5"+"0".repeat(800)+"e-780"),
  Math.log10(5)+20));
 assert.ok(near(positiveLog10("000123.45"),Math.log10(123.45)));
 assert.ok(near(positiveLog10("1e9999"),9999));
 assert.ok(near(positiveLog10("1e-9999"),-9999));
});
test("long mantissa remains valid in main-effect source calculation",()=>{
 const source={perLevel:"0."+"0".repeat(500)+"1",growthExpo:1,
  maxLevel:0,enchantedMagnitude:"1"};
 const effect=computeArtifactEffect(source,"1e1000",false);
 assert.equal(effect.status,"computed-main-effect");
 assert.ok(near(effect.log10,499));
 assert.ok(near(log10OnePlusPower(499),499));
});
test("nonnumeric, zero, negative and pathological scientific strings are rejected",()=>{
 for(const s of ["","0","0e9999","-1e9","1eInfinity","1e1e2",
  "Infinity","NaN","1,5", "1e99999999999999999","1".repeat(11000),
  null,undefined,{},true])
  assert.equal(positiveLog10(s),null,String(s).slice(0,30));
});
