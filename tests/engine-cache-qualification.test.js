import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const REV="20261120-log-native-r4";
test("localized pages load the same version of the optimized module",()=>{
 for(const path of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  assert.ok(src(path).includes("src/app.js?v="+REV),path);
 }
});
test("UI and Web Worker cannot silently keep stale engine or ledger",()=>{
 const app=src("src/app.js"),worker=src("src/worker.js"),
  engine=src("src/engine.js");
 assert.ok(app.includes('engine.js?v='+REV));
 assert.ok(app.includes('worker.js?v='+REV));
 assert.ok(worker.includes('engine.js?v='+REV));
 assert.ok(worker.includes('calculation-ledger.js?v='+REV));
 assert.ok(engine.includes('effects.js?v='+REV));
 assert.ok(engine.includes('contract-scenarios.js?v='+REV));
 assert.ok(!app.includes("engine.js?v=20261118-work-review-r1"));
 assert.ok(!worker.includes("calculation-ledger.js?v=20261118-work-review-r1"));
});
