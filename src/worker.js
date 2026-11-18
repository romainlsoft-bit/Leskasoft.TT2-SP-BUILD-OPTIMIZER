import {optimizeBuild} from "./engine.js?v=20261118-final-w";
import {petSearchPlan} from "./pet-scenarios.js?v=20261118-final-w";
import {calculateModeledScenario} from "./calculation-ledger.js?v=20261118-final-w";
import {selectPetPair} from "./pet-pair-search.js?v=20261118-final-w";
import {bestEquipmentByCategory,gearSelectionEffects,petCandidateGearWeightEnvelope,
 enumerateOwnedGearAssignments}
 from "./equipment-scenarios.js?v=20261118-final-w";
import {refineCoupledGearAndSkills,enumerateJointGearAndSkills}
 from "./joint-candidate-search.js?v=20261118-final-w";
import {modeledCandidateUpperBound} from "./model-score-bounds.js?v=20261118-final-w";

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
    scoreUpperBound:modeledCandidateUpperBound(winning.result,modeledScenario.totalLog10),
    result:{...winning.result,modeledScenario},
    gearSelection:winning.gearSelection,jointSearch:refined.search};
  };
  if(type==="optimize-pet-scenarios"){
   const initialGear=gearFor(settings);
   const envelope=petCandidateGearWeightEnvelope(settings.accountProfile,settings);
   const screening={...settings,
    equipmentPetSlotWeights:envelope.slotWeights,
    equipmentPetPassiveWeights:envelope.passiveWeights,
    equipmentPetCoverageComplete:initialGear.petEquipmentCoverageComplete};
   const plan=petSearchPlan(settings.accountProfile,screening);
   const {damage,gold}=plan;
   const pairCount=Math.max(1,damage.length)*Math.max(1,gold.length);
   useFullGearEnumeration=useFullGearEnumeration&&
    gearEnumeration.assignments.length*pairCount<=fullJointBudget;
   if(damage.length||gold.length){
    const chosen=selectPetPair(damage,gold,(damagePet,goldPet)=>{
     const context={...settings,selectedDamagePet:damagePet,
      selectedGoldPet:goldPet};
     return {damagePet,goldPet,...evaluateJoint(context),
      damageName:damage.find(x=>x.id===damagePet)?.name||"",
      goldName:gold.find(x=>x.id===goldPet)?.name||""};
    },{maxPasses:3,exhaustiveShortlist:true,maxCandidatesPerSlot:6,
     entireEligibleRoster:plan.exhaustiveEligible,
     onProgress:progress=>self.postMessage({progress})});
    if(!chosen.best)throw new Error("No pet scenario available");
    const result={...chosen.best.result,
     petSearch:{
      converged:chosen.converged,passes:chosen.passes,
      uniqueEvaluations:chosen.uniqueEvaluations,
      shortlistOnly:chosen.shortlistOnly,
      exhaustiveWithinShortlist:chosen.exhaustiveWithinShortlist===true,
      exhaustiveAmongEligiblePetPairs:chosen.exhaustiveAmongEligiblePetPairs===true,
      eligibleCount:plan.eligibleCount,
      omittedCandidates:plan.omittedCandidates,
      candidateCount:chosen.candidateCount,
      pairBudget:plan.pairBudget,
      jointSearch:chosen.best.jointSearch,
      comparisonBounds:chosen.comparisonBounds,
      fullOwnedGearCartesianPerPair:useFullGearEnumeration,
      completeOwnedPetAndGearCartesian:useFullGearEnumeration&&
       plan.exhaustiveEligible,
      globallyOptimalAcrossPetGearSP:false
     }};
    const winningSettings={...settings,
     selectedDamagePet:chosen.best.damagePet,
     selectedGoldPet:chosen.best.goldPet};
    const equipment=bestEquipmentByCategory(settings.accountProfile,winningSettings,3);
    self.postMessage({ok:true,result,
     selectedPets:{damage:chosen.best.damagePet,gold:chosen.best.goldPet},
     petComparisons:{damage:chosen.damageResults,gold:chosen.goldResults},
     petSearch:result.petSearch,equipment,gearSelection:chosen.best.gearSelection});
    return;
   }
  }
  const chosen=evaluateJoint(settings,true);
  const equipment=bestEquipmentByCategory(settings.accountProfile,settings,3);
  self.postMessage({ok:true,result:{...chosen.result,
   jointSearch:chosen.jointSearch},
   selectedPets:{damage:settings.selectedDamagePet||null,
    gold:settings.selectedGoldPet||null},
   petComparisons:{damage:[],gold:[]},equipment,gearSelection:chosen.gearSelection});
 }catch(error){
  self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)});
 }
};
