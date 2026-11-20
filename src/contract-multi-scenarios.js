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
import {skillInfo} from "../vendor/skills.js";
import {simulateContractTimeline} from "./contract-timeline.js";

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
export function contractWindowSourceScore(levels,timeline,settings={}){
 const sim=simulateContractTimeline(levels,timeline);
 if(sim.status==="no-active-contract-talents")
  return {status:"scored",weightedLog10:0,damageLog10:0,goldLog10:0,
   fundedTicks:0,windowSeconds:Number(timeline.durationSeconds),
   nativeCancellationOrderVerified:false,gameplayUptimeVerified:false};
 if(sim.status!=="simulated")
  return {status:"unresolved",reason:sim.status,reasons:sim.reasons??[]};
 const weight=Number(settings.goldWeight);
 if(!finite(weight)||weight<0||weight>2)
  return {status:"unresolved",reason:"invalid-gold-weight"};
 let damage=0,gold=0;
 const T=sim.horizonSeconds,N=sim.fundedTicks;
 for(const [id,term] of Object.entries(sim.terms)){
  // The final-source log maximum is the native ramp, not an always-on
  // bonus. An unfunded tick contributes exactly zero in THIS model.
  const maximum=term.sourceMaxLog10;
  const ramp=term.sourceRampSeconds;
  let sum=0;
  for(let tick=1;tick<=N;tick++)sum+=maximum*Math.min(1,tick/ramp);
  if(id==="ForbiddenContract")damage+=sum/T;
  if(id==="RoyalContract")gold+=sum/T;
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
  throw new TypeError("Scenario candidate search requires solve, score and baseline");
 const policy=settings.contractMultiScenario;
 const conservativeMode={...settings,assumeContractsAtMax:false};
 const baseScore=score(baseline,conservativeMode,gearSelection);
 const candidateBase={id:"conservative",result:baseline,modeledLogScore:baseScore};
 // Validate on the baseline before launching any expensive new SP search.
 const validation=rankContractCandidates([candidateBase],conservativeMode,policy);
 if(validation.status!=="ranked")
  return {selection:validation,result:baseline};
 let optimistic,alternative;
 try {
  optimistic=solve({...conservativeMode,assumeContractsAtMax:true});
  const minima={...settings.minimums};
  for(const id of IDS)minima[id]=Math.max(Number(minima[id]??0),
    Number(optimistic.levels[id]??0));
  alternative=solve({...conservativeMode,minimums:minima});
 }catch(e){
  return {selection:{...validation,status:"only-conservative-feasible",
   reason:e instanceof Error?e.message:String(e),
   appliedToRecommendation:false},result:baseline};
 }
 const altScore=score(alternative,conservativeMode,gearSelection);
 const rankings=rankContractCandidates([candidateBase,
  {id:"contract-investment",result:alternative,modeledLogScore:altScore}],
  conservativeMode,policy);
 if(rankings.status!=="ranked")
  return {selection:rankings,result:baseline};
 const chosen=rankings.winnerId==="contract-investment"?alternative:baseline;
 const initialCT=Number(baseline.levels.CombatTechniques??0);
 const proposedCT=Number(chosen.levels.CombatTechniques??0);
 // This optional pass holds the previously selected gear/pets fixed.
 // If CT changed, gear effects need a new joint fixed-gear solve.
 // Refuse a false final recommendation until that coupling is checked.
 const ctConsistent=initialCT===proposedCT;
 const applied=rankings.winnerId==="conservative"||ctConsistent;
 return {result:applied?chosen:baseline,selection:{...rankings,
  winnerId:applied?rankings.winnerId:"conservative",
  exploratoryWinnerId:rankings.winnerId,
  candidatesChecked:2,seedRunOptimizedUnderContractMaximum:true,
  winningCandidateReoptimizedWithConservativeSkillScoring:true,
  requiresNewGearCTRefinement:!ctConsistent,
  appliedToRecommendation:applied&&rankings.winnerId==="contract-investment",
  sourceDerivedButNotMeasured:true,
  globallyOptimal:false,predictsStages:false}};
}
