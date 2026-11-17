import {test} from "node:test";
import assert from "node:assert/strict";
import {ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {calculatePermanentArtifactEffects,computeArtifactEffect} from "../src/account-artifacts.js";
import {artifactDerivedPower} from "../src/account-artifact-derived.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";

const near=(a,b,tolerance=1e-9)=>Math.abs(a-b)<=
 tolerance*Math.max(1,Math.abs(a),Math.abs(b));
const entry=(report,id)=>report.entries.find(x=>x.id===id);
const evaluate=artifacts=>{
 const profile=parseAccountProfile({Version:"8.4.0",artifacts});
 const effects=calculatePermanentArtifactEffects(profile,ARTIFACT_CATALOG);
 return {profile,effects,derived:artifactDerivedPower(profile,effects)};
};

test("8.4 artifact catalog contains all official v5.10 extended amplifier targets",()=>{
 const damage=[
  "Artifact10","Artifact76","Artifact101","Artifact6","Artifact102",
  "Artifact78","Artifact52","Artifact75","Artifact7","Artifact103",
  "Artifact41","Artifact96","Artifact11","Artifact77","Artifact100"];
 const gold=["Artifact53","Artifact97","Artifact9","Artifact77"];
 for(const id of [...damage,...gold]){
  assert.ok(ARTIFACT_CATALOG[id]?.maxLevel===0,id);
 }
 const artifacts=Object.fromEntries([...new Set([...damage,...gold])]
  .map(id=>[id,{level:100,enchanted:false}]));
 const r=evaluate({Artifact80:{level:40},Artifact81:{level:40},...artifacts}).effects;
 assert.ok(near(r.magnifier.factor,5.5));
 assert.ok(near(r.treasure.factor,10));
 for(const id of damage){
  const x=entry(r,id);
  assert.ok(near(x.log10,x.unamplifiedLog10*5.5*
   (gold.includes(id)?10:1)),id);
  assert.equal(x.magnifierApplied,true,id);
 }
 for(const id of gold){
  const x=entry(r,id);
  assert.ok(near(x.log10,x.unamplifiedLog10*10*
   (damage.includes(id)?5.5:1)),id);
  assert.equal(x.treasureApplied,true,id);
 }
 assert.equal(entry(r,"Artifact77").appliedToScore,false,
  "an amplified SorcererBonusBoost is not unconditional AllDamage");
});
test("The Magnifier and Fergus also affect their base uncapped icon categories",()=>{
 const r=evaluate({Artifact80:{level:40},Artifact81:{level:40},
  Artifact31:{level:100,e:false},Artifact20:{level:100,e:false},
  Artifact38:{level:100,e:false},Artifact44:{level:100,e:false}}).effects;
 for(const id of ["Artifact31","Artifact38"]){
  const x=entry(r,id);
  assert.ok(near(x.log10,x.unamplifiedLog10*5.5),id);
  assert.equal(x.treasureApplied,false);
 }
 for(const id of ["Artifact20","Artifact44"]){
  const x=entry(r,id);
  assert.ok(near(x.log10,x.unamplifiedLog10*10),id);
  assert.equal(x.magnifierApplied,false);
 }
});
test("post-5.19 White Dwarf magnification is exponentiated by OWNED count once",()=>{
 const {effects,derived}=evaluate({
  Artifact80:{level:40},Artifact85:{level:50},
  Artifact31:{level:100,e:false},Artifact20:{level:100,e:false}
 });
 const dwarf=entry(derived,"Artifact85");
 assert.equal(derived.ownedArtifactCount,4);
 assert.ok(near(dwarf.log10,entry(effects,"Artifact85").log10*4));
 assert.equal(dwarf.magnifierApplied,true);
 assert.equal(effects.byType.AllDamage,entry(effects,"Artifact31").log10,
  "white dwarf does not enter main effects ledger twice");
});
test("identical mirror rows never double count artifacts or amplifier levels",()=>{
 const {effects,derived}=evaluate([
  {id:"Artifact80",level:40},{id:"Artifact80",level:40},
  {id:"Artifact85",level:50},{id:"Artifact85",level:50},
  {id:"Artifact31",level:100,enchanted:false}
 ]);
 assert.ok(near(effects.magnifier.factor,5.5));
 assert.equal(effects.duplicateRecords,2);
 assert.equal(derived.ownedArtifactCount,3);
 assert.ok(near(entry(derived,"Artifact85").log10,
  3*entry(effects,"Artifact85").log10));
});
test("conflicting amplifier values suppress dependent bonus scoring",()=>{
 const {effects}=evaluate([
  {id:"Artifact80",level:40},{id:"Artifact80",level:32},
  {id:"Artifact31",level:100,enchanted:false},
  {id:"Artifact20",level:100,enchanted:false}
 ]);
 assert.equal(effects.magnifier.factor,null);
 assert.equal(entry(effects,"Artifact31").appliedToScore,false);
 assert.equal(entry(effects,"Artifact31").status,"unknown-artifact-amplifier");
 assert.equal(entry(effects,"Artifact20").appliedToScore,true);
});
test("game-export strings True and False preserve enchantment state",()=>{
 const {profile,effects}=evaluate({
  "Divine Retribution":{level:"1e250",enchanted:"True"},
  "Fruit of Eden":{level:"1e9999",enchanted:"False"}
 });
 assert.deepEqual(profile.sections.artifacts.records.map(x=>x.enchanted),
  [true,false]);
 const enchanted=entry(effects,"Artifact31");
 assert.ok(Number.isFinite(enchanted.log10));
 assert.ok(near(enchanted.unamplifiedLog10,
  computeArtifactEffect(ARTIFACT_CATALOG.Artifact31,"1e250",true).log10));
 assert.ok(Number.isFinite(entry(effects,"Artifact38").log10));
});
test("explicitly salvaged or not-owned rows never increase White Dwarf count",()=>{
 const {effects,derived}=evaluate([
  {id:"Artifact85",level:50},
  {id:"Artifact31",level:100,enchanted:"False"},
  {id:"Artifact38",level:100,enchanted:"True",salvaged:"True"},
  {id:"Artifact20",level:100,enchanted:"True",isOwned:"False"}
 ]);
 assert.equal(effects.explicitlyUnowned,2);
 assert.equal(derived.ownedArtifactCount,2);
 assert.equal(derived.whiteDwarfApplied,true);
 assert.equal(effects.entries.length,2);
 assert.ok(!effects.entries.some(x=>x.id==="Artifact38"||x.id==="Artifact20"));
});
test("unknown IDs make the White Dwarf count unknown, without zero substitution",()=>{
 const {effects,derived}=evaluate({
  Artifact85:{level:50},Artifact31:{level:100,enchanted:false},
  UnlistedArtifact:{level:3}
 });
 assert.equal(effects.unknown.length,1);
 assert.equal(derived.ownedArtifactCount,null);
 assert.equal(derived.ownedCountVerifiable,false);
 assert.equal(derived.whiteDwarfApplied,false);
 assert.ok(derived.unmodeled.includes("white-dwarf-ownership-count-unverifiable"));
});
test("truncated source cannot silently contribute a false partial account total",()=>{
 const artifacts=Array.from({length:513},(_,i)=>({
  id:i===0?"Artifact85":"Artifact31",level:50,enchanted:false
 }));
 const {profile,effects,derived}=evaluate(artifacts);
 assert.equal(profile.sections.artifacts.truncated,true);
 assert.equal(effects.truncated,true);
 assert.equal(effects.scored,0);
 assert.equal(derived.entries.length,0);
 assert.equal(derived.ownedArtifactCount,null);
 assert.ok(derived.unmodeled.includes("truncated-artifact-collection"));
 const power=extractFixedAccountPower(profile);
 assert.ok(!power.entries.some(x=>
  ["artifacts","artifactDamage","whiteDwarf"].includes(x.system)));
});
test("additive Artifact Damage precedes Heavenly Sword once, not other boosters",()=>{
 const {effects,derived}=evaluate({
  Artifact26:{level:100,enchanted:false},
  Artifact31:{level:100,enchanted:false},Artifact85:{level:50},
  Artifact80:{level:40},Artifact81:{level:40}
 });
 const sum=Object.entries({
  Artifact26:100,Artifact31:100,Artifact85:50,Artifact80:40,
  Artifact81:40
 }).reduce((v,[id,lvl])=>v+Number(ARTIFACT_CATALOG[id].damageBonus)*lvl,0);
 const additive=derived.entries.find(x=>x.system==="artifactDamage");
 assert.ok(near(additive.log10,
  Math.log10(sum)+entry(effects,"Artifact26").log10));
 assert.equal(additive.conservative,true);
 assert.equal(additive.appliedToScore,true);
 const wd=derived.entries.find(x=>x.system==="whiteDwarf");
 assert.ok(near(wd.log10,entry(effects,"Artifact85").log10*5));
 assert.notEqual(additive.log10,wd.log10);
});
test("unknown main enchantment is not guessed as a direct bonus",()=>{
 const {effects}=evaluate({Artifact31:{level:100},Artifact20:{level:100,e:0}});
 assert.equal(entry(effects,"Artifact31").status,"unknown-enchantment-state");
 assert.equal(entry(effects,"Artifact31").appliedToScore,false);
 assert.equal(entry(effects,"Artifact20").appliedToScore,true);
});
test("all 18 damage/gold combinations integrate derived artifacts once",()=>{
 const profile=parseAccountProfile({Version:"8.4.0",artifacts:{
  Artifact80:{level:40},Artifact81:{level:40},
  Artifact26:{level:100,enchanted:"False"},
  Artifact85:{level:50},Artifact31:{level:100,enchanted:"True"},
  Artifact20:{level:100,enchanted:"False"},
  Artifact38:{level:100,enchanted:"True"},
  Artifact44:{level:100,enchanted:"True"}
 }});
 const power=extractFixedAccountPower(profile);
 assert.equal(power.entries.filter(x=>x.system==="whiteDwarf").length,1);
 assert.equal(power.entries.filter(x=>x.system==="artifactDamage").length,1);
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={accountProfile:profile,damage,gold,goldWeight:.7,
   skillPoints:30,qol:"none",sets:{},minimums:{},currentLevels:{},
   craftingPower:1,maxStage:0,timeToKill:8,sClone:30};
  const optimized=optimizeBuild(settings);
  const expected=fixedAccountScore(power,settings);
  assert.ok(near(optimized.fixedAccount.damageLog10,expected.damageLog10),
   damage+"/"+gold+" damage");
  assert.ok(near(optimized.fixedAccount.goldLog10,expected.goldLog10),
   damage+"/"+gold+" gold");
  assert.ok(Number.isFinite(optimized.accountAdjustedScore));
  assert.equal(optimized.accountIntegration.artifacts.whiteDwarfApplied,true);
  assert.equal(optimized.accountIntegration.artifacts.ownedArtifactCount,8);
  assert.equal(optimized.accountIntegration.artifacts.magnifier.owned,true);
  assert.equal(optimized.accountIntegration.artifacts.treasure.owned,true);
  assert.equal(optimized.accountIntegration.releaseReady,false);
 }
});
