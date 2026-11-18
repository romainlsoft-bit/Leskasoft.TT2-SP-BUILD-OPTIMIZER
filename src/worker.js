import {optimizeBuild} from "./engine.js?v=20261118-pet-coupling-p";
import {recommendPets} from "./pet-scenarios.js?v=20261118-pet-coupling-p";
import {calculateModeledScenario} from "./calculation-ledger.js?v=20261118-pet-coupling-p";
import {selectPetPair} from "./pet-pair-search.js?v=20261118-pet-search-q";
import {bestEquipmentByCategory,gearSelectionEffects,petCandidateGearWeightEnvelope} from "./equipment-scenarios.js?v=20261118-pet-search-q";

// One worker, one cache. The solver checks per-branch score and constraint
// signatures: changing a pet can change Summoner/Combat Techniques, while
// independent branches reuse their previously calculated DP frontiers.
self.onmessage=event=>{
 const {type,settings}=event.data||{};
 if(!["optimize","optimize-pet-scenarios"].includes(type))return;
 const cache=new Map();
 try{
  const selectionFor=context=>
   gearSelectionEffects(context.accountProfile,context,context.selectedEquipment||{});
  const contextFor=(context,gear)=>({...context,
   equipmentPetSlotWeights:gear.petEquipmentSlotWeights,
   equipmentPetPassiveWeights:gear.petEquipmentPassiveWeights,
   equipmentPetCoverageComplete:gear.petEquipmentCoverageComplete});
  const initialSelection=selectionFor(settings);
  const initialContext=contextFor(settings,initialSelection);
  if(type==="optimize-pet-scenarios"){
   const envelope=petCandidateGearWeightEnvelope(settings.accountProfile,settings);
   const screeningContext={...initialContext,
    equipmentPetSlotWeights:envelope.slotWeights,
    equipmentPetPassiveWeights:envelope.passiveWeights};
   const damage= recommendPets(settings.accountProfile,screeningContext,"damage",3);
   const gold= recommendPets(settings.accountProfile,screeningContext,"gold",3);
   if(damage.length||gold.length){
    // Search one pet slot at a time, but re-evaluate against the winning
    // opposite slot. A scenario scored with an old partner cannot be the
    // result of a combined optimization.
    const choose=selectPetPair(damage,gold,(damagePet,goldPet)=>{
     const pairSettings={...settings,selectedDamagePet:damagePet,
      selectedGoldPet:goldPet};
     // Each evaluated pair chooses its gear before the SP optimizer,
     // rather than inheriting the original pair's stale item weights.
     const pairGear=selectionFor(pairSettings);
     const context=contextFor(pairSettings,pairGear);
     const result=optimizeBuild(context,undefined,cache);
     const modeledScenario=calculateModeledScenario(result,context,pairGear);
     return {damagePet,goldPet,adjustedScore:modeledScenario.totalLog10,
      damageName:damage.find(p=>p.id===damagePet)?.name||"",
      goldName:gold.find(p=>p.id===goldPet)?.name||"",
      gearSelection:pairGear,result:{...result,modeledScenario}};
    },{maxPasses:3,exhaustiveShortlist:true,
     onProgress:progress=>self.postMessage({progress})});
    if(!choose.best)throw new Error("No pet scenario available");
    const result={...choose.best.result,
     petSearch:{converged:choose.converged,passes:choose.passes,
      uniqueEvaluations:choose.uniqueEvaluations,
      shortlistOnly:true,exhaustiveWithinShortlist:choose.exhaustiveWithinShortlist===true,
      candidateCount:choose.candidateCount}};
    const winningSettings={...settings,selectedDamagePet:choose.best.damagePet,
     selectedGoldPet:choose.best.goldPet};
    const equipment=bestEquipmentByCategory(settings.accountProfile,winningSettings,2);
    self.postMessage({ok:true,result,
     selectedPets:{damage:choose.best.damagePet,gold:choose.best.goldPet},
     petComparisons:{damage:choose.damageResults,gold:choose.goldResults},
     petSearch:result.petSearch,
     equipment,gearSelection:choose.best.gearSelection});
    return;
   }
  }
  const result=optimizeBuild(initialContext,progress=>self.postMessage({progress}),cache);
  const modeledScenario=calculateModeledScenario(result,initialContext,initialSelection);
  const equipment=bestEquipmentByCategory(settings.accountProfile,settings,2);
  self.postMessage({ok:true,result:{...result,modeledScenario},selectedPets:{
    damage:settings.selectedDamagePet||null,gold:settings.selectedGoldPet||null
   },petComparisons:{damage:[],gold:[]},equipment,gearSelection:initialSelection});
 }catch(error){
  self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)});
 }
};
