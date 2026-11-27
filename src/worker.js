import {createFinalCandidateDecision} from "./final-candidate-decision.js?v=20261123-boss-specials-r1";
import {publicOptimizationSettings} from "./public-optimization-policy.js?v=20261123-boss-specials-r1";
import {MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS,shouldEnumerateOwnedGear} from "./gear-search-policy.js?v=20261123-boss-specials-r1";
import {optimizeBuild,capCurrentMaxStage} from "./engine.js?v=20261123-boss-specials-r1&season=20261126-season14-r1&compat=20261126-audit56-r1&score=20261123-cadence-separated-r1&audit=20261123-ti-sensitivity-r1&ember=20261123-ember-fire-sword-gate-r1&jackpot=20261123-native-jackpot-expectation-r1&mc=20261123-multicast-no-guessed-x10-r1&crit=20261124-cleaving-crit-event-r1&ambush=20261124-ambush-conditional-gold-r1&ideal=20261126-boss-r1&architecture=20261127-audit56-r1&pairrefine=20261127-r1&spellconstraints=20261127-r1";
import {petSearchPlan,availablePets} from "./pet-scenarios.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {calculateModeledScenario} from "./calculation-ledger.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {selectPetPair} from "./pet-pair-search.js?v=20261123-boss-specials-r1";
import {bestEquipmentByCategory,gearSelectionEffects,petCandidateGearWeightEnvelope,
 enumerateOwnedGearAssignments}
 from "./equipment-scenarios.js?v=20261123-boss-specials-r1&season=20261126-season14-r1&security=20261126-audit56-r1";
import {refineCoupledGearAndSkills,enumerateJointGearAndSkills}
 from "./joint-candidate-search.js?v=20261123-boss-specials-r1&security=20261126-audit56-r1";
import {modeledCandidateUpperBound} from "./model-score-bounds.js?v=20261123-boss-specials-r1";
import {rerankVisitedContractPetPairs} from "./contract-pet-rerank.js?v=20261123-boss-specials-r1";

// Per-request cache: branch DP signatures must distinguish changes in pet,
// equipment and the resulting Combat Techniques contribution.
self.onmessage=event=>{
 const {type,settings:rawSettings}=event.data||{};
 // Direct worker requests can carry old-season pets and saved 250k stages.
 const ownedPets=availablePets(rawSettings?.accountProfile);
 const petIdsBySlot={
  damage:new Set(ownedPets.filter(p=>p.equipType==="Damage").map(p=>p.id)),
  gold:new Set(ownedPets.filter(p=>p.equipType==="Support").map(p=>p.id))
 };
 const settings=rawSettings?publicOptimizationSettings({
  ...rawSettings,
  maxStage:capCurrentMaxStage(rawSettings.maxStage,
   rawSettings.accountProfile,!rawSettings.accountProfile),
  selectedDamagePet:petIdsBySlot.damage.has(rawSettings.selectedDamagePet)?
   rawSettings.selectedDamagePet:null,
  selectedGoldPet:petIdsBySlot.gold.has(rawSettings.selectedGoldPet)?
   rawSettings.selectedGoldPet:null
 }):null;
 if(!["optimize","optimize-pet-scenarios"].includes(type))return;
 const cache=new Map();
 try{
  const gearEnumeration=enumerateOwnedGearAssignments(settings.accountProfile,
   settings,MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS);
  const sp=Number(settings.skillPoints??0);
  // Pet-pair comparison is diagnostic-only; bound its total gear×pet work.
  const fullJointBudget=sp<=1000?96:sp<=5000?48:32;
  let useFullGearEnumeration=shouldEnumerateOwnedGear(gearEnumeration);
  const gearFor=context=>
   gearSelectionEffects(context.accountProfile,context,context.selectedEquipment||{});
  const evaluateJoint=(chosen,sendSolverProgress=false)=>{
   const dependencies={gearFor,
    solve:context=>optimizeBuild(context,sendSolverProgress?
     p=>self.postMessage({progress:p}):undefined,cache),
    score:(result,context,gear)=>calculateModeledScenario(result,context,gear).totalLog10,
    upperBoundOf:modeledCandidateUpperBound};
   const refined=useFullGearEnumeration?
    enumerateJointGearAndSkills(chosen,{...dependencies,assignments:gearEnumeration.assignments}):
    refineCoupledGearAndSkills(chosen,{...dependencies,maxRounds:3});
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
  const withContractDecision=createFinalCandidateDecision(settings,opts=>optimizeBuild(opts,undefined,cache));
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
  // No automatic pair comparisons: choose one owned, source-ranked
  // candidate per automatic slot. NEVER optimize with an empty active
  // pet slot merely because the expensive comparison was disabled.
  // Manual pet selections remain hard constraints.
  const baselineGear=gearFor(settings);
  const envelope=petCandidateGearWeightEnvelope(settings.accountProfile,settings);
  const initialPetPlan=petSearchPlan(settings.accountProfile,{
   ...settings,equipmentPetSlotWeights:envelope.slotWeights,
   equipmentPetPassiveWeights:envelope.passiveWeights,
   equipmentPetCoverageComplete:baselineGear.petEquipmentCoverageComplete
  });
  const selected={...settings,
   selectedDamagePet:settings.selectedDamagePet||initialPetPlan.damage[0]?.id||null,
   selectedGoldPet:settings.selectedGoldPet||initialPetPlan.gold[0]?.id||null};
  const chosen=evaluateJoint(selected,true);
  const equipment=bestEquipmentByCategory(settings.accountProfile,selected,3);
  self.postMessage({ok:true,result:{...withContractDecision(chosen),
   jointSearch:chosen.jointSearch,
   petSelection:{mode:"single-ranked-owned-pet-per-slot",
    comparedPairs:false,sourceRankedNotCalibrated:true}},
   selectedPets:{damage:selected.selectedDamagePet,
    gold:selected.selectedGoldPet},
   petComparisons:{damage:[],gold:[]},equipment,gearSelection:chosen.gearSelection});
 }catch(error){
  self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)});
 }
};
