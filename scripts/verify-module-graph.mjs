/**
 * Offline TT2 ESM module graph audit. Never contacts GitHub or starts CI.
 * Every source relative JS import and the worker URL must resolve to an
 * existing file with ONE uniform version token, for predictable browser
 * caching and module singleton identity.
 */
import {readFileSync,readdirSync,existsSync} from "node:fs";
import {resolve,dirname,join,relative,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const text=path=>readFileSync(join(root,path),"utf8");
const html=text("index.html");
const match=html.match(/\bsrc=["']src\/app\.js\?v=([a-zA-Z0-9_-]+)(?:&amp;[a-zA-Z0-9_-]+=[a-zA-Z0-9_-]+)*["']/);
if(!match)throw new Error("Root entry must have a versioned app module");
const release=match[1];
const failures=[];
const expect=(okay,message)=>{if(!okay)failures.push(message);};
for(const page of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
 const pattern=/\bsrc=["'](?:\.\.\/)?src\/app\.js\?v=([a-zA-Z0-9_-]+)(?:&amp;[a-zA-Z0-9_-]+=[a-zA-Z0-9_-]+)*["']/;
 const versions=text(page).match(pattern);
 expect(versions?.[1]===release,page+": stale or absent app version");
}
const files=readdirSync(join(root,"src")).filter(name=>name.endsWith(".js"))
 .map(name=>"src/"+name);
const importRegex=/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\bnew URL\(\s*)(["'])(\.{1,2}\/[^"'\s]+?\.js)(?:\?v=([a-zA-Z0-9_-]+)((?:&[a-zA-Z0-9_-]+=[a-zA-Z0-9_-]+)*))?\1/g;
const targets=new Map();
let edges=0;
for(const sourceFile of files){
 const content=text(sourceFile);
 const matches=[...content.matchAll(importRegex)];
 for(const m of matches){
  edges++;
  const [,quote,raw,version,options]=m;
  const target=resolve(root,dirname(sourceFile),raw);
  expect(relative(root,target).split(sep)[0]!=="..",
   sourceFile+": escaping project root with "+raw);
  expect(existsSync(target),sourceFile+": unresolved "+raw);
  expect(version===release,sourceFile+": "+raw+" has version "+String(version)+
   ", expected "+release);
  const key=relative(root,target);
  if(!targets.has(key))targets.set(key,new Set());
  // ESM module identity includes the entire query string, not just v.
  targets.get(key).add(version==null?"(unversioned)":version+(options||""));
 }
 const parsed=spawnSync(process.execPath,["--check",join(root,sourceFile)],{
  encoding:"utf8",timeout:20000,windowsHide:true
 });
 expect(parsed.status===0,sourceFile+": syntax error or timeout "+
  (parsed.stderr||parsed.error?.message||"").trim().slice(0,400));
}
for(const [target,versions] of targets)
 expect(versions.size===1,target+": would create duplicate ESM instances");
if(failures.length){
 for(const problem of failures)console.error("FAIL",problem);
 process.exitCode=1;
}else console.log("TT2 ESM graph OK:",files.length,"source modules,",
 edges,"relative imports,",targets.size,"unique module URLs, version",release);
