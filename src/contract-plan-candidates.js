/**
 * Bounded candidate-generator for hypothetical TT2 8.4 contract allocation.
 *
 * The 2/3 Pact step is an SP SEARCH GRID heuristic, never a sourced damage
 * multiplier or a claim about uptime. This module has no scoring side effects.
 */
import {skillInfo} from "../vendor/skills.js?v=20261120-unified-graph-r2";
const IDS=Object.freeze(["ForbiddenContract","RoyalContract","TerrifyingPact"]);
const valid=(x)=>Number.isSafeInteger(Number(x))&&Number(x)>=0;
export function contractInvestmentPlans(currentLevels={},seedLevels={},minimums={},policy={}){
 const floor=id=>valid(minimums[id])?Number(minimums[id]):0;
 const level=(source,id)=>{
  const n=valid(source?.[id])?Number(source[id]):0;
  const max=Number(skillInfo[id].MaxLevel);
  return Math.min(max,Math.max(floor(id),n));
 };
 const original=Object.fromEntries(IDS.map(id=>[id,level(currentLevels,id)]));
 const seeded=Object.fromEntries(IDS.map(id=>[id,level(seedLevels,id)]));
 const plans=[],unique=new Set();
 const add=(id,levels)=>{
  const required=Object.fromEntries(IDS.map(key=>[key,level(levels,key)]));
  const signature=IDS.map(key=>required[key]).join("/");
  if(unique.has(signature))return;
  unique.add(signature);
  plans.push({id,minimums:required});
 };
 add("contract-investment",seeded);
 if(policy.pactAtMaxDuringFundedTicks===true){
  const pact=original.TerrifyingPact;
  if(pact>=3){
   // For a current Pact lv22, inspect lv15. Do not assume it wins.
   const reduced=Math.max(floor("TerrifyingPact"),Math.round(pact*2/3));
   if(reduced<pact)add("contract-pact-stepdown",{
    ...original,TerrifyingPact:reduced});
  }
  const f=seeded.ForbiddenContract>0||original.ForbiddenContract>0;
  const r=seeded.RoyalContract>0||original.RoyalContract>0;
  if((f||r)&&Math.max(seeded.TerrifyingPact,original.TerrifyingPact)>0)
   add("contract-pact-priority",{
    ForbiddenContract:f?Math.max(1,floor("ForbiddenContract")):0,
    RoyalContract:r?Math.max(1,floor("RoyalContract")):0,
    TerrifyingPact:Math.max(seeded.TerrifyingPact,original.TerrifyingPact)
   });
 }
 return plans.slice(0,3);
}
