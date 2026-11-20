import {test} from "node:test";
import assert from "node:assert/strict";
import {ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {calculatePermanentArtifactEffects,computeArtifactEffect,
 computeArtifactEffectWithLogAmplifier} from "../src/account-artifacts.js";
import {extractFixedAccountPower,fixedAccountScore}
 from "../src/account-power.js";

const near=(a,b,tol=1e-10)=>Math.abs(a-b)<=tol*
 Math.max(1,Math.abs(a),Math.abs(b));
test("finite amplification remains identical to source's ordinary-factor formula",()=>{
 for(const id of ["Artifact31","Artifact20","Artifact77","Artifact85"]){
  const info=ARTIFACT_CATALOG[id];
  for(const scale of [1,5.5,10,55]){
   for(const level of [1,100,"1e9999"]){
    if(info.maxLevel>0&&level!==1)continue;
    const ordinary=computeArtifactEffect(info,level,false,scale);
    const log=computeArtifactEffectWithLogAmplifier(
     info,level,false,Math.log10(scale));
    assert.equal(ordinary.status,"computed-main-effect");
    assert.ok(near(ordinary.log10,log.log10),id+" "+scale+" "+level);
   }
  }
 }
});
test("overflowed magnifier stays computable in log space, with no false unknown",()=>{
 // Deliberately extreme source-parameter fixture, not claimed as game data.
 const catalog={...ARTIFACT_CATALOG,
  Artifact80:{...ARTIFACT_CATALOG.Artifact80,
   maxLevel:0,perLevel:"1e500",growthExpo:0}};
 const profile=parseAccountProfile({artifacts:{
  Artifact80:{level:1,enchanted:false},
  Artifact31:{level:"1e300",enchanted:false},
  Artifact85:{level:40,enchanted:false}
 }});
 const effects=calculatePermanentArtifactEffects(profile,catalog);
 const boosted=effects.entries.find(x=>x.id==="Artifact31");
 assert.equal(effects.magnifier.factor,null,
  "the ordinary factor cannot be expressed as a finite number");
 assert.ok(near(effects.magnifier.log10,500));
 assert.equal(boosted.status,"computed-direct-effect");
 assert.equal(boosted.appliedToScore,true);
 assert.ok(Number.isFinite(boosted.log10));
 assert.ok(near(boosted.amplificationLog10,500));
 assert.equal(boosted.amplificationFactor,null);
 assert.equal(boosted.magnifierApplied,true);
 assert.ok(boosted.log10>boosted.unamplifiedLog10+499);
});
test("two overflowing source factors add in log10 without Infinity*Infinity",()=>{
 const catalog={...ARTIFACT_CATALOG,
  Artifact80:{...ARTIFACT_CATALOG.Artifact80,maxLevel:0,
   perLevel:"1e450",growthExpo:0},
  Artifact81:{...ARTIFACT_CATALOG.Artifact81,maxLevel:0,
   perLevel:"1e470",growthExpo:0}};
 const profile=parseAccountProfile({artifacts:{
  Artifact80:{level:1,enchanted:false},
  Artifact81:{level:1,enchanted:false},
  Artifact77:{level:"1e500",enchanted:false}
 }});
 const effects=calculatePermanentArtifactEffects(profile,catalog);
 const titania=effects.entries.find(x=>x.id==="Artifact77");
 assert.ok(near(effects.magnifier.log10,450));
 assert.ok(near(effects.treasure.log10,470));
 assert.ok(near(titania.amplificationLog10,920));
 assert.ok(Number.isFinite(titania.log10));
 assert.equal(titania.status,"computed-unscored-interaction");
 assert.equal(titania.magnifierApplied,true);
 assert.equal(titania.treasureApplied,true);
 assert.equal(titania.appliedToScore,false,
  "unsupported secondary bonus must remain unscored");
});
test("real v8.4 magnifier and treasure keep their audited ordinary factors",()=>{
 const profile=parseAccountProfile({artifacts:{
  Artifact80:{level:40,enchanted:false},
  Artifact81:{level:40,enchanted:false},
  Artifact31:{level:100,enchanted:false},
  Artifact20:{level:100,enchanted:false}
 }});
 const effects=calculatePermanentArtifactEffects(profile,ARTIFACT_CATALOG);
 assert.ok(near(effects.magnifier.factor,5.5));
 assert.ok(near(effects.treasure.factor,10));
 const a=effects.entries.find(x=>x.id==="Artifact31");
 const b=effects.entries.find(x=>x.id==="Artifact20");
 assert.ok(near(a.amplificationLog10,Math.log10(5.5)));
 assert.ok(near(b.amplificationLog10,1));
 assert.ok(a.appliedToScore&&b.appliedToScore);
 const power=extractFixedAccountPower(profile);
 const computed=fixedAccountScore(power,{damage:"Pet",gold:"Fairy",goldWeight:0.7});
 assert.ok(Number.isFinite(computed.weightedLog10));
});
test("invalid logarithmic amplifier never fabricates an effect",()=>{
 const info=ARTIFACT_CATALOG.Artifact31;
 for(const x of [null,Infinity,-Infinity,NaN,"500"]){
  const out=computeArtifactEffectWithLogAmplifier(info,100,false,x);
  assert.equal(out.status,"invalid-main-effect-amplifier");
  assert.equal(out.log10,null);
 }
});
