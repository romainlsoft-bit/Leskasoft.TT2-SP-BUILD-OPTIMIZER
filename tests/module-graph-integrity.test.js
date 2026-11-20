import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
test("browser module graph is version-coherent and locally syntax-valid",()=>{
 const script=new URL("../scripts/verify-module-graph.mjs",import.meta.url);
 const run=spawnSync(process.execPath,[fileURLToPath(script)],{
  encoding:"utf8",timeout:120000,windowsHide:true
 });
 assert.equal(run.status,0,run.stderr||run.error?.message||run.stdout);
 assert.match(run.stdout,/ESM graph OK:/);
});
