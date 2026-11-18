import {test} from "node:test";
import assert from "node:assert/strict";
import {SEASON_ARTIFACT_CATALOG,SEASON_ARTIFACT_CATALOG_EMBEDDED_A} from "../vendor/account-catalog.js";
import {parseAccountProfile} from "../src/account-profile.js";
import {resolveMonumentEvidence} from "../src/account-monuments.js";
import {extractFixedAccountPower,fixedAccountScore} from "../src/account-power.js";
import {DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";

// Independent 8.4 Unity TextAsset EndgameSeasonArtifactInfo_1 snapshot.
// FNV-1a32 over all 52 rows and all 14 modeled fields, canonicalizing
// losslessly in scientific base 10; no game binaries or account data stored.
const EXPECTED_B="fc7604a0";
const FIELDS=["name","bonusType","isActive","maxLevel","effectPerLevel",
 "growthExpo","category","damageBonus","damageExpo","costCoef","costExpo",
 "enchantmentMagnitude","enchantmentMult","level40Reference"];
function normalize(value){
 const raw=String(value).trim();
 const m=/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(raw);
 if(!m)return raw;
 let digits=(m[2]+(m[3]||"")).replace(/^0+/,"");
 let exponent=Number(m[4]||0)-(m[3]||"").length;
 if(!digits)return "0";
 while(digits.endsWith("0")){digits=digits.slice(0,-1);exponent++;}
 return (m[1]==="-"?"-":"")+digits+"e"+exponent;
}
function hash(table){
 const data=Object.keys(table).sort().flatMap(id=>
  [...FIELDS].sort().map(field=>id+"|"+field+"="+normalize(table[id][field]))).join("\n");
 let h=2166136261;
 for(const byte of Buffer.from(data,"utf8"))
  h=Math.imul(h^byte,16777619)>>>0;
 return h.toString(16).padStart(8,"0");
}
test("Season-13 Unity variant B: complete 52-monument source parity",()=>{
 assert.equal(Object.keys(SEASON_ARTIFACT_CATALOG).length,52);
 assert.equal(hash(SEASON_ARTIFACT_CATALOG),EXPECTED_B);
 assert.notEqual(hash(SEASON_ARTIFACT_CATALOG_EMBEDDED_A),EXPECTED_B);
 const active=Object.values(SEASON_ARTIFACT_CATALOG).filter(row=>row.isActive);
 assert.equal(active.length,33);
 for(const group of ["Celestial","Viper","Arcanas"])
  assert.equal(active.filter(row=>row.category===group).length,11);
 assert.equal(active.filter(row=>row.category==="Pirate").length,0);
 assert.equal(SEASON_ARTIFACT_CATALOG.SeasonalArtifact34.enchantmentMult,"1.00E+01");
 assert.equal(SEASON_ARTIFACT_CATALOG.SeasonalArtifact45.growthExpo,"129.011");
});
test("Season-13 catalog affects the fixed account score consistently in 18 scenarios",()=>{
 const profile=parseAccountProfile({
  playerStats:{"Transcendence Season":13},
  monuments:{
   SeasonalArtifact23:{level:12,enchanted:false},
   SeasonalArtifact34:{level:12,enchanted:false},
   SeasonalArtifact45:{level:12,enchanted:false}
  }
 });
 const monuments=resolveMonumentEvidence(profile,new Date("2026-11-18T12:00:00Z"));
 assert.equal(monuments.seasonVerified,true);
 assert.equal(monuments.recognized,3);
 assert.equal(monuments.entries.find(x=>x.id==="SeasonalArtifact45").growthExpo,"129.011");
 assert.equal(monuments.entries.find(x=>x.id==="SeasonalArtifact23").growthExpo,"30.637");
 const fixed=extractFixedAccountPower(profile);
 let count=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const value=fixedAccountScore(fixed,{damage,gold,goldWeight:0.7});
  assert.ok(Number.isFinite(value.damageLog10),damage+"/"+gold);
  assert.ok(Number.isFinite(value.goldLog10),damage+"/"+gold);
  assert.ok(Number.isFinite(value.weightedLog10),damage+"/"+gold);
  count++;
 }
 assert.equal(count,18);
});
