import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {translations} from "../src/i18n.js";
const details=readFileSync(new URL("../src/account-diagnostics-ui.js",import.meta.url),"utf8");
const labels=["Some conditional skills have unverified activation or stacking; their damage was not guessed.","Lightning Strike hits per boss are unknown; current SP levels are protected, but no speculative damage is scored.","Lightning Strike source-only estimate uses an explicitly supplied hit count; actual proc rate remains unverified."];
test("calculation limitations are shown to players, not hidden in JSON diagnostics",()=>{
 for(const label of labels)assert.ok(details.includes(label),label);
 assert.ok(details.includes("limitations.lightningStrikeCountUnverified"));
 assert.ok(details.includes("limitations.conditionalSkillsUnverified"));
});
test("new math limitations have complete EN/FR/UK/RU text",()=>{
 for(const locale of ["fr","uk","ru"])for(const key of labels){
  assert.equal(typeof translations[locale][key],"string",locale+"/"+key);
  assert.ok(translations[locale][key].trim().length>10,locale+"/"+key);
 }
});
