import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {skillInfo} from "../vendor/skills.js";
import {reductions} from "../vendor/reductions.js";
import {scoreAtLevel} from "../src/effects.js";
import {spellEffectScorable} from "../src/spell-scenarios.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES,spentPoints}
 from "../src/engine.js";

const state=(damage,gold,rest={})=>({
 damage,gold,goldWeight:.7,skillPoints:500,maxStage:300000,
 currentLevels:{},minimums:{},sets:{},qol:"none",...rest
});
const eq=(a,b,where)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
 Math.abs(a-b)<1e-10,where+": "+a+" vs "+b);

test("Ember Arts A is PetDamage, B is Fire Sword spell amount, not a second passive pet multiplier",()=>{
 assert.equal(skillInfo.PetBonusBoost.BonusTypeA,"PetDamage");
 assert.equal(skillInfo.PetBonusBoost.BonusTypeB,"TapBoostSkillAmount");
 assert.equal(skillInfo.PetBonusBoost.MaxLevel,40);
});

test("all 18 routes: permanent pet bonus survives but Fire Sword B requires a verified equipped spell",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const ctx=state(damage,gold),level=12;
  const aWeight=Number(reductions.PetBonusBoost[damage]??0)+
   .7*Number(reductions.PetBonusBoost[gold]??0);
  const bWeight=Number(reductions.TapDmg[damage]??0);
  const nativeA=aWeight*Math.log10(Number(skillInfo.PetBonusBoost["A"+level]));
  const nativeB=bWeight*Math.log10(Number(skillInfo.PetBonusBoost["B"+level]));
  const missing=scoreAtLevel("PetBonusBoost",level,ctx);
  const absent=scoreAtLevel("PetBonusBoost",level,{
   ...ctx,selectedSpells:["ShadowClone"]});
  const active={...ctx,selectedSpells:["TapBoost"]};
  assert.equal(spellEffectScorable("TapBoost",active),true);
  const selected=scoreAtLevel("PetBonusBoost",level,active);
  const inactive=scoreAtLevel("PetBonusBoost",level,{
   ...active,assumeMaxSpells:false});
  const lowStage=scoreAtLevel("PetBonusBoost",level,{
   ...active,maxStage:14000});
  eq(missing,nativeA,damage+"/"+gold+" no loadout");
  eq(absent,nativeA,damage+"/"+gold+" wrong spell");
  eq(inactive,nativeA,damage+"/"+gold+" spell effect not active");
  eq(lowStage,nativeA,damage+"/"+gold+" no modeled max-level spell");
  eq(selected,nativeA+nativeB,damage+"/"+gold+" selected Fire Sword");
 }
});
test("Pet/Fairy native Ember Arts B changes the marginal solver score only when Fire Sword is supported",()=>{
 const lvl=20,ctx=state("Pet","Fairy");
 const base=scoreAtLevel("PetBonusBoost",lvl,ctx);
 const withSpell=scoreAtLevel("PetBonusBoost",lvl,{
  ...ctx,selectedSpells:["TapBoost"]});
 const sourceB=Math.log10(Number(skillInfo.PetBonusBoost["B"+lvl]));
 eq(withSpell-base,sourceB,"fire sword source B at level "+lvl);
 assert.ok(base>0,"Pet Damage A must never disappear");
});
test("imported Ember Arts remains protected if its Fire Sword benefit is unverified",()=>{
 const currentLevels={PetDmg:9,FireTapSkillBoost:1,PetBonusBoost:3};
 const ctx=state("Pet","Fairy",{
  currentLevels,selectedSpells:["ShadowClone"],skillPoints:500,
  protectUnmodeledSkills:true
 });
 const result=optimizeBuild(ctx);
 assert.ok(result.protectedSkills.includes("PetBonusBoost"));
 assert.ok(result.levels.PetBonusBoost>=3);
 assert.ok(spentPoints(result.levels)<=500);
 const entry=result.investmentAudit.protectedEntries.find(
  row=>row.id==="PetBonusBoost");
 assert.ok(entry);
 assert.equal(entry.reason,"ember-arts-fire-sword-spell-not-confirmed-active");
 assert.equal(result.modelAttribution.nativeConditionalScoringGuards
  .emberArtsFireSwordScoredOnlyWhenEquipped,false);
});
test("18 routes retain budget/prerequisites and expose exact Ember Arts gate",()=>{
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const passive=optimizeBuild(state(damage,gold,{skillPoints:100}));
  const equipped=optimizeBuild(state(damage,gold,{
   skillPoints:100,selectedSpells:["TapBoost"]
  }));
  assert.ok(spentPoints(passive.levels)<=100);
  assert.ok(spentPoints(equipped.levels)<=100);
  assert.equal(passive.modelAttribution.nativeConditionalScoringGuards
   .emberArtsFireSwordScoredOnlyWhenEquipped,false);
  assert.equal(equipped.modelAttribution.nativeConditionalScoringGuards
   .emberArtsFireSwordScoredOnlyWhenEquipped,true);
  assert.equal(passive.modelAttribution.additiveReconstructionMatches,true);
  assert.equal(equipped.modelAttribution.additiveReconstructionMatches,true);
 }
});
test("browser and worker share current ESM identities; no GitHub Actions",()=>{
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../src/worker.js",import.meta.url),"utf8");
 const engine=readFileSync(new URL("../src/engine.js",import.meta.url),"utf8");
 const ti=readFileSync(new URL("../src/tactical-insight-sensitivity.js",import.meta.url),"utf8");
 const alt=readFileSync(new URL("../src/ti-alternative.js",import.meta.url),"utf8");
 const suffix="&ember=20261123-ember-fire-sword-gate-r1";
 const match=(contents,base)=>contents.match(
  new RegExp(base+"\\?([^\\\"]+)"))?.[1];
 assert.equal(match(app,"engine\\.js"),match(worker,"engine\\.js"));
 assert.equal(match(engine,"effects\\.js"),match(ti,"effects\\.js"));
 assert.equal(match(engine,"effects\\.js"),match(alt,"effects\\.js"));
 assert.ok(match(engine,"effects\\.js").includes(suffix));
 assert.ok(match(app,"worker\\.js").includes(suffix));
 for(const html of ["index.html","fr/index.html","uk/index.html","ru/index.html"]){
  const content=readFileSync(new URL("../"+html,import.meta.url),"utf8");
  assert.ok(content.includes("&amp;ember=20261123-ember-fire-sword-gate-r1"));
 }
 assert.equal(existsSync(new URL("../.github/workflows/",import.meta.url)),false);
});
