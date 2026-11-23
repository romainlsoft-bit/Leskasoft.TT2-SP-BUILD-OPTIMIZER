/**
 * Explicit, source-local Stage Skip floor for ALL six TT2 damage builds.
 *
 * This is a legitimate constrained SP objective: buy the minimum source
 * talent level that meets a user-declared target, then optimize ALL remaining
 * SP using the existing score. No invented stage-HP, hit DPS, global skip,
 * expected proc rate, or extra score weight. Target is per attack channel,
 * and missing spell loadouts remain visible.
 *
 * Source: pinned SkillTreeInfo2.0.csv via vendor/skills.js.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-conditional-score-r1";
import {sourcedStageSkipChannels} from "./attack-channels.js?v=20261123-conditional-score-r1";
import {spellSelectionEvidence} from "./spell-scenarios.js?v=20261123-conditional-score-r1";

const strictTarget=value=>{
 if(value===undefined||value===null||value==="")return 0;
 const n=typeof value==="number"?value:typeof value==="string"&&
  /^\d+$/.test(value.trim())?Number(value.trim()):NaN;
 if(!Number.isSafeInteger(n)||n<0||n>10000)
  throw new RangeError("Source Stage Skip target must be an integer from 0 to 10,000.");
 return n;
};
/** Validated source value: a nonnegative integer for the Stage Skip
 * bonus column, with a read-only zero for level 0.
 */
export function stageSkipAtLevel(skillId,column,level){
 const row=skillInfo[skillId];
 if(!row||!["A","B","C"].includes(column))
  throw new TypeError("Invalid source Stage Skip definition");
 const n=Number(level),max=Number(row.MaxLevel);
 if(!Number.isSafeInteger(n)||n<0||n>max)
  throw new RangeError("Invalid Stage Skip skill level");
 const value=Number(row[column+n]);
 if(!Number.isSafeInteger(value)||value<0)
  throw new RangeError("Unavailable Stage Skip source level "+skillId+":"+n);
 return value;
}
export function resolvePushSkipTarget(settings={}){
 const target=strictTarget(settings.pushSourceStageSkipTarget);
 if(target===0)return {enabled:false,requiredLevels:{},
  target:0,optimizerScoreAltered:false,stageGainPredicted:false};
 const candidates=sourcedStageSkipChannels(settings.damage);
 const chosen=candidates.find(x=>x.id===settings.pushAttackChannelId);
 if(!chosen)throw new RangeError(
  "Select an attack channel with Stage Skip for the chosen damage build.");
 const spell=spellSelectionEvidence(settings);
 if(chosen.requiredSpell&&spell.valid&&
    !spell.ids.includes(chosen.requiredSpell))
  throw new RangeError("The selected attack requires a spell that is not equipped.");
 const source=skillInfo[chosen.sourceSkillId];
 if(!source||source["BonusType"+chosen.sourceColumn]!==chosen.sourceBonusType)
  throw new Error("Stage Skip source catalog mismatch");
 let requiredLevel=-1;
 for(let level=0;level<=Number(source.MaxLevel);level++){
  if(stageSkipAtLevel(chosen.sourceSkillId,chosen.sourceColumn,level)>=target){
   requiredLevel=level;break;
  }
 }
 if(requiredLevel<0)throw new RangeError(
  "Stage Skip target exceeds this attack talent's source maximum.");
 // A confirmed selected spell can have its unlock in another talent.
 // Source-only target never pretends to verify attack availability.
 const loadout=chosen.requiredSpell?(spell.valid?"equipped":"unverified"):"not-required";
 return {enabled:true,damage:settings.damage,gold:settings.gold??null,
  attackChannelId:chosen.id,attackLabel:chosen.label,
  sourceSkillId:chosen.sourceSkillId,sourceSkillName:source.Name,
  sourceBonusType:chosen.sourceBonusType,sourceColumn:chosen.sourceColumn,
  target,requiredLevel,sourceValueAtRequiredLevel:stageSkipAtLevel(
   chosen.sourceSkillId,chosen.sourceColumn,requiredLevel),
  sourceMaximum:stageSkipAtLevel(
   chosen.sourceSkillId,chosen.sourceColumn,Number(source.MaxLevel)),
  requiredLevels:{[chosen.sourceSkillId]:requiredLevel},
  requiredSpell:chosen.requiredSpell,spellLoadoutEvidence:loadout,
  includesGlobalStageSkip:false,
  unconditionalActivationProven:false,realBossKillVerified:false,
  optimizerScoreAltered:false,stageGainPredicted:false};
}
export function verifyPushSkipTarget(target,levels={}){
 if(target?.enabled!==true)return {enabled:false,satisfied:true};
 const level=Number(levels[target.sourceSkillId]??0);
 const actual=stageSkipAtLevel(target.sourceSkillId,target.sourceColumn,level);
 if(actual<target.target)
  throw new Error("Internal validation failed: unmet source Stage Skip target");
 return {...target,actualLevel:level,actualSourceStageSkip:actual,
  satisfied:true,stageGainPredicted:false};
}
