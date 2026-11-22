import {CLAN_SCROLLS} from "../vendor/clan-scrolls.js?v=20261122-combat-window-r1";
import {ARTIFACT_CATALOG,EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js?v=20261122-combat-window-r1";
import {calculatePermanentArtifactEffects} from "./account-artifacts.js?v=20261122-combat-window-r1";
/** Source-backed capped boosters: Quill targets individual scroll effects,
 * Stamp the completed-scroll-set fraction. Additive resource scrolls are
 * excluded. Dragon Weaver's additive +25% applies only to an
 * amplifier lane without a competing Quill / Stamp; cross-stacking still
 * requires proof. */
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
 const rows=["ClanScrollBoost","ClanScrollSetBoost"].map(type=>
  set?.bonuses?.filter(x=>x.type===type)||[]);
 const amounts=rows.map(matches=>matches.length===1?matches[0].amount:null);
 // Official Dragon Weaver (7.4): +25%, not x0.25.
 // Match the exact source rows, never treat an additive amount as a factor.
 const verified=owned&&rows.every(matches=>matches.length===1&&
  matches[0].amount==="0.25"&&matches[0].inc==="1"&&
  matches[0].expo==="1");
 return {owned,verified,displayName:"Dragon Weaver",amounts,
  individualFactor:verified?1+Number(amounts[0]):1,
  setFactor:verified?1+Number(amounts[1]):1,
  appliedToIndividual:false,appliedToSet:false,applied:false,
  source:"Game Hive v7.4 + TT2 8.4 ScrollTutor additive rows",
  status:verified?"additive-25-percent-verified":owned?
   "unverified-dragon-weaver-source":"not-proven-owned"};
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
 // We can compute the +25% standalone in each independent lane. When
 // Quill or Stamp is owned, the source does not prove whether +25% is added
 // before or after their respective artifact multiplier: retain the
 // already-proven artifact lane and diagnose the missing cross stack.
 const useTutorIndividual=scrollTutor.verified&&!quill.owned;
 const useTutorSet=scrollTutor.verified&&!stamp.owned;
 const individualFactor=quill.factor*(useTutorIndividual?scrollTutor.individualFactor:1);
 const setFactor=stamp.factor*(useTutorSet?scrollTutor.setFactor:1);
 const enhancedSetBonusPercent=setBonusPercent===null?null:setBonusPercent*setFactor;
 const boostedEntries=(truncated?[]:entries).map(entry=>{
  const perScroll=entry.log10===null?null:entry.log10*individualFactor;
  return {...entry,quillBoostedLog10:perScroll,
   setBoostedLog10:perScroll===null?null:
    perScroll*(1+(enhancedSetBonusPercent??0)),
   scrollArtifactBoostModeled:perScroll!==null&&
    (quill.verified||(stamp.verified&&fullSets!==null&&fullSets>0)||
     useTutorIndividual||(useTutorSet&&fullSets!==null&&fullSets>0))};
 });
 scrollTutor.appliedToIndividual=useTutorIndividual&&boostedEntries.some(x=>x.log10!==null);
 scrollTutor.appliedToSet=useTutorSet&&fullSets!==null&&fullSets>0&&
  boostedEntries.some(x=>x.log10!==null);
 scrollTutor.applied=scrollTutor.appliedToIndividual||scrollTutor.appliedToSet;
 scrollTutor.status=!scrollTutor.owned?"not-proven-owned":!scrollTutor.verified?
  "unverified-dragon-weaver-source":(quill.owned||stamp.owned)?
  "partial-additive-lane-cross-stack-unknown":"verified-standalone-25-percent";
 quill.applied=quill.verified&&boostedEntries.some(x=>x.log10!==null);
 stamp.applied=stamp.verified&&fullSets!==null&&fullSets>0&&
  boostedEntries.some(x=>x.log10!==null);
 if(truncated)unknown.push({id:"*",reason:"truncated-scroll-export"});
 if(scrollTutor.owned&&!scrollTutor.verified)unknown.push({id:"ScrollTutor",reason:"unverified-dragon-weaver-source"});
 if(scrollTutor.owned&&scrollTutor.verified&&(quill.owned||stamp.owned))
  unknown.push({id:"ScrollTutor",reason:"dragon-weaver-artifact-cross-stack-unverified"});
 if(quill.owned&&!quill.verified)unknown.push({id:quill.id,reason:"unverified-scroll-amplifier"});
 if(stamp.owned&&!stamp.verified)unknown.push({id:stamp.id,reason:"unverified-scroll-set-amplifier"});
 return {entries:boostedEntries,unknown,completeRoster,fullSets,
  setBonusPercent,enhancedSetBonusPercent,truncated,quill,stamp,scrollTutor,
  setBonusSource:"TT2 6.5 Clan Scroll rework, 8.4 source rows",
  setBoostModeled:completeRoster,boostsModeled:quill.applied||stamp.applied||scrollTutor.applied,
  boostStackComplete:(!scrollTutor.owned||(scrollTutor.verified&&!quill.owned&&!stamp.owned))&&
   !effects.truncated&&(!quill.owned||quill.verified)&&(!stamp.owned||stamp.verified),
  totalLevels:entries.reduce((a,e)=>a+e.level,0),complete:false};
}
