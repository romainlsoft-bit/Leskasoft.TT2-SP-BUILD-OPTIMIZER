import test from "node:test";
import assert from "node:assert/strict";
import {publicOptimizationSettings} from "../src/public-optimization-policy.js";
import {scoreAtLevel} from "../src/effects.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {skillInfo} from "../vendor/skills.js";

const specs=[
 {damage:"Clan Ship",spell:"ThunderVolley",id:"ClanShipVoltage",flag:"assumeThunderVolleySpecialHit",report:"thunderVolleySpecialAtBoss"},
 {damage:"Dagger",spell:"StreamOfBlades",id:"CriticalHit",flag:"assumeDaggerTargetMarked",report:"bladeStreamTargetAtBoss"}
];
const base={skillPoints:500,maxStage:180000,qol:"none",gold:"Fairy",goldWeight:.7,sets:{},currentLevels:{},minimums:{}};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+" vs "+b);
test("public special attacks require the matching verified spell and damage route",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const cfg=publicOptimizationSettings({...base,damage,gold,selectedSpells:specs.map(s=>s.spell)});
  for(const s of specs)assert.equal(cfg[s.flag],damage===s.damage,damage+"/"+gold+"/"+s.flag);
 }
});
test("stale controls cannot enable a special attack without a valid maximum-spell scenario",()=>{
 for(const s of specs){
  const raw={...base,damage:s.damage,[s.flag]:true};
  for(const extra of [{},{selectedSpells:["TapBoost"]},{selectedSpells:[s.spell,s.spell]},
    {selectedSpells:[s.spell,"unknown"]},{selectedSpells:[s.spell],assumeMaxSpells:false},
    {selectedSpells:[s.spell],maxStage:14999},
    {selectedSpells:[s.spell],accountProfile:{spellLoadout:{present:true,ids:["TapBoost"]}}},
    {accountProfile:{spellLoadout:{present:true,truncated:true,ids:[s.spell]}}}]){
   assert.equal(publicOptimizationSettings({...raw,...extra})[s.flag],false,s.flag);
  }
  assert.equal(publicOptimizationSettings({...raw,[s.flag]:false,selectedSpells:[s.spell]})[s.flag],true);
  assert.equal(publicOptimizationSettings({...raw,accountProfile:{spellLoadout:{present:true,ids:[s.spell]}}})[s.flag],true);
 }
});
test("existing sourced primary and special multipliers are counted once at each level",()=>{
 for(const s of specs)for(const gold of GOLD_TYPES){
  const cfg=publicOptimizationSettings({...base,damage:s.damage,gold,selectedSpells:[s.spell],minimums:{[s.id]:1}});
  for(let n=1;n<=Number(skillInfo[s.id].MaxLevel);n++){
   const row=skillInfo[s.id],a=Math.log10(Number(row["A"+n])),b=Math.log10(Number(row["B"+n]));
   near(scoreAtLevel(s.id,n,cfg),a+b);
   near(scoreAtLevel(s.id,n,{...cfg,[s.flag]:false}),a);
  }
  assert.equal(scoreAtLevel(s.id,0,cfg),0);
 }
});
test("solver guarantees selected spell unlock and reports modeled boss special without double counting",()=>{
 for(const s of specs)for(const gold of GOLD_TYPES){
  const cfg=publicOptimizationSettings({...base,damage:s.damage,gold,selectedSpells:[s.spell]});
  const result=optimizeBuild(cfg);
  assert.ok(result.selectedSpellUnlocks.includes(s.id));
  const n=result.levels[s.id],row=skillInfo[s.id];
  assert.ok(n>=1);
  assert.equal(result.combatAssumptions[s.report],true);
  assert.equal(result.combatAssumptions.actualBossUptimeVerified,false);
  near(result.modelAttribution.entries.find(r=>r.id===s.id).scoreLog10,
   Math.log10(Number(row["A"+n]))+Math.log10(Number(row["B"+n])));
  assert.ok(result.modelAttribution.additiveReconstructionMatches);
  assert.ok(result.spent<=base.skillPoints);
 }
});
