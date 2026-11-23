/** First-party TT2 8.4 Unity SkillTreeInfo2.0 + BonusInfo provenance.
 * These entries are not unconditional direct damage multipliers.
 * No formulas copied from the former community reduction matrix.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-native-adaptive-r1";

export const CONDITIONAL_SKILL_SOURCES=Object.freeze({"ClanShipStun":{"name":"Anchoring Shot","primary":"ClanShipStunDamage","condition":"stunned-target","source":"BonusInfo: bonus only while the target is stunned"},"BossTimer":{"name":"Dimensional Shift","primary":"ShadowCloneAllSkillBoost","condition":"shadow-clone-active","source":"BonusInfo: spell boost only while Shadow Clone is active"},"PoisonedBlade":{"name":"Poison Edge","primary":"UltraDaggerPoisonBoost","condition":"dagger-poison-applied","source":"BonusInfo: additive percent poison bonus; no 1+10*A conversion"},"KratosSummon":{"name":"Sprouting Salts","primary":"KratosMonsterBonusAmount","condition":"kratos-sprout-stacks","source":"BonusInfo: special-titan stack mechanics, no permanent AllDamage"}});
export function conditionalSkillEvidence(levels={},settings={}){
 const rows=[];
 for(const [id,source] of Object.entries(CONDITIONAL_SKILL_SOURCES)){
  const level=Number(levels[id]??0);
  if(!Number.isSafeInteger(level)||level<=0||level>Number(skillInfo[id]?.MaxLevel))
   continue;
  const stunned=id==="ClanShipStun"&&settings.assumeBossStunned===true;
  rows.push({
   id,name:source.name,level,bonusType:skillInfo[id].BonusTypeA,
   sourceAmount:skillInfo[id]["A"+level],
   condition:source.condition,source:source.source,
   appliedToSkillScore:stunned,
   assumedCondition:stunned?"explicit-boss-stunned":"unverified",
   actualUptimeVerified:false,conditionModelComplete:false
  });
 }
 return {
  schema:"tt2-unverified-conditional-skills-v1",rows,
  recognized:rows.length,unverified:rows.filter(x=>!x.appliedToSkillScore).length,
  fullActivationKnown:false,
  addedToFixedAccountScore:false,predictsStageGain:false
 };
}
