import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {parseFinalChanceEvidence,resolveConditionalProbabilityEvidence}
 from "../src/conditional-probabilities.js";
import {resolveManaEvidence} from "../src/mana-evidence.js";
import {resolveSpellScenario} from "../src/spell-scenarios.js";
import {optimizeBuild,DAMAGE_TYPES,GOLD_TYPES} from "../src/engine.js";
import {calculateModeledScenario} from "../src/calculation-ledger.js";
import {gearSelectionEffects} from "../src/equipment-scenarios.js";
import {observedPetFairy} from "./fixtures/pet-fairy-comparison-20261116.js";
const cfg=(accountProfile,extra={})=>({
 accountProfile,damage:"Pet",gold:"Fairy",goldWeight:.7,skillPoints:0,
 maxStage:200000,currentLevels:{},minimums:{},qol:"none",
 sets:{},craftingPower:1,timeToKill:8,sClone:30,...extra
});
test("T: percent-labelled final chance observations are normalized without guessing units",()=>{
 const p=parseAccountProfile({Version:"8.4.0",playerStats:{
  "Critical Chance":"42.5%","Jackpot Gold Chance":"1e1%",
  "Multiple Titan Chance":"0%"
 }});
 assert.equal(p.chanceEvidence.schema,"tt2-final-chance-evidence-v1");
 assert.equal(p.chanceEvidence.families.critical.fraction,.425);
 assert.equal(p.chanceEvidence.families.jackpot.fraction,.1);
 assert.equal(p.chanceEvidence.families.multipleTitan.fraction,0);
 assert.equal(p.chanceEvidence.complete,true);
 const raw=parseFinalChanceEvidence({playerStats:{
  CritChance:"0.5",JackpotChance:50,MultipleTitanChance:0.75
 }});
 assert.equal(raw.complete,false);
 for(const row of Object.values(raw.families)){
  assert.equal(row.fraction,null);
  assert.equal(row.status,"ambiguous-or-invalid-percent");
 }
 const explicit=parseFinalChanceEvidence({playerStats:{
  CritChancePercent:"0.5",JackpotChancePercent:"100"
 }});
 assert.equal(explicit.families.critical.fraction,.005);
 assert.equal(explicit.families.jackpot.fraction,1);
});
test("T: conflicting, malformed and out-of-range observations are rejected together",()=>{
 const conflict=parseFinalChanceEvidence({
  playerStats:{"Critical Chance":"25%"},
  "CriticalChance":"50%"
 });
 assert.equal(conflict.families.critical.fraction,null);
 assert.equal(conflict.families.critical.status,"conflicting-observed-percent");
 const invalid=parseFinalChanceEvidence({playerStats:{
  "Critical Chance":"101%","Jackpot Gold Chance":"-1%",
  "Multiple Titan Chance":"banana"
 }});
 for(const row of Object.values(invalid.families))
  assert.equal(row.fraction,null);
 assert.equal(parseFinalChanceEvidence({}).families.critical.present,false);
 assert.equal(parseFinalChanceEvidence({playerStats:{"Critical Chance":"40%",
  CritChance:"40%"}}).families.critical.fraction,.4);
});
test("T: guaranteed HS critical is distinct from exported observed chance",()=>{
 const p=parseAccountProfile({playerStats:{
  "Critical Chance":"13%","Jackpot Gold Chance":"5%",
  "Multiple Titan Chance":"20%"
 }});
 const hs=resolveConditionalProbabilityEvidence(p,{damage:"Heavenly Strike"});
 assert.equal(hs.families.critical.observedFraction,.13);
 assert.equal(hs.families.critical.effectiveEventFraction,1);
 assert.equal(hs.families.critical.expectedEventsPer100Eligible,100);
 assert.equal(hs.families.jackpot.expectedEventsPer100Eligible,5);
 assert.equal(hs.families.multipleTitan.expectedEventsPer100Eligible,20);
 assert.equal(hs.expectedGoldOrStageBonusLog10,null);
 assert.equal(hs.probabilitiesAppliedToScore,false);
 const pet=resolveConditionalProbabilityEvidence(p,{damage:"Pet"});
 assert.equal(pet.families.critical.effectiveEventFraction,.13);
 const missing=resolveConditionalProbabilityEvidence(parseAccountProfile({}),
  {damage:"Shadow Clone"});
 assert.equal(missing.families.critical.expectedEventsPer100Eligible,null);
});
test("T: real one-cast mana affordability and initial drain are arithmetic, not uptime",()=>{
 const profile=parseAccountProfile({selectedSpells:["BurstDamage","HandOfMidas"],
  playerStats:{"Mana Pool":"1","Mana Regen per Second":"0.5"}});
 const settings=cfg(profile);
 const spells=resolveSpellScenario(settings);
 assert.equal(spells.selection.valid,true);
 assert.ok(spells.manaOneCast>1);
 const m=resolveManaEvidence(settings,{},spells,{
  baseDrain:{combined:1.5},assumptions:{maximumRampReached:true}
 });
 assert.equal(m.spellManaCostOneCastEach,spells.manaOneCast);
 assert.equal(m.sixSpellsAffordableAtOnce,false);
 assert.equal(m.fullRotationShortfall,spells.manaOneCast-1);
 assert.equal(m.fullRotationRemainingMana,1-spells.manaOneCast);
 assert.equal(m.spellAffordability.length,2);
 assert.ok(m.spellAffordability.every(row=>row.sourceCost!==null));
 assert.equal(m.passiveRegenOnlyPerMinute,30);
 assert.equal(m.passiveRegenOnlyRotationSeconds,spells.manaOneCast/.5);
 const nominal=spells.rows.reduce((n,row)=>
  n+row.finalManaCost/row.sourceDurationSeconds,0);
 assert.equal(m.sourceTableNominalManaPerSecond,nominal);
 assert.equal(m.passiveRegenMinusNominalSpellLoop,.5-nominal);
 assert.equal(m.initialRegenMinusContractDrain,-1);
 assert.equal(m.initialContractDrainCoveredByPassiveRegen,false);
 assert.equal(m.actualUptimeVerified,false);
 assert.equal(m.sustainedContractManaVerified,false);
 assert.equal(m.addedToSkillScore,false);
 assert.ok(m.notes.includes("one-cast-loadout-exceeds-exported-full-mana"));
});
test("T: missing final mana stats, no loadout or unknown cost never becomes free regen",()=>{
 const no=resolveManaEvidence(cfg(parseAccountProfile({})),{},null,null);
 assert.equal(no.spellAffordability.length,0);
 assert.equal(no.fullRotationShortfall,null);
 assert.equal(no.passiveRegenOnlyPerMinute,null);
 assert.equal(no.initialRegenMinusContractDrain,null);
 assert.equal(no.sourceTableNominalManaPerSecond,null);
 assert.equal(no.passiveRegenMinusNominalSpellLoop,null);
 assert.equal(no.sixSpellsAffordableAtOnce,null);
 const zero=resolveManaEvidence(cfg(parseAccountProfile({
  playerStats:{"Mana Pool":"0","Mana Regen per Second":"0"}
 })),{},null,{baseDrain:{combined:0}});
 assert.equal(zero.passiveRegenOnlyPerMinute,0);
 assert.equal(zero.initialContractDrainCoveredByPassiveRegen,true);
 assert.equal(zero.simulatedCastTimeline,false);
});
test("T: all eighteen builds carry observed probability and mana diagnostics without score leaks",()=>{
 const data={playerStats:{
  "Critical Chance":"35%","Jackpot Gold Chance":"17%",
  "Multiple Titan Chance":"9%","Mana Pool":"1",
  "Mana Regen per Second":"2"},selectedSpells:["BurstDamage","HandOfMidas"]};
 const withChances=parseAccountProfile(data);
 const withoutChances=parseAccountProfile({
  selectedSpells:data.selectedSpells,
  playerStats:{"Mana Pool":"1","Mana Regen per Second":"2"}});
 let count=0;
 for(const damage of DAMAGE_TYPES)for(const gold of GOLD_TYPES){
  const one=cfg(withChances,{damage,gold});
  const two=cfg(withoutChances,{damage,gold});
  const gearOne=gearSelectionEffects(withChances,one);
  const gearTwo=gearSelectionEffects(withoutChances,two);
  const resultOne=optimizeBuild(one);
  const resultTwo=optimizeBuild(two);
  const ledgerOne=calculateModeledScenario(resultOne,one,gearOne);
  const ledgerTwo=calculateModeledScenario(resultTwo,two,gearTwo);
  assert.ok(Number.isFinite(ledgerOne.totalLog10));
  assert.ok(Math.abs(ledgerOne.totalLog10-ledgerTwo.totalLog10)<1e-8);
  assert.equal(ledgerOne.conditionalProcs.numericallyObserved,3);
  assert.equal(ledgerOne.coverage.conditionalProcEvidence.numericallyObserved,3);
  assert.equal(ledgerOne.conditionalProcs.families.critical.effectiveEventFraction,
   damage==="Heavenly Strike"?1:.35);
  assert.equal(ledgerOne.conditionalProcs.probabilitiesAppliedToScore,false);
  assert.equal(ledgerOne.manaEvidence.sixSpellsAffordableAtOnce,false);
  assert.ok(ledgerOne.coverage.gaps.includes(
   "selected-spell-rotation-unaffordable-at-exported-mana"));
  assert.equal(ledgerOne.coverage.realStagePredictionValidated,false);
  count++;
 }
 assert.equal(count,18);
});
test("T: observed Pet/Fairy 750-stage fixture remains an external gate, not a log10 conversion",()=>{
 assert.equal(observedPetFairy.version,"8.4.0");
 assert.equal(observedPetFairy.observedStageDifference,750);
 const profile=parseAccountProfile({playerStats:{"Critical Chance":"20%"}});
 const evidence=resolveConditionalProbabilityEvidence(profile,{damage:"Pet",gold:"Fairy"});
 assert.equal(evidence.expectedGoldOrStageBonusLog10,null);
 assert.equal(evidence.families.critical.expectedEventsPer100Eligible,20);
});
