/**
 * 8.4 hero-weapon baseline. The 37-hero full-set effect is All Hero Damage;
 * individual weapon effects and amplifier dependencies remain unverified.
 */
import {heroWeaponEvidence} from "./account-temporal.js";
import {ARTIFACT_CATALOG,EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js";
const BOOST_IDS=["Artifact71","Artifact91","Artifact92","Artifact93"];
export function heroProgressionEvidence(profile,artifactEffects=null){
 const weapons=heroWeaponEvidence(profile),artifactRows=artifactEffects?.entries||[];
 const artifactBoosters=BOOST_IDS.map(id=>{
  const data=ARTIFACT_CATALOG[id],effect=artifactRows.find(x=>x.id===id);
  const owned=(profile?.sections?.artifacts?.records||[]).some(x=>
   [id,data?.name].some(name=>String(x.id).toLowerCase()===String(name).toLowerCase())&&
   x.owned!==false&&x.salvaged!==true);
  return {id,name:data?.name||id,owned,
   effectLog10:Number.isFinite(effect?.log10)?effect.log10:null,applied:false};
 });
 const completed=new Set(profile?.ownedSetIds||[]);
 const mythicBoosts=["MythicSmith","ScrollTutor"].map(id=>({
  id,owned:completed.has(id)&&profile?.sections?.equipmentSets?.truncated!==true,
  types:EQUIPMENT_SET_CATALOG[id]?.bonuses?.filter(x=>
   /HelperWeapon|ClanScroll/.test(x.type)).map(x=>x.type)||[],applied:false
 }));
 const sets=weapons.completeRosterVerified?weapons.completeSets:null;
 const entries=sets>0?[{system:"heroWeapons",id:"full-hero-weapon-sets",
  bonusType:"AllHelperDamage",level:sets,log10:sets*Math.log10(5),
  conservative:true,source:"37-hero full weapon set ×5 All Hero Damage"}]:[];
 const unresolved=[];
 if(profile?.sections?.heroWeapons?.present&&sets===null)
  unresolved.push("unverified-37-hero-weapon-roster");
 if(weapons.uniqueKnownHeroes>0)
  unresolved.push("per-hero-weapon-levels-require-dominant-hero-and-ascension");
 if(artifactBoosters.some(x=>x.owned)||mythicBoosts.some(x=>x.owned))
  unresolved.push("unverified-hero-weapon-and-scroll-amplifiers");
 return {weapons,entries,unresolved,artifactBoosters,mythicBoosts,
  baseSetLog10:sets===null?null:sets*Math.log10(5),
  individualWeaponsScored:false,amplifiersScored:false,complete:false};
}
