import {CLAN_SCROLLS} from "../vendor/clan-scrolls.js";
/** Permanent scroll levels; no estimates from account-wide totals. */
export function clanScrollEvidence(profile){
 const levels=new Map(),unknown=[],duplicateIds=new Set();
 const index=new Map(CLAN_SCROLLS.map(x=>[x.id.toLowerCase(),x]));
 for(const item of profile?.sections?.clanScrolls?.records||[]){
  const row=index.get(String(item.id).toLowerCase()),level=Number(item.level);
  if(!row||!Number.isSafeInteger(level)||level<0||level>100000){
   unknown.push({id:item.id,reason:"unrecognized-or-invalid-level"});continue;
  }
  if(levels.has(row.id)){duplicateIds.add(row.id);unknown.push({id:item.id,reason:"duplicate-source-id"});continue;}
  levels.set(row.id,level);
 }
 // Never trust the first duplicate entry: the export could contain
 // contradictory levels. An incomplete roster cannot yield full-set boosts.
 for(const id of duplicateIds)levels.delete(id);
 const entries=CLAN_SCROLLS.filter(x=>levels.has(x.id)).map(x=>{
  const level=levels.get(x.id);
  return {...x,level,log10:x.isAdditive?null:level*Math.log10(x.bonusAmount)};
 });
 const truncated=profile?.sections?.clanScrolls?.truncated===true;
 const completeRoster=!truncated&&unknown.length===0&&entries.length===CLAN_SCROLLS.length;
 const fullSets=completeRoster?Math.min(...entries.map(x=>x.level)):null;
 // Full set #1 gives +5%; each further complete set adds +10%.
 // Ref: Tap Titans 2 Wiki / Heroes / Clan Scrolls, updated after 6.5 rework.
 // For multiplicative effects the set boost multiplies the exponent:
 // rawBonus^(1 + setBonusPercent). Additive effects need a separate model.
 const setBonusPercent=fullSets===null?null:
  fullSets===0?0:0.05+Math.max(0,fullSets-1)*0.10;
 const boostedEntries=(truncated?[]:entries).map(entry=>({
  ...entry,setBoostedLog10:entry.log10===null||setBonusPercent===null
   ?null:entry.log10*(1+setBonusPercent)
 }));
 if(truncated)unknown.push({id:"*",reason:"truncated-scroll-export"});
 return {entries:boostedEntries,unknown,completeRoster,fullSets,setBonusPercent,truncated,
  setBonusSource:"TT2 Wiki - Heroes/Clan Scrolls (post 6.5)",
  // The set boost is modeled when all 18 levels are known, but artifact
  // and equipment amplification (Quill, Old King's Stamp, ScrollTutor)
  // still requires additional formulas and account input.
  setBoostModeled:completeRoster,boostsModeled:false,
  totalLevels:entries.reduce((a,e)=>a+e.level,0),complete:false};
}
