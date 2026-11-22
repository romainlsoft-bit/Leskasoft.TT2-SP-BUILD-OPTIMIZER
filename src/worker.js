import {optimizeBuild} from "./engine.js?v=20261122-boss-push-r1";
import {petSearchPlan,availablePets} from "./pet-scenarios.js?v=20261122-boss-push-r1";
import {calculateModeledScenario} from "./calculation-ledger.js?v=20261122-boss-push-r1";
import {selectPetPair} from "./pet-pair-search.js?v=20261122-boss-push-r1";
import {bestEquipmentByCategory,gearSelectionEffects,petCandidateGearWeightEnvelope,
 enumerateOwnedGearAssignments}
 from "./equipment-scenarios.js?v=20261122-boss-push-r1";
import {refineCoupledGearAndSkills,enumerateJointGearAndSkills}
 from "./joint-candidate-search.js?v=20261122-boss-push-r1";
import {modeledCandidateUpperBound} from "./model-score-bounds.js?v=20261122-boss-push-r1";
import {proposeContractScenarioBuild} from "./contract-multi-scenarios.js?v=20261122-boss-push-r1";
import {rerankVisitedContractPetPairs} from "./contract-pet-rerank.js?v=20261122-boss-push-r1";

// Per-request cache: branch DP signatures must distinguish changes in pet,
// equipment and the resulting Combat Techniques contribution.
self.onmessage=event=>{
 const {type,settings}=event.data||{};
 if(!["optimize","optimize-pet-scenarios"].includes(type))return;
 const cache=new Map();
 try{
  const gearEnumeration=enumerateOwnedGearAssignments(settings.accountProfile,
   settings,16);
  const sp=Number(settings.skillPoints??0);
  const fullJointBudget=sp<=1000?72:sp<=5000?36:16;
  let useFullGearEnumeration=gearEnumeration.exhaustive&&
   gearEnumeration.assignments.length<=fullJointBudget;
  const gearFor=context=>
   gearSelectionEffects(context.accountProfile,context,context.selectedEquipment||{});
  const evaluateJoint=(chosen,sendSolverProgress=false)=>{
   const refined=useFullGearEnumeration?
    enumerateJointGearAndSkills(chosen,{
     assignments:gearEnumeration.assignments,gearFor,
     solve:context=>optimizeBuild(context,sendSolverProgress?
      p=>self.postMessage({progress:p}):undefined,cache),
     score:(result,context,gear)=>
      calculateModeledScenario(result,context,gear).totalLog10,
     upperBoundOf:modeledCandidateUpperBound
    }):
    refineCoupledGearAndSkills(chosen,{
    gearFor,
    solve:context=>optimizeBuild(context,sendSolverProgress?
     p=>self.postMessage({progress:p}):undefined,cache),
    score:(result,context,gear)=>
     calculateModeledScenario(result,context,gear).totalLog10,
    upperBoundOf:modeledCandidateUpperBound,
    maxRounds:3
   });
   if(!refined.best)throw new Error("Joint pet/gear/SP search found no candidate");
   const winning=refined.best;
   const modeledScenario=calculateModeledScenario(
    winning.result,winning.context,winning.gearSelection);
   return {adjustedScore:modeledScenario.totalLog10,
    scoreUpperBound:winning.scoreUpperBound,
     boundUnresolved:winning.boundUnresolved===true,
    result:{...winning.result,modeledScenario},
    gearSelection:winning.gearSelection,jointSearch:refined.search,
    context:winning.context};
  };
  // Compare the forced Stage Skip target to an unconstrained solve
  // under the SAME final pet/gear context. This is run ONCE for the
  // winner, not once per pet candidate. Report TWO feasible allocations
  // and their old proxy scores; Stage Skip is never assigned a made-up
  // log10 damage weight.
  const withPushComparison=(choice,selected)=>{
   const target=selected?.pushSkipTarget;
   if(target?.enabled!==true)return selected;
   if(choice.context?.contractMultiScenario?.enabled===true)
    return {...selected,pushSkipComparison:{status:"not-comparable-with-contract-scenario"}};
   const unforced=optimizeBuild({...choice.context,
    pushAttackChannelId:"",pushSourceStageSkipTarget:0},undefined,cache);
   const source=target.sourceSkillId,col=target.sourceColumn;
   const sourceBefore=Number(
    // Use the same source-row values already audited by the engine.
    // No Stage Skip from equipment, sets or global stats is inferred.
    unforced.attackChannels.channels.find(c=>c.id===target.attackChannelId)
     ?.skip.find(x=>x.skillId===source&&x.kind==="stage")?.value??0
   );
   return {...selected,pushSkipComparison:{
    schema:"tt2-source-skip-proxy-comparison-v1",
    status:"compared-same-pet-gear-context",
    attackChannelId:target.attackChannelId,
    sourceSkillId:source,sourceColumn:col,
    baselineScore:unforced.score,constrainedScore:selected.score,
    scoreDifferenceLog10:selected.score-unforced.score,
    baselineSourceStageSkip:sourceBefore,
    constrainedSourceStageSkip:target.actualSourceStageSkip,
    baselineBranchTotals:unforced.branchTotals,
    constrainedBranchTotals:selected.branchTotals,
    baselineLevels:unforced.levels,
    baselineSP:unforced.spent,constrainedSP:selected.spent,
    sameRequestedPetGearContext:true,
    boundedGridMayChangeExactOrdering:
     unforced.optimality?.certifiedExact!==true||
     selected.optimality?.certifiedExact!==true,
    comparesModeledSPProxyOnly:true,
    scoreIsNotMeasuredCombatDps:true,stageGainPredicted:false
   }};
  };
  // Optional explicit scenario comparison only for the final chosen
  // pet/gear pair. Do NOT multiply the whole gear/pet search workload.
  const withContractDecision=choice=>{
   const context=choice.context||settings;
   if(context.contractMultiScenario?.enabled!==true)
    return withPushComparison(choice,choice.result);
   const selection=proposeContractScenarioBuild({
    settings:context,baseline:choice.result,gearSelection:choice.gearSelection,
    solve:opts=>optimizeBuild(opts,undefined,cache),
    score:(result,opts,gear)=>
     calculateModeledScenario(result,opts,gear).totalLog10
   });
   // On unresolved or infeasible inputs, preserve the EXACT original
   // modeled result, including its score and existing maximum-mode choice.
   if(selection.selection.status!=="ranked")
    return withPushComparison(choice,{...choice.result,contractMultiScenario:selection.selection});
   const winner=selection.result;
   // The returned result uses the conservative DP objective (the contract
   // source-only window gain never becomes an always-on skill multiplier).
   const modeledScenario=calculateModeledScenario(winner,{
    ...context,assumeContractsAtMax:false},choice.gearSelection);
   return withPushComparison(choice,{...winner,modeledScenario,contractMultiScenario:selection.selection});
  };
  if(type==="optimize-pet-scenarios"){
   const visitedPetPairs=[];
   const initialGear=gearFor(settings);
   const envelope=petCandidateGearWeightEnvelope(settings.accountProfile,settings);
   const screening={...settings,
    equipmentPetSlotWeights:envelope.slotWeights,
    equipmentPetPassiveWeights:envelope.passiveWeights,
    equipmentPetCoverageComplete:initialGear.petEquipmentCoverageComplete};
   const plan=petSearchPlan(settings.accountProfile,screening);
   const ownedPets=availablePets(settings.accountProfile);
   const explicitFor=(id,slot,fallback)=>{
    if(!id)return fallback;
    const found=ownedPets.find(p=>p.id===id&&p.equipType===
     (slot==="damage"?"Damage":"Support"));
    if(!found)throw new Error("Selected "+slot+" pet is not owned or incompatible");
    return [found];
   };
   // Named selections are hard constraints; only Automatic slots search.
   const damage=explicitFor(settings.selectedDamagePet,"damage",plan.damage);
   const gold=explicitFor(settings.selectedGoldPet,"gold",plan.gold);
   const manualSlots={damage:Boolean(settings.selectedDamagePet),
    gold:Boolean(settings.selectedGoldPet)};
   const fullySearched=(manualSlots.damage||plan.omittedCandidates.damage===0)&&
    (manualSlots.gold||plan.omittedCandidates.gold===0);
   const pairCount=Math.max(1,damage.length)*Math.max(1,gold.length);
   useFullGearEnumeration=useFullGearEnumeration&&
    gearEnumeration.assignments.length*pairCount<=fullJointBudget;
   if(damage.length||gold.length){
    const chosen=selectPetPair(damage,gold,(damagePet,goldPet)=>{
     const context={...settings,selectedDamagePet:damagePet,
      selectedGoldPet:goldPet};
     const candidate={damagePet,goldPet,...evaluateJoint(context),
      damageName:damage.find(x=>x.id===damagePet)?.name||"",
      goldName:gold.find(x=>x.id===goldPet)?.name||""};
     visitedPetPairs.push(candidate);
     return candidate;
    },{maxPasses:3,exhaustiveShortlist:true,maxCandidatesPerSlot:6,
     entireEligibleRoster:fullySearched,
     onProgress:progress=>self.postMessage({progress})});
    if(!chosen.best)throw new Error("No pet scenario available");
    // A different pet pair can win under the explicitly declared contract
    // window. Examine EVERY already-visited pair cheaply, then fully rerun
    // at most three pair/gear/SP finalists. Defaults add zero extra work.
    const rerank=rerankVisitedContractPetPairs(visitedPetPairs,settings,{
     original:chosen.best,maxRefinements:3,resolve:withContractDecision
    });
    const contractReranked=rerank.status==="ranked-visited-shortlist";
    const finalChoice=contractReranked?rerank.selected:chosen.best;
    const finalModeledResult=contractReranked?
     rerank.selectedResult:withContractDecision(chosen.best);
    const selectedPairChanged=finalChoice!==chosen.best;
    const rerankSummary=contractReranked?{
     schema:rerank.schema,status:rerank.status,
     visitedPairs:rerank.visitedPairs,shortlistedPairs:rerank.shortlistedPairs,
     selectedPairChanged,compared:rerank.compared,
     scenarioRankingCertified:false,globallyOptimal:false,
     originalPetSearchBoundsNotApplicable:true,
     unexploredAlternativesRemain:true,
     accountForOtherGearChoices:false,actualUptimeVerified:false,
     predictsStages:false
    }: {status:rerank.status,reason:rerank.reason,
     selectedPairChanged:false};
    const result={...finalModeledResult,
     petSearch:{
      converged:chosen.converged,passes:chosen.passes,
      uniqueEvaluations:chosen.uniqueEvaluations,
      shortlistOnly:chosen.shortlistOnly,
      exhaustiveWithinShortlist:chosen.exhaustiveWithinShortlist===true,
      exhaustiveAmongEligiblePetPairs:chosen.exhaustiveAmongEligiblePetPairs===true,
      eligibleCount:plan.eligibleCount,
      omittedCandidates:{
       damage:manualSlots.damage?0:plan.omittedCandidates.damage,
       gold:manualSlots.gold?0:plan.omittedCandidates.gold
      },
      manualSlots,
      candidateCount:chosen.candidateCount,
      pairBudget:plan.pairBudget,
      jointSearch:finalChoice.jointSearch,
      comparisonBounds:contractReranked?{
       // The original additive score bounds do NOT bound the new
       // weighted scenario objective, even for the same visited pets.
       compared:rerank.shortlistedPairs,
       certifiedWithinVisited:false,
       certifiedForScenarioRanking:false,
       unresolvedCompetitors:null,
       largestPossibleChallengerGain:null,
       winningFeasibleScore:null,winningUpperBound:null,
       scope:"contract-scenario-shortlist-uncertified",
       priorConservativeObjectiveBounds:chosen.comparisonBounds
      }:chosen.comparisonBounds,
      contractPetRerank:rerankSummary,
      contractRerankUsesFiniteVisitedShortlist:contractReranked,
      selectedPairAfterContractRerank:selectedPairChanged,
      fullOwnedGearCartesianPerPair:useFullGearEnumeration,
      completeOwnedPetAndGearCartesian:useFullGearEnumeration&&
       fullySearched,
      globallyOptimalAcrossPetGearSP:false
     }};
    const winningSettings={...settings,
     selectedDamagePet:finalChoice.damagePet,
     selectedGoldPet:finalChoice.goldPet};
    const equipment=bestEquipmentByCategory(settings.accountProfile,winningSettings,3);
    self.postMessage({ok:true,result,
     selectedPets:{damage:finalChoice.damagePet,gold:finalChoice.goldPet},
     // The conservative one-axis pet comparisons would be misleading
     // when the explicit contract scenario changes the winning pair.
     petComparisons:selectedPairChanged?{damage:[],gold:[]}:
      {damage:chosen.damageResults,gold:chosen.goldResults},
     petSearch:result.petSearch,equipment,
     gearSelection:finalChoice.gearSelection});
    return;
   }
  }
  const chosen=evaluateJoint(settings,true);
  const equipment=bestEquipmentByCategory(settings.accountProfile,settings,3);
  self.postMessage({ok:true,result:{...withContractDecision(chosen),
   jointSearch:chosen.jointSearch},
   selectedPets:{damage:settings.selectedDamagePet||null,
    gold:settings.selectedGoldPet||null},
   petComparisons:{damage:[],gold:[]},equipment,gearSelection:chosen.gearSelection});
 }catch(error){
  self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)});
 }
};
