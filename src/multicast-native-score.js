/**
 * Source-only multicast skill scoring for TT2 8.4.
 *
 * A = per-multicast stack multiplier; B = number of available stacks.
 * Only the sourced A multiplier can be credited. Neither a fabricated
 * 10x per stack nor unrelated, guessed "other gold" is valid.
 *
 * The returned score is conditional on caller-verified spell loadout,
 * maximum-level scenario and (assumed/declared) stack availability.
 * It is not measured spell uptime, actual cast success or boss DPS.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {MULTICAST_SKILL_SPELLS} from "./spell-scenarios.js?v=20261123-boss-specials-r1";

export function nativeMulticastSkillScore(id,level,multicast,routeWeight){
 const row=skillInfo[id],n=Number(level),w=Number(routeWeight);
 if(!row||!Object.hasOwn(MULTICAST_SKILL_SPELLS,id)||
   !Number.isSafeInteger(n)||n<0||n>Number(row.MaxLevel))
  throw new RangeError("Invalid source multicast skill/level");
 if(!Number.isFinite(w)||w<0)
  throw new RangeError("Invalid multicast route reduction");
 if(typeof row.BonusTypeA!=="string"||
    !row.BonusTypeA.endsWith("StacksBonus")||
    typeof row.BonusTypeB!=="string"||
    !row.BonusTypeB.endsWith("Stacks"))
  throw new Error("Multicast native bonus types changed; verify source model");
 if(n===0||multicast?.modeled!==true||multicast.modeledCharges===0)
  return {scoreLog10:0,charges:0,sourceLog10PerCharge:0,
   sourceOnly:true,excludedInventedTenfoldPerCharge:true,
   guessedOtherGoldExcluded:true,unverifiedSpecialCExcluded:true,
   activeUptimeVerified:false};
 const count=Number(multicast.modeledCharges);
 const A=Number(row["A"+n]);
 if(!Number.isSafeInteger(count)||count<1||count>6||
    !Number.isFinite(A)||A<1)
  throw new Error("Invalid native multicast stack data");
 const perCharge=Math.log10(A);
 const score=w*count*perCharge;
 if(!Number.isFinite(score))throw new Error("Nonfinite native multicast score");
 return {scoreLog10:score,charges:count,sourceLog10PerCharge:perCharge,
  sourceOnly:true,excludedInventedTenfoldPerCharge:true,
  guessedOtherGoldExcluded:true,unverifiedSpecialCExcluded:true,
  activeUptimeVerified:false};
}
