/**
 * Independently attest TT2 8.4 data against Unity TextAssets extracted from
 * the player's installed game. This script does not fetch third-party CSVs.
 * It does not copy, redistribute or publish the extracted game assets.
 */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {skillInfo} from '../vendor/skills.js';
import {spellInfo} from '../vendor/spells.js';
import {PETS} from '../vendor/pets.js';
import {TRANSCENDENT_PETS} from '../vendor/transcendent-pets.js';

export const PLAYABLE_SPELL_IDS=Object.freeze([
 'BurstDamage','CritBoost','HandOfMidas','TapBoost','HelperBoost',
 'ShadowClone','DualPet','StreamOfBlades','ThunderVolley','TwilightFairy',
 'GoldenMissile'
]);
export const UNITY_84_SNAPSHOT=Object.freeze({
 skills:Object.freeze({file:'SkillTreeInfo2.0.csv',primaryKey:'TalentID',rows:72,fields:345,
  sha256:'3b8067bad4170dad4b6743af14b7e7d5c4d6f02857e01d3f070f668b60b4ac3a',
  sourceSha256:'12e4234cf6ed060c8e90b01d4565108fecc9397d4eb5d1438101af7cb313f37f'}),
 spells:Object.freeze({file:'ActiveSkillInfo.csv',primaryKey:'ActiveSkillID',rows:11,fields:176,
  sha256:'cfa68349d3aabf2e6e7602abe846badc444a897ed08bb1ee3106fc744e3b8fa3',
  sourceSha256:'7eccdce065d96658142a2f1f3962d7a233083ceacb3781c11f6979599c9fcba8'}),
 pets:Object.freeze({file:'PetInfo.csv',primaryKey:'PetID',rows:30,fields:8,
  sha256:'9118cd4d89d7a6253e71299420b72d2f9d6aa2577ad12ecd71cedc8cc046ad13',
  sourceSha256:'0e86cd5c1125981c73db2a50780530937e431a6bfaa4591b082842de97745c51'}),
 seasonPets:Object.freeze({file:'EndgamePetInfo.csv',primaryKey:'PetID',rows:15,fields:8,
  sha256:'3719eabd6201a9335312655cd668d5d0a5e45b6a1d74db30def2cd6b16236e7b',
  sourceSha256:'4730f9d4f816f6686cdd15a5d470890b379c9f73622834e2a7f6b22abbf42ed6'})
});
const PET_FIELDS=Object.freeze({
 id:'PetID',name:'PetName',type:'BonusType',equipType:'EquipType',
 base:'BonusBase',inc:'BonusInc',improve:'ImprovementBonus',
 improvementLimit:'MaxImprovementLevels'
});
const sha256=input=>createHash('sha256').update(input,'utf8').digest('hex');

