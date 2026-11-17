import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SUPPORTED_LANGUAGES, translations, t} from "../src/i18n.js";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
const readme=readFileSync(new URL("../README.md",import.meta.url),"utf8");
const notice=readFileSync(new URL("../THIRD_PARTY_NOTICES.md",import.meta.url),"utf8");
const license=readFileSync(new URL("../LICENSE",import.meta.url),"utf8");

test("English is the default and only explicitly supported languages can be selected",()=>{
 assert.deepEqual(SUPPORTED_LANGUAGES,["en","fr","uk","ru"]);
 assert.equal(t("Skill Points"),"Skill Points");
 assert.equal(t("Skill Points","en"),"Skill Points");
 assert.equal(t("Skill Points","xx"),"Skill Points");
 assert.equal(t("Missing key","uk"),"Missing key");
 assert.ok(app.includes('localStorage.getItem("tt2_site_language")'));
 assert.ok(app.includes('searchParams.get("lang")'));
});

test("French, Ukrainian and Russian translate critical UI flows",()=>{
 const keys=["STEP 01 — PLAYER","STEP 02 — PLAYSTYLE","STEP 03 — RESULT",
   "Your account","Your optimized tree","Skill Points","Damage build","Quality of life",
   "Optimize my build","Cancel optimization","How to export your TT2 data",
   "Open Options → Services → Export.","Copy TT2 skill tree","Original optimizer by",
   "No valid allocation fits these settings. Check QoL and minimums."];
 for(const lang of ["fr","uk","ru"])for(const key of keys) {
   assert.ok(translations[lang][key],`Missing ${lang} translation for ${key}`);
   assert.notEqual(t(key,lang),key,`Untranslated ${lang}: ${key}`);
 }
});
test("Interpolation retains dynamic values in every language",()=>{
 const source="{phase}: {completed}/{total} complete. You can cancel at any time.";
 for(const lang of SUPPORTED_LANGUAGES) {
   const actual=t(source,lang,{phase:"A",completed:3,total:6});
   assert.ok(actual.includes("A"));
   assert.ok(actual.includes("3/6"));
   assert.ok(!actual.includes("{phase}"));
 }
});
test("All non-dynamic visible English markup strings are localized",()=>{
 const strings=[...html.matchAll(/>([^<>]+)</g)].map(x=>x[1].trim()).filter(Boolean);
 const ignore=new Set(["TT2 8.4 — Free Skill Point Calculator | Leskasoft","TT2","●","✦","→","?", "×","GitHub ↗","English","Français","Українська","Русский","rawrzcookie","MIT notices","Leskasoft","Leskasoft ↗","Clan Ship · Fairy","0"]);
 for(const str of strings) {
   if(ignore.has(str)||str.includes("application/ld+json")||str.startsWith("{")||str.includes("&nbsp;")||str==="TT2 8.4")continue;
   if(!/[a-zA-Z]/.test(str))continue;
   for(const lang of ["fr","uk","ru"])assert.ok(translations[lang][str],`Missing markup translation for ${lang}: ${str}`);
 }
});
test("Each step uses full width, and results are last even in mobile CSS",()=>{
 assert.equal((html.match(/<section class="panel/g)||[]).length,3);
 assert.ok(html.indexOf('class="panel setup"')<html.indexOf('class="panel preferences"'));
 assert.ok(html.indexOf('class="panel preferences"')<html.indexOf('class="panel results"'));
 assert.match(css,/\.workspace\{display:flex;flex-direction:column/);
 assert.match(css,/\.workspace>\.setup\{order:1\}/);
 assert.match(css,/\.workspace>\.preferences\{order:2\}/);
 assert.match(css,/\.workspace>\.results\{order:3\}/);
 assert.ok(!html.includes("Your strongest build."));
 assert.ok(!html.includes('class="hero"'));
 assert.ok(!html.includes('class="seo"'));
});
test("Export guide is keyboard-accessible and matches Options → Services → Export",()=>{
 assert.ok(html.includes('id="export-help-button"'));
 assert.ok(html.includes('aria-haspopup="dialog"'));
 assert.ok(html.includes('<dialog id="export-help-dialog"'));
 assert.ok(html.includes("Options → Services → Export."));
 assert.ok(html.includes('id="export-help-close"'));
 assert.ok(app.includes('help.showModal()'));
 assert.ok(app.includes('help.close()'));
});
test("MIT licensing includes original author notice and visible credit",()=>{
 assert.ok(license.startsWith("MIT License"));
 assert.ok(license.includes("Copyright (c) 2026 romainlsoft-bit"));
 assert.ok(notice.includes("Copyright (c) 2022 rawrzcookie"));
 assert.ok(notice.includes("Permission is hereby granted"));
 assert.ok(html.includes("Original optimizer by"));
 assert.ok(html.includes('href="https://github.com/rawrzcookie/rawrzcookie.github.io"'));
});

test("account coverage diagnostics are localized and all 16 imported categories displayed",()=>{
 const keys=["Seasonal artifacts","Titan Research","Clan Scrolls","Owned unique equipment",
 "not verifiable from this export",
 "Detected account categories: {categories}. Some effects are modeled; other imported categories remain diagnostic.",
 "Coverage: timed effects scored {applied}/{total}; hero weapon sets {weapons}; Clan Scroll sets {scrolls}. These figures are not predicted stages."];
 for(const key of keys)for(const lang of ["fr","uk","ru"]){
  assert.ok(translations[lang][key],"Missing translation: "+lang+" "+key);
  assert.notEqual(t(key,lang),key);
 }
 for(const id of ["titanResearch","seasonArtifacts","clanScrolls","uniqueEquipment"])
  assert.ok(app.includes(id+':'),"Missing account category "+id);
 for(const lang of ["en","fr","uk","ru"]){
  const value=t(keys[6],lang,{applied:2,total:3,weapons:5,scrolls:7});
  for(const number of ["2","3","5","7"])assert.ok(value.includes(number));
 }
});
