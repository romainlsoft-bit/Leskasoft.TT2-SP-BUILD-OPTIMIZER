import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {inflateSync} from "node:zlib";

const pages=["index.html","fr/index.html","uk/index.html","ru/index.html",
 "skill-tree-optimizer/index.html","fr/optimiseur-arbre-de-competences/index.html",
 "uk/skill-tree-optimizer/index.html","ru/skill-tree-optimizer/index.html"];
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("all eight pages enforce one strict resource policy before scripts and styles",()=>{
 const policies=new Set();
 for(const path of pages){
  const html=read(path);
  const csp=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(csp,path);
  assert.ok(csp.index<html.indexOf("<script"),path);
  assert.ok(csp.index<html.indexOf('rel="stylesheet"'),path);
  policies.add(csp[1]);
  for(const directive of ["default-src 'none'","script-src 'self'","style-src 'self'",
   "worker-src 'self'","connect-src 'self'","object-src 'none'","base-uri 'none'",
   "frame-src 'none'","form-action 'none'"])assert.ok(csp[1].split("; ").includes(directive),path);
  assert.doesNotMatch(csp[1],/unsafe-inline|unsafe-eval|frame-ancestors|report-uri/);
  assert.match(html,/<meta name="referrer" content="no-referrer">/);
  assert.doesNotMatch(html,/<[^>]+\son[a-z]+="/i);
  assert.doesNotMatch(html,/<[^>]+\sstyle="/i);
  for(const link of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)){
   assert.match(link[0],/rel="[^"]*noopener/);
  }
  for(const block of html.matchAll(/<script\b([^>]*)>/g))
   assert.match(block[1],/type="application\/ld\+json"|type="module"[^>]*src="/);
 }
 assert.equal(policies.size,1);
});
test("dynamic branch chart uses CSSOM instead of injected style attributes",()=>{
 const app=read("src/app.js");
 assert.match(app,/fills\[index\]\.style\.width=/);
 assert.match(app,/fills\[index\]\.style\.background=/);
 assert.doesNotMatch(app,/class="progress-fill" style=/);
});

test("eight pages share a real PNG social preview with localized alt text",()=>{
 const image=readFileSync(new URL("../assets/social-card.png",import.meta.url));
 assert.equal(image.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(image.readUInt32BE(16),1200);
 assert.equal(image.readUInt32BE(20),630);
 const chunks=[];
 for(let pos=8;pos+12<=image.length;){
  const n=image.readUInt32BE(pos),type=image.toString("ascii",pos+4,pos+8);
  assert.ok(pos+12+n<=image.length,"truncated PNG chunk");
  if(type==="IDAT")chunks.push(image.subarray(pos+8,pos+8+n));
  pos+=12+n;
 }
 assert.equal(inflateSync(Buffer.concat(chunks)).length,601*630);
 for(const path of pages){
  const html=read(path);
  assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
  assert.ok(html.includes('<meta property="og:image" content="https://tap-titans.leskasoft.com/assets/social-card.png">'),path);
  assert.match(html,/<meta property="og:image:alt" content="[^"]+">/);
 }
});
