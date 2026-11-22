import {HERO_ROSTER} from "../vendor/hero-roster.js?v=20261122-boss-push-r1";
/**
 * TT2 date evidence. No player-entered dates and no inferred set ages.
 * A set is completed upon acquisition of its fifth distinct equipment slot.
 * Rebuild that date ONLY from explicit completion metadata or a preserved
 * historical acquisition log. Current inventory may consist of re-acquired
 * pieces and cannot establish when the set first became complete.
 */
export const OFFICIAL_TRANSCENDENCE_STARTS=Object.freeze({
 "13":"2026-08-12" // Game Hive DevLog #231, August 11, 2026
});
// E9 is a COMMUNITY calendar, NOT a developer-confirmed end timestamp.
// Interpret "Ends Nov 24" conservatively as the WHOLE day inclusive,
// and require a fresh season export from Nov 25 00:00 UTC onward.
// https://e9wiki.com/tt2/en (checked 2026-11-20)
export const ESTIMATED_TRANSCENDENCE_ENDS=Object.freeze({
 "13":"2026-11-24"
});
const DAY_MS=86400000;
const SLOT_NAMES=Object.freeze({
 weapon:"Weapon",sword:"Weapon",hat:"Hat",helmet:"Hat",
 suit:"Suit",armor:"Suit",aura:"Aura",slash:"Slash"
});
const SLOTS=["Weapon","Hat","Suit","Aura","Slash"];
function epoch(value){
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))return null;
 const result=Date.parse(value);
 return Number.isFinite(result)?result:null;
}
function ageOf(when,now){
 const start=epoch(when);
 if(start===null||!Number.isFinite(now)||start>now)return null;
 return Math.floor((now-start)/DAY_MS);
}
export function resolveTranscendenceAge(profile,at=new Date()){
 const now=at instanceof Date?at.getTime():epoch(at);
 const fromExport=profile?.dates?.transcendenceStartedAt;
 const season=String(profile?.stats?.transcendenceSeason??"");
 const fromOfficial=OFFICIAL_TRANSCENDENCE_STARTS[season]||null;
 const began=fromExport||fromOfficial;
 const days=ageOf(began,now);
 const estimatedEndDate=ESTIMATED_TRANSCENDENCE_ENDS[season]||null;
 // End date from E9 is unofficial. Do not assert in-game certainty,
 // but never silently carry a possibly obsolete season's multipliers
 // indefinitely into later seasons.
 const endExclusive=estimatedEndDate?
  Date.parse(estimatedEndDate+"T00:00:00Z")+DAY_MS:null;
 const estimatedSeasonEnded=endExclusive!==null&&
  Number.isFinite(now)&&now>=endExclusive;
 return {days,
  source:days===null?null:fromExport?"export":"official-season-calendar",
  season:season||null,estimatedEndDate,estimatedSeasonEnded,
  endDateSource:estimatedEndDate?"community-e9wiki-unofficial":null,
  expirationOfficiallyConfirmed:false};
}
export function resolveSetCompletionDates(profile,at=new Date()){
 const now=at instanceof Date?at.getTime():epoch(at);
 const result=Object.create(null);
 const sets=profile?.sections?.equipmentSets?.records||[];
 const equipment=profile?.sections?.equipmentHistory?.records||[];
 const examined=new Set();
 for(const row of sets){
  const id=String(row.id);
  if(examined.has(id))continue;
  examined.add(id);
  const matches=sets.filter(item=>String(item.id)===id);
  const directDates=[...new Map(matches.filter(item=>item.completedAt)
   .map(item=>[epoch(item.completedAt),item.completedAt])).values()];
  const multipleDates=directDates.length>1;
  // Only immutable first-acquisition history is evidence after item sales.
  // Present-day equipped/owned gear deliberately does not participate.
  const pieces=equipment.filter(piece=>String(piece.setId??"")===id);
  const slots=new Map();
  let allDated=true;
  for(const piece of pieces){
   const slot=SLOT_NAMES[String(piece.slot||"").toLowerCase()];
   const t=epoch(piece.acquiredAt);
   if(!slot||t===null){allDated=false;continue;}
   slots.set(slot,Math.min(slots.get(slot)??Infinity,t));
  }
  const five=allDated&&pieces.length>=5&&SLOTS.every(s=>slots.has(s));
  const derived=five?new Date(Math.max(...SLOTS.map(s=>slots.get(s)))).toISOString():null;
  const direct=multipleDates?null:directDates[0]||null;
  const conflict=multipleDates||Boolean(direct&&derived&&epoch(direct)!==epoch(derived));
  const completedAt=conflict?null:derived||direct;
  const days=ageOf(completedAt,now);
  result[id]={completedAt:days===null?null:completedAt,days,
   source:days===null?null:derived?"five-historical-acquisitions":"export-set-completion",
   unresolved:conflict?"conflicting-export-dates":days===null?"missing-or-future-set-completion-date":null};
 }
 return result;
}
export function heroWeaponEvidence(profile){
 const source=profile?.sections?.heroWeapons?.records||[];
 const heroIds=new Set(HERO_ROSTER),seen=new Map(),unknownHeroIds=[],duplicates=[];
 const known=source.filter(r=>r.level!==undefined&&r.level!==null&&
  String(r.level).trim()!==""&&Number.isSafeInteger(Number(r.level))&&
  Number(r.level)>=0&&Number(r.level)<=100000);
 for(const row of known){
  const key=String(row.id).toUpperCase();
  if(!heroIds.has(key)){unknownHeroIds.push(row.id);continue;}
  if(seen.has(key)){duplicates.push(key);continue;}
  seen.set(key,Number(row.level));
 }
 // Full sets require a distinct unambiguous complete active-hero roster.
 for(const id of duplicates)seen.delete(id);
 const truncated=profile?.sections?.heroWeapons?.truncated===true;
 const completeRosterVerified=profile?.sections?.heroWeapons?.present===true&&
  !truncated&&duplicates.length===0&&unknownHeroIds.length===0&&
  source.length===HERO_ROSTER.length&&HERO_ROSTER.every(id=>seen.has(id));
 // Each complete set requires all 37 hero weapons at that level.
 const completeSets=completeRosterVerified?Math.min(...HERO_ROSTER.map(id=>seen.get(id))):null;
 const individual=HERO_ROSTER.filter(id=>seen.has(id)).map(id=>({
  id,level:seen.get(id),unboostedHeroLog10:seen.get(id)*Math.log10(1.5)
 }));
 return {ownedHeroes:known.filter(r=>Number(r.level)>0).length,
  totalRecorded:source.length,unknownLevels:source.length-known.length,
  totalWeaponLevels:known.reduce((a,r)=>a+Number(r.level),0),
  uniqueKnownHeroes:seen.size,requiredHeroCount:HERO_ROSTER.length,
  missingHeroes:HERO_ROSTER.length-seen.size,unknownHeroIds,duplicates,
  completeSets,completeRosterVerified,truncated,invalidLevels:source.length-known.length,
  // A full set gives ×5 base hero damage. Weapon level ×1.5 per hero.
  // These are NOT added as independent AllDamage: effective hero power,
  // Morgelai Sword/Ringing Stone enhancements and source reductions matter.
  unboostedFullSetLog10:completeSets===null?null:completeSets*Math.log10(5),
  individual,boostsModeled:false,complete:false};
}
