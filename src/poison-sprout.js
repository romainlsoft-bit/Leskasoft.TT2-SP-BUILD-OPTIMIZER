/**
 * Native source-only damage for Poison Edge and Sprouting Salts.
 * One poison application, or the talent's own maximum Sprout stacks,
 * are explicit hypothetical boss conditions, never actual uptime.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {positiveLog10,log10OnePlusPower} from "./account-artifacts.js?v=20261123-boss-specials-r1";

export function poisonSproutEvidence(id,level,settings={}){
 if(!["PoisonedBlade","KratosSummon"].includes(id))throw new RangeError("Unknown stack talent");
 const row=skillInfo[id],n=Number(level),poison=id==="PoisonedBlade";
 if(!Number.isSafeInteger(n)||n<0||n>Number(row.MaxLevel))throw new RangeError("Invalid stack talent level");
 if(poison?(row.BonusTypeA!=="UltraDaggerPoisonBoost"||row.BonusTypeD!=="UltraDaggerPoisonMaxCount"):
  (row.BonusTypeA!=="KratosMonsterBonusAmount"||row.BonusTypeB!=="KratosMonsterStacks"||row.BonusTypeC!=="KratosMonsterSpawnChance"))
  throw new Error("Stack talent source changed");
 const sourceMaxStacks=Number(poison?row.BonusAmountD:row["B"+n]);
 if(!Number.isSafeInteger(sourceMaxStacks)||sourceMaxStacks<0)throw new Error("Invalid source stack cap");
 const sourceLog=n===0?0:positiveLog10(row["A"+n]);
 if(sourceLog===null||sourceLog<0)throw new Error("Invalid source stack bonus");
 const eligible=poison?settings.assumePoisonApplied===true:settings.assumeSproutAtMax===true;
 const modeledStacks=eligible&&n>0?(poison?Math.min(1,sourceMaxStacks):sourceMaxStacks):0;
 const scoreLog10=modeledStacks===0?0:poison?
  log10OnePlusPower(sourceLog+Math.log10(modeledStacks)):modeledStacks*sourceLog;
 return {id,level:n,eligible,sourceMaxStacks,modeledStacks,sourceLog10:sourceLog,
  scoreLog10,scenario:poison?"one-poison-application":"source-maximum-sprout-stacks",
  additivePoison:poison,multiplicativeSprout:!poison,
  actualActivationVerified:false,extraAccountStacksExcluded:true,
  spawnChanceAddedToDamage:false,addedToFixedAccount:false,predictsStageGain:false};
}
