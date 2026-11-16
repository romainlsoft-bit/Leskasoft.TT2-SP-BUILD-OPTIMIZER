import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readClipboardText} from "../src/clipboard.js";
import {t} from "../src/i18n.js";

const source=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const app=source("src/app.js");
const css=source("styles.css");
const pages={
 en:source("index.html"),fr:source("fr/index.html"),
 uk:source("uk/index.html"),ru:source("ru/index.html")
};

test("clipboard reader recognizes unsupported browser without throwing",async()=>{
 assert.deepEqual(await readClipboardText(undefined),{ok:false,reason:"unsupported"});
 assert.deepEqual(await readClipboardText({}),{ok:false,reason:"unsupported"});
});
test("clipboard reader distinguishes empty content and denied access",async()=>{
 assert.deepEqual(await readClipboardText({readText:async()=>""}),{ok:false,reason:"empty"});
 assert.deepEqual(await readClipboardText({readText:async()=>" \n "}),{ok:false,reason:"empty"});
 assert.deepEqual(await readClipboardText({readText:async()=>{throw new Error("NotAllowedError");}}),{ok:false,reason:"blocked"});
});
test("clipboard read passes unmodified JSON text exactly once",async()=>{
 const json='{"playerStats":{"Skill Points Owned":22500},"skillTree":{}}';
 let calls=0;
 const result=await readClipboardText({readText:()=>{calls++;return Promise.resolve(json);}});
 assert.deepEqual(result,{ok:true,text:json});
 assert.equal(calls,1);
});
test("errors go to a visible, dismissible and accessible toast in all languages",()=>{
 for(const [lang,html] of Object.entries(pages)){
  assert.ok(html.includes('id="app-toast"'),lang);
  assert.ok(html.includes('role="alert"'),lang);
  assert.ok(html.includes('aria-live="assertive"'),lang);
  assert.ok(html.includes('id="toast-close"'),lang);
  assert.ok(html.includes('id="toast-message"'),lang);
  assert.ok(html.includes('id="toast-title"'),lang);
  assert.ok(html.includes('aria-label="'+t("Close notification",lang)+'"'),lang);
 }
 assert.match(css,/\.app-toast\{[\s\S]*position:fixed/);
 assert.match(css,/\.app-toast\[hidden\]\{display:none!important\}/);
 assert.ok(app.includes('if(type==="error")showToast(display)'));
 assert.ok(app.includes('$("toast-close").addEventListener("click",hideToast)'));
});
test("clipboard failures offer manual paste instead of treating permissions as invalid JSON",()=>{
 assert.ok(app.includes('readClipboardText(navigator.clipboard)'));
 assert.ok(app.includes('result.reason==="empty"'));
 assert.ok(app.includes('result.reason==="unsupported"'));
 assert.ok(app.includes('panel.open=true'));
 assert.ok(app.includes('field.focus({preventScroll:true})'));
 assert.ok(app.includes('if(clipboardContent!==null)field.value=clipboardContent'));
 assert.ok(!app.includes("navigator.clipboard.readText();importRaw(raw)"));
});
test("clipboard and toast messages are fully translated in FR, UK and RU",()=>{
 const keys=[
  "Error","Close notification",
  "Clipboard is empty. Copy your TT2 export and try again.",
  "Automatic clipboard access is unavailable. Paste your export into the field below (Ctrl+V on desktop, or Paste on mobile).",
  "Browser denied clipboard access. Paste your export into the field below (Ctrl+V on desktop, or Paste on mobile).",
  "Clipboard data could not be imported: {detail}"
 ];
 for(const lang of ["fr","uk","ru"])for(const key of keys){
  assert.notEqual(t(key,lang,{detail:"TEST"}),key,lang+" / "+key);
 }
});
