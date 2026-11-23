/**
 * Local, two-point Tactical Insight calibration for TT2 8.4.
 *
 * Measured identical Stats conditions at two TI levels supply an actual
 * log10(delta damage) and log10(delta gold) for ONE damage/gold route.
 * Community reduction coefficients are never mixed into this score.
 *
 * The source A field (+multiplicative hero-power %) is only an interpolation
 * COORDINATE inside the observed interval. It is NOT a proven hero-power
 * count or a derived native skill formula. B's additive hero-power effect
 * is already present in the measured delta, never added again.
 *
 * Never extrapolate outside the measured levels. The optimizer must enforce
 * [lowerLevel, upperLevel] as a hard local-calibration scope.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {parseObservedHitLog10} from "./boss-push-evidence.js?v=20261123-boss-specials-r1";
const SKILL="HelperBoost";
const row=skillInfo[SKILL];
const maximum=Number(row.MaxLevel);
const levelNumber=value=>{
 const n=Number(value);
 if(value===null||value===undefined||String(value).trim()===""||
    !Number.isSafeInteger(n)||n<0||n>maximum)
  throw new RangeError("Tactical Insight calibration levels must be valid source talent levels");
 return n;
};
const measuredStat=(value,name)=>{
 let result;
 try{result=parseObservedHitLog10(value);}
 catch{throw new RangeError("Invalid "+name+" Stats measurement");}
 if(result===null||!Number.isFinite(result))
  throw new RangeError("Missing "+name+" Stats measurement");
 return result;
};
const coordinate=level=>{
 const amount=Number(row["A"+level]);
 if(!Number.isFinite(amount)||amount<0)
  throw new RangeError("Invalid native Tactical Insight A bonus");
 return Math.log1p(amount);
};
/** Return a non-sensitive, validated local calibration; no raw Stats values. */
export function resolveTacticalInsightLocal(settings={}){
 const raw=settings.tacticalInsightCalibration;
 if(raw?.enabled!==true)return {enabled:false,mode:"community-proxy-or-excluded"};
 if(settings.excludeUnverifiedTacticalInsight===true)
  throw new RangeError("Choose either measured Tactical Insight or its exclusion experiment");
 if(raw.damage!==settings.damage||raw.gold!==settings.gold)
  throw new RangeError("Tactical Insight observations belong to a different damage/gold build");
 const lowerLevel=levelNumber(raw.lowerLevel);
 const upperLevel=levelNumber(raw.upperLevel);
 if(upperLevel<=lowerLevel)
  throw new RangeError("Tactical Insight upper calibration level must exceed lower level");
 const lo=coordinate(lowerLevel),hi=coordinate(upperLevel);
 if(!(hi>lo))
  throw new RangeError("Native Tactical Insight interpolation coordinate is not increasing");
 const beforeDamage=measuredStat(raw.lowerDamage,"lower damage");
 const afterDamage=measuredStat(raw.upperDamage,"upper damage");
 const beforeGold=measuredStat(raw.lowerGold,"lower gold");
 const afterGold=measuredStat(raw.upperGold,"upper gold");
 // This is a same-buffs, same-target controlled two-point experiment.
 // A decrease is more likely an invalid observation than a TI penalty:
 // do not convert an uncontrolled buff loss into a negative hero power.
 const damageGainLog10=afterDamage-beforeDamage,
       goldGainLog10=afterGold-beforeGold;
 if(damageGainLog10<0||goldGainLog10<0)
  throw new RangeError("Higher Tactical Insight level has lower Stats; compare identical conditions");
 if(damageGainLog10===0&&goldGainLog10===0)
  throw new RangeError("No measurable Tactical Insight change between observations");
 return {schema:"tt2-84-tactical-insight-two-point-local-v1",
  enabled:true,mode:"measured-local",damage:settings.damage,gold:settings.gold,
  lowerLevel,upperLevel,damageGainLog10,goldGainLog10,
  sourceCoordinateLow:lo,sourceCoordinateHigh:hi,
  sourceAType:row.BonusTypeA,sourceBType:row.BonusTypeB,
  additiveHeroPowersAlreadyIncludedInObservedDelta:true,
  sameStatsConditionsAssertedByUserNotVerified:true,
  observedMetricsSameConditionsAssumedNotVerified:true,
  extrapolationAllowed:false,heroSkillRosterKnown:false,
  observedWholeBossDamage:false,gameplayCalibrationVerified:false};
}
/** Score is relative to the LOWER observed level, which is mandatory in DP.
 * Gold weight is the same independent user preference as the existing model.
 */
export function tacticalInsightLocalScore(level,settings={}){
 const calibration=settings.resolvedTacticalInsightLocal?.enabled===true?
  settings.resolvedTacticalInsightLocal:resolveTacticalInsightLocal(settings);
 if(!calibration.enabled)return null;
 const n=levelNumber(level);
 // The score table is also calculated at 0..MaxLevel for other diagnostics.
 // Clamp OUTSIDE the measured interval, but never let the solver choose
 // those levels: min/max are hard-constrained in optimizeBuild.
 const clamped=Math.max(calibration.lowerLevel,
  Math.min(calibration.upperLevel,n));
 const coordinateDelta=calibration.sourceCoordinateHigh-calibration.sourceCoordinateLow;
 const fraction=(coordinate(clamped)-calibration.sourceCoordinateLow)/coordinateDelta;
 const goldWeight=Number(settings.goldWeight);
 if(!Number.isFinite(goldWeight)||goldWeight<0||goldWeight>2)
  throw new RangeError("Invalid Tactical Insight calibration gold preference");
 const result=fraction*(calibration.damageGainLog10+
  goldWeight*calibration.goldGainLog10);
 if(!Number.isFinite(result))
  throw new RangeError("Invalid Tactical Insight local calibration score");
 return result;
}
