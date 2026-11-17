/**
 * 8.4 hero-weapon baseline. The 37-hero full-set effect is All Hero Damage;
 * individual weapon effects and amplifier dependencies remain unverified.
 */
import {heroWeaponEvidence} from "./account-temporal.js";
import {HERO_CLASS_BY_ID} from "../vendor/hero-classes.js";
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
 // Level-50 Ringing or Morgelai: (1+0.01*50)=1.5 applied to the
 // respective underlying ×5 set / ×1.5 individual weapon factor.
 const booster=id=>{
  const b=artifactBoosters.find(x=>x.id===id);
  const row=artifactRows.find(x=>x.id===id);
  const valid=!artifactEffects?.truncated&&b?.owned===true&&
   Number.isFinite(row?.log10)&&row.log10>=0&&row.level!==null&&
   row.status==="computed-unscored-interaction";
  return {id,factor:valid?10**row.log10:1,verified:valid,
   status:valid?"source-effect":b?.owned?"unverified-amplifier":"absent-or-unknown"};
 };
 const ringing=booster("Artifact91"),morgelai=booster("Artifact71");
 const individual=weapons.individual.map(w=>({
  id:w.id,heroClass:HERO_CLASS_BY_ID[w.id]??null,level:w.level,
  baseWeaponLog10:w.unboostedHeroLog10,
  boostedWeaponLog10:w.level*Math.log10(1.5*morgelai.factor),
  modeledIndividually:true,inGlobalDamageScore:false
 }));
 const strongest=profile?.dominantHero??{id:null,heroClass:null,verified:false,status:"not-exported"};
 const entries=sets>0?[{system:"heroWeapons",id:"full-hero-weapon-sets",
  bonusType:"BaseHeroDamage",level:sets,log10:sets*Math.log10(5*ringing.factor),
  conservative:true,source:"37-hero full weapon set ×5 All Hero Damage"}]:[];
 const unresolved=[];
 if(ringing.status==="unverified-amplifier"||morgelai.status==="unverified-amplifier")
  unresolved.push("unverified-artifact-amplifier");
 if(individual.length&&!strongest.verified)
  unresolved.push("unknown-dominant-hero");
 if(profile?.sections?.heroWeapons?.present&&sets===null)
  unresolved.push("unverified-37-hero-weapon-roster");
 if(weapons.uniqueKnownHeroes>0)
  unresolved.push("per-hero-weapon-levels-require-dominant-hero-and-ascension");
 if(artifactBoosters.some(x=>x.owned)||mythicBoosts.some(x=>x.owned))
  unresolved.push("unverified-hero-weapon-and-scroll-amplifiers");
 return {weapons,entries,unresolved,artifactBoosters,mythicBoosts,
  ringing,morgelai,individual,strongest,
  baseSetLog10:sets===null?null:sets*Math.log10(5*ringing.factor),
  individualWeaponsScored:false,amplifiersScored:ringing.verified&&sets>0,
  complete:false};
}
