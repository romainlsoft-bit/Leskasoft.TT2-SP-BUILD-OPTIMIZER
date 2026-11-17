import {optimizeBuild} from "./engine.js?v=20261117-monument-pools";
import {recommendPets} from "./pet-scenarios.js?v=20261117-monument-pools";
import {calculateModeledScenario} from "./calculation-ledger.js";
import {selectPetPair} from "./pet-pair-search.js";
import {bestEquipmentByCategory,gearSelectionEffects} from "./equipment-scenarios.js?v=20261117-monument-pools";

// One worker, one cache. The solver checks per-branch score and constraint
// signatures: changing a pet can change Summoner/Combat Techniques, while
// independent branches reuse their previously calculated DP frontiers.
self.onmessage=event=>{
 const {type,settings}=event.data||{};
 if(!["optimize","optimize-pet-scenarios"].includes(type))return;
 const cache=new Map();
 try{
  const equipment=bestEquipmentByCategory(settings.accountProfile,settings,2);
  const selection=gearSelectionEffects(settings.accountProfile,settings,settings.selectedEquipment||{});
  const gearContext={...settings,equipmentPetSlotWeights:selection.petEquipmentSlotWeights,
   equipmentPetPassiveWeights:selection.petEquipmentPassiveWeights,
   equipmentPetCoverageComplete:selection.petEquipmentCoverageComplete};
  if(type==="optimize-pet-scenarios"){
   const damage= recommendPets(settings.accountProfile,gearContext,"damage",3);
   const gold= recommendPets(settings.accountProfile,gearContext,"gold",3);
   if(damage.length||gold.length){
    // Search one pet slot at a time, but re-evaluate against the winning
    // opposite slot. A scenario scored with an old partner cannot be the
    // result of a combined optimization.
    const choose=selectPetPair(damage,gold,(damagePet,goldPet)=>{
     const context={...gearContext,selectedDamagePet:damagePet,
      selectedGoldPet:goldPet};
     const result=optimizeBuild(context,undefined,cache);
     const modeledScenario=calculateModeledScenario(result,context,selection);
     return {damagePet,goldPet,adjustedScore:modeledScenario.totalLog10,
      damageName:damage.find(p=>p.id===damagePet)?.name||"",
      goldName:gold.find(p=>p.id===goldPet)?.name||"",
      result:{...result,modeledScenario}};
    },{maxPasses:3,onProgress:progress=>self.postMessage({progress})});
    if(!choose.best)throw new Error("No pet scenario available");
    const result={...choose.best.result,
     petSearch:{converged:choose.converged,passes:choose.passes,
      uniqueEvaluations:choose.uniqueEvaluations,
      shortlistOnly:true,candidateCount:choose.candidateCount}};
    self.postMessage({ok:true,result,
     selectedPets:{damage:choose.best.damagePet,gold:choose.best.goldPet},
     petComparisons:{damage:choose.damageResults,gold:choose.goldResults},
     petSearch:result.petSearch,
     equipment,gearSelection:selection});
    return;
   }
  }
  const result=optimizeBuild(gearContext,progress=>self.postMessage({progress}),cache);
  const modeledScenario=calculateModeledScenario(result,gearContext,selection);
  self.postMessage({ok:true,result:{...result,modeledScenario},selectedPets:{
    damage:settings.selectedDamagePet||null,gold:settings.selectedGoldPet||null
   },petComparisons:{damage:[],gold:[]},equipment,gearSelection:selection});
 }catch(error){
  self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)});
 }
};
