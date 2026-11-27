import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const version=(source,file)=>{
 const matches=[...source.matchAll(new RegExp(
  file.replace(".","\\.")+"\\?v=([a-zA-Z0-9-]+)","g"))];
 assert.ok(matches.length>0,"Expected versioned "+file);
 const values=new Set(matches.map(m=>m[1]));
 assert.equal(values.size,1,"Mixed version identifiers for "+file);
 return matches[0][1];
};
test("all four locale pages load the same fresh application build",()=>{
 const pages=["index.html","fr/index.html","uk/index.html","ru/index.html"];
 const tokens=pages.map(page=>version(src(page),"app.js"));
 assert.equal(new Set(tokens).size,1);
 assert.match(tokens[0],/^20\d{6}-[A-Za-z0-9_-]+$/);
});
test("updated engine, imports, gemstone conversion and worker share one release token",()=>{
 const app=src("src/app.js"),engine=src("src/engine.js"),
  worker=src("src/worker.js"),power=src("src/account-power.js"),
  gear=src("src/equipment-scenarios.js");
 const expected=version(src("index.html"),"app.js");
 for(const [from,source,modules] of [
  ["app",app,["engine.js","i18n.js","account-profile.js",
   "account-gemstones.js","account-power.js","worker.js","pet-scenarios.js","equipment-scenarios.js"]],
  ["worker",worker,["engine.js","equipment-scenarios.js","pet-scenarios.js","calculation-ledger.js","final-candidate-decision.js"]],
  ["engine",engine,["account-profile.js","optimization-account-baseline.js",
   "mana-evidence.js","contract-scenarios.js","effects.js","account-source-coverage.js"]],
  ["account-baseline",src("src/optimization-account-baseline.js"),["account-power.js","account-dependencies.js","skill-tree-set-effects.js"]],
  ["account-power",power,["account-gemstones.js","account-monuments.js","pet-scenarios.js"]],
  ["gear",gear,["account-power.js","account-gemstones.js","pet-scenarios.js"]],
  ["dependencies",src("src/account-dependencies.js"),["account-monuments.js","account-gemstones.js","account-temporal.js"]],
  ["monuments",src("src/account-monuments.js"),["account-temporal.js"]],
  ["coverage",src("src/account-source-coverage.js"),["account-temporal.js"]],
  ["pets",src("src/pet-scenarios.js"),["account-temporal.js"]],
  ["ledger",src("src/calculation-ledger.js"),["pet-scenarios.js"]],
  ["effects",src("src/effects.js"),["pet-scenarios.js"]]
 ]){
  for(const imported of modules)assert.equal(version(source,imported),expected,
   from+" -> "+imported+" may load an outdated cached module");
 }
});
