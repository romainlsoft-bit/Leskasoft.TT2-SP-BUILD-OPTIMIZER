import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const pages=["index.html","fr/index.html","uk/index.html","ru/index.html"];
test("the public form has no contract speculation or mana-timeline controls",()=>{
 for(const p of pages){
  const html=read(p);
  for(const id of ["contracts-at-max","timeline-enabled","timeline-starting-mana",
    "timeline-mana-capacity","timeline-passive-regen","timeline-duration",
    "timeline-free-forbidden","timeline-free-royal",
    "scenario-enabled","scenario-active-fraction","scenario-pact-max"])
   assert.doesNotMatch(html,new RegExp('id="'+id+'"'),p+" "+id);
  assert.match(html,/id="protect-unmodeled-skills"/);
  assert.doesNotMatch(html,/id="astral-activations"/);
 }
});
test("old saved preferences and links cannot silently enable contract what-ifs",()=>{
 const app=read("src/app.js");
 assert.match(app,/function keepContractsConservative\(options\)/);
 assert.match(app,/options\.assumeContractsAtMax=false/);
 assert.match(app,/options\.contractTimeline=null/);
 assert.match(app,/options\.contractMultiScenario=null/);
 assert.match(app,/const requestContext=publicOptimizationSettings\(keepContractsConservative\(structuredClone\(state\)\)\)/);
 assert.match(app,/keepContractsConservative\(state\)/);
 assert.doesNotMatch(app,/contracts:state\.assumeContractsAtMax/);
 assert.doesNotMatch(app,/assumeContractsAtMax:payload\.contracts===true/);
 for(const id of ["contracts-at-max","timeline-enabled","scenario-enabled"])
  assert.doesNotMatch(app,new RegExp('\\$\\("'+id+'"\\)'));
});
test("public UI and all locales use the same refreshed release token",()=>{
 const entry=read("index.html").match(/src\/app\.js\?v=([A-Za-z0-9_-]+)/);
 assert.ok(entry,"Missing versioned application entry");
 const token=entry[1];
 for(const p of pages)assert.ok(read(p).includes("app.js?v="+token),p);
 assert.ok(read("src/app.js").includes("worker.js?v="+token));
});
