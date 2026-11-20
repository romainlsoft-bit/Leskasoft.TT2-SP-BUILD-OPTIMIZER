/**
 * Source-visible "per Transcendence season day" monument diagnostics.
 * TT2 8.4 catalog identifies the source multiplier and season-day condition.
 *
 * Game Hive confirms that these sources grow each season day, but the
 * native exact stacking rule is NOT verified.  Do not turn the illustrated
 * value into fixed AllDamage, critical or gold bonuses automatically.
 */
import {equipmentEffectReduction} from "./equipment-reductions.js";

const ROUTES=Object.freeze({
 AllDamagePerSeasonDay:"AllDamage",
 CritDamagePerSeasonDay:"CritDamage"
});
const finite=x=>typeof x==="number"&&Number.isFinite(x);
export function monumentSeasonDayEvidence(monuments,settings={}){
 const rows=(monuments?.entries||[]).filter(x=>x.perSeasonDay===true);
 const days=monuments?.seasonDays;
 const validDays=Number.isSafeInteger(days)&&days>=0;
 const entries=rows.map(row=>{
  const route=ROUTES[row.type]||null;
  // The catalog main effect is the per-day coefficient, *not*
  // a guaranteed whole-season score.
  const perDayLog=finite(row.baseEffectLog10)?row.baseEffectLog10:null;
  const eligible=row.categoryAllowed===true &&
   row.seasonCategorySource==="official-season-categories"&&
   row.formulaStatus==="computed-unscored-interaction";
  const weight=route?equipmentEffectReduction(route,settings).weight:null;
  const illustrated=eligible&&validDays&&perDayLog!==null&&
   Number.isFinite(perDayLog*days)?perDayLog*days:null;
  return {id:row.id,sourceBonusType:row.type,
   sourcePerDayLog10:perDayLog,days:validDays?days:null,
   currentSeasonEligibilityVerified:eligible,
   hypotheticalCompoundedSeasonLog10:illustrated,
   conversionRoute:route,
   sourceDamageWeight:finite(weight)?weight:null,
   eligibleForCurrentSourceDamage:illustrated!==null&&finite(weight)&&weight>0,
   actualNativeSeasonDayFormulaVerified:false,
   appliedToAccountScore:false,
   appliedToOptimizationScore:false,
   status:illustrated!==null?"hypothetical-daily-compounding-only":
    "unresolved-source-or-season-days"};
 });
 return {schema:"tt2-monument-season-day-audit-v1",
  totalEntries:rows.length,illustrableEntries:entries.filter(x=>
   x.hypotheticalCompoundedSeasonLog10!==null).length,
  uncreditedEntries:rows.length,entries,
  seasonVerified:monuments?.seasonVerified===true,
  seasonDays:validDays?days:null,
  nativeFormulaVerified:false,addedToScore:false,
  sourceLimited:true,complete:false,
  warning:"Per-day source level is known; actual effective gameplay multiplier requires verified native stacking."};
}
