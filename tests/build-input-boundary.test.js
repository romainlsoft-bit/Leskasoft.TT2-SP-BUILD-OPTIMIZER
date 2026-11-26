import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SKILLS,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {
 sanitizeUserBuild,parseSharedBuildHash,MAX_SHARED_BUILD_HASH,
 MAX_SAVED_STATE_TEXT
} from "../src/build-input-boundary.js";
import {MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS,shouldEnumerateOwnedGear}
 from "../src/gear-search-policy.js";

const defaults=()=>({
 damage:"Clan Ship",gold:"Fairy",skillPoints:0,maxStage:0,
 stageSeason:null,playstyle:"balanced",qol:"recommended",
 goldWeight:.7,craftingPower:1,timeToKill:8,sClone:30,
 currentLevels:{},minimums:{},excluded:[],preserveCurrent:false,
 protectUnmodeledSkills:true,selectedEquipment:{},
 selectedDamagePet:null,selectedGoldPet:null,accountProfile:null,
 sets:{},sourceImported:false,importedVersion:null
});
const clean=(input,strict=false)=>sanitizeUserBuild(input,defaults(),
 SKILLS,DAMAGE_TYPES,GOLD_TYPES,{strict});
const encode=payload=>"#build="+btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
const decode=hash=>parseSharedBuildHash(hash,SKILLS,DAMAGE_TYPES,GOLD_TYPES);

