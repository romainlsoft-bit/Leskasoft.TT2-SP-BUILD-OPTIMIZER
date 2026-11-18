import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const locales=["index.html","fr/index.html","uk/index.html","ru/index.html"];

test("all static locales expose the same conditional-skill safety control",()=>{
 for(const file of locales){
  const html=read(file);
  assert.match(html,/id="protect-unmodeled-skills" checked/);
  assert.match(html,/src\/app\.js\?v=20\d{6}-[a-z0-9-]+/);
  assert.ok(!html.includes("20261117-conditional-guard"));
  assert.match(html,/styles\.css\?v=20261117-locale-layout/);
  assert.match(html,/id="preserve-current"/);
 }
});
test("language-safe layouts wrap text and let form controls fill grid columns",()=>{
 const css=read("styles.css");
 assert.match(css,/\.field-grid input,\.field-grid select,\.field-grid textarea/);
 assert.match(css,/\.playstyle strong,\.playstyle small/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/\.choice-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.result-detail \.table-wrapper\{max-width:100%;overflow-x:auto\}/);
});
test("share links persist the safety preference without importing private profile fields",()=>{
 const app=read("src/app.js");
 assert.match(app,/protect:state\.protectUnmodeledSkills!==false/);
 assert.match(app,/protectUnmodeledSkills:payload\.protect!==false/);
 assert.match(app,/protectUnmodeledSkills:true/);
 assert.doesNotMatch(app,/sharePayload\(\)[\s\S]*?return \{[^}]*accountProfile:/);
});
