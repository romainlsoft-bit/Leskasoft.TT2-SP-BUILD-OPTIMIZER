/**
 * Source-limited optional per-hero snapshots. Current DPS may already include
 * hero weapons and the equipped helmet, so this diagnostic is NEVER a new
 * fixed-score damage multiplier or a basis for claiming a new optimal helmet.
 */
import {HERO_ROSTER} from "../vendor/hero-roster.js?v=20261120-math-safety-r3";
import {HERO_CLASS_BY_ID} from "../vendor/hero-classes.js?v=20261120-math-safety-r3";
import {positiveLog10} from "./account-artifacts.js?v=20261120-math-safety-r3";
const ZERO=/^\+?(?:0+(?:\.0*)?|\.0+)(?:[Ee][+-]?\d+)?$/;
export function heroLevelEvidence(profile){
 const section=profile?.sections?.heroLevels;
 const rows=section?.records||[];
 const seen=new Map(),duplicates=new Set(),invalid=[],unknown=[];
 const roster=new Set(HERO_ROSTER);
 for(const row of rows){
  const id=String(row.id??"").toUpperCase();
  if(!roster.has(id)){unknown.push(id);continue;}
  if(seen.has(id)){duplicates.add(id);continue;}
  const level=Number(row.level),ascension=Number(row.ascension);
  // Caps are validation fences, not proof of a 8.4 ascension formula.
  const validLevel=row.level!==undefined&&row.level!==""&&
   Number.isSafeInteger(level)&&level>=0&&level<=6000;
  const validAscension=row.ascension!==undefined&&row.ascension!==""&&
   Number.isSafeInteger(ascension)&&ascension>=0&&ascension<=1000000;
  const dps=row.dps===undefined?null:ZERO.test(String(row.dps).trim())?
   -Infinity:positiveLog10(row.dps);
  if(!validLevel||!validAscension||row.dps!==undefined&&dps===null)
   invalid.push(id);
  seen.set(id,{id,heroClass:HERO_CLASS_BY_ID[id],level:validLevel?level:null,
   ascension:validAscension?ascension:null,currentDpsLog10:dps,
   valid:validLevel&&validAscension});
 }
 for(const id of duplicates){seen.delete(id);invalid.push(id);}
 const parsed=[...seen.values()];
 const completeRoster=section?.present===true&&section.truncated!==true&&
  rows.length===HERO_ROSTER.length&&unknown.length===0&&duplicates.size===0&&
  invalid.length===0&&parsed.length===HERO_ROSTER.length&&parsed.every(x=>x.valid);
 const dpsComplete=completeRoster&&parsed.every(x=>x.currentDpsLog10!==null);
 let totalCurrentDpsLog10=null,classShares=null,currentTopHero=null;
 if(dpsComplete){
  const peak=Math.max(...parsed.map(x=>x.currentDpsLog10));
  if(Number.isFinite(peak)){
   const relative=parsed.map(x=>10**(x.currentDpsLog10-peak));
   const sum=relative.reduce((a,x)=>a+x,0);
   totalCurrentDpsLog10=peak+Math.log10(sum);
   classShares=Object.fromEntries(["Melee","Ranged","Spell"].map(kind=>
    [kind,parsed.reduce((a,x,i)=>a+(x.heroClass===kind?relative[i]:0),0)/sum]));
   currentTopHero=parsed.reduce((a,x)=>x.currentDpsLog10>a.currentDpsLog10?x:a).id;
  }
 }
 const dominant=profile?.dominantHero?.id??null;
 const dominantConflict=Boolean(dominant&&currentTopHero&&dominant!==currentTopHero);
 return {present:section?.present===true,truncated:section?.truncated===true,
  completeRoster,dpsComplete,parsedCount:parsed.length,invalid,unknown,
  duplicates:[...duplicates],missing:HERO_ROSTER.length-parsed.length,
  entries:parsed,totalCurrentDpsLog10,classShares,currentTopHero,
  dominantConflict,scored:false,reason:"current-DPS-already-contains-weapon-and-gear",
  complete:false};
}
