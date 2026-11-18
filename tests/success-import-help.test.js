import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {t} from "../src/i18n.js";

const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=src("src/app.js");
const css=src("styles.css");
const pages=["index.html","fr/index.html","uk/index.html","ru/index.html"];

test("every successful action shows the positive toast and errors remain visible",()=>{
 assert.match(app,/else if\(type==="success"\)showToast\(display,"success"\)/);
 assert.match(app,/if\(type==="error"\)showToast\(display\)/);
 assert.match(app,/toast\.dataset\.kind=type/);
 assert.match(app,/success\?"status":"alert"/);
 assert.match(app,/success\?"polite":"assertive"/);
 assert.match(app,/setTimeout\(\(\)=>\{toastDismissTimer=null;toast\.hidden=true;\},6000\)/);
 assert.match(css,/\.app-toast\[data-kind="success"\]/);
});
test("copy failures are not reported as success",()=>{
 assert.match(app,/copied\?"success":"error"/g);
 assert.match(app,/const copied=await copyText\(exportBuild\(lastResult\.levels\)\)/);
 assert.match(app,/const copied=await copyText\(link\)/);
});
test("result import help and Leskasoft link are present in all localized HTML",()=>{
 for(const p of pages){
  const html=src(p);
  assert.ok(html.includes('id="import-help-button"'),p);
  assert.ok(html.includes('id="import-help-dialog"'),p);
  assert.ok(html.includes('id="import-help-close"'),p);
  assert.ok(html.includes('id="import-help-done"'),p);
  assert.ok(html.includes('aria-controls="import-help-dialog"'),p);
  assert.ok(html.includes("Saves"),p);
  assert.ok(html.includes("Import"),p);
  assert.ok(html.includes("Load to Tree"),p);
  const lang=p==="index.html"?"en":p.split("/")[0];
  assert.ok(html.includes('href="https://www.leskasoft.fr/'+lang+'"'),p);
 }
 assert.match(app,/importHelp\.showModal\(\)/);
 assert.match(app,/import-help-close","import-help-done/);
});
test("success notification title is localized in all supported languages",()=>{
 for(const lang of ["fr","uk","ru"])assert.notEqual(t("Success",lang),"Success",lang);
 assert.equal(t("Success","en"),"Success");
});

test("Leskasoft link preserves the chosen locale in all four static pages",()=>{
 for(const [lang,path] of Object.entries({
  en:"index.html",fr:"fr/index.html",uk:"uk/index.html",ru:"ru/index.html"
 })){
  const html=src(path);
  assert.ok(html.includes('id="leskasoft-link" href="https://www.leskasoft.fr/'+lang+'"'),lang);
 }
 assert.ok(app.includes('leskasoft.href="https://www.leskasoft.fr/"+locale'));
});

test("Conditional boss-push parameters appear in every localized page",()=>{
 for(const lang of ["en","fr","uk","ru"]){
  const path=lang==="en"?"index.html":lang+"/index.html";
  const html=src(path);
  for(const id of ["hayst-active","snap-active","astral-activations","combat-assumptions-summary"])
    assert.ok(html.includes('id="'+id+'"'),lang+": "+id);
 }
 assert.ok(app.includes("state.assumeHaystActive"));
 assert.ok(app.includes("state.astralActivations"));
});
