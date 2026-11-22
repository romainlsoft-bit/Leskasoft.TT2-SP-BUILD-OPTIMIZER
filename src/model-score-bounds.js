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
/** Upper bound of every gear/CT search state for one pet pair. */
export function visitedScoreEnvelope(rows){
 if(!Array.isArray(rows)||!rows.length)
  return {upperBound:null,unresolved:true,missing:0};
 let upper=Number.NEGATIVE_INFINITY,missing=0;
 for(const row of rows){
  const low=Number(row?.adjustedScore),value=row?.scoreUpperBound;
  if(!Number.isFinite(low))throw new RangeError("Invalid feasible score");
  if(value==null||!Number.isFinite(Number(value))||
     Number(value)<low-1e-8){missing++;continue;}
  upper=Math.max(upper,Number(value));
 }
 return {upperBound:missing?null:upper,unresolved:missing>0,missing};
}

export function rankVisitedCandidateBounds(candidates,winner,{epsilon=1e-8}={}){
 if(!Array.isArray(candidates)||!winner)
  return {compared:0,certifiedWithinVisited:false,
   unresolvedCompetitors:0,largestPossibleChallengerGain:null,
   winningFeasibleScore:null,winningUpperBound:null};
 const lower=Number(winner.adjustedScore);
 if(!Number.isFinite(lower))throw new RangeError("Invalid winning candidate score");
 const winnerHigh=winner.scoreUpperBound;
 let missing=winnerHigh==null?1:0;
 if(winnerHigh!=null&&(!Number.isFinite(Number(winnerHigh))||
   Number(winnerHigh)<lower-epsilon))missing++;
 let unresolved=0,largest=0;
 for(const candidate of candidates){
  if(candidate===winner)continue;
  const lo=Number(candidate.adjustedScore),raw=candidate.scoreUpperBound;
  if(!Number.isFinite(lo))throw new RangeError("Invalid competing feasible score");
  if(raw==null||!Number.isFinite(Number(raw))||
     Number(raw)<lo-epsilon){missing++;unresolved++;continue;}
  const hi=Number(raw);
  if(hi>lower+epsilon){unresolved++;largest=Math.max(largest,hi-lower);}
 }
 return {compared:candidates.length,
  certifiedWithinVisited:unresolved===0&&missing===0,
  unresolvedCompetitors:unresolved,boundsUnavailable:missing,
  largestPossibleChallengerGain:missing?null:largest,
  winningFeasibleScore:lower,
  winningUpperBound:winnerHigh==null?null:Number(winnerHigh),
  scope:"evaluated-candidates-and-current-additive-objective-only",
  noClaimAboutUnexploredConfigurations:true};
}
