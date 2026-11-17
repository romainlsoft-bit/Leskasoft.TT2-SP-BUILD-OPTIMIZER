import {CLAN_SCROLLS} from "../vendor/clan-scrolls.js";
import {ARTIFACT_CATALOG,EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js";
import {calculatePermanentArtifactEffects} from "./account-artifacts.js";
/** Source-backed capped boosters: Quill targets individual scroll effects,
 * Stamp the completed-scroll-set fraction. Additive resource scrolls are
 * excluded, and ScrollTutor stacking remains unverified. */
function artifactBoost(profile,effects,id,type){
 const data=ARTIFACT_CATALOG[id],row=effects?.entries?.find(x=>x.id===id);
 const owned=(profile?.sections?.artifacts?.records||[]).some(x=>
  [id,data?.name].some(n=>String(x.id).toLowerCase()===String(n).toLowerCase())&&
  x.salvaged!==true&&x.owned!==false);
 const verified=owned&&!effects?.truncated&&row?.bonusType===type&&
  row.status==="computed-unscored-interaction"&&row.level!==null&&
  Number.isFinite(row.log10)&&row.log10>=0;
 return {id,owned,verified,factor:verified?10**row.log10:1,
  applied:false,status:verified?"source-main-effect":owned?
   "unverified-artifact-source":"not-owned-or-unknown"};
}
function scrollTutorEvidence(profile){
 const owned=profile?.sections?.equipmentSets?.present===true&&
  profile.sections.equipmentSets.truncated!==true&&
  (profile?.ownedSetIds||[]).includes("ScrollTutor");
 const set=EQUIPMENT_SET_CATALOG.ScrollTutor;
 const amounts=["ClanScrollBoost","ClanScrollSetBoost"].map(type=>
  set?.bonuses?.find(x=>x.type===type)?.amount??null);
 return {owned,amounts,applied:false,status:owned?
  "additive-stack-order-not-verified":"not-proven-owned"};
}
export function clanScrollEvidence(profile,artifactEffects=null){
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
 for(const id of duplicateIds)levels.delete(id);
 const entries=CLAN_SCROLLS.filter(x=>levels.has(x.id)).map(x=>{
  const level=levels.get(x.id);
  return {...x,level,log10:x.isAdditive?null:level*Math.log10(x.bonusAmount)};
 });
 const truncated=profile?.sections?.clanScrolls?.truncated===true;
 const completeRoster=!truncated&&unknown.length===0&&entries.length===CLAN_SCROLLS.length;
 const fullSets=completeRoster?Math.min(...entries.map(x=>x.level)):null;
 const setBonusPercent=fullSets===null?null:
  fullSets===0?0:0.05+Math.max(0,fullSets-1)*0.10;
 const effects=artifactEffects??calculatePermanentArtifactEffects(profile,ARTIFACT_CATALOG);
 const quill=artifactBoost(profile,effects,"Artifact92","ClanScrollBoost");
 const stamp=artifactBoost(profile,effects,"Artifact93","ClanScrollSetBoost");
 const scrollTutor=scrollTutorEvidence(profile);
 const enhancedSetBonusPercent=setBonusPercent===null?null:setBonusPercent*stamp.factor;
 const boostedEntries=(truncated?[]:entries).map(entry=>{
  const perScroll=entry.log10===null?null:entry.log10*quill.factor;
  return {...entry,quillBoostedLog10:perScroll,
   setBoostedLog10:perScroll===null?null:
    perScroll*(1+(enhancedSetBonusPercent??0)),
   scrollArtifactBoostModeled:perScroll!==null&&
    (quill.verified||(stamp.verified&&fullSets!==null&&fullSets>0))};
 });
 quill.applied=quill.verified&&boostedEntries.some(x=>x.log10!==null);
 stamp.applied=stamp.verified&&fullSets!==null&&fullSets>0&&
  boostedEntries.some(x=>x.log10!==null);
 if(truncated)unknown.push({id:"*",reason:"truncated-scroll-export"});
 if(scrollTutor.owned)unknown.push({id:"ScrollTutor",reason:"additive-booster-order-unverified"});
 if(quill.owned&&!quill.verified)unknown.push({id:quill.id,reason:"unverified-scroll-amplifier"});
 if(stamp.owned&&!stamp.verified)unknown.push({id:stamp.id,reason:"unverified-scroll-set-amplifier"});
 return {entries:boostedEntries,unknown,completeRoster,fullSets,
  setBonusPercent,enhancedSetBonusPercent,truncated,quill,stamp,scrollTutor,
  setBonusSource:"TT2 6.5 Clan Scroll rework, 8.4 source rows",
  setBoostModeled:completeRoster,boostsModeled:quill.applied||stamp.applied,
  boostStackComplete:!scrollTutor.owned&&!effects.truncated&&
   (!quill.owned||quill.verified)&&(!stamp.owned||stamp.verified),
  totalLevels:entries.reduce((a,e)=>a+e.level,0),complete:false};
}
