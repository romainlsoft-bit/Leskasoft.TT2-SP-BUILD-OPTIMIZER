/**
 * Canonical pet levels from the sanitized TT2 account export.
 *
 * An export can contain the same pet by ID and display name. Equal values
 * are one observation, NOT two bonuses. Contradictory or invalid observations
 * exclude the entire pet rather than silently using the last entry.
 *
 * No levels are inferred from total-pet statistics, previous Transcendence
 * seasons, or old cached account data.
 */
import {PETS} from "../vendor/pets.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {TRANSCENDENT_PETS} from "../vendor/transcendent-pets.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";

const MAX_PET_LEVEL=100000;
const ALL=Object.freeze({...PETS,...TRANSCENDENT_PETS});
const BY_NAME=new Map(Object.values(ALL).flatMap(pet=>[
 [pet.id.toLowerCase(),pet.id],[pet.name.toLowerCase(),pet.id]
]));
const cache=new WeakMap();

function parseLevel(raw){
 if((typeof raw!=="number"&&typeof raw!=="string")||
    (typeof raw==="string"&&!raw.trim()))return null;
 const n=Number(raw);
 return Number.isSafeInteger(n)&&n>=0&&n<=MAX_PET_LEVEL?n:null;
}

export function petLevelEvidence(profile){
 const section=profile?.sections?.petLevels;
 if(profile&&typeof profile==="object"&&cache.has(profile))
  return cache.get(profile);
 const records=Array.isArray(section?.records)?section.records:[];
 const groups=new Map(),rejected=[];
 for(const record of records){
  const raw=String(record?.id??"").trim();
  const id=BY_NAME.get(raw.toLowerCase());
  if(!id){
   rejected.push({id:raw.slice(0,90),reason:"unknown-pet-id"});
   continue;
  }
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(record.level);
 }
 const levels=Object.create(null);
 let duplicateMirrors=0;
 for(const [id,values] of groups){
  const parsed=values.map(parseLevel);
  if(parsed.some(level=>level===null)){
   rejected.push({id,reason:"invalid-pet-level"});
   continue;
  }
  if(new Set(parsed).size!==1){
   rejected.push({id,reason:"conflicting-pet-levels"});
   continue;
  }
  levels[id]=parsed[0];
  duplicateMirrors+=values.length-1;
 }
 if(section?.truncated===true){
  // Any of the omitted rows might contradict a previously parsed pet.
  // A truncated collection is not safe evidence for numerical scoring.
  for(const id of Object.keys(levels))delete levels[id];
  duplicateMirrors=0;
  rejected.push({id:"petLevels",reason:"truncated-pet-export"});
 }
 const evidence={levels,rejected,duplicateMirrors,
  recognized:Object.keys(levels).length,
  sectionPresent:section?.present===true,
  trustworthy:section?.present===true&&rejected.length===0};
 if(profile&&typeof profile==="object")cache.set(profile,evidence);
 return evidence;
}
