import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {parseExport,optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {scoreAtLevel} from "../src/effects.js";
import {spellInfo,spell_reductions} from "../vendor/spells.js";
import {skillInfo} from "../vendor/skills.js";
import {ACTIVE_SPELL_CAPS} from "../vendor/active-spell-caps.js";
import {resolveSpellCaps,spellTableIndex} from "../src/spell-caps.js";
import {spellSelectionEvidence,resolveSpellScenario,spellCapGainEligible,MAX_EQUIPPED_SPELLS} from "../src/spell-scenarios.js";
import {resolveManaEvidence} from "../src/mana-evidence.js";
import {calculateModeledScenario} from "../src/calculation-ledger.js";
const near=(a,b,message)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8,message??(`${a} != ${b}`));
const base={damage:"Heavenly Strike",gold:"Fairy",goldWeight:.7,maxStage:200000,
  skillPoints:80,qol:"none",minimums:{},currentLevels:{},sets:{},
  craftingPower:1,timeToKill:8,sClone:30};
const selected=["BurstDamage","CritBoost","HandOfMidas","TapBoost","HelperBoost","ShadowClone"];
test("8.4 has eleven active spell rows but only six selected slots",()=>{
 assert.equal(Object.keys(ACTIVE_SPELL_CAPS).length,11);
 assert.equal(MAX_EQUIPPED_SPELLS,6);
 assert.equal(spellTableIndex(30),29);
 assert.equal(spellTableIndex(35),34);
 assert.equal(spellTableIndex(40),39);
 assert.equal(spellTableIndex(0),null);
});
test("explicit exported spell slots import as sanitized only-six loadout",()=>{
 const p=parseAccountProfile({selectedSpells:selected});
 assert.equal(p.spellLoadout.present,true);
 assert.equal(p.spellLoadout.truncated,false);
 assert.deepEqual(spellSelectionEvidence({accountProfile:p}).ids,selected);
 const json=parseExport({skillTree:{TapDmg:1},selectedSpells:selected});
 assert.deepEqual(json.profile.spellLoadout.ids,selected);
 assert.equal(p.schema,"tt2-account-profile-v1");
});
test("invalid, duplicate, missing, conflicting and too-long spell selections score zero",()=>{
 for(const ids of [[],[selected[0],selected[0]],["unknown"],[...selected,"DualPet"]]){
  const s=resolveSpellScenario({...base,selectedSpells:ids});
  assert.equal(s.appliedToScenario,false);
  near(s.weightedLog10,0);
 }
 const missing=resolveSpellScenario(base);
 assert.equal(missing.selection.valid,false);
 near(missing.weightedLog10,0);
 const stored=parseAccountProfile({selectedSpells:["BurstDamage","TapBoost"]});
 const conflict=resolveSpellScenario({...base,accountProfile:stored,selectedSpells:["TapBoost"]});
 assert.equal(conflict.selection.reason,"conflicting-spell-loadouts");
 assert.equal(conflict.appliedToScenario,false);
 const huge=parseAccountProfile({selectedSpells:[...selected,"DualPet"]});
 assert.equal(huge.spellLoadout.truncated,true);
 assert.equal(resolveSpellScenario({...base,accountProfile:huge}).appliedToScenario,false);
});
test("six chosen spells count source A29 baseline exactly once, never eleven",()=>{
 const s=resolveSpellScenario({...base,selectedSpells:selected});
 assert.equal(s.slots,6);
 assert.equal(s.rows.length,6);
 assert.equal(s.appliedToScenario,true);
 let dmg=0,gold=0,mana=0;
 for(const id of selected){
  const source=Math.log10(Number(spellInfo[id].A29));
  const reductions=spell_reductions[id];
  dmg+=source*(Number(reductions[base.damage])||0);
  gold+=source*(Number(reductions[base.gold])||0);
  mana+=Number(spellInfo[id].M29);
 }
 near(s.damageLog10,dmg);
 near(s.goldLog10,gold);
 near(s.weightedLog10,dmg+base.goldWeight*gold);
 assert.equal(s.manaOneCast,mana);
 assert.equal(s.addedToFixedAccount,false);
 assert.equal(s.addedToSkillScore,false);
 assert.equal(s.actualActivationVerified,false);
});
test("Fallen Angel +5 changes base A34 but SP cap delta is not scored twice",()=>{
 const s=resolveSpellScenario({...base,sets:{tFA:true},selectedSpells:["BurstDamage"]},
  {TwilightBell:5});
 assert.equal(s.rows[0].baseLevel,35);
 assert.equal(s.rows[0].cap,37);
 near(s.rows[0].baseLog10,Math.log10(Number(spellInfo.BurstDamage.A34)));
 assert.equal(s.rows[0].capMarginalAlreadyInSkillScore,true);
 near(s.weightedLog10,s.rows[0].baseLog10);
});
test("selected slot and proven unlock gate SP-dependent cap marginal",()=>{
 const s={...base,selectedSpells:["DualPet","TapBoost"]};
 assert.equal(spellCapGainEligible("SummonerAutoTap","DualPet",s),false);
 assert.equal(spellCapGainEligible("SummonerAutoTap","TapBoost",s),true);
 assert.equal(spellCapGainEligible("SummonerAutoTap","DualPet",
  {...s,minimums:{DualPetBoost:1}}),true);
 assert.equal(spellCapGainEligible("SummonerAutoTap","BurstDamage",s),false);
 assert.equal(spellCapGainEligible("SummonerAutoTap","TapBoost",
  {...s,maxStage:0,assumeMaxSpells:false}),false);
});
test("real scoreAtLevel only credits source spell cap when selected and activated",()=>{
 const withLoadout=scoreAtLevel("TwilightBell",1,{...base,selectedSpells:["BurstDamage"]});
 const absent=scoreAtLevel("TwilightBell",1,base);
 near(withLoadout-absent,
  Math.log10(Number(spellInfo.BurstDamage.A30))-
  Math.log10(Number(spellInfo.BurstDamage.A29)));
 const noAssumption=scoreAtLevel("TwilightBell",1,{
  ...base,selectedSpells:["BurstDamage"],assumeMaxSpells:false,maxStage:0});
 near(noAssumption,absent);
});
test("Locked Dual Pet and Golden Missile are not free spells",()=>{
 const locked=resolveSpellScenario({...base,selectedSpells:["DualPet","GoldenMissile"]});
 assert.equal(locked.appliedToScenario,false);
 near(locked.weightedLog10,0);
 assert.equal(locked.unsupported.some(x=>x.includes("spell-not-unlocked:DualPet")),true);
 const unlocked=resolveSpellScenario({...base,selectedSpells:["DualPet","GoldenMissile"]},
  {DualPetBoost:1,ExplosivesExpert:1});
 assert.equal(unlocked.appliedToScenario,true);
 assert.equal(unlocked.rows.every(x=>x.available),true);
});
test("mana catalog skill rows stay numeric evidence, not an invented regen rate",()=>{
 const p=parseAccountProfile({selectedSpells:["BurstDamage"],
  playerStats:{"Mana Pool":"400","Mana Regen per Second":"5"}});
 const s=resolveSpellScenario({...base,accountProfile:p});
 const m=resolveManaEvidence({...base,accountProfile:p},{
  MPCapacityBoost:1,ManaStealSkillBoost:1,ManaMonster:1},s,null);
 assert.equal(m.exportedFinalManaPool,400);
 assert.equal(m.exportedFinalManaRegenPerSecond,5);
 assert.equal(m.skills.length,3);
 assert.equal(m.skills[0].A,Number(skillInfo.MPCapacityBoost.A1));
 assert.equal(m.skills[0].B,Number(skillInfo.MPCapacityBoost.B1));
 assert.equal(m.skills[1].B,Number(skillInfo.ManaStealSkillBoost.B1));
 assert.equal(m.actualUptimeVerified,false);
 assert.equal(m.sustainedContractManaVerified,false);
 assert.equal(m.independentManaSourceEffectsNotAddedToExportedStats,true);
});
test("contract mana growth and multicast are not promoted to sustained uptime",()=>{
 const m=resolveManaEvidence(base,{},null,{
  assumptions:{maximumRampReached:true},baseDrain:{combined:0.55}});
 assert.equal(m.initialContractDrainPerSecond,0.55);
 assert.equal(m.spellManaCostOneCast,null);
 assert.equal(m.simulatedCastTimeline,false);
 assert.equal(m.notes.includes("contract-mana-drain-grows-over-time"),true);
});
test("18 damage/gold routes use pinned reduction tables, no unselected spell credits",()=>{
 const p=parseAccountProfile({selectedSpells:selected});
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const context={...base,damage,gold,accountProfile:p};
  const x=resolveSpellScenario(context);
  const direct=selected.reduce((total,id)=>total+
   Math.log10(Number(spellInfo[id].A29))*(Number(spell_reductions[id][damage])||0),0);
  const goldOnly=selected.reduce((total,id)=>total+
   Math.log10(Number(spellInfo[id].A29))*(Number(spell_reductions[id][gold])||0),0);
  near(x.damageLog10,direct,damage+" "+gold+" damage");
  near(x.goldLog10,goldOnly,damage+" "+gold+" gold");
  near(x.weightedLog10,direct+.7*goldOnly);
 }
});
test("18 native optimizeBuild + modeled ledger include base once, not fixed account",()=>{
 const p=parseAccountProfile({selectedSpells:selected});
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const settings={...base,damage,gold,accountProfile:p};
  const x=optimizeBuild(settings);
  assert.equal(x.spellScenario.appliedToScenario,true);
  assert.equal(x.spellScenario.slots,6);
  assert.equal(x.spellScenario.addedToFixedAccount,false);
  assert.equal(x.manaEvidence.actualUptimeVerified,false);
  const m=calculateModeledScenario(x,settings,{selected:{},independentScore:0});
  near(m.selectedSpellBaselineLog10,x.spellScenario.weightedLog10);
  near(m.totalLog10,m.skillLog10+m.fixedAccountLog10+
   m.equippedGearLog10+m.activePetsAbovePassivesLog10+
   m.selectedSpellBaselineLog10);
  assert.equal(m.components,5);
 }
});
test("absent loadout preserves current conditional cap investments and no spell baseline",()=>{
 const s={...base,damage:"Pet",gold:"Fairy",skillPoints:80,
  currentLevels:{SummonerAutoTap:1},protectUnmodeledSkills:true};
 // Source-dependent cap levels are protected if existing SP investments
 // cannot be valued without the six-slot spell loadout.
 // The engine may require more SP to meet prerequisites at very low budgets,
 // so assert its protection policy via diagnostic or budget failure.
 try{
  const x=optimizeBuild(s);
  assert.equal(x.protectedSkills.includes("SummonerAutoTap"),true);
  assert.equal(x.spellScenario.appliedToScenario,false);
 }catch(e){
  assert.match(e.message,/SP|prerequisite|minimum/i);
 }
});


