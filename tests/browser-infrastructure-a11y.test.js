import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SKILLS,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {
 BUILD_STORAGE_KEY,LANGUAGE_STORAGE_KEY,
 restoreSavedBuild,persistSavedBuild,eraseSavedBrowserData,storeLanguage
} from "../src/browser-persistence.js";
import {
 createPublicSharePayload,createShareableBuildLink,readSharedBuild
} from "../src/share-link-protocol.js";
import {MAX_SHARED_BUILD_HASH,MAX_SAVED_STATE_TEXT}
 from "../src/build-input-boundary.js";

const defaults=()=>({
 damage:"Clan Ship",gold:"Fairy",skillPoints:0,maxStage:0,
 stageSeason:null,playstyle:"balanced",qol:"recommended",
 goldWeight:.7,craftingPower:1,timeToKill:8,sClone:30,
 currentLevels:{},minimums:{},excluded:[],
 preserveCurrent:false,protectUnmodeledSkills:true,
 accountProfile:null,selectedEquipment:{},selectedDamagePet:null,
 selectedGoldPet:null,sets:{}
});
function storage(){
 const content=new Map();
 return {
  content,
  getItem:key=>content.has(key)?content.get(key):null,
  setItem:(key,value)=>{content.set(key,String(value));},
  removeItem:key=>{content.delete(key);}
 };
}
const restore=box=>restoreSavedBuild(box,defaults(),SKILLS,DAMAGE_TYPES,GOLD_TYPES);
const createLink=(state,url="https://tap-titans.leskasoft.com/fr/?lang=fr#old")=>
 createShareableBuildLink(url,state,defaults(),SKILLS,DAMAGE_TYPES,GOLD_TYPES);
