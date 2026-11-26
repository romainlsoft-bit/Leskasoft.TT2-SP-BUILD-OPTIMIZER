import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createAccountDiagnosticsRenderer} from "../src/account-diagnostics-ui.js";
import {createResultDetailRenderers} from "../src/result-details-ui.js";

const tr=(s,vars={})=>String(s).replace(/\{(\w+)\}/g,
 (_,k)=>vars[k]===undefined?"{"+k+"}":String(vars[k]));
const safe=s=>String(s).replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
function fakeDOM(){
 const nodes=new Map();
 const root={insertAdjacentElement:(_where,el)=>nodes.set(el.id,el)};
 const document={
  createElement:()=>({
   id:"",className:"",hidden:false,textContent:"",innerHTML:"",
   setAttribute(){},
   insertAdjacentElement(_where,el){nodes.set(el.id,el)}
  }),
  querySelector:selector=>selector===".math-disclaimer"?root:null
 };
 nodes.set("combat-assumptions-summary",root);
 return {document,getById:id=>nodes.get(id),nodes};
}
test("account diagnostic panel includes monuments without a temporal dead zone",()=>{
 const dom=fakeDOM();
 const render=createAccountDiagnosticsRenderer({
  getById:dom.getById,doc:dom.document,tr,
  numberText:String,formatLogMultiplier:n=>"10^"+n,seasonNotice:"Season 14 source notice."
 });
 const result={
  fixedAccount:{damageLog10:1,goldLog10:2,matched:2},
  accountIntegration:{
   unmodeledEffects:0,timedSetPower:{applied:0,calculated:0},
   monuments:{identified:1,scored:1,season:"14",
    additiveDamageLog10:2,additiveComponents:1,unknownIds:0,conflicts:0}
  },
  accountSourceCoverage:{
   seasonCalendar:{season:"14",betweenSeasons:false},
   systems:[],clanTechnology:{present:false}
  }
 };
 assert.doesNotThrow(()=>render(result));
 const node=dom.nodes.get("account-integration-diagnostic");
 assert.ok(node);
 assert.equal(node.hidden,false);
 assert.match(node.textContent,/Monuments \(season/);
 assert.match(node.textContent,/Season 14 source notice/);
 assert.match(node.textContent,/Account baseline/);
});
test("account diagnostics hide stale seasonal monuments between seasons",()=>{
 const dom=fakeDOM();
 const render=createAccountDiagnosticsRenderer({
  getById:dom.getById,doc:dom.document,tr,
  numberText:String,formatLogMultiplier:String,seasonNotice:"S14"
 });
 render({fixedAccount:{damageLog10:0,goldLog10:0,matched:0},
  accountIntegration:{monuments:{identified:1,season:"13"}},
  accountSourceCoverage:{seasonCalendar:{betweenSeasons:true},systems:[]}
 });
 assert.doesNotMatch(dom.nodes.get("account-integration-diagnostic").textContent,
  /Monuments \(season/);
});
test("account diagnostics fail closed when no account evidence exists",()=>{
 const dom=fakeDOM();
 const render=createAccountDiagnosticsRenderer({
  getById:dom.getById,doc:dom.document,tr,
  numberText:String,formatLogMultiplier:String,seasonNotice:""
 });
 render({fixedAccount:null,accountIntegration:null});
 assert.equal(dom.nodes.get("account-integration-diagnostic").hidden,true);
});
test("attack channel display escapes hostile source labels and leaves score untouched",()=>{
 const dom=fakeDOM();
 const views=createResultDetailRenderers({
  getById:dom.getById,doc:dom.document,tr,safe,
  numberText:String,exportBuild:levels=>JSON.stringify(levels)
 });
 const channel={
  id:"test",label:'<img src=x onerror=alert(1)>',
  skillId:'<svg onload=alert(1)>',level:1,sourceModifierLog10:2,
  skip:[{value:3,level:1,skillName:"<attack>",kind:"stage"}],
  status:"unverified-spell-selection"
 };
 views.renderAttackChannelEvidence({attackChannels:{channels:[channel]}});
 const markup=dom.nodes.get("attack-channel-diagnostics").innerHTML;
 assert.match(markup,/&lt;img/);
 assert.match(markup,/&lt;svg/);
 assert.match(markup,/&lt;attack&gt;/);
 assert.doesNotMatch(markup,/<img|<svg/);
 const score={byBranch:{Knight:2},top:[],gold:"Fairy"};
 views.renderModelAttribution({modelAttribution:score});
 assert.match(dom.nodes.get("model-score-attribution").innerHTML,/Knight/);
 assert.equal(Object.hasOwn(views,"renderPushSkipComparison"),false);
 views.renderBossPushEvidence({});
 assert.equal(dom.nodes.get("boss-push-evidence").hidden,true);
});
test("controller retains only orchestration and all diagnostics live in SRP modules",()=>{
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 const account=readFileSync(new URL("../src/account-diagnostics-ui.js",import.meta.url),"utf8");
 const detail=readFileSync(new URL("../src/result-details-ui.js",import.meta.url),"utf8");
 assert.match(app,/createAccountDiagnosticsRenderer\(/);
 assert.match(app,/createResultDetailRenderers\(/);
 assert.doesNotMatch(app,/function renderAccountIntegration\(/);
 assert.doesNotMatch(app,/function renderAttackChannelEvidence\(/);
 assert.match(account,/const sourceCoverage=result\.accountSourceCoverage;/);
 assert.doesNotMatch(detail,/function renderNativeAttackFrontier\(/);
 assert.doesNotMatch(app,/renderNativeAttackFrontier\(/);
 assert.doesNotMatch(app,/renderPushFrontier\(/);
 assert.match(app,/running\.postMessage\(\{type:"optimize",settings:requestContext\}\)/);
});
