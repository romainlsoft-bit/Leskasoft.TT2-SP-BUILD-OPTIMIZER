import {CLAN_SCROLLS} from "../vendor/clan-scrolls.js";
/** Permanent scroll levels; no estimates from account-wide totals. */
export function clanScrollEvidence(profile){
 const levels=new Map(),unknown=[];
 const index=new Map(CLAN_SCROLLS.map(x=>[x.id.toLowerCase(),x]));
 for(const item of profile?.sections?.clanScrolls?.records||[]){
  const row=index.get(String(item.id).toLowerCase()),level=Number(item.level);
  if(!row||!Number.isSafeInteger(level)||level<0||level>100000){
   unknown.push({id:item.id,reason:"unrecognized-or-invalid-level"});continue;
  }
  if(levels.has(row.id)){unknown.push({id:item.id,reason:"duplicate"});continue;}
  levels.set(row.id,level);
 }
 const entries=CLAN_SCROLLS.filter(x=>levels.has(x.id)).map(x=>{
  const level=levels.get(x.id);
  return {...x,level,log10:x.isAdditive?null:level*Math.log10(x.bonusAmount)};
 });
 const completeRoster=entries.length===CLAN_SCROLLS.length;
 return {entries,unknown,completeRoster,fullSets:completeRoster?Math.min(...entries.map(x=>x.level)):null,
  totalLevels:entries.reduce((a,e)=>a+e.level,0),boostsModeled:false,complete:false};
}
