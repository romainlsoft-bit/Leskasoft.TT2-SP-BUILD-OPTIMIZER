import {rankVisitedCandidateBounds,visitedScoreEnvelope} from "./model-score-bounds.js?v=20261123-boss-specials-r1";
import {MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS} from "./gear-search-policy.js?v=20261123-boss-specials-r1";
/**
 * Block-coordinate refinement between the ACTUAL equipped gear and the
 * optimized skill tree for one chosen pair of active pets.
 *
 * Previously gear was selected at CT=0 before the solver, and then kept
 * forever even when Combat Techniques reached 50. That is not a coupled
 * choice: a different helmet/primary may become best at the final CT.
 *
 * This is monotone best-seen refinement over the modeled proxy, not proof
 * of a global optimum over every possible gear × SP × pet configuration.
 * Cache signatures remain the responsibility of optimizeBuild.
 */
const SLOTS=Object.freeze(["Sword","Helmet","Armor","Slash","Aura"]);
export const gearSignature=gear=>JSON.stringify(SLOTS.map(k=>
 gear?.selected?.[k]?.id??null));
export function refineCoupledGearAndSkills(settings,{gearFor,solve,score,upperBoundOf,maxRounds=3,initialCT=0}={}){
 if(typeof gearFor!=="function"||typeof solve!=="function"||typeof score!=="function")
  throw new TypeError("Joint gear/SP search requires gearFor, solve and score");
 if(!Number.isSafeInteger(maxRounds)||maxRounds<1||maxRounds>5)
  throw new RangeError("Joint gear/SP rounds must be 1–5");
 if(!Number.isSafeInteger(initialCT)||initialCT<0||initialCT>50)
  throw new RangeError("Initial Combat Techniques level must be 0–50");
 let ct=initialCT,best=null,bestRow=null,converged=false,cycleDetected=false;
 const visited=new Set(),trace=[];
 for(let round=0;round<maxRounds;round++){
  const requested={...settings,petCombatTechniquesLevel:ct};
  const gear=gearFor(requested);
  const signature=gearSignature(gear);
  // CT changes the Pet Equipment amplification even when the selected
  // item IDs stay identical. A gear-only cycle key silently lost that
  // effect and could certify a stale score.
  const stateKey=JSON.stringify([signature,ct]);
  if(visited.has(stateKey)){cycleDetected=true;break;}
  visited.add(stateKey);
  const context={...requested,
   equipmentPetSlotWeights:gear.petEquipmentSlotWeights||{},
   equipmentPetPassiveWeights:gear.petEquipmentPassiveWeights||{},
   equipmentPetCoverageComplete:gear.petEquipmentCoverageComplete};
  const result=solve(context);
  const adjustedScore=score(result,context,gear);
  if(typeof adjustedScore!=="number"||!Number.isFinite(adjustedScore))
   throw new Error("Joint gear/SP candidate score is not finite");
  const optimizedCT=Number(result?.levels?.CombatTechniques??0);
  if(!Number.isSafeInteger(optimizedCT)||optimizedCT<0||optimizedCT>50)
   throw new Error("Invalid optimized Combat Techniques level");
  // Missing bounds invalidate ranking certification, not the feasible build.
  let scoreUpperBound=null;
  if(upperBoundOf){
   try{
    const high=upperBoundOf(result,adjustedScore);
    if(Number.isFinite(high)&&high>=adjustedScore-1e-8)
     scoreUpperBound=high;
   }catch{}
  }
  const row={signature,ctForGear:ct,optimizedCT,adjustedScore,
   scoreUpperBound,
   exhaustiveGearSearch:gear.gearSearch?.exhaustiveWithinOwnedInventory===true};
  trace.push(row);
  if(!best||adjustedScore>best.adjustedScore+1e-10){
   bestRow=row;
   best={gearSelection:gear,result,context,adjustedScore,scoreUpperBound};
  }
  // Gear can change with optimized CT: check its selection at the actual
  // resulting CT, rather than treating a previous gear choice as optimal.
  const next=gearFor({...settings,petCombatTechniquesLevel:optimizedCT});
  const nextKey=gearSignature(next);
  if(signature===nextKey&&ct===optimizedCT){converged=true;break;}
  ct=optimizedCT;
 }
 const envelope=visitedScoreEnvelope(trace);
 if(best){best.scoreUpperBound=envelope.upperBound;
  best.boundUnresolved=envelope.unresolved;}
 return {best,search:{
  evaluations:trace.length,trace,converged,cycleDetected,
  scoreEnvelope:envelope,
  comparisonBounds:rankVisitedCandidateBounds(trace,bestRow),
  allExaminedGearSpacesComplete:trace.length>0&&
   trace.every(x=>x.exhaustiveGearSearch),
  globallyOptimalAcrossPetGearSP:false,
  bestSeenNotLastAssumed:true,
  stoppedAtMaxRounds:!converged&&!cycleDetected&&trace.length===maxRounds
 }};
}

