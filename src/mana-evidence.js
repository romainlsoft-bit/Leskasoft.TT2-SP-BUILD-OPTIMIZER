/**
 * TT2 8.4 mana evidence. SkillTreeInfo2.0.csv provides resource magnitudes,
 * not an observed number of spell casts or Mana Siphon procs per second.
 * No mana regeneration/contract ramp/uptime is invented.
 */
import {skillInfo} from "../vendor/skills.js";
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
 const notes=[];
 if(manaPool===null)notes.push("exported-final-mana-pool-missing");
 if(manaRegen===null)notes.push("exported-final-mana-regen-missing");
 if(costs===null)notes.push("spell-rotation-mana-cost-unverified");
 if(contractScenario?.assumptions?.maximumRampReached)
  notes.push("contract-mana-drain-grows-over-time");
 notes.push("mana-siphon-taps-per-second-not-exported");
 notes.push("mana-monster-spawn-rate-not-verified");
 notes.push("effective-spell-duration-and-multicast-mana-costs-unverified");
 return {schema:"tt2-mana-evidence-v1",skills,skillSource:"8.4 SkillTreeInfo2.0.csv",
  exportedFinalManaPool:manaPool,exportedFinalManaRegenPerSecond:manaRegen,
  spellManaCostOneCastEach:costs,
  initialContractDrainPerSecond:drain,
  sixSpellsAffordableAtOnce,
  // The above comparison is a single simultaneous cast budget, NOT the
  // actual sustainable number of spells; regeneration and recasts differ.
  independentManaSourceEffectsNotAddedToExportedStats:true,
  simulatedCastTimeline:false,actualUptimeVerified:false,
  sustainedContractManaVerified:false,notes,complete:false};
}
