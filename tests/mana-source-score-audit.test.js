import {test} from "node:test";
import assert from "node:assert/strict";
import {skillInfo} from "../vendor/skills.js";
import {scoreAtLevel} from "../src/effects.js";
import {DAMAGE_TYPES,GOLD_TYPES,optimizeBuild} from "../src/engine.js";

const BASE={goldWeight:0.7,sets:{},minimums:{},currentLevels:{},
 maxStage:15000,craftingPower:1,timeToKill:8,sClone:30,qol:"none"};

test("source 8.4 mana A/B families cannot become direct damage",()=>{
 assert.equal(skillInfo.MPCapacityBoost.BonusTypeA,"ManaPoolCap");
 assert.equal(skillInfo.MPCapacityBoost.BonusTypeB,"AllManaSourceMult");
 assert.equal(skillInfo.ManaStealSkillBoost.BonusTypeA,"ManaTapRegenAmount");
 assert.equal(skillInfo.ManaStealSkillBoost.BonusTypeB,"ManaStealChance");
 let checked=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={...BASE,damage,gold};
  for(const id of ["MPCapacityBoost","ManaStealSkillBoost"]){
   const max=Number(skillInfo[id].MaxLevel);
   for(const level of new Set([0,1,Math.floor(max/2),max])){
    assert.equal(scoreAtLevel(id,level,settings),0,
      damage+"/"+gold+"/"+id+"/"+level);
    checked++;
   }
  }
 }
 assert.equal(checked,18*2*4);
});

test("explicit mandatory mana QoL levels are still respected",()=>{
 const ctx={...BASE,damage:"Shadow Clone",gold:"Fairy",
  skillPoints:250,minimums:{MPCapacityBoost:1}};
 const r=optimizeBuild(ctx);
 assert.ok(r.levels.MPCapacityBoost>=1);
 assert.ok(Number.isFinite(r.score));
});
