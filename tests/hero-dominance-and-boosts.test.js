import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {HERO_ROSTER} from "../vendor/hero-roster.js";
import {HERO_CLASS_BY_ID} from "../vendor/hero-classes.js";
import {heroProgressionEvidence} from "../src/hero-progression.js";
import {calculatePermanentArtifactEffects} from "../src/account-artifacts.js";
import {ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {bestEquipmentByCategory,gearSelectionEffects} from "../src/equipment-scenarios.js";
import {optimizeBuild} from "../src/engine.js";
const heroes=n=>Object.fromEntries(HERO_ROSTER.map(id=>[id,n]));
const gear=[
 {id:"H_Elder",slot:"Helmet",name:"Elder Snow Cap",bonusType:"HeroDamage",bonusAmount:"1e12"},
 {id:"H_Melee",slot:"Helmet",name:"Melee helmet",bonusType:"MeleeHelperDamage",bonusAmount:"1e100"},
 {id:"H_Spell",slot:"Helmet",name:"Spell helmet",bonusType:"SpellHelperDamage",bonusAmount:"1e100"},
 {id:"H_Ranged",slot:"Helmet",name:"Ranged helmet",bonusType:"RangedHelperDamage",bonusAmount:"1e100"}];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test("37 active hero classes are pinned from 8.4 HelperInfo.csv",()=>{
 assert.equal(Object.keys(HERO_CLASS_BY_ID).length,37);
 assert.deepEqual(Object.keys(HERO_CLASS_BY_ID),HERO_ROSTER);
 assert.equal(HERO_CLASS_BY_ID.H18,"Spell");
 assert.equal(HERO_CLASS_BY_ID.H01,"Melee");
 assert.equal(HERO_CLASS_BY_ID.H06,"Ranged");
});
test("dominant hero is proven only by unambiguous exported canonical ID",()=>{
 const p=parseAccountProfile({StrongestHeroID:"H18",heroWeapons:heroes(2)});
 assert.equal(p.dominantHero.verified,true);
 assert.equal(p.dominantHero.heroClass,"Spell");
 assert.equal(parseAccountProfile({heroWeapons:heroes(2)}).dominantHero.verified,false);
 const conflict=parseAccountProfile({StrongestHeroID:"H18",playerStats:{DominantHeroID:"H01"}});
 assert.equal(conflict.dominantHero.verified,false);
 assert.equal(parseAccountProfile({StrongestHeroID:"NOT_A_HERO"}).dominantHero.verified,false);
});
test("Ringing full-weapon set booster scores once as unreduced base hero damage",()=>{
 const p=parseAccountProfile({heroWeapons:heroes(2),artifacts:{Artifact91:{level:50,enchanted:false}}});
 const a=calculatePermanentArtifactEffects(p,ARTIFACT_CATALOG);
 const e=heroProgressionEvidence(p,a);
 assert.equal(e.ringing.verified,true);
 close(e.ringing.factor,1.5);
 close(e.baseSetLog10,2*Math.log10(7.5));
 const fixed=extractFixedAccountPower(p);
 close(fixed.byType.BaseHeroDamage,2*Math.log10(7.5));
 assert.equal(fixed.byType.AllHelperDamage||0,0);
});
test("Morgelai upgrades all 37 individual weapon bonuses, but not global damage",()=>{
 const p=parseAccountProfile({heroWeapons:heroes(4),artifacts:{Artifact71:{level:50,enchanted:false}}});
 const a=calculatePermanentArtifactEffects(p,ARTIFACT_CATALOG);
 const e=heroProgressionEvidence(p,a);
 assert.equal(e.individual.length,37);
 assert.equal(e.morgelai.verified,true);
 close(e.individual.find(x=>x.id==="H01").boostedWeaponLog10,4*Math.log10(2.25));
 assert.equal(e.individual.every(x=>x.inGlobalDamageScore===false),true);
 close(extractFixedAccountPower(p).byType.BaseHeroDamage,4*Math.log10(5));
});
test("ambiguous or absent amplifier never receives invented Ringing/Morgelai bonus",()=>{
 const absent=heroProgressionEvidence(parseAccountProfile({heroWeapons:heroes(2)}));
 close(absent.baseSetLog10,2*Math.log10(5));
 const conflict=parseAccountProfile({heroWeapons:heroes(2),artifacts:[
  {id:"Artifact91",level:49,enchanted:false},{id:"Artifact91",level:50,enchanted:false}]});
 const effects=calculatePermanentArtifactEffects(conflict,ARTIFACT_CATALOG);
 const e=heroProgressionEvidence(conflict,effects);
 assert.equal(e.ringing.verified,false);
 close(e.baseSetLog10,2*Math.log10(5));
});
test("helmet shortlist excludes mismatched class ONLY with explicit strongest hero",()=>{
 const settings={damage:"Pet",gold:"Fairy",goldWeight:.7};
 const known=parseAccountProfile({StrongestHeroID:"H18",equipmentInventory:gear});
 const noClass=parseAccountProfile({equipmentInventory:gear});
 const ranked=bestEquipmentByCategory(known,settings).Helmet.map(x=>x.helmetKind);
 assert.equal(ranked.includes("Melee hero"),false);
 assert.equal(ranked.includes("Ranged hero"),false);
 assert.ok(ranked.includes("Spell hero")||ranked.includes("Elder Snow Cap"));
 const uncontrolled=bestEquipmentByCategory(noClass,settings).helmetRotation;
 assert.equal(uncontrolled.melee[0].helmetKind,"Melee hero");
 const wrong=gearSelectionEffects(known,settings,{Helmet:"Helmet:1"});
 assert.equal(wrong.missingExplicitSelections.length,1);
});
test("18 source damage×gold pairs never reduce BaseHeroDamage twice",()=>{
 const p=extractFixedAccountPower(parseAccountProfile({heroWeapons:heroes(2),
  artifacts:{Artifact91:{level:50,enchanted:false}}}));
 for(const damage of ["Pet","Clan Ship","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"])
  for(const gold of ["Fairy","HoG","Chesterson"]){
   const s={damage,gold,goldWeight:.7};
   const actual=fixedAccountScore(p,s);
   const without=fixedAccountScore({...p,byType:{...p.byType,BaseHeroDamage:0}},s);
   close(actual.damageLog10-without.damageLog10,2*Math.log10(7.5));
  }
});
test("real optimizer integration across all 18 source damage/gold combinations",()=>{
 const p=parseAccountProfile({StrongestHeroID:"H18",heroWeapons:heroes(2),
  artifacts:{Artifact91:{level:50,enchanted:false}}});
 for(const damage of ["Pet","Clan Ship","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"])
  for(const gold of ["Fairy","HoG","Chesterson"]){
   const settings={damage,gold,goldWeight:.7,skillPoints:80,
    maxStage:0,qol:"none",currentLevels:{},minimums:{},sets:{},craftingPower:1,
    timeToKill:8,sClone:30,accountProfile:p};
   const r=optimizeBuild(settings);
   assert.equal(r.accountIntegration.heroProgression.strongest.heroClass,"Spell");
   close(r.fixedAccount.damageLog10,
    fixedAccountScore(extractFixedAccountPower(p),settings).damageLog10);
   assert.ok(r.fixedAccount.damageLog10>=2*Math.log10(7.5));
   close(r.accountAdjustedScore-r.score,r.fixedAccount.weightedLog10);
   assert.equal(r.fixedAccount.complete,false);
  }
});
