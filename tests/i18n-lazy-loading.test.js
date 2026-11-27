import test from "node:test";
import assert from "node:assert/strict";
import {loadLocale,t,translations} from "../src/i18n.js";

test("English requires no catalog and each locale is loaded on demand, once",async()=>{
 assert.deepEqual(Object.keys(translations),[]);
 assert.equal(await loadLocale("en"),"en");
 assert.equal(await loadLocale("xx"),"en");
 assert.deepEqual(Object.keys(translations),[]);
 assert.equal(t("Skill Points","en"),"Skill Points");
 assert.equal(t("constructor","en"),"constructor");
 const [first,second]=await Promise.all([loadLocale("fr"),loadLocale("fr")]);
 assert.equal(first,"fr");
 assert.equal(second,"fr");
 assert.deepEqual(Object.keys(translations),["fr"]);
 const french=translations.fr;
 assert.equal(Object.keys(french).length,455);
 assert.equal(Object.isFrozen(french),true);
 assert.notEqual(t("Skill Points","fr"),"Skill Points");
 assert.equal(await loadLocale("fr"),"fr");
 assert.equal(translations.fr,french);
 assert.equal(t("Skill Points","uk"),"Skill Points");
 await loadLocale("uk");
 assert.deepEqual(Object.keys(translations),["fr","uk"]);
 assert.equal(Object.keys(translations.uk).length,456);
 await loadLocale("ru");
 assert.equal(Object.keys(translations.ru).length,455);
 for(const lang of ["fr","uk","ru"]){
  const key="{phase}: {completed}/{total} complete. You can cancel at any time.";
  const rendered=t(key,lang,{phase:"TEST",completed:3,total:6});
  assert.ok(rendered.includes("TEST"));
  assert.ok(rendered.includes("3/6"));
  assert.equal(t("constructor",lang),"constructor");
 }
});