/** Numeric canonicalization never converts e9999 to a JS Number. */
export function canonicalValue(input){
 const value=String(input ?? '').trim();
 if(/^(true|false)$/i.test(value))return value.toLowerCase();
 const match=/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(value);
 if(!match)return value;
 const fractional=match[3]??'';
 let digits=(match[2]+fractional).replace(/^0+/,'');
 let power=Number(match[4]??0)-fractional.length;
 if(!digits)return '0';
 while(digits.endsWith('0')){digits=digits.slice(0,-1);power++;}
 if(!Number.isSafeInteger(power))return value;
 return (match[1]==='-'?'-':'')+digits+'e'+power;
}
export function canonicalLines(rows){
 return Object.keys(rows).sort().flatMap(id=>
  Object.keys(rows[id]).sort().map(key=>id+'|'+key+'='+canonicalValue(rows[id][key]))).join('\n');
}
export const digestRows=rows=>sha256(canonicalLines(rows));
export function projectedRows(kind,values){
 const entries=Object.entries(values);
 const projection=kind==='pets'||kind==='seasonPets';
 return Object.fromEntries(entries
  .filter(([id])=>kind!=='spells'||PLAYABLE_SPELL_IDS.includes(id))
  .map(([id,row])=>[id,projection?
   Object.fromEntries(Object.keys(PET_FIELDS).map(field=>[field,row[field]])):
   row]));
}
export function vendorRows(){
 return {skills:projectedRows('skills',skillInfo),
  spells:projectedRows('spells',spellInfo),
  pets:projectedRows('pets',PETS),
  seasonPets:projectedRows('seasonPets',TRANSCENDENT_PETS)};
}
export function auditSnapshot(vendor=vendorRows()){
 const issues=[];
 for(const [kind,meta] of Object.entries(UNITY_84_SNAPSHOT)){
  const rows=vendor[kind]||{};
  const ids=Object.keys(rows);
  const fields=ids.length?Object.keys(rows[ids[0]]).length:0;
  if(ids.length!==meta.rows)issues.push(kind+': expected '+meta.rows+' records, got '+ids.length);
  if(fields!==meta.fields)issues.push(kind+': expected '+meta.fields+' fields, got '+fields);
  if(digestRows(rows)!==meta.sha256)issues.push(kind+': Unity snapshot digest mismatch');
 }
 return {ok:issues.length===0,issues};
}
/** Parse comma/quoted/escaped/newline CSV without depending on network. */
export function parseCsv(source){
 const text=String(source).replace(/^\uFEFF/,'');
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;}
   else quoted=!quoted;
  }else if(!quoted&&(char===','||char==='\r'||char==='\n')){
   row.push(field);field='';
   if(char!==','){
    if(row.some(item=>item!==''))rows.push(row);
    row=[];
    if(char==='\r'&&text[i+1]==='\n')i++;
   }
  }else field+=char;
 }
 if(quoted)throw new Error('Unclosed CSV quoted field');
 if(field||row.length){row.push(field);rows.push(row);}
 if(!rows.length)throw new Error('Empty CSV');
 const [names,...data]=rows;
 if(new Set(names).size!==names.length)throw new Error('Duplicate CSV headers');
 return data.map((fields,index)=>{
  if(fields.length!==names.length)throw new Error('CSV line '+(index+2)+': column mismatch');
  return Object.fromEntries(names.map((name,i)=>[name,fields[i]]));
 });
}
export function readSourceRows(kind,text){
 const info=UNITY_84_SNAPSHOT[kind];
 if(!info)throw new RangeError('Unrecognized TT2 dataset: '+kind);
 const source=parseCsv(text),output={};
 for(const row of source){
  const id=row[info.primaryKey];
  if(!id)throw new Error(kind+': source row missing ID');
  if(Object.hasOwn(output,id))throw new Error(kind+': duplicate ID '+id);
  if(kind==='spells'&&!PLAYABLE_SPELL_IDS.includes(id))continue;
  if(kind==='pets'||kind==='seasonPets')
   output[id]=Object.fromEntries(Object.entries(PET_FIELDS).map(([key,column])=>[key,row[column]]));
  else output[id]=Object.fromEntries(Object.entries(row).filter(([key])=>key!==info.primaryKey));
 }
 return output;
}
export function compareRows(expected,actual,maxIssues=40){
 const issues=[];
 for(const id of new Set([...Object.keys(expected),...Object.keys(actual)])){
  if(!Object.hasOwn(expected,id)){issues.push(id+': missing in extracted source');continue;}
  if(!Object.hasOwn(actual,id)){issues.push(id+': missing in vendored catalog');continue;}
  for(const field of new Set([...Object.keys(expected[id]),...Object.keys(actual[id])])){
   if(canonicalValue(expected[id][field])!==canonicalValue(actual[id][field]))
    issues.push(id+'.'+field+': game='+JSON.stringify(expected[id][field])+', vendor='+JSON.stringify(actual[id][field]));
   if(issues.length>=maxIssues)return issues;
  }
 }
 return issues;
}
export async function auditUnityDirectory(directory,our=vendorRows()){
 const issues=[];
 for(const [kind,info] of Object.entries(UNITY_84_SNAPSHOT)){
  const path=join(directory,info.file);
  const data=await readFile(path,'utf8');
  const source=readSourceRows(kind,data);
  const fileDigest=sha256(data.replace(/^\uFEFF/,'').length?data:data);
  const sourceDigest=digestRows(source);
  if(sourceDigest!==info.sha256)issues.push(kind+': game snapshot changed ('+sourceDigest+')');
  if(fileDigest!==info.sourceSha256)issues.push(kind+': source CSV bytes changed; inspect for version drift');
  issues.push(...compareRows(source,our[kind]).map(diff=>kind+': '+diff));
 }
 return {ok:issues.length===0,issues};
}
export async function main(args=process.argv.slice(2)){
 const pos=args.indexOf('--unity-dir');
 if(args.some((a,i)=>a!=='--unity-dir'&&i!==pos+1)){
  console.error('Usage: npm run check:data -- [--unity-dir path/to/extracted/tables]');
  return 2;
 }
 if(pos>=0&&!args[pos+1]){
  console.error('Missing --unity-dir directory');return 2;
 }
 const embedded=auditSnapshot();
 if(!embedded.ok){console.error(embedded.issues.join('\n'));return 1;}
 if(pos<0){
  console.log('OK: 72 skills, 11 playable spells, 30 legacy pets, 15 seasonal pets match the independently extracted TT2 8.4 Unity snapshot. No network access required.');
  return 0;
 }
 try{
  const verified=await auditUnityDirectory(args[pos+1]);
  if(!verified.ok){console.error(verified.issues.slice(0,40).join('\n'));return 1;}
  console.log('OK: independent TT2 8.4 Unity CSVs match all four vendored catalog projections.');
  return 0;
 }catch(e){console.error('Unable to read TT2 Unity source: '+e.message);return 2;}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])
 process.exitCode=await main();