/**
 * TT2 date evidence. No player-entered dates and no inferred set ages.
 * A set is completed upon acquisition of its fifth distinct equipment slot.
 */
export const OFFICIAL_TRANSCENDENCE_STARTS=Object.freeze({
 "13":"2026-08-12" // Game Hive DevLog #231, August 11, 2026
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
 return {days,source:days===null?null:fromExport?"export":"official-season-calendar",season:season||null};
}
export function resolveSetCompletionDates(profile,at=new Date()){
 const now=at instanceof Date?at.getTime():epoch(at);
 const result=Object.create(null);
 const sets=profile?.sections?.equipmentSets?.records||[];
 const equipment=profile?.sections?.equipmentInventory?.records||[];
 for(const row of sets){
  const id=String(row.id);
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
  const direct=row.completedAt||null;
  const conflict=direct&&derived&&epoch(direct)!==epoch(derived);
  const completedAt=conflict?null:derived||direct;
  const days=ageOf(completedAt,now);
  result[id]={completedAt:days===null?null:completedAt,days,
   source:days===null?null:derived?"five-equipment-acquisitions":"export-set-completion",
   unresolved:conflict?"conflicting-export-dates":days===null?"missing-or-future-set-completion-date":null};
 }
 return result;
}
export function heroWeaponEvidence(profile){
 const rows=profile?.sections?.heroWeapons?.records||[];
 const known=rows.filter(r=>Number.isSafeInteger(Number(r.level))&&Number(r.level)>=0);
 return {ownedHeroes:known.filter(r=>Number(r.level)>0).length,
  totalRecorded:rows.length,unknownLevels:rows.length-known.length,
  totalWeaponLevels:known.reduce((a,r)=>a+Number(r.level),0),
  completeSets:null,completeRosterVerified:false};
}
