import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=source("src/app.js"),worker=source("src/worker.js");
test("review P2: configuration changes invalidate and terminate in-flight worker",()=>{
 assert.match(app,/function remember\(\)\{[\s\S]*?calculationRevision\+\+/);
 assert.match(app,/if\(worker\)\{worker\.terminate\(\);worker=null;resetOptimizeButton\(\);\}/);
 assert.match(app,/revision!==calculationRevision\|\|worker!==running/);
 assert.match(app,/const requestContext=structuredClone\(state\)/);
 assert.match(app,/lastRunContext=requestContext/);
 assert.match(app,/const scenario=lastRunContext\?\?state/);
});
test("review P2: selected real gear and pet pair render ahead of alternatives",()=>{
 assert.match(app,/lastGearSelection=data\.gearSelection\?\?null/);
 assert.match(app,/lastResolvedPets=data\.selectedPets\?\?null/);
 assert.match(app,/lastGearSelection=selected\.gearSelection\?\?null/);
 assert.match(app,/Selected optimized equipment/);
 assert.match(app,/Equipment alternatives/);
 assert.match(app,/const selected=lastGearSelection\?\.selected\|\|\{\}/);
});
test("review P2: explicit pet IDs fix their respective slot in the worker",()=>{
 assert.match(worker,/const damage=explicitFor\(settings\.selectedDamagePet,"damage",plan\.damage\)/);
 assert.match(worker,/const gold=explicitFor\(settings\.selectedGoldPet,"gold",plan\.gold\)/);
 assert.match(worker,/Selected .* pet is not owned or incompatible/);
});
test("review SEO: four visible crawlable language links in four calculator pages",()=>{
 const pages=["index.html","fr/index.html","uk/index.html","ru/index.html"];
 for(const path of pages){
  const html=source(path);
  assert.match(html,/<nav class="language-links" aria-label="Languages">/);
  for(const [lang,url] of [["en","/"],["fr","/fr/"],["uk","/uk/"],["ru","/ru/"]]){
   assert.ok(html.includes('href="'+url+'" hreflang="'+lang+'"'),path+" "+lang);
  }
  assert.match(html,/aria-current="page"/);
 }
 assert.match(app,/const desired=SUPPORTED_LANGUAGES\.includes\(queryLang\)\?queryLang:pathLang/);
});
test("review SEO: guides cover import and distinct Pet/Fairy and Clan Ship use cases",()=>{
 const pages=[
  "skill-tree-optimizer/index.html",
  "fr/optimiseur-arbre-de-competences/index.html",
  "uk/skill-tree-optimizer/index.html",
  "ru/skill-tree-optimizer/index.html"
 ];
 for(const path of pages){
  const html=source(path);
  for(const phrase of ["Pet/Fairy","Clan Ship/Fairy","Skill Tree → Saves → Import"])
   assert.ok(html.includes(phrase),path+" "+phrase);
  assert.ok(html.includes("dateModified"),path);
 }
});
