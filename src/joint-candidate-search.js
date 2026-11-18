/**
 * Block-coordinate refinement between the ACTUAL equipped gear and the
 * optimized skill tree for one chosen pair of active pets.
 *
 * Previously gear was selected at CT=0 before the solver, and then kept
 * forever even when Combat Techniques reached 50. That is not a coupled
 * choice: a different helmet/primary may become best at the final CT.
 *
 * This is monotone best-seen refinement over the modeled proxy, not proof
 * of a global optimum over every possible gear × SP × pet configuration.
 * Cache signatures remain the responsibility of optimizeBuild.
 */
const SLOTS=Object.freeze(["Sword","Helmet","Armor","Slash","Aura"]);
export const gearSignature=gear=>JSON.stringify(SLOTS.map(k=>
 gear?.selected?.[k]?.id??null));
export function refineCoupledGearAndSkills(settings,{gearFor,solve,score,maxRounds=3}={}){
 if(typeof gearFor!=="function"||typeof solve!=="function"||typeof score!=="function")
  throw new TypeError("Joint gear/SP search requires gearFor, solve and score");
 if(!Number.isSafeInteger(maxRounds)||maxRounds<1||maxRounds>5)
  throw new RangeError("Joint gear/SP rounds must be 1–5");
 let ct=0,best=null,converged=false,cycleDetected=false;
 const visited=new Set(),trace=[];
 for(let round=0;round<maxRounds;round++){
  const requested={...settings,petCombatTechniquesLevel:ct};
  const gear=gearFor(requested);
  const signature=gearSignature(gear);
  if(visited.has(signature)){cycleDetected=true;break;}
  visited.add(signature);
  const context={...settings,
   equipmentPetSlotWeights:gear.petEquipmentSlotWeights||{},
   equipmentPetPassiveWeights:gear.petEquipmentPassiveWeights||{},
   equipmentPetCoverageComplete:gear.petEquipmentCoverageComplete};
  const result=solve(context);
  const adjustedScore=score(result,context,gear);
  if(typeof adjustedScore!=="number"||!Number.isFinite(adjustedScore))
   throw new Error("Joint gear/SP candidate score is not finite");
  const optimizedCT=Number(result?.levels?.CombatTechniques??0);
  if(!Number.isSafeInteger(optimizedCT)||optimizedCT<0||optimizedCT>50)
   throw new Error("Invalid optimized Combat Techniques level");
  const row={signature,ctForGear:ct,optimizedCT,adjustedScore,
   exhaustiveGearSearch:gear.gearSearch?.exhaustiveWithinOwnedInventory===true};
  trace.push(row);
  if(!best||adjustedScore>best.adjustedScore+1e-10)
   best={gearSelection:gear,result,context,adjustedScore};
  // Gear can change with optimized CT: check its selection at the actual
  // resulting CT, rather than treating a previous gear choice as optimal.
  const next=gearFor({...settings,petCombatTechniquesLevel:optimizedCT});
  const nextKey=gearSignature(next);
  if(signature===nextKey){converged=true;break;}
  ct=optimizedCT;
 }
 return {best,search:{
  evaluations:trace.length,trace,converged,cycleDetected,
  allExaminedGearSpacesComplete:trace.length>0&&
   trace.every(x=>x.exhaustiveGearSearch),
  globallyOptimalAcrossPetGearSP:false,
  bestSeenNotLastAssumed:true,
  stoppedAtMaxRounds:!converged&&!cycleDetected&&trace.length===maxRounds
 }};
}

/**
 * Exact enumeration of all EXPLICITLY OWNED eligible gear combinations for
 * one pet pair, with a fresh SP optimization for EVERY gear combination.
 * "Exact" refers to this finite Cartesian input set; the SP solver can
 * still report approximate bounded optimization, and the game model omits
 * conditional mechanics. No claim about in-game stage maxima.
 */
export function enumerateJointGearAndSkills(settings,{
 assignments,gearFor,solve,score
}={}){
 if(!Array.isArray(assignments)||!assignments.length||assignments.length>16)
  throw new RangeError("Full gear/SP enumeration requires 1–16 assignments");
 if(typeof gearFor!=="function"||typeof solve!=="function"||typeof score!=="function")
  throw new TypeError("Missing full gear/SP enumeration function");
 let best=null;
 const trace=[],seen=new Set();
 for(const assignment of assignments){
  const requested={...settings,selectedEquipment:assignment,
   petCombatTechniquesLevel:0};
  const gear=gearFor(requested),signature=gearSignature(gear);
  if(seen.has(signature))continue; // duplicated equivalent empty slot
  seen.add(signature);
  const context={...settings,
   equipmentPetSlotWeights:gear.petEquipmentSlotWeights||{},
   equipmentPetPassiveWeights:gear.petEquipmentPassiveWeights||{},
   equipmentPetCoverageComplete:gear.petEquipmentCoverageComplete};
  const result=solve(context),adjustedScore=score(result,context,gear);
  if(typeof adjustedScore!=="number"||!Number.isFinite(adjustedScore))
   throw new Error("Non-finite full gear/SP score");
  trace.push({signature,adjustedScore,
   ctForGear:0,optimizedCT:result?.levels?.CombatTechniques??null,
   exactSP:result?.optimality?.mode==="exact"});
  if(!best||adjustedScore>best.adjustedScore+1e-10)
   best={gearSelection:gear,result,context,adjustedScore};
 }
 return {best,search:{
  method:"full-owned-gear-cartesian-with-SP-reoptimization",
  evaluations:trace.length,assignmentsRequested:assignments.length,
  trace,converged:true,cycleDetected:false,
  allExaminedGearSpacesComplete:true,
  exhaustiveOwnedGearPerPetPair:true,
  exactSkillOptimizationForWinner:best?.result?.optimality?.mode==="exact",
  globallyOptimalAcrossPetGearSP:false,
  bestSeenNotLastAssumed:true,stoppedAtMaxRounds:false
 }};
}
