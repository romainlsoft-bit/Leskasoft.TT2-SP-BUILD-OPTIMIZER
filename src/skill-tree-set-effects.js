/**
 * The six TT2 6.2+ mythic sets give All Damage per SP invested in exactly
 * one skill tree, not a fixed account bonus. This changes optimal SP routing.
 *
 * Game Hive DevLog #140: 1.01x All Damage per Skill Point assigned to the
 * associated tree. 8.4 EquipmentSetInfo.csv holds the current Amount/Inc/Expo.
 *
 * Each independent skill's cumulative SP cost contributes
 *   spentPointsInThatSkill * log10(set's multiplier)
 * to the branch's additive DP score. Sum across skills within the branch.
 *
 * This is *not* one multiplication per skill level and is not applied to
 * every branch or to every spendable SP regardless of allocation.
 */
import {EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js";
import {skillInfo} from "../vendor/skills.js";
import {positiveLog10} from "./account-artifacts.js";

export const SKILL_TREE_SET_FAMILIES=Object.freeze({
 SkillTreeKnightAllDamage:"BranchRed",
 SkillTreePetAllDamage:"BranchOrange",
 SkillTreeWarlordAllDamage:"BranchYellow",
 SkillTreeSorcererAllDamage:"BranchBlue",
 SkillTreeRogueAllDamage:"BranchGreen",
 SkillTreeAlchemistAllDamage:"BranchPurple"
});
const families=new Set(Object.keys(SKILL_TREE_SET_FAMILIES));
const entries=Object.entries(skillInfo);
const COST_BY_SKILL=Object.fromEntries(entries.map(([id,info])=>{
 const costs=[0];
 for(let level=1;level<=Number(info.MaxLevel);level++){
  const cost=Number(info["Co"+(level-1)]);
  if(!Number.isSafeInteger(cost)||cost<0)
   throw new Error("Invalid TT2 source cost "+id+" at level "+level);
  costs.push(costs.at(-1)+cost);
 }
 return [id,Float64Array.from(costs)];
}));
const cache=new WeakMap();
const empty=()=>({
 byBranch:Object.fromEntries(Object.values(SKILL_TREE_SET_FAMILIES)
  .map(x=>[x,0])),entries:[],unknown:[],
 recognized:0,unresolved:0,applied:0,
 passiveAccountScoreAdded:false,fullyGameCalibrated:false
});

/** Evidence comes from the completed-set collection (not equipped pieces).
 * An observed unlocked set remains owned even after selling every item.
 */
export function resolveSkillTreeSetEffects(profile){
 if(!profile||typeof profile!=="object")return empty();
 if(cache.has(profile))return cache.get(profile);
 const result=empty(),seen=new Set();
 const observed=profile?.sections?.equipmentSets?.present===true;
 if(!observed){cache.set(profile,result);return result}
 for(const claimedId of profile.ownedSetIds||[]){
  const setId=String(claimedId);
  const catalog=EQUIPMENT_SET_CATALOG[setId];
  if(!catalog)continue;
  if(seen.has(setId))continue;
  seen.add(setId);
  for(const bonus of catalog.bonuses){
   if(!families.has(bonus.type))continue;
   const branch=SKILL_TREE_SET_FAMILIES[bonus.type];
   const amount=positiveLog10(bonus.amount);
   const inc=Number(bonus.inc),expo=Number(bonus.expo);
   // Both the current formula and game patch notes say x1.01 PER SP.
   // The six game rows have Inc=1, Expo=1, i.e. no CP dependence.
   // New or changed source values must not silently get a guessed formula.
   const valid=amount!==null&&amount>=0&&
    Number.isFinite(amount)&&inc===1&&expo===1&&catalog.type==="Mythic";
   const row={setId,bonusType:bonus.type,branch,
    amount:bonus.amount,inc:bonus.inc,expo:bonus.expo,
    log10PerPoint:valid?amount:null,
    source:"completed-equipment-set-collection",
    status:valid?"verified-per-skill-point":"unsupported-per-SP-source-scaling"};
   result.entries.push(row);
   result.recognized++;
   if(valid){result.byBranch[branch]+=amount;result.applied++}
   else{result.unknown.push({setId,bonusType:bonus.type,reason:row.status});result.unresolved++}
  }
 }
 if(profile.sections.equipmentSets?.truncated===true)
  result.unknown.push({system:"equipmentSets",
   reason:"partial-owned-set-collection-other-branch-sets-may-be-absent"});
 cache.set(profile,result);return result;
}

export function pointsSpentInSkill(id,level){
 const costs=COST_BY_SKILL[id];
 if(!costs||!Number.isInteger(level)||level<0||level>=costs.length)
  throw new RangeError("Unknown TT2 skill/level "+id+" "+level);
 return costs[level];
}

/** Exact within the *modeled* independent log10 skill-tree DP objective. */
export function skillTreeSetScore(id,level,settings){
 if(!Number.isInteger(level)||level<=0)return 0;
 const branch=skillInfo[id]?.Branch;
 if(!branch)return 0;
 const coeff=resolveSkillTreeSetEffects(settings?.accountProfile).byBranch[branch]||0;
 return coeff?pointsSpentInSkill(id,level)*coeff:0;
}

export function skillTreeSetAllocationEvidence(profile,levels={}){
 const sets=resolveSkillTreeSetEffects(profile);
 const spentByBranch=Object.fromEntries(Object.keys(sets.byBranch).map(b=>[b,0]));
 for(const [id,info] of entries){
  const level=Number(levels[id]||0);
  spentByBranch[info.Branch]+=pointsSpentInSkill(id,level);
 }
 const damageLog10=Object.keys(sets.byBranch).reduce(
  (sum,b)=>sum+spentByBranch[b]*sets.byBranch[b],0);
 return {...sets,spentByBranch,damageLog10,
  includedInSkillScore:true,addedToAccountFixedScore:false};
}
