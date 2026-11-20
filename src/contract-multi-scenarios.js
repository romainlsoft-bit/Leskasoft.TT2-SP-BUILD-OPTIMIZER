/**
 * Explicit two-state (contracts active/inactive) SP candidate comparison.
 *
 * IMPORTANT:
 * - This is a weighted log-score proxy across caller-declared scenarios,
 *   NEVER an observed probability or a prediction of actual stage gains.
 * - We compare full, budget-feasible *conservative* optima (no contract
 *   maximum already in scores). An optimistic solve only proposes contract
 *   investments to pin; it is never scored directly / double counted.
 * - We do not claim global optimality across SP × gear × pets × timelines.
 */
import {skillInfo} from "../vendor/skills.js?v=20261120-simple-ui-r5";
import {simulateContractTimeline} from "./contract-timeline.js?v=20261120-simple-ui-r5";
import {contractInvestmentPlans} from "./contract-plan-candidates.js?v=20261120-simple-ui-r5";

const IDS=["ForbiddenContract","RoyalContract","TerrifyingPact"];
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const rawLog=x=>{
 const s=String(x??"").trim();
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))return null;
 const [m,e="0"]=s.toLowerCase().split("e");
 const num=Number(m),exp=Number(e);
 return num>0&&Number.isFinite(num)&&Number.isSafeInteger(exp)?
  Math.log10(num)+exp:null;
};
const invalid=(reason)=>({schema:"tt2-multi-contract-candidates-v1",
 status:"unresolved",reason,appliedToRecommendation:false,
 globallyOptimal:false,predictsStages:false});

/**
 * Mean log10 impact over an explicitly selected finite boss window.
 * The zero-power tail after a simulated termination is included.
 * The result is a reference to source maxima, not a real observed uptime.
 */
/**
 * Constant-time sum of the 1 Hz contract ramp (the source maximum raised to
 * min(1,tick/ramp) on each funded tick), expressed directly in log10.
 * This does not estimate actual uptime or native cancellation order.
 */
export function contractWindowRampMeanLog10(maximumLog10,rampSeconds,
 fundedTicks,horizonSeconds){
 const M=maximumLog10,R=rampSeconds,N=fundedTicks,T=horizonSeconds;
 if(!Number.isFinite(M)||!Number.isFinite(R)||R<=0||
    !Number.isSafeInteger(N)||N<0||!Number.isSafeInteger(T)||T<=0||N>T)
  return null;
 const partial=Math.min(N,Math.max(0,Math.ceil(R)-1));
 const mean=(partial*(partial+1)/(2*R)+(N-partial))/T;
 const value=M*mean;
 return Number.isFinite(value)?value:null;
}
export function contractWindowSourceScore(levels,timeline,settings={}){
 const weight=Number(settings.goldWeight);
 if(settings.goldWeight===null||settings.goldWeight===undefined||
    settings.goldWeight===""||!Number.isFinite(weight)||weight<0||
    weight>2)
  return {status:"unresolved",reason:"invalid-gold-weight"};
 const sim=simulateContractTimeline(levels,timeline);
 if(sim.status==="no-active-contract-talents")
  return {status:"scored",weightedLog10:0,damageLog10:0,goldLog10:0,
   fundedTicks:0,windowSeconds:Number(timeline.durationSeconds),
   nativeCancellationOrderVerified:false,gameplayUptimeVerified:false};
 if(sim.status!=="simulated")
  return {status:"unresolved",reason:sim.status,reasons:sim.reasons??[]};
 let damage=0,gold=0;
 const T=sim.horizonSeconds,N=sim.fundedTicks;
 for(const [id,term] of Object.entries(sim.terms)){
  // The final-source log maximum is the native ramp, not an always-on
  // bonus. An unfunded tick contributes exactly zero in THIS model.
  const sourceMean=contractWindowRampMeanLog10(
   term.sourceMaxLog10,term.sourceRampSeconds,N,T);
  if(sourceMean===null)
   return {status:"unresolved",reason:"nonfinite-contract-source-ramp:"+id};
  if(id==="ForbiddenContract")damage+=sourceMean;
  if(id==="RoyalContract")gold+=sourceMean;
 }
 // No unconditional Terrifying Pact credit. An opt-in explicitly
 // assumes the full A/B source modifier while the matching contract
 // is funded. Runtime timing/stacking remain unresolved.
 if(settings.pactAtMaxDuringFundedTicks===true && Number(levels.TerrifyingPact)>0){
  if(sim.activeContracts.includes("ForbiddenContract")){
   const lg=rawLog(skillInfo.TerrifyingPact["A"+Number(levels.TerrifyingPact)]);
   if(lg===null)return {status:"unresolved",reason:"invalid-pact-gold-source"};
   gold+=lg*N/T;
  }
  if(sim.activeContracts.includes("RoyalContract")){
   const lg=rawLog(skillInfo.TerrifyingPact["B"+Number(levels.TerrifyingPact)]);
   if(lg===null)return {status:"unresolved",reason:"invalid-pact-damage-source"};
   damage+=lg*N/T;
  }
 }
 return {status:"scored",damageLog10:damage,goldLog10:gold,
  weightedLog10:damage+weight*gold, fundedTicks:N,
  windowSeconds:T,pactAssumedAtFullSourceWhileFunded:
   settings.pactAtMaxDuringFundedTicks===true,
  nativeCancellationOrderVerified:false,gameplayUptimeVerified:false,
  addedToOriginalOptimizerScore:false};
}
/**
 * Rank a small, explicitly explored candidate set. The inactive scenario
 * uses the conservative proxy; the active scenario uses a user-provided
 * fraction (not a measured probability), plus the source-only window score.
 */
