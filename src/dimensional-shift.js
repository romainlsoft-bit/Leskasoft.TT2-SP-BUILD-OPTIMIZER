/**
 * Source-local Dimensional Shift primary-spell effect in the existing
 * selected maximum-spell scenario. Never infer actual spell uptime.
 * See docs/DIMENSIONAL_SHIFT.md for provenance and model limits.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {spellInfo,spell_reductions} from "../vendor/spells.js?v=20261123-boss-specials-r1";
import {ACTIVE_SPELL_CAPS} from "../vendor/active-spell-caps.js?v=20261123-boss-specials-r1";
import {spellSelectionEvidence,spellEffectScorable} from "./spell-scenarios.js?v=20261123-boss-specials-r1";
import {spellTableIndex} from "./spell-caps.js?v=20261123-boss-specials-r1";
import {positiveLog10} from "./account-artifacts.js?v=20261123-boss-specials-r1";

const weight=value=>typeof value==="number"&&Number.isFinite(value)&&value>=0?value:0;

export function dimensionalShiftEvidence(level,settings={}){
 const row=skillInfo.BossTimer,n=Number(level);
 if(!Number.isSafeInteger(n)||n<0||n>Number(row.MaxLevel))
  throw new RangeError("Invalid Dimensional Shift level");
 if(row.BonusTypeA!=="ShadowCloneAllSkillBoost"||
    row.BonusTypeB!=="ShadowCloneAllSkillDurationRate")
  throw new Error("Dimensional Shift source fields changed");
 const sourceFactor=n===0?1:Number(row["A"+n]);
 if(!Number.isFinite(sourceFactor)||sourceFactor<1)
  throw new Error("Invalid Dimensional Shift source multiplier");
 const selection=spellSelectionEvidence(settings);
 const eligible=spellEffectScorable("ShadowClone",settings);
 const fallenAngel=Boolean(settings.sets?.tFA||settings.accountProfile?.ownedSetIds?.includes("DarkAngel"));
 const goldPriority=weight(Number(settings.goldWeight));
 const rows=selection.ids.map(id=>{
  const baseLevel=ACTIVE_SPELL_CAPS[id].baseCap+(fallenAngel?5:0);
  const primary=positiveLog10(spellInfo[id]?.["A"+spellTableIndex(baseLevel)]);
  const modeled=eligible&&spellEffectScorable(id,settings)&&primary!==null;
  const damageWeight=weight(spell_reductions[id]?.[settings.damage]);
  const goldWeight=weight(spell_reductions[id]?.[settings.gold]);
  return {id,modeled,damageWeight,goldWeight,
   combinedWeight:modeled?damageWeight+goldPriority*goldWeight:0};
 });
 const totalWeight=rows.reduce((sum,r)=>sum+r.combinedWeight,0);
 return {schema:"tt2-dimensional-shift-primary-spell-proxy-v1",level:n,
  eligible,selectionVerified:selection.valid,
  completeForSelectedPrimaryProxy:eligible&&rows.length>0&&rows.every(r=>r.modeled),
  rows,totalWeight,sourceFactor,
  scoreLog10:totalWeight*Math.log10(sourceFactor),
  sourceDurationRate:n===0?1:Number(row["B"+n]),
  durationAddedToDamage:false,actualUptimeVerified:false,
  usesExistingSpellReductionProxy:true,addedToSpellBaseline:false,
  addedToFixedAccount:false,predictsStageGain:false};
}
