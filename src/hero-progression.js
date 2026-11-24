/**
 * TT2 8.4: source-backed weapon sets, per-hero weapon boosters and
 * conditional effects. Per-hero DPS requires verified ascensions/levels.
 */
import {heroWeaponEvidence} from "./account-temporal.js?v=20261123-boss-specials-r1&season=20261124-end-season13-r1";
import {HERO_CLASS_BY_ID} from "../vendor/hero-classes.js?v=20261123-boss-specials-r1";
import {heroLevelEvidence} from "./hero-levels.js?v=20261123-boss-specials-r1";
import {equipmentSetAliasEvidence} from "./equipment-set-aliases.js?v=20261123-boss-specials-r1";
import {ARTIFACT_CATALOG,EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js?v=20261123-boss-specials-r1";
const BOOST_IDS=["Artifact71","Artifact91","Artifact92","Artifact93"];
function artifactFactor(id,profile,effects){
 const info=ARTIFACT_CATALOG[id];
 const owned=(profile?.sections?.artifacts?.records||[]).some(x=>
  [id,info?.name].some(name=>String(x.id).toLowerCase()===String(name).toLowerCase())&&
  x.owned!==false&&x.salvaged!==true);
 const row=effects?.entries?.find(x=>x.id===id);
 const verified=owned&&!effects?.truncated&&
  row?.status==="computed-unscored-interaction"&&
  row.level!==null&&Number.isFinite(row.log10)&&row.log10>=0&&
  row.bonusType===info?.bonusType;
 return {id,name:info?.name??id,owned,verified,
  factor:verified?10**row.log10:1,applied:false,
  effectLog10:Number.isFinite(row?.log10)?row.log10:null,
  status:verified?"source-effect":owned?"unverified-amplifier":"absent-or-unknown"};
}
function mythicSmithEvidence(profile){
 const set=EQUIPMENT_SET_CATALOG.MythicSmith;
 const owned=profile?.sections?.equipmentSets?.present===true&&
  profile.sections.equipmentSets.truncated!==true&&
  (profile?.ownedSetIds||[]).includes("MythicSmith");
 const types=["HelperWeaponBoost","HelperWeaponSetBoost"];
 const rows=types.map(type=>set?.bonuses?.filter(b=>b.type===type)||[]);
 // Inc=1 in pinned CSV: no Crafting Power assumption is necessary.
 const verified=owned&&rows.every(items=>items.length===1&&
  Number.isFinite(Number(items[0].amount))&&Number(items[0].amount)>=1&&
  Number(items[0].inc)===1&&Number.isFinite(Number(items[0].expo)));
 return {id:"MythicSmith",owned,verified,
  individualFactor:verified?Number(rows[0][0].amount):1,
  setFactor:verified?Number(rows[1][0].amount):1,
  applied:verified,status:verified?"catalog-cp-independent":
   owned?"unverified-mythic-source":"not-proven-owned"};
}
export function heroProgressionEvidence(profile,artifactEffects=null){
 const weapons=heroWeaponEvidence(profile);
 const artifactBoosters=BOOST_IDS.map(id=>artifactFactor(id,profile,artifactEffects));
 const ringing=artifactBoosters.find(b=>b.id==="Artifact91");
 const morgelai=artifactBoosters.find(b=>b.id==="Artifact71");
 const mythicSmith=mythicSmithEvidence(profile);
 // Worldshaper is the 7.11 display name for internal MythicSmith's
 // identical x1.25/x1.25 rows; alias is canonicalized on import.
 const aliasEvidence=equipmentSetAliasEvidence(profile);
 const worldshaper={owned:mythicSmith.owned,
  catalogPresent:EQUIPMENT_SET_CATALOG.MythicSmith!==undefined,
  applied:mythicSmith.applied,status:mythicSmith.applied?
   "verified-primary-alias-worldshaper":mythicSmith.owned?
   "unverified-worldshaper-primary":"not-proven-owned",
  source:"Game Hive 7.11 + 8.4 MythicSmith primary rows"};
 const completed=new Set(profile?.ownedSetIds||[]);
 const mythicBoosts=["MythicSmith","ScrollTutor"].map(id=>({
  id,owned:completed.has(id)&&profile?.sections?.equipmentSets?.present===true&&
    profile.sections.equipmentSets.truncated!==true,
  types:EQUIPMENT_SET_CATALOG[id]?.bonuses?.filter(x=>
   /HelperWeapon|ClanScroll/.test(x.type)).map(x=>x.type)||[],
  applied:id==="MythicSmith"&&mythicSmith.applied
 }));
 const sets=weapons.completeRosterVerified?weapons.completeSets:null;
 const individualFactor=1.5*morgelai.factor*mythicSmith.individualFactor;
 const setFactor=5*ringing.factor*mythicSmith.setFactor;
 const individual=weapons.individual.map(w=>({
  id:w.id,heroClass:HERO_CLASS_BY_ID[w.id]??null,level:w.level,
  baseWeaponLog10:w.unboostedHeroLog10,
  boostedWeaponLog10:w.level*Math.log10(individualFactor),
  modeledIndividually:true,inGlobalDamageScore:false
 }));
 const strongest=profile?.dominantHero??{id:null,heroClass:null,verified:false,status:"not-exported"};
 const heroLevels=heroLevelEvidence(profile);
 const baseSetLog10=sets===null?null:sets*Math.log10(setFactor);
 const entries=sets>0?[{system:"heroWeapons",id:"full-hero-weapon-sets",
  bonusType:"BaseHeroDamage",level:sets,log10:baseSetLog10,
  conservative:true,source:"8.4 weapon sets ×5; Ringing/MythicSmith boosts"}]:[];
 const unresolved=[];
 if(artifactBoosters.some(b=>b.owned&&!b.verified&&["Artifact71","Artifact91"].includes(b.id)))
  unresolved.push("unverified-artifact-amplifier");
 if(mythicSmith.owned&&!mythicSmith.verified)unresolved.push("unverified-mythic-smith");
 if(worldshaper.owned&&!worldshaper.applied)unresolved.push("unverified-worldshaper-primary");
 if(heroLevels.present&&!heroLevels.completeRoster)unresolved.push("unverified-hero-level-or-ascension-roster");
 if(heroLevels.dominantConflict)unresolved.push("conflicting-dominant-hero-dps");
 if(individual.length&&!strongest.verified)unresolved.push("unknown-dominant-hero");
 if(profile?.sections?.heroWeapons?.present&&sets===null)
  unresolved.push("unverified-37-hero-weapon-roster");
 if(weapons.uniqueKnownHeroes>0)
  unresolved.push("per-hero-weapon-levels-require-dps-and-ascension");
 return {weapons,entries,unresolved,artifactBoosters,mythicBoosts,
  ringing,morgelai,mythicSmith,worldshaper,aliasEvidence,heroLevels,individual,strongest,
  individualFactor,setFactor,baseSetLog10,individualWeaponsScored:false,
  amplifiersScored:(ringing.verified||mythicSmith.applied)&&sets>0,complete:false};
}