const skillState=()=>({...defaults(),skillPoints:22600,maxStage:180000,
 damage:"Pet",gold:"Fairy",qol:"none",currentLevels:{TapDmg:1},
 minimums:{TapDmg:1},excluded:["TapDmg"]});
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("storage writes and restores a validated existing local session",()=>{
 const box=storage();
 const state=skillState();
 assert.equal(persistSavedBuild(box,state),true);
 assert.equal(JSON.parse(box.getItem(BUILD_STORAGE_KEY)).skillPoints,22600);
 const restored=restore(box);
 assert.equal(restored.damage,"Pet");
 assert.equal(restored.skillPoints,22600);
 assert.deepEqual(restored.currentLevels,{TapDmg:1});
 assert.notEqual(restored,state);
});
test("malformed, oversize and unavailable storage fail to source-safe defaults",()=>{
 const box=storage();
 box.setItem(BUILD_STORAGE_KEY,"not-json");
 assert.equal(restore(box).skillPoints,0);
 box.setItem(BUILD_STORAGE_KEY,"X".repeat(MAX_SAVED_STATE_TEXT+1));
 assert.equal(restore(box).skillPoints,0);
 const denied={getItem(){throw Error("denied")},setItem(){throw Error("quota")},
  removeItem(){throw Error("denied")}};
 assert.equal(restore(denied).skillPoints,0);
 assert.equal(persistSavedBuild(denied,skillState()),false);
 assert.equal(eraseSavedBrowserData(denied),false);
 assert.equal(persistSavedBuild(null,skillState()),false);
 assert.equal(eraseSavedBrowserData(null),false);
});
test("oversized local snapshots cannot leave an older secret on disk",()=>{
 const box=storage();
 box.setItem(BUILD_STORAGE_KEY,JSON.stringify(skillState()));
 assert.equal(persistSavedBuild(box,{...skillState(),fakeSecret:"Z".repeat(MAX_SAVED_STATE_TEXT)}),false);
 assert.equal(box.getItem(BUILD_STORAGE_KEY),null);
});
test("legacy local preferences cannot override validated skill caps",()=>{
 const box=storage();
 box.setItem(BUILD_STORAGE_KEY,JSON.stringify({
  ...skillState(),currentLevels:{TapDmg:2,UnknownSkill:3},
  minimums:{TapDmg:'0" onfocus="alert(1)'},evilField:"untrusted"
 }));
 const result=restore(box);
 assert.deepEqual(result.currentLevels,{TapDmg:2});
 assert.deepEqual(result.minimums,{});
 assert.equal(Object.hasOwn(result,"evilField"),false);
});
test("erase removes account session and saved language, without pretending success if blocked",()=>{
 const box=storage();
 assert.equal(persistSavedBuild(box,skillState()),true);
 assert.equal(storeLanguage(box,"fr"),true);
 assert.equal(box.getItem(LANGUAGE_STORAGE_KEY),"fr");
 assert.equal(storeLanguage(box,"__proto__"),false);
 assert.equal(eraseSavedBrowserData(box),true);
 assert.equal(box.getItem(BUILD_STORAGE_KEY),null);
 assert.equal(box.getItem(LANGUAGE_STORAGE_KEY),null);
 assert.equal(restore(box).skillPoints,0);
});
test("share URLs use existing #build protocol but exclude every account identity",()=>{
 const state=skillState();
 state.accountProfile={schema:"tt2-account-profile-v1",sections:{},
  stats:{transcendenceSeason:14},playerName:"PRIVATE_PLAYER_NAME",
  playerId:"PRIVATE_ACCOUNT_ID",email:"PRIVATE_MAIL"};
 state.selectedEquipment={Sword:"PRIVATE_INVENTORY"};
 state.selectedDamagePet="Pet1";
 const payload=createPublicSharePayload(state,defaults(),SKILLS,DAMAGE_TYPES,GOLD_TYPES);
 assert.equal(payload.ss,14);
 assert.equal(payload.sp,22600);
 assert.equal(Object.hasOwn(payload,"accountProfile"),false);
 assert.equal(Object.hasOwn(payload,"selectedEquipment"),false);
 const url=createLink(state);
 assert.match(url,/^https:\/\/tap-titans\.leskasoft\.com\/fr\/\?lang=fr#build=/);
 for(const secret of ["PRIVATE_PLAYER_NAME","PRIVATE_ACCOUNT_ID","PRIVATE_MAIL",
  "PRIVATE_INVENTORY","Pet1"])assert.equal(url.includes(secret),false);
 const decoded=readSharedBuild(url.slice(url.indexOf("#")),SKILLS,DAMAGE_TYPES,GOLD_TYPES);
 assert.deepEqual(decoded.currentLevels,{TapDmg:1});
 assert.equal(decoded.stageSeason,14);
 assert.equal(decoded.skillPoints,22600);
 assert.equal(decoded.accountProfile,null);
});
test("new shared links decode with legacy UTF-8 base64 format",()=>{
 const state=skillState(),payload=createPublicSharePayload(
  state,defaults(),SKILLS,DAMAGE_TYPES,GOLD_TYPES);
 const newLink=createLink(state);
 const oldHash="#build="+Buffer.from(JSON.stringify(payload),"utf8").toString("base64");
 assert.equal(newLink.slice(newLink.indexOf("#")),oldHash);
 const decoded=readSharedBuild(oldHash,SKILLS,DAMAGE_TYPES,GOLD_TYPES);
 assert.equal(decoded.damage,"Pet");
 assert.equal(decoded.protectUnmodeledSkills,true);
});
test("forged skill levels and oversized fragments are rejected before sharing",()=>{
 const bad={...skillState(),currentLevels:{TapDmg:'0" onfocus="alert(1)'}};
 assert.throws(()=>createLink(bad),/numeric|integer|level/i);
 const huge={...skillState(),excluded:Array(9000).fill("TapDmg")};
 assert.throws(()=>createLink(huge),/too large/i);
 assert.ok(MAX_SHARED_BUILD_HASH<50000);
});
test("all eight static pages expose a localized skip link and a main target",()=>{
 const locales={
  "index.html":"Skip to main content",
  "fr/index.html":"Aller au contenu principal",
  "uk/index.html":"Перейти до основного вмісту",
  "ru/index.html":"Перейти к основному содержимому",
  "skill-tree-optimizer/index.html":"Skip to main content",
  "fr/optimiseur-arbre-de-competences/index.html":"Aller au contenu principal",
  "uk/skill-tree-optimizer/index.html":"Перейти до основного вмісту",
  "ru/skill-tree-optimizer/index.html":"Перейти к основному содержимому"
 };
 for(const [path,label] of Object.entries(locales)){
  const html=read(path);
  assert.equal((html.match(/class="skip-link"/g)||[]).length,1,path);
  assert.equal((html.match(/id="main-content"/g)||[]).length,1,path);
  assert.match(html,/href="#main-content"/);
  assert.ok(html.includes(">"+label+"</a>"),path);
  assert.match(html,/styles\.css\?v=[^"]*&amp;a11y=20261126-audit56-r1/);
 }
 const css=read("styles.css");
 assert.match(css,/\.skip-link:focus/);
 assert.match(css,/prefers-reduced-motion: reduce/);
});
test("clear action cannot reload after failed erasure, old state modules are no longer in controller",()=>{
 const app=read("src/app.js");
 assert.match(app,/if\(!erased\)\{[\s\S]*?return;[\s\S]*?\}\s*window\.history/);
 assert.match(app,/restoreSavedBuild\(localStorage,fresh\(\),SKILLS,DAMAGE_TYPES,GOLD_TYPES\)/);
 assert.match(app,/persistSavedBuild\(localStorage,state\)/);
 assert.match(app,/createShareableBuildLink\(window\.location\.href/);
 assert.doesNotMatch(app,/function sharePayload\(/);
 assert.doesNotMatch(app,/unescape\(encodeURIComponent/);
});
