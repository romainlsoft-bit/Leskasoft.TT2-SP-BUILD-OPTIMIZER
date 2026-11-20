import {rankVisitedCandidateBounds} from "./model-score-bounds.js?v=20261120-log-native-r4";
/**
 * Coordinate-wise search over the two actual active pet slots.
 *
 * A damage-pet winner scored against gold-pet G1 may not remain best after
 * the gold slot switches to G2 (Combat Techniques, skill-point allocation
 * and branch-cache signatures can change). Do not return a damage choice
 * evaluated for a different gold pet, or compare two incompatible score
 * contexts. The search evaluates one axis at a time, never constructs a
 * Cartesian 3 x 3 candidate product, and reuses evaluated pairs.
 *
 * A three-per-slot SHORTLIST is not proof of the globally optimal pet pair.
 * The opt-in exhaustiveShortlist mode removes coordinate-descent traps
 * within the shortlist, but not outside candidates excluded by screening.
 * If a fixed point has not been reached within the pass cap, report it as
 * unresolved instead of claiming convergence.
 */
const ID=x=>x?.id??null;
const finite=(score)=>typeof score==="number"&&Number.isFinite(score);
const stablePick=(rows,current)=>rows.reduce((best,row)=>{
 if(!best||row.adjustedScore>best.adjustedScore+1e-10)return row;
 if(Math.abs(row.adjustedScore-best.adjustedScore)<1e-10&&
    (row.petId===current&&best.petId!==current))return row;
 return best;
},null);

export function selectPetPair(damageCandidates=[],goldCandidates=[],evaluate,options={}){
 if(typeof evaluate!=="function")throw new TypeError("Pet scenario evaluator required");
 const maxPasses=options.maxPasses===undefined?3:Number(options.maxPasses);
 if(!Number.isSafeInteger(maxPasses)||maxPasses<1||maxPasses>6)
  throw new RangeError("Pet search passes must be 1–6");
 const damage=damageCandidates.filter(x=>typeof ID(x)==="string"&&ID(x));
 const gold=goldCandidates.filter(x=>typeof ID(x)==="string"&&ID(x));
 if(new Set(damage.map(ID)).size!==damage.length||new Set(gold.map(ID)).size!==gold.length)
  throw new Error("Duplicated pet candidate IDs");
 const perSlot=options.maxCandidatesPerSlot??3;
 if(!Number.isSafeInteger(perSlot)||perSlot<1||perSlot>6)
  throw new RangeError("At most six candidate pets per slot");
 if(damage.length>perSlot||gold.length>perSlot)
  throw new RangeError("At most "+perSlot+" candidate pets per slot");
 const visited=new Map(),attempts=[],progress=options.onProgress;
 let damagePet=ID(damage[0]),goldPet=ID(gold[0]),passes=0,
  damageResults=[],goldResults=[],converged=false;
 function evaluatePair(d,g){
  const key=JSON.stringify([d,g]);
  if(visited.has(key))return visited.get(key);
  const result=evaluate(d,g);
  if(!result||!finite(result.adjustedScore))
   throw new Error("Non-finite pet scenario for "+key);
  const entry={...result,damagePet:d,goldPet:g,
   adjustedScore:result.adjustedScore};
  visited.set(key,entry);
  attempts.push({damagePet:d,goldPet:g,score:entry.adjustedScore,
   upperBound:entry.scoreUpperBound??entry.adjustedScore});
  progress?.({completed:visited.size,total:options.exhaustiveShortlist===true?
    Math.max(1,damage.length)*Math.max(1,gold.length):
    maxPasses*(damage.length+gold.length),
   phase:"pet-scenarios"});
  return entry;
 }
 if(!damage.length&&!gold.length)
  return {best:null,damageResults:[],goldResults:[],converged:true,
   passes:0,uniqueEvaluations:0,attempts:[]};
 // Enumerate the small, already screened Cartesian shortlist. Every pair
 // carries its own gear reranking, SP optimization and scenario ledger.
 // Not a global optimum over all owned pets, gear or real stages.
 if(options.exhaustiveShortlist===true){
  let winner=null;
  for(const d of damage.length?damage.map(ID):[null])
   for(const g of gold.length?gold.map(ID):[null]){
    const row=evaluatePair(d,g);
    if(!winner||row.adjustedScore>winner.adjustedScore+1e-10)winner=row;
   }
  const finalDamage=damage.map(p=>({
   ...evaluatePair(ID(p),winner.goldPet),petId:ID(p),slot:"damage"
  }));
  const finalGold=gold.map(p=>({
   ...evaluatePair(winner.damagePet,ID(p)),petId:ID(p),slot:"gold"
  }));
  return {best:winner,damageResults:finalDamage,goldResults:finalGold,
   converged:true,passes:1,uniqueEvaluations:visited.size,attempts,
   candidateCount:{damage:damage.length,gold:gold.length},
   shortlistOnly:options.entireEligibleRoster!==true,
   exhaustiveWithinShortlist:true,
   exhaustiveAmongEligiblePetPairs:options.entireEligibleRoster===true,
   comparisonBounds:rankVisitedCandidateBounds([...visited.values()],winner)};
 }
 for(let pass=0;pass<maxPasses;pass++){
  passes++;
  const priorDamage=damagePet,priorGold=goldPet;
  damageResults=damage.length?damage.map(p=>{
   const scored=evaluatePair(ID(p),goldPet);
   return {...scored,petId:ID(p),slot:"damage"};
  }):[];
  if(damageResults.length)damagePet=stablePick(damageResults,damagePet).petId;
  goldResults=gold.length?gold.map(p=>{
   const scored=evaluatePair(damagePet,ID(p));
   return {...scored,petId:ID(p),slot:"gold"};
  }):[];
  if(goldResults.length)goldPet=stablePick(goldResults,goldPet).petId;
  if(priorDamage===damagePet&&priorGold===goldPet){converged=true;break}
 }
 // Always materialize an optimization for the actual selected pair,
 // not a stale result captured while optimizing an alternative gold pet.
 const best=evaluatePair(damagePet,goldPet);
 const consistentDamageResults=damage.length?damage.map(p=>({
  ...evaluatePair(ID(p),goldPet),petId:ID(p),slot:"damage"
 })):[];
 // The search may stop without convergence. Report this rather than
 // mistakenly implying that both axes have settled at their true optimum.
 const damageWinner=consistentDamageResults.length?
  stablePick(consistentDamageResults,damagePet).petId:damagePet;
 if(damageWinner!==damagePet)converged=false;
 return {best,damageResults:consistentDamageResults,goldResults,
  converged,passes,uniqueEvaluations:visited.size,attempts,
  candidateCount:{damage:damage.length,gold:gold.length},
  shortlistOnly:options.entireEligibleRoster!==true,
  exhaustiveAmongEligiblePetPairs:false,
  comparisonBounds:rankVisitedCandidateBounds([...visited.values()],best)};
}
