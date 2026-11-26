/** Post-solve account baseline and dependency coverage. The SP objective is unchanged. */
import {extractFixedAccountPower,fixedAccountScore} from "./account-power.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {accountDependencyGraph} from "./account-dependencies.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {extractTimedSetPower} from "./account-set-bonuses.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {resolvePermanentSetPower} from "./account-permanent-sets.js?v=20261123-boss-specials-r1";
import {skillTreeSetAllocationEvidence} from "./skill-tree-set-effects.js?v=20261123-boss-specials-r1";

export function buildAccountBaseline(settings,levels){
  const power=extractFixedAccountPower(settings.accountProfile);
  const fixedRaw=fixedAccountScore(power,settings);
  // Recompute date-dependent bonuses on every optimization, never memoize
  // them by profile identity across days.
  const timed=extractTimedSetPower(settings.accountProfile);
  const timedScore=fixedAccountScore({available:timed.applied>0,byType:timed.byType},settings);
  // Completed sets (even sold) and observed Unique items are immutable
  // account bonuses. CP affects their numerical values, never their ownership.
  // CP-dependent multiplier formulas are evaluated once outside the SP DP.
  const permanentSetPower=resolvePermanentSetPower(settings.accountProfile,settings);
  const permanentScore=fixedAccountScore({
   available:permanentSetPower.appliedDirect>0,byType:permanentSetPower.byType
  },settings);
  const fixedAccount={...fixedRaw,
    damageLog10:fixedRaw.damageLog10+timedScore.damageLog10+permanentScore.damageLog10,
    goldLog10:fixedRaw.goldLog10+timedScore.goldLog10+permanentScore.goldLog10,
    weightedLog10:fixedRaw.weightedLog10+timedScore.weightedLog10+permanentScore.weightedLog10};
  const dependencyReport=accountDependencyGraph(settings.accountProfile);
  // The catalog DAG still counts every static set row as unknown. Discount
  // only the owned set effects for which the CP formula was actually
  // resolved; CP=1 lower bounds remain unresolved for full-power claims.
  const skillTreeSetPower=skillTreeSetAllocationEvidence(settings.accountProfile,levels);
  const newlyResolvedSetEffects=permanentSetPower.entries.filter(e=>
   (e.appliedToAccount||e.appliedToEquipment)&&!e.conservative).length+
   skillTreeSetPower.applied;
  const remainingUnmodeledEffects=Math.max(0,
   dependencyReport.unmodeledEffects-newlyResolvedSetEffects);
  return {power,timed,permanentSetPower,fixedAccount,dependencyReport,skillTreeSetPower,newlyResolvedSetEffects,remainingUnmodeledEffects};
}
