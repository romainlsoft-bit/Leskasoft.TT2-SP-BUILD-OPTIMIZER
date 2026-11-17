import {optimizeBuild} from "./engine.js?v=20261117-account-profile";
import {recommendPets,petScenarioScore} from "./pet-scenarios.js";
import {bestEquipmentByCategory,gearSelectionEffects} from "./equipment-scenarios.js";

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
  if(type==="optimize-pet-scenarios"){
   const damage= recommendPets(settings.accountProfile,settings,"damage",3);
   const gold= recommendPets(settings.accountProfile,settings,"gold",3);
   if(damage.length||gold.length){
    // Independent rankings. There are at most 3+3 evaluations; never 3x3.
    let chosenDamage=damage[0]||null;
    let chosenGold=gold[0]||null;
    const total=damage.length+gold.length;
    let completed=0;
    const evaluate=(candidate,slot)=>{
     const d=slot==="damage"?candidate:chosenDamage;
     const g=slot==="gold"?candidate:chosenGold;
     const context={...settings,selectedDamagePet:d?.id||null,
      selectedGoldPet:g?.id||null};
     const result=optimizeBuild(context,undefined,cache);
     completed++;
     self.postMessage({progress:{phase:"pet-scenarios",completed,total}});
     return {slot,damagePet:d?.id||null,goldPet:g?.id||null,
      damageName:d?.name||"",goldName:g?.name||"",
      adjustedScore:result.score+petScenarioScore(context,0)+selection.independentScore,
      result};
    };
    const damageResults=damage.map(p=>evaluate(p,"damage"));
    if(damageResults.length){
     const highest=damageResults.reduce((a,b)=>b.adjustedScore>a.adjustedScore?b:a);
     chosenDamage=damage.find(p=>p.id===highest.damagePet);
    }
    const goldResults=gold.map(p=>evaluate(p,"gold"));
    let best;
    if(goldResults.length)best=goldResults.reduce((a,b)=>b.adjustedScore>a.adjustedScore?b:a);
    else if(damageResults.length)best=damageResults.reduce((a,b)=>b.adjustedScore>a.adjustedScore?b:a);
    if(!best)throw new Error("No pet scenario available");
    self.postMessage({ok:true,result:best.result,
      selectedPets:{damage:best.damagePet,gold:best.goldPet},
      petComparisons:{damage:damageResults,gold:goldResults},
      equipment,gearSelection:selection});
    return;
   }
  }
  const result=optimizeBuild(settings,progress=>self.postMessage({progress}),cache);
  self.postMessage({ok:true,result,selectedPets:{
    damage:settings.selectedDamagePet||null,gold:settings.selectedGoldPet||null
   },petComparisons:{damage:[],gold:[]},equipment,gearSelection:selection});
 }catch(error){
  self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)});
 }
};
