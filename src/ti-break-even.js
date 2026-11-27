/**
 * An exact affine comparison of TWO fixed trees in the existing model.
 * f=0 removes only the historical TI coefficient; f=1 retains it.
 * The interval is a sensitivity experiment, not a confidence interval.
 */
export function coefficientBreakEven(excludedDelta,communityDelta){
 if(!Number.isFinite(excludedDelta)||!Number.isFinite(communityDelta))
  throw new RangeError("Finite Tactical Insight score differences required");
 const a=excludedDelta,b=communityDelta;
 const tolerance=1e-8*Math.max(1,Math.abs(a),Math.abs(b));
 const sign=x=>Math.abs(x)<=tolerance?0:Math.sign(x);
 const sa=sign(a),sb=sign(b);
 const status=sa*sb<0?"crossing":sa===0&&sb===0?"indistinguishable":
  sa>=0&&sb>=0?"positive-nonnegative-throughout":
  "negative-nonpositive-throughout";
 // Interpolate the endpoints rather than introducing a new skill weight.
 const crossingFraction=status==="crossing"?Math.abs(a)/(Math.abs(a)+Math.abs(b)):null;
 return {schema:"tt2-ti-affine-sensitivity-v1",status,
  excludedDelta:a,communityDelta:b,
  crossingFraction,aboveThreshold:status==="crossing"?(sb>0?"positive":"negative"):null,
  belowThreshold:status==="crossing"?(sa>0?"positive":"negative"):null,
  minimumDelta:Math.min(a,b),maximumDelta:Math.max(a,b),
  deltaAtHalfWeight:a/2+b/2,
  positiveStrictlyThroughout:sa>0&&sb>0,
  negativeStrictlyThroughout:sa<0&&sb<0,
  testedFixedTreesOnly:true,coefficientCalibrated:false,
  intervalIsConfidenceInterval:false,changesAllocation:false};
}