/**
 * Exact enumeration of all EXPLICITLY OWNED eligible gear combinations for
 * one pet pair, with a fresh SP optimization for EVERY gear combination.
 * "Exact" refers to this finite Cartesian input set; the SP solver can
 * still report approximate bounded optimization, and the game model omits
 * conditional mechanics. No claim about in-game stage maxima.
 */
export function enumerateJointGearAndSkills(settings,{
 assignments,gearFor,solve,score,upperBoundOf
}={}){
 if(!Array.isArray(assignments)||!assignments.length||
  assignments.length>MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS)
  throw new RangeError("Full gear/SP enumeration requires 1–"+
   MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS+" assignments");
 if(typeof gearFor!=="function"||typeof solve!=="function"||typeof score!=="function")
  throw new TypeError("Missing full gear/SP enumeration function");
 let best=null,bestRow=null;
 const trace=[],seen=new Set();
 let refinements=0,unconverged=0;
 for(const assignment of assignments){
  // Fixed owned gear is an input to the solver, but its Pet/Equipment
  // multiplier still depends on the resulting Combat Techniques level.
  // Re-evaluate at that level; never keep the CT=0 proxy as a final score.
  const fixed={...settings,selectedEquipment:assignment};
  const refined=refineCoupledGearAndSkills(fixed,{
   gearFor:ctx=>gearFor({...ctx,selectedEquipment:assignment}),
   solve,score,upperBoundOf,maxRounds:5
  });
  if(!refined.best)throw new Error("Empty fixed-gear refinement");
  const {gearSelection:gear,result,context,adjustedScore,scoreUpperBound}=
   refined.best;
  const signature=gearSignature(gear);
  if(seen.has(signature))continue;
  seen.add(signature);
  refinements+=refined.search.evaluations;
  if(!refined.search.converged)unconverged++;
  const row={signature,adjustedScore,scoreUpperBound,
   ctForGear:gear.gearSearch?.optimizedWithPetCombatTechniquesLevel??null,
   optimizedCT:result?.levels?.CombatTechniques??null,
   ctConsistent:gear.gearSearch?.optimizedWithPetCombatTechniquesLevel===
    result?.levels?.CombatTechniques,
   refinementConverged:refined.search.converged,
   exactSP:result?.optimality?.mode==="exact"};
  trace.push(row);
  if(!best||adjustedScore>best.adjustedScore+1e-10){
   bestRow=row;
   best={gearSelection:gear,result,context,adjustedScore,scoreUpperBound};
  }
 }
 const envelope=visitedScoreEnvelope(trace);
 if(best){best.scoreUpperBound=envelope.upperBound;
  best.boundUnresolved=envelope.unresolved;}
 return {best,search:{
  method:"full-owned-gear-cartesian-with-SP-reoptimization",
  scoreEnvelope:envelope,
  evaluations:trace.length,assignmentsRequested:assignments.length,
  refinementEvaluations:refinements,unconvergedAssignments:unconverged,
  trace,converged:unconverged===0,cycleDetected:false,
  comparisonBounds:rankVisitedCandidateBounds(trace,bestRow),
  allExaminedGearSpacesComplete:true,
  exhaustiveOwnedGearPerPetPair:true,
  everyFixedGearCTConverged:unconverged===0,
  exactSkillOptimizationForWinner:best?.result?.optimality?.mode==="exact",
  globallyOptimalAcrossPetGearSP:false,
  bestSeenNotLastAssumed:true,stoppedAtMaxRounds:false
 }};
}

