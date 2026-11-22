/**
 * Bounded second-pass reranking for PREVIOUSLY VISITED pet-pair choices.
 *
 * The first pass was optimized under the conservative additive objective;
 * contract hypotheses can change the relative choice of pet pairs.
 * Score every visited pair cheaply under the contract-window source model,
 * then run expensive contract-aware SP refinement for only the best two
 * scenarios plus the original winning pair (at most three).
 *
 * Scope: finite visited candidates only. Not exhaustive joint optimization
 * over all owned gear/pets or all alternative SP minima. No score bounds
 * from the original additive objective can certify this new ranking.
 */
import {rankContractCandidates} from "./contract-multi-scenarios.js?v=20261122-boss-push-r1";

const finite=x=>typeof x==="number"&&Number.isFinite(x);
const invalid=(status,reason)=>({
 status,reason,selected:null,selectedResult:null,visitedPairs:0,
 shortlistedPairs:0,globallyOptimal:false,
 scenarioRankingCertified:false,unexploredAlternativesRemain:true
});
const key=choice=>JSON.stringify([choice?.damagePet??null,
 choice?.goldPet??null]);

/**
 * resolve(choice) must return a full candidate result from a fresh
 * contract-aware SP comparison, preserving gear and both pet selections.
 * Each result's contractMultiScenario contains the actual accepted winner
 * from that fixed-gear/pet comparison, not the discarded optimistic seed.
 */
export function rerankVisitedContractPetPairs(choices,settings,{
 original=null,resolve,maxRefinements=3
}={}){
 if(settings?.contractMultiScenario?.enabled!==true)
  return invalid("not-requested","scenario-disabled");
 if(!Array.isArray(choices)||!choices.length||
   typeof resolve!=="function"||
   !Number.isSafeInteger(maxRefinements)||maxRefinements<1||maxRefinements>4)
  return invalid("unresolved","invalid-pet-rerank-input");
 if(settings?.assumeContractsAtMax===true)
  return invalid("unresolved","cannot-combine-with-maximum-contract-scoring");

 const visited=[],keys=new Set();
 for(const choice of choices){
  const id=key(choice);
  if(keys.has(id))continue;
  keys.add(id);
  if(!choice?.result?.levels||!finite(choice.adjustedScore)||
   !choice.context||!choice.gearSelection)
   return invalid("unresolved","invalid-visited-pet-pair");
  const pre=rankContractCandidates([{
   id:"conservative",result:choice.result,
   modeledLogScore:choice.adjustedScore
  }],settings,settings.contractMultiScenario);
  if(pre.status!=="ranked")
   return {...invalid("unresolved",pre.reason),visitedPairs:visited.length};
  const preScore=pre.rows[0].scenarioWeightedLog10;
  if(!finite(preScore))return invalid("unresolved","nonfinite-pet-pair-preview");
  visited.push({id,choice,preScore});
 }
 const selectedOriginal=original?key(original):null;
 if(selectedOriginal!==null&&!visited.some(e=>e.id===selectedOriginal))
  return invalid("unresolved","original-pair-not-visited");

 visited.sort((a,b)=>b.preScore-a.preScore||a.id.localeCompare(b.id));
 const rankedPreview=visited.slice(0,maxRefinements);
 // Keep the previously selected pair in contention even when the
 // optimistic partial scenario elevates an entirely different shortlist.
 if(selectedOriginal!==null&&!rankedPreview.some(e=>e.id===selectedOriginal)){
  rankedPreview.pop();
  rankedPreview.push(visited.find(e=>e.id===selectedOriginal));
 }
 const refined=[];
 for(const entry of rankedPreview){
  let solved;
  try{solved=resolve(entry.choice)}catch(error){
   // A single infeasible SP proposal never invalidates other feasible
   // pair candidates. Preserve its baseline candidate as an upper-context
   // warning; do not claim the alternative was evaluated successfully.
   solved={...entry.choice.result,contractMultiScenario:{
    status:"only-conservative-feasible",
    reason:error instanceof Error?error.message:String(error)
   }};
  }
  const decision=solved?.contractMultiScenario;
  const chosen=decision?.status==="ranked"?
   decision.rows?.find(row=>row.id===decision.winnerId):null;
  const score=chosen?.scenarioWeightedLog10??entry.preScore;
  if(!solved?.levels||!finite(score))
   return {...invalid("unresolved","invalid-refined-pet-score"),
    visitedPairs:visited.length,shortlistedPairs:refined.length};
  refined.push({...entry,selectedResult:solved,finalScore:score,
   selectedContractAllocation:decision?.status==="ranked"&&
    decision?.appliedToRecommendation===true,
   refinementStatus:decision?.status??"not-reported"});
 }
 refined.sort((a,b)=>b.finalScore-a.finalScore||a.id.localeCompare(b.id));
 const best=refined[0];
 return {schema:"tt2-visited-pet-contract-rerank-v1",
  status:"ranked-visited-shortlist",selected:best.choice,
  selectedResult:best.selectedResult,
  selectedScore:best.finalScore,
  originalPairRetained:selectedOriginal===null||best.id===selectedOriginal,
  visitedPairs:visited.length,shortlistedPairs:refined.length,
  maxRefinements,shortlistMethod:"top-declared-contract-preview-plus-original",
  compared:refined.map(x=>({
   damagePet:x.choice.damagePet??null,goldPet:x.choice.goldPet??null,
   conservativeLog10:x.choice.adjustedScore,
   scenarioPreviewLog10:x.preScore,
   finalScenarioLog10:x.finalScore,
   refinementStatus:x.refinementStatus,
   replacedAllocation:x.selectedContractAllocation
  })),
  globallyOptimal:false,scenarioRankingCertified:false,
  originalPetSearchBoundsNotApplicable:true,
  unexploredAlternativesRemain:true,
  accountForOtherGearChoices:false,actualUptimeVerified:false,
  predictsStages:false};
}
