/**
 * Shared owned-gear search limits. Keep the candidate enumeration limit
 * identical to the joint evaluator's accepted range: otherwise a completed
 * inventory with 17-32 admissible setups crashes the public worker.
 */
export const MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS=32;
export const MAX_GEAR_ENUMERATION_INPUT_LIMIT=256;
export function shouldEnumerateOwnedGear(enumeration){
 return enumeration?.exhaustive===true&&
  Array.isArray(enumeration.assignments)&&
  enumeration.assignments.length>=1&&
  enumeration.assignments.length<=MAX_EXHAUSTIVE_OWNED_GEAR_ASSIGNMENTS;
}
