import test from "node:test";
import assert from "node:assert/strict";
import {publicOptimizationSettings} from "../src/public-optimization-policy.js";
import {scoreAtLevel} from "../src/effects.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {skillInfo} from "../vendor/skills.js";
import {reductions} from "../vendor/reductions.js";

const base={skillPoints:500,maxStage:180000,qol:"none",goldWeight:.7,sets:{},currentLevels:{},minimums:{}};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+" vs "+b);

test("ideal Warlord conditions are applied across every damage and gold route",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s=publicOptimizationSettings({...base,damage,gold,selectedSpells:["HelperBoost"],assumeBossStunned:false,assumeInspiredHelpersActive:false});
  assert.equal(s.assumeBossStunned,true);
  assert.equal(s.assumeInspiredHelpersActive,true);
 }
});
test("stun is unavailable below unlock stage or with explicit no-ship evidence",()=>{
 for(const extra of [{maxStage:699},{maxStage:0},{clanShipAvailable:false}]){
  const s=publicOptimizationSettings({...base,...extra,assumeBossStunned:true});
  assert.equal(s.assumeBossStunned,false);
 }
 assert.equal(publicOptimizationSettings({...base,maxStage:700}).assumeBossStunned,true);
});
test("inspired heroes need valid selected War Cry in the maximum-spell scenario",()=>{
 for(const extra of [{},{selectedSpells:["TapBoost"]},{selectedSpells:["HelperBoost","HelperBoost"]},
  {selectedSpells:["HelperBoost"],assumeMaxSpells:false},
  {selectedSpells:["HelperBoost"],maxStage:14999},
  {selectedSpells:["HelperBoost"],accountProfile:{spellLoadout:{present:true,ids:["TapBoost"]}}},
  {accountProfile:{spellLoadout:{present:true,truncated:true,ids:["HelperBoost"]}}}]){
  const s=publicOptimizationSettings({...base,...extra,assumeInspiredHelpersActive:true});
  assert.equal(s.assumeInspiredHelpersActive,false);
 }
 assert.equal(publicOptimizationSettings({...base,accountProfile:{spellLoadout:{present:true,ids:["HelperBoost"]}}}).assumeInspiredHelpersActive,true);
});
test("native A modifiers are counted once; duration, hero count and stage skip are not damage",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s=publicOptimizationSettings({...base,damage,gold,selectedSpells:["HelperBoost"]});
  for(const id of ["ClanShipStun","HelperInspiredWeaken"]){
   for(let n=1;n<=Number(skillInfo[id].MaxLevel);n++){
    near(scoreAtLevel(id,n,s),Number(reductions[id][damage])*Math.log10(Number(skillInfo[id]["A"+n])));
   }
   assert.equal(scoreAtLevel(id,0,s),0);
  }
 }
});
test("imported floors and diagnostics match the effective boss conditions",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const s={...base,damage,gold,currentLevels:{ClanShipStun:1,HelperInspiredWeaken:1},
   minimums:{ClanShipStun:1,HelperInspiredWeaken:1},selectedSpells:["HelperBoost"]};
  const active=optimizeBuild(publicOptimizationSettings(s));
  assert.equal(active.combatAssumptions.anchoringShotStunAtBoss,true);
  assert.equal(active.combatAssumptions.inspiredHeroesAtBoss,true);
  assert.equal(active.combatAssumptions.actualBossUptimeVerified,false);
  for(const id of ["ClanShipStun","HelperInspiredWeaken"]){
   assert.ok(!active.protectedSkills.includes(id));
   near(active.modelAttribution.entries.find(r=>r.id===id).scoreLog10,
    Number(reductions[id][damage])*Math.log10(Number(skillInfo[id]["A"+active.levels[id]])));
  }
  assert.ok(active.modelAttribution.additiveReconstructionMatches);
  assert.ok(active.spent<=base.skillPoints);
 }
 const off=optimizeBuild({...base,damage:"Pet",gold:"Fairy",currentLevels:{ClanShipStun:1,HelperInspiredWeaken:1}});
 assert.ok(off.protectedSkills.includes("ClanShipStun"));
 assert.ok(off.protectedSkills.includes("HelperInspiredWeaken"));
});
