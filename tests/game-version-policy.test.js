import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseTT2Version,compareTT2Versions,gameVersionEvidence,
 VERIFIED_SKILL_CATALOG_VERSION,VERIFIED_SKILL_CATALOG_DATASET}
 from "../src/game-version-policy.js";
import {GAME_VERSION,DATASET_REVISION,parseExport} from "../src/engine.js";
import {VERIFIED_NEXT_SEASON_START_UTC,capCurrentMaxStage}
 from "../src/current-season-policy.js";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("verified skill-version and source provenance are centralized",()=>{
 assert.equal(VERIFIED_SKILL_CATALOG_VERSION,"8.4.0");
 assert.equal(VERIFIED_SKILL_CATALOG_DATASET,"2026-09-18");
 assert.equal(GAME_VERSION,VERIFIED_SKILL_CATALOG_VERSION);
 assert.equal(DATASET_REVISION,VERIFIED_SKILL_CATALOG_DATASET);
});
test("version comparison uses semantic components, not lexicographic strings",()=>{
 assert.equal(compareTT2Versions("8.4.0","8.4.0"),0);
 assert.equal(compareTT2Versions("8.4.1","8.4.0"),1);
 assert.equal(compareTT2Versions("8.4.2","8.4.0"),1);
 assert.equal(compareTT2Versions("8.4.10","8.4.9"),1);
 assert.equal(compareTT2Versions("8.3.9","8.4.0"),-1);
 assert.equal(compareTT2Versions("9.0.0","8.4.0"),1);
 assert.equal(compareTT2Versions("8.4.2 (unknown)","8.4.0"),null);
 assert.equal(parseTT2Version("bad"),null);
 assert.equal(parseTT2Version("__proto__"),null);
});
test("version evidence never asserts untested account mechanics",()=>{
 const matching=gameVersionEvidence("8.4.0");
 assert.equal(matching.status,"matches-verified");
 assert.equal(matching.skillTreeMappingVerified,true);
 assert.equal(matching.otherAccountMechanicsVerified,false);
 for(const version of ["8.4.1","8.4.2","8.5.0"]){
  const check=gameVersionEvidence(version);
  assert.equal(check.status,"newer-than-verified",version);
  assert.equal(check.skillTreeMappingVerified,false);
 }
 assert.equal(gameVersionEvidence("8.3.0").status,"older-than-verified");
 assert.equal(gameVersionEvidence("invalid").status,"unrecognized");
 assert.equal(gameVersionEvidence(null).status,"unknown");
});
test("imported TT2 8.4.2 is accepted with an explicit unverified-version warning marker",()=>{
 const parsed=parseExport({Version:"8.4.2",Skills:{TapDmg:1},SkillPoints:5});
 assert.equal(parsed.importedVersion,"8.4.2");
 assert.equal(parsed.versionCompatibility.status,"newer-than-verified");
 assert.equal(parsed.versionCompatibility.verifiedSkillCatalogVersion,"8.4.0");
 const older=parseExport({Version:"8.3.0",Skills:{},SkillPoints:0});
 assert.equal(older.versionCompatibility.status,"older-than-verified");
 const known=parseExport({Version:"8.4.0",Skills:{},SkillPoints:0});
 assert.equal(known.versionCompatibility.status,"matches-verified");
});
test("UI shows version warnings in four languages rather than special-casing 8.4.1",()=>{
 const app=read("src/app.js");
 assert.match(app,/gameVersionEvidence\(state\.importedVersion\)/);
 assert.match(app,/versionReport\.status==="newer-than-verified"/);
 assert.doesNotMatch(app,/startsWith\("8\.4\.1"\)/);
 for(const key of [
  "Imported TT2 version {version} is newer than the verified skill catalog {catalog}.",
  "Imported TT2 version {version} is not validated against skill catalog {catalog}."
 ]){
  assert.ok(app.includes(key));
  for(const lang of ["fr","uk","ru"])
   assert.ok(read("src/i18n-"+lang+".js").includes(key),
    lang+" localization source missing");
 }
});
test("season start is not hardcoded again in the frontend",()=>{
 const app=read("src/app.js");
 assert.match(app,/VERIFIED_NEXT_SEASON_START_UTC/);
 assert.equal(app.includes('Date.parse("2026-11-26T00:00:00.000Z")'),false);
 assert.equal(VERIFIED_NEXT_SEASON_START_UTC,"2026-11-26T00:00:00.000Z");
 assert.equal(capCurrentMaxStage(200000,null,false,new Date("2026-11-25")),180000);
});
test("localized public guides reflect single-ranked automatic pets and S14/version caveats",()=>{
 for(const page of ["skill-tree-optimizer/index.html",
  "fr/optimiseur-arbre-de-competences/index.html",
  "uk/skill-tree-optimizer/index.html",
  "ru/skill-tree-optimizer/index.html"]){
  const html=read(page);
  assert.match(html,/"dateModified":"2026-11-26"/);
  assert.match(html,/8\.4\.0/);
  assert.match(html,/14/);
  assert.match(html,/Automatic/);
  assert.doesNotMatch(html,/to let the optimizer compare eligible owned pets|laisse le calculateur comparer les familiers|дозволяє порівняти доступних улюбленців|позволяет сравнивать доступных питомцев/);
 }
});