export function rankContractCandidates(candidates,settings={},policy={}){
 if(policy?.enabled!==true)return invalid("not-requested");
 const w=policy.activeFraction;
 const weight=Number(w);
 if(w===undefined||w===null||w===""||!finite(weight)||weight<0||weight>1)
  return invalid("explicit-active-fraction-required");
 const timeline=settings?.contractTimeline;
 if(!timeline||timeline.enabled!==true)
  return invalid("explicit-mana-timeline-required");
 if(settings.assumeContractsAtMax===true)
  return invalid("cannot-combine-with-maximum-contract-scoring");
 if(!Array.isArray(candidates)||!candidates.length||candidates.length>4)
  return invalid("invalid-candidate-count");
 const ids=new Set();
 const rows=[];
 for(const entry of candidates){
  if(!entry||typeof entry.id!=="string"||ids.has(entry.id)||
    !entry.result?.levels||!finite(entry.modeledLogScore))
   return invalid("invalid-or-duplicate-candidate");
  ids.add(entry.id);
  const scoped=contractWindowSourceScore(entry.result.levels,timeline,{
   goldWeight:settings.goldWeight,
   pactAtMaxDuringFundedTicks:policy.pactAtMaxDuringFundedTicks===true
  });
  if(scoped.status!=="scored")return invalid(
   "unresolved-timeline-for-"+entry.id+":"+scoped.reason);
  // Weighted log proxy: p*active + (1-p)*inactive, NOT actual DPS
  // or an experimentally measured probability of a contract active.
  const scored=entry.modeledLogScore+weight*scoped.weightedLog10;
  if(!finite(scored))return invalid("nonfinite-scenario-score");
  rows.push({id:entry.id,baseModeledLog10:entry.modeledLogScore,
   activeContractWindowLog10:scoped.weightedLog10,
   declaredActiveFraction:weight,scenarioWeightedLog10:scored,
   fundedTicks:scoped.fundedTicks,windowSeconds:scoped.windowSeconds,
   levels:Object.fromEntries(IDS.map(id=>[id,Number(entry.result.levels[id]??0)])),
   modeledSourceConditionsOnly:true});
 }
 const sorted=[...rows].sort((a,b)=>
  b.scenarioWeightedLog10-a.scenarioWeightedLog10||
   (a.id==="conservative"?-1:b.id==="conservative"?1:a.id.localeCompare(b.id)));
 return {schema:"tt2-multi-contract-candidates-v1",status:"ranked",
  winnerId:sorted[0].id,rows,rankedIds:sorted.map(x=>x.id),
  scenarioWeights:{active:weight,inactive:1-weight},
  pactSourceMaxAssumed:policy.pactAtMaxDuringFundedTicks===true,
  appliedToRecommendation:false, // Caller must prove gear/CT consistency.
  globallyOptimal:false,optimizerSearchComplete:false,
  fixedPetGearSearchNotRepeated:true,
  sourceWindowNotGameplayUptime:true,
  predictsStages:false};
}
/**
 * Two-pass source seeds, then conservative re-optimization with pinned
 * contract levels. Never return the optimistic run itself as recommended.
 * Refuses to replace the baseline if CT's equipment coupling changes.
 * The caller provides the exact final gear/pet settings and baseline.
 */
