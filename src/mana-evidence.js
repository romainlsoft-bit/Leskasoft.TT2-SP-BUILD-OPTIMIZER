/**
 * TT2 8.4 mana evidence. SkillTreeInfo2.0.csv provides resource magnitudes,
 * not an observed number of spell casts or Mana Siphon procs per second.
 * No mana regeneration/contract ramp/uptime is invented.
 */
import {skillInfo} from "../vendor/skills.js?v=20261120-math-safety-r3";
import {simulateContractTimeline} from "./contract-timeline.js?v=20261120-math-safety-r3";
const MANA_SKILLS=Object.freeze({
 MPCapacityBoost:["ManaPoolCap","AllManaSourceMult"],
 ManaStealSkillBoost:["ManaTapRegenAmount","ManaStealChance"],
 ManaMonster:["ManaMonsterAmount","ManaMonsterSpawnChance"]
});
const finiteNonnegative=value=>{
 if(value===undefined||value===null||value==="")return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=0?n:null;
};
function sourceSkill(id,level){
 const item=skillInfo[id],n=Number(level??0);
 if(!Number.isSafeInteger(n)||n<0||n>Number(item?.MaxLevel))
  return {id,level:null,bonusTypes:MANA_SKILLS[id],
   A:null,B:null,verified:false,status:"invalid-mana-talent-level"};
 const A=finiteNonnegative(item["A"+n]);
 const B=finiteNonnegative(item["B"+n]);
 return {id,level:n,bonusTypes:MANA_SKILLS[id],
  A,B,verified:A!==null&&B!==null,status:A!==null&&B!==null?
   "source-amount-no-proc-frequency":"missing-resource-table-row"};
}
export function resolveManaEvidence(settings={},levels={},spellScenario=null,contractScenario=null){
 const skills=Object.keys(MANA_SKILLS).map(id=>sourceSkill(id,levels[id]??0));
 const profile=settings?.accountProfile;
 // If the game provides current final mana stats, they already include
 // talents, passives and equipment. DO NOT apply source A/B again.
 const manaPool=finiteNonnegative(profile?.stats?.manaPool??settings?.manaPool);
 const manaRegen=finiteNonnegative(profile?.stats?.manaRegen??settings?.manaRegen);
 const costs=spellScenario?.manaOneCast??null;
 const drain=contractScenario?.baseDrain?.combined??null;
 const sixSpellsAffordableAtOnce=manaPool!==null&&costs!==null?
  manaPool>=costs:null;
 // Final exported pool/regeneration are snapshots; treating them as a
 // perpetual skill-invariant resource would double-count skill bonuses.
 const selectedSpellRows=spellScenario?.selection?.valid===true&&
  Array.isArray(spellScenario.rows)?spellScenario.rows:null;
 const spellAffordability=selectedSpellRows===null?[]:selectedSpellRows.map(row=>{
  const cost=finiteNonnegative(row.finalManaCost);
  const available=row.available===true;
  return {id:row.id,sourceCost:cost,available,
   affordableAtExportedFullPool:!available||manaPool===null||cost===null?
    null:manaPool>=cost,
   missingManaFromFullPool:!available||manaPool===null||cost===null?
    null:Math.max(0,cost-manaPool),
   sourceDurationSeconds:finiteNonnegative(row.sourceDurationSeconds),
   source:"8.4 ActiveSkillInfo final level; one cast, no multicast"};
 });
 const fullRotationRemainingMana=manaPool===null||costs===null?null:manaPool-costs;
 const fullRotationShortfall=fullRotationRemainingMana===null?null:
  Math.max(0,-fullRotationRemainingMana);
 const perMinute=manaRegen===null?null:60*manaRegen;
 const passiveRegenOnlyPerMinute=Number.isFinite(perMinute)?perMinute:null;
 const regenRotation=manaRegen===null||costs===null||
  !(manaRegen>0)?null:costs/manaRegen;
 const passiveRegenOnlyRotationSeconds=Number.isFinite(regenRotation)?regenRotation:null;
 // Source-table nominal loop: one cast per base spell Duration. Actual
 // duration, multi-cast, triggers and skill-dependent reductions may change
 // every term. It is only a transparent arithmetic reference.
 const nominalRows=spellAffordability.filter(row=>row.available&&
  row.sourceCost!==null&&row.sourceDurationSeconds>0);
 const nominalLoop=selectedSpellRows!==null&&selectedSpellRows.length>0&&
  nominalRows.length===selectedSpellRows.length?
   nominalRows.reduce((sum,row)=>sum+row.sourceCost/row.sourceDurationSeconds,0):null;
 const sourceTableNominalManaPerSecond=Number.isFinite(nominalLoop)?nominalLoop:null;
 const passiveRegenMinusNominalSpellLoop=manaRegen===null||
  sourceTableNominalManaPerSecond===null?null:
  manaRegen-sourceTableNominalManaPerSecond;
 // Contracts may drain increasingly fast. Only the initial instantaneous
 // comparison is sourced. No forecast of exhaustion or actual uptime:
 // siphon events and Manni Mana opportunities are not exported.
 const initialRegenMinusContractDrain=manaRegen===null||drain===null?
  null:manaRegen-drain;
 const initialContractDrainCoveredByPassiveRegen=
  initialRegenMinusContractDrain===null?null:initialRegenMinusContractDrain>=0;
 // A user-configured, deterministic what-if: never folded into the score.
 const contractTimeline=simulateContractTimeline(levels,settings?.contractTimeline);
 const notes=[];
 if(manaPool===null)notes.push("exported-final-mana-pool-missing");
 if(manaRegen===null)notes.push("exported-final-mana-regen-missing");
 if(costs===null)notes.push("spell-rotation-mana-cost-unverified");
 if(sixSpellsAffordableAtOnce===false)notes.push("one-cast-loadout-exceeds-exported-full-mana");
 if(initialContractDrainCoveredByPassiveRegen===false)
  notes.push("contract-initial-drain-exceeds-passive-regen");
 if(contractScenario?.assumptions?.maximumRampReached)
  notes.push("contract-mana-drain-grows-over-time");
 notes.push("mana-siphon-taps-per-second-not-exported");
 notes.push("mana-monster-spawn-rate-not-verified");
 notes.push("effective-spell-duration-and-multicast-mana-costs-unverified");
 return {schema:"tt2-mana-evidence-v1",skills,skillSource:"8.4 SkillTreeInfo2.0.csv",
  exportedFinalManaPool:manaPool,exportedFinalManaRegenPerSecond:manaRegen,
  spellManaCostOneCastEach:costs,
  initialContractDrainPerSecond:drain,
  sixSpellsAffordableAtOnce,spellAffordability,
  fullRotationRemainingMana,fullRotationShortfall,
  passiveRegenOnlyPerMinute,passiveRegenOnlyRotationSeconds,
  sourceTableNominalManaPerSecond,passiveRegenMinusNominalSpellLoop,
  initialRegenMinusContractDrain,initialContractDrainCoveredByPassiveRegen,
  resourceArithmeticMode:"known-one-cast-full-pool-and-initial-drain-only",
  addedToSkillScore:false,
  // The above comparison is a single simultaneous cast budget, NOT the
  // actual sustainable number of spells; regeneration and recasts differ.
  independentManaSourceEffectsNotAddedToExportedStats:true,
  contractTimeline,
  simulatedContractTimeline:contractTimeline.status==="simulated",
  simulatedCastTimeline:false, // Contract ticks do not simulate spell casts.
  actualUptimeVerified:false,
  sustainedContractManaVerified:false,notes,complete:false};
}