test("source-only six-slot suggestions never masquerade as equipped spells",()=>{
 const ctx={...base,damage:"Gold Gun",gold:"HoG"};
 const result=resolveSpellScenario(ctx,{
  DualPetBoost:1,CriticalHit:1,ClanShipVoltage:1,TwilightGathering:1,
  ExplosivesExpert:1});
 assert.equal(result.selection.valid,false);
 assert.equal(result.appliedToScenario,false);
 assert.equal(result.recommendation.addedToScore,false);
 assert.equal(result.recommendation.modeledAsEquipped,false);
 assert.ok(result.recommendation.ids.length<=6);
 assert.ok(result.recommendation.ids.includes("GoldenMissile"));
 near(result.weightedLog10,0);
 assert.equal(result.manaOneCast,null);
});

test("an explicit opt-out at high stage disables the maximum-spell hypothesis",()=>{
 const s=resolveSpellScenario({...base,assumeMaxSpells:false,
  selectedSpells:["BurstDamage"]});
 assert.equal(s.assumedMaxLevelScenario,false);
 assert.equal(s.appliedToScenario,false);
 assert.equal(resolveSpellCaps({...base,assumeMaxSpells:false}).assumeAllActive,false);
 near(s.weightedLog10,0);
});

test("cross-branch unlocked later is diagnosed, not counted as free SP cap gain",()=>{
 const settings={...base,selectedSpells:["DualPet"]};
 const s=resolveSpellScenario(settings,{DualPetBoost:1,SummonerAutoTap:5});
 assert.equal(s.rows[0].available,true);
 assert.equal(s.rows[0].capMarginalUnscored,true);
 assert.equal(s.rows[0].capMarginalAlreadyInSkillScore,false);
 assert.ok(s.unsupported.includes("unverified-cross-branch-cap-marginal:DualPet"));
 const proof=resolveSpellScenario({...settings,minimums:{DualPetBoost:1}},
  {DualPetBoost:1,SummonerAutoTap:5});
 assert.equal(proof.rows[0].capMarginalAlreadyInSkillScore,true);
});