export function proposeContractScenarioBuild({settings,baseline,gearSelection,
 solve,score}={}){
 if(settings?.contractMultiScenario?.enabled!==true)
  return {selection:invalid("not-requested"),result:baseline};
 if(settings.assumeContractsAtMax===true)
  return {selection:invalid("cannot-combine-with-maximum-contract-scoring"),
   result:baseline};
 if(typeof solve!=="function"||typeof score!=="function"||!baseline?.levels)
  throw new TypeError("Scenario search requires solve, score and baseline");
 const policy=settings.contractMultiScenario;
 const conservativeMode={...settings,assumeContractsAtMax:false};
 const candidateBase={id:"conservative",result:baseline,
  modeledLogScore:score(baseline,conservativeMode,gearSelection)};
 // Validate before launching the potentially expensive source seed.
 const validation=rankContractCandidates([candidateBase],conservativeMode,policy);
 if(validation.status!=="ranked")
  return {selection:validation,result:baseline};
 let seed;
 try{
  seed=solve({...conservativeMode,assumeContractsAtMax:true});
 }catch(e){
  return {selection:{...validation,status:"only-conservative-feasible",
   reason:e instanceof Error?e.message:String(e),
   appliedToRecommendation:false},result:baseline};
 }
 // The optimistic seed is ONLY a search hint. If a future solver returns
 // a partial/invalid candidate, retain the already feasible baseline.
 // Do not turn this optional what-if error into a failed optimization.
 if(!seed?.levels||typeof seed.levels!=="object"||
    Array.isArray(seed.levels))
  return {selection:{...validation,status:"only-conservative-feasible",
   reason:"invalid-optimistic-contract-seed",
   appliedToRecommendation:false},result:baseline};
 const plans=contractInvestmentPlans(
  baseline.levels,seed.levels,settings.minimums,policy);
 const canReallocate=policy.pactAtMaxDuringFundedTicks===true;
 const candidates=[candidateBase],solutions=new Map([["conservative",baseline]]);
 const skipped=[];
 for(const plan of plans){
  try{
   const result=solve({...conservativeMode,
    allowContractScenarioReallocation:canReallocate,
    minimums:{...settings.minimums,...plan.minimums}});
   const modeled=score(result,conservativeMode,gearSelection);
   if(!finite(modeled))throw new Error("nonfinite-candidate-score");
   solutions.set(plan.id,result);
   candidates.push({id:plan.id,result,modeledLogScore:modeled});
  }catch(e){
   skipped.push({id:plan.id,reason:e instanceof Error?e.message:String(e)});
  }
 }
 if(candidates.length===1)
  return {selection:{...validation,status:"only-conservative-feasible",
   reason:"all-constrained-alternatives-infeasible",
   skippedAlternatives:skipped,appliedToRecommendation:false},result:baseline};
 const rankings=rankContractCandidates(candidates,conservativeMode,policy);
 if(rankings.status!=="ranked")return {selection:rankings,result:baseline};
 const oldCT=Number(baseline.levels.CombatTechniques??0);
 // A changed CT potentially changes equipment-pet primary multipliers.
 // Exclude that unsafe allocation, then pick the best remaining candidate
 // instead of discarding a feasible second-best alternative.
 const eligible=rankings.rankedIds.filter(id=>
  id==="conservative"||
  Number(solutions.get(id)?.levels?.CombatTechniques??0)===oldCT);
 const winnerId=eligible[0]??"conservative";
 const exploratoryWinnerId=rankings.rankedIds[0];
 return {result:solutions.get(winnerId)??baseline,selection:{...rankings,
  winnerId,exploratoryWinnerId,
  candidatesChecked:candidates.length,
  constrainedAlternativesAttempted:plans.length,
  constrainedAlternativesSkipped:skipped.length,
  skippedAlternatives:skipped,
  seedRunOptimizedUnderContractMaximum:true,
  winningCandidateReoptimizedWithConservativeSkillScoring:true,
  requiresNewGearCTRefinement:winnerId!==exploratoryWinnerId,
  selectiveContractReallocation:canReallocate,
  protectsOtherUnmodeledSkills:true,
  appliedToRecommendation:winnerId!=="conservative",
  sourceDerivedButNotMeasured:true,globallyOptimal:false,predictsStages:false}};
}
