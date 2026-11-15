#!/usr/bin/env node
// Compares the vendored skill tree against the most recently available CSV.
// This checker does NOT silently merge data updates or claim full game support.
import { skillInfo } from "../vendor/skills.js";

const SOURCE = "https://raw.githubusercontent.com/rawrzcookie/TT2_CSV/main/csv/SkillTreeInfo2.0.csv";
function parseCsv(csv) {
  const rows=[];let field="",row=[],quoted=false;
  for(let i=0;i<csv.length;i++){
    const c=csv[i];
    if(c==='"') {
      if(quoted&&csv[i+1]==='"'){field+='"';i++}else quoted=!quoted;
    } else if(!quoted&&(c===','||c==='\n'||c==='\r')){
      row.push(field);field="";
      if(c!==','){if(row.some(x=>x!==""))rows.push(row);row=[];if(c==='\r'&&csv[i+1]==='\n')i++}
    } else field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row)}
  return rows;
}
const norm=value=>{
  if(value===undefined||value===null||value==="-")return String(value??"-");
  const n=Number(value);return Number.isFinite(n)&&String(value).trim()!==""?n:String(value);
};
try {
  const response=await fetch(SOURCE,{headers:{"User-Agent":"Leskasoft-TT2-Version-Checker"}});
  if(!response.ok)throw new Error("Source HTTP "+response.status);
  const rows=parseCsv(await response.text()),headers=rows.shift();
  const current=new Map(rows.map(row=>[row[0],Object.fromEntries(headers.map((key,i)=>[key,row[i]]))]));
  const diffs=[];
  for(const [id,skill] of Object.entries(skillInfo)){
    const row=current.get(id);
    if(!row){diffs.push(id+": missing in upstream CSV");continue}
    for(const key of Object.keys(skill)){
      if(!(key in row)){diffs.push(id+"."+key+": missing upstream field");continue}
      if(norm(skill[key])!==norm(row[key]))diffs.push(id+"."+key+": "+JSON.stringify(skill[key])+" => "+JSON.stringify(row[key]));
    }
  }
  for(const id of current.keys())if(!(id in skillInfo))diffs.push(id+": new upstream skill");
  if(!diffs.length){console.log("OK: "+current.size+" skill definitions match the source CSV. This does not validate every TT2 8.4 gameplay formula.");}
  else {console.error("DATA DIFFERENCES FOUND ("+diffs.length+"):\n"+diffs.slice(0,80).join("\n"));if(diffs.length>80)console.error("... "+(diffs.length-80)+" more");process.exitCode=1;}
}catch(e){console.error("Unable to verify live skill CSV: "+e.message);process.exitCode=2;}
