/**
 * Compare feasible modeled scores without pretending that a bounded-grid
 * SP solution is exact. For every evaluated fixed gear/pet scenario, the
 * branch-DP optimum lies in [score, score+(SP_upper - SP_lower)].
 * The other (fixed, gear and pet) ledger components are constants for
 * that scenario. No game-progress/stage conversion is involved.
 */
export function modeledCandidateUpperBound(result,modeledLog10){
 const low=Number(result?.score);
 const rawUpper=Number(result?.optimality?.upperBound);
 if(!Number.isFinite(low)||!Number.isFinite(rawUpper)||
    !Number.isFinite(modeledLog10))
  throw new RangeError("Non-finite candidate score bound");
 const slack=rawUpper-low;
 if(slack< -1e-7*Math.max(1,Math.abs(low)))
  throw new RangeError("DP upper bound below its feasible lower bound");
 const upper=modeledLog10+Math.max(0,slack);
 if(!Number.isFinite(upper))throw new RangeError("Candidate upper bound overflow");
 return upper;
}

/**
 * Certifies that the selected feasible candidate dominates all OTHER
 * evaluated candidates' theoretical score upper bounds, up to epsilon.
 * Does not claim that unexplored gear or pets were enumerated, or that
 * the additive game model captures all conditional interactions.
 */
export function rankVisitedCandidateBounds(candidates,winner,{epsilon=1e-8}={}){
 if(!Array.isArray(candidates)||!winner)
  return {compared:0,certifiedWithinVisited:false,
   unresolvedCompetitors:0,largestPossibleChallengerGain:null,
   winningFeasibleScore:null,winningUpperBound:null};
 const lower=Number(winner.adjustedScore);
 const upper=winner.scoreUpperBound===undefined?lower:Number(winner.scoreUpperBound);
 if(!Number.isFinite(lower)||!Number.isFinite(upper)||upper<lower-epsilon)
  throw new RangeError("Invalid winning candidate bounds");
 let unresolved=0,largest=0;
 for(const candidate of candidates){
  if(candidate===winner)continue;
  const lo=Number(candidate.adjustedScore);
  const hi=candidate.scoreUpperBound===undefined?lo:Number(candidate.scoreUpperBound);
  if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<lo-epsilon)
   throw new RangeError("Invalid competing candidate bounds");
  if(hi>lower+epsilon){
   unresolved++;
   largest=Math.max(largest,hi-lower);
  }
 }
 return {compared:candidates.length,certifiedWithinVisited:unresolved===0,
  unresolvedCompetitors:unresolved,largestPossibleChallengerGain:largest,
  winningFeasibleScore:lower,winningUpperBound:upper,
  scope:"evaluated-candidates-and-current-additive-objective-only",
  noClaimAboutUnexploredConfigurations:true};
}