test("shared builds accept known levels, exclusions and Unicode-free old schema",()=>{
 const payload={sp:22600,st:180000,ss:14,da:"Pet",go:"Fairy",p:"push",
  q:"none",w:.6,cp:2,tk:8,cl:30,cur:{TapDmg:1},
  min:{TapDmg:1},exc:["TapDmg"],keep:true,protect:false};
 const result=decode(encode(payload));
 assert.deepEqual(result.currentLevels,{TapDmg:1});
 assert.deepEqual(result.minimums,{TapDmg:1});
 assert.deepEqual(result.excluded,["TapDmg"]);
 assert.equal(result.skillPoints,22600);
 assert.equal(result.maxStage,180000);
 assert.equal(result.stageSeason,14);
 assert.equal(result.protectUnmodeledSkills,false);
 assert.equal(result.accountProfile,null);
});
test("shared links reject script-bearing current/minimum values BEFORE DOM rendering",()=>{
 for(const key of ["cur","min"]){
  const payload={sp:100,da:"Pet",go:"Fairy",
   [key]:{TapDmg:'0" autofocus onfocus="alert(1)'}};
  assert.throws(()=>decode(encode(payload)),/Invalid shared build numeric parameter/);
  const payload2={...payload,[key]:{TapDmg:'"><svg/onload=alert(1)>'}};
  assert.throws(()=>decode(encode(payload2)),/Invalid shared build numeric parameter/);
 }
});
test("shared levels are integers in source-catalog range, never arbitrary keys",()=>{
 const max=Number(SKILLS.TapDmg.MaxLevel);
 for(const bad of [{TapDmg:max+1},{TapDmg:-1},{TapDmg:1.5},
  {TapDmg:null},{TapDmg:true},{constructor:1},{UnknownSkill:2}]){
  assert.throws(()=>decode(encode({cur:bad})),/skill|Skill|numeric|integer/i);
 }
 assert.throws(()=>decode(encode({exc:["__proto__"]})),/excluded skill/);
});
test("malformed hashes, oversized encoded payloads and nonscalar metadata fail closed",()=>{
 for(const hash of ["#build=","#build=<bad>","#build=!!!","#build="+
  "A".repeat(MAX_SHARED_BUILD_HASH)]){
  assert.throws(()=>decode(hash));
 }
 assert.throws(()=>decode(encode({sp:"NaN"})),/numeric/);
 assert.throws(()=>decode(encode({da:"arbitrary"})),/choice/);
 assert.throws(()=>decode(encode({q:"__proto__"})),/choice/);
 assert.throws(()=>decode(encode({cp:0})),/numeric/);
 assert.throws(()=>decode(encode({cur:[]})),/object/);
 assert.throws(()=>decode(encode({exc:{}})),/list/);
 assert.ok(MAX_SAVED_STATE_TEXT>=2_000_000);
});
test("restored browser state is allowlisted, normalized and keeps valid imported profile",()=>{
 const profile={schema:"tt2-account-profile-v1",sections:{petLevels:{present:true,
  records:[],count:0,truncated:false}},stats:{}};
 const saved={...defaults(),accountProfile:profile,sourceImported:true,
  currentLevels:{TapDmg:2,OtherSkill:99},
  minimums:{TapDmg:'0" onclick="alert(1)'},excluded:["TapDmg","TapDmg","__proto__"],
  damage:"Pet",gold:"Fairy",evilField:"secret",skillPoints:22600,
  selectedEquipment:{Sword:"sword_1","__proto__":"evil"},
  selectedDamagePet:"Pet1",playstyle:"push"};
 const restored=clean(saved);
 assert.equal(restored.currentLevels.TapDmg,2);
 assert.equal(Object.keys(restored.currentLevels).length,1);
 assert.deepEqual(restored.minimums,{});
 assert.deepEqual(restored.excluded,["TapDmg"]);
 assert.equal(restored.accountProfile,profile);
 assert.equal(restored.sourceImported,true);
 assert.equal(restored.damage,"Pet");
 assert.equal(restored.skillPoints,22600);
 assert.equal(restored.selectedDamagePet,"Pet1");
 assert.equal(Object.hasOwn(restored,"evilField"),false);
 assert.equal(Object.hasOwn(restored.selectedEquipment,"__proto__"),false);
});
test("restored settings reject nonfinite/invalid inputs without triggering errors",()=>{
 const restored=clean({...defaults(),skillPoints:"Infinity",
  currentLevels:{TapDmg:"<script>alert(1)</script>"},minimums:[],
  goldWeight:999,playstyle:"prototype",preserveCurrent:"true",
  accountProfile:{schema:"forged"},selectedDamagePet:"<svg>"});
 assert.deepEqual(restored.currentLevels,{});
 assert.deepEqual(restored.minimums,{});
 assert.equal(restored.skillPoints,0);
 assert.equal(restored.goldWeight,.7);
 assert.equal(restored.playstyle,"balanced");
 assert.equal(restored.preserveCurrent,false);
 assert.equal(restored.accountProfile,null);
 assert.equal(restored.selectedDamagePet,null);
});
test("all four localized HTML pages include an explicit browser-data erasure control",()=>{
 for(const file of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const html=readFileSync(new URL("../"+file,import.meta.url),"utf8");
  assert.equal((html.match(/id="clear-local-data"/g)||[]).length,1,file);
  assert.match(html,/security=20261126-audit56-r1/);
 }
 const js=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.match(js,/parseSharedBuildHash\(hash,SKILLS,DAMAGE_TYPES,GOLD_TYPES\)/);
 assert.match(js,/sanitizeUserBuild\(JSON\.parse\(stored\),fresh\(\),SKILLS,DAMAGE_TYPES,GOLD_TYPES\)/);
 assert.match(js,/value="\$\{safe\(state\.currentLevels\?\.\[id\]\?\?0\)\}"/);
 assert.match(js,/value="\$\{safe\(state\.minimums\?\.\[id\]\?\?0\)\}"/);
 assert.match(js,/localStorage\.removeItem\("tt2_skill_optimizer_v1"\)/);
});
test("one gear limit is used for 16, 17, 32 and 33 candidates",()=>{
 assert.equal(MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS,32);
 for(const count of [1,16,17,32])
  assert.equal(shouldEnumerateOwnedGear({exhaustive:true,assignments:Array(count).fill({})}),true);
 for(const count of [0,33,64])
  assert.equal(shouldEnumerateOwnedGear({exhaustive:true,assignments:Array(count).fill({})}),false);
 assert.equal(shouldEnumerateOwnedGear({exhaustive:false,assignments:[{}]}),false);
});