/**
 * Bounded multistart coordinate search for a large owned inventory.
 * Probe different CT levels using the factorized gear selector, solve
 * only newly discovered gear signatures, and retain the best feasible
 * result across all runs. The probe grid is not a global certificate.
 */
export function refineGearWithCTSeeds(settings,{
 gearFor,solve,score,upperBoundOf,maxAdditionalCandidates=2
}={}){
 if(!Number.isSafeInteger(maxAdditionalCandidates)||maxAdditionalCandidates<0||
    maxAdditionalCandidates>3)throw new RangeError("Additional gear candidates must be 0–3");
 const gearCache=new Map();
 const cachedGearFor=context=>{
  const ct=context.petCombatTechniquesLevel;
  if(!gearCache.has(ct))gearCache.set(ct,gearFor(context));
  return gearCache.get(ct);
 };
 const dependencies={gearFor:cachedGearFor,solve,score,upperBoundOf};
 const baseline=refineCoupledGearAndSkills(settings,dependencies);
 const initial=baseline.best;
 const trace=[...baseline.search.trace];
 const seen=new Set(trace.map(row=>row.signature));
 const imported=Number(settings.currentLevels?.CombatTechniques??0);
 const probes=[...new Set([
  ...(Number.isSafeInteger(imported)&&imported>=0&&imported<=50?[imported]:[]),
  50,25,10,40,5,15,20,30,35,45
 ])].filter(level=>level!==0);
 let winner=baseline,best=initial,additional=0;
 const probeTrace=[];
 // Scan cheaply even when additional solve budget is exhausted: expose
 // omitted distinct candidates rather than claiming they were evaluated.
 const omitted=new Set();
 for(const initialCT of probes){
  const gear=cachedGearFor({...settings,petCombatTechniquesLevel:initialCT});
  const signature=gearSignature(gear);
  if(seen.has(signature)){probeTrace.push({initialCT,signature,status:"already-solved-gear"});continue;}
  if(additional>=maxAdditionalCandidates){
   omitted.add(signature);
   probeTrace.push({initialCT,signature,status:"solve-budget-exhausted"});continue;
  }
  const candidate=refineCoupledGearAndSkills(settings,{
   ...dependencies,initialCT,maxRounds:2
  });
  additional++;
  for(const row of candidate.search.trace){seen.add(row.signature);trace.push(row);}
  probeTrace.push({initialCT,signature,status:"evaluated",evaluations:candidate.search.evaluations});
  if(candidate.best.adjustedScore>best.adjustedScore+1e-10){
   best=candidate.best;winner=candidate;
  }
 }
 for(const signature of seen)omitted.delete(signature);
 const winningRow=winner.search.trace.find(row=>
  row.signature===gearSignature(best.gearSelection)&&
  row.ctForGear===best.context.petCombatTechniquesLevel&&
  row.adjustedScore===best.adjustedScore);
 const envelope=visitedScoreEnvelope(trace);
 return {best:{...best,scoreUpperBound:envelope.upperBound,boundUnresolved:envelope.unresolved},
  search:{...winner.search,method:"bounded-multistart-fixed-CT-gear",
   evaluations:trace.length,trace,scoreEnvelope:envelope,
   comparisonBounds:rankVisitedCandidateBounds(trace,winningRow),
   allExaminedGearSpacesComplete:trace.every(row=>row.exhaustiveGearSearch),
   ctSeedSearch:{baselineScore:initial.adjustedScore,selectedScore:best.adjustedScore,
    gain:Math.max(0,best.adjustedScore-initial.adjustedScore),
    selectedAlternative:winner!==baseline,probes:probeTrace,
    additionalCandidates:additional,maxAdditionalCandidates,
    distinctSolvedGear:seen.size,omittedDistinctGear:omitted.size,
    distinctGearProbes:gearCache.size,
    allCTLevelsExamined:false,globallyExact:false},
   globallyOptimalAcrossPetGearSP:false}};
}
