/**
 * Conditional contracts and Terrifying Pact.
 *
 * Source: TT2 8.4 SkillTreeInfo2.0.csv, source bonus columns:
 * - Forbidden Contract A: MAX damage; B: initial mana drain.
 * - Royal Contract A: MAX gold; B: initial mana drain.
 * - Terrifying Pact A: gold while Forbidden is active.
 * - Terrifying Pact B: damage while Royal is active.
 * - Terrifying Pact C: fewer titans per stage with either contract.
 *
 * These are conditional maximum bonuses, not passive stats or a guarantee
 * that a user's mana can sustain the effect. The game drain rises over time.
 * No invented mana regen, proc rate, uptime or ramp duration.
 */
import {skillInfo} from "../vendor/skills.js?v=20261122-push-target-r2";
import {contractNativeTickSchedule} from "./contract-native-ticks.js?v=20261122-push-target-r2";

const CONTRACTS=Object.freeze(["ForbiddenContract","RoyalContract"]);
const CONTRACT_SKILLS=Object.freeze([...CONTRACTS,"TerrifyingPact"]);
const validLevel=(id,level)=>{
 const max=Number(skillInfo[id]?.MaxLevel);
 const value=Number(level??0);
 if(!Number.isSafeInteger(value)||value<0||value>max)
  throw new RangeError("Invalid contract skill level for "+id);
 return value;
};
const numberAt=(id,code,level)=>{
 const n=Number(skillInfo[id]?.[code+level]);
 return Number.isFinite(n)&&n>=0?n:null;
};
const scoreLog=value=>value!==null&&value>1?Math.log10(value):0;
const weight=settings=>{
 const n=Number(settings?.goldWeight);
 if(!Number.isFinite(n)||n<0||n>2)
  throw new RangeError("Contract gold weight must be between 0 and 2");
 return n;
};
function guaranteedFromContext(settings,id){
 if(settings?.assumeContractsAtMax!==true)return false;
 const guaranteed=Number(settings?.minimums?.[id]??0);
 const retained=settings?.preserveCurrent===true?
  Number(settings?.currentLevels?.[id]??0):0;
 return (Number.isFinite(guaranteed)&&guaranteed>0)||
  (Number.isFinite(retained)&&retained>0);
}
/**
 * Modeled conditional maximum gain from a single skill at level L.
 * Use in the *additive* solver only after FC/RC minima are proven.
 */
export function contractSkillScore(id,level,settings={}){
 if(!CONTRACT_SKILLS.includes(id))throw new RangeError("Unknown contract skill "+id);
 const n=validLevel(id,level);
 if(n===0||settings.assumeContractsAtMax!==true)return 0;
 const goldWeight=weight(settings);
 if(id==="ForbiddenContract")return scoreLog(numberAt(id,"A",n));
 if(id==="RoyalContract")return goldWeight*scoreLog(numberAt(id,"A",n));
 // The gold boost requires Forbidden Contract; the damage boost Royal.
 const withForbidden=guaranteedFromContext(settings,"ForbiddenContract");
 const withRoyal=guaranteedFromContext(settings,"RoyalContract");
 return (withForbidden?goldWeight*scoreLog(numberAt(id,"A",n)):0)+
  (withRoyal?scoreLog(numberAt(id,"B",n)):0);
}

/**
 * Compare two Terrifying Pact levels using source values only.
 *
 * Pact A requires active Forbidden Contract; Pact B requires active
 * Royal Contract. This is NOT a forecast of the game Stats panel.
 * Co0 is the cost of the first skill level (not Co1).
 */
export function compareTerrifyingPactLevels(fromLevel,toLevel){
 const id="TerrifyingPact";
 const from=validLevel(id,fromLevel),to=validLevel(id,toLevel);
 const cumulativeSP=level=>{
  let spent=0;
  for(let i=0;i<level;i++){
   const cost=Number(skillInfo[id]["Co"+i]);
   if(!Number.isSafeInteger(cost)||cost<0)
    throw new RangeError("Invalid source Pact SP cost at "+i);
   spent+=cost;
  }
  return spent;
 };
 const delta=code=>scoreLog(numberAt(id,code,to))-scoreLog(numberAt(id,code,from));
 const beforeTitan=numberAt(id,"C",from),afterTitan=numberAt(id,"C",to);
 if(beforeTitan===null||afterTitan===null)
  throw new RangeError("Missing source Pact titan reduction");
 return {
  schema:"tt2-pact-source-level-comparison-v1",
  fromLevel:from,toLevel:to,skillPointDelta:cumulativeSP(to)-cumulativeSP(from),
  maxConditionalGoldLog10Delta:delta("A"),
  maxConditionalDamageLog10Delta:delta("B"),
  titansPerStageReductionDelta:afterTitan-beforeTitan,
  conditions:{gold:"ForbiddenContract-active",
   damage:"RoyalContract-active",titanReduction:"either-contract-active"},
  actualContractUptimeVerified:false,shownInGameStatsVerified:false,
  appliedToOptimizationScore:false,predictsStageGain:false
 };
}

/**
 * Diagnostic snapshot AFTER optimization: only the selected final skill
 * levels may be used to report the maximum conditional effect.
 */
export function resolveContractScenario(levels={},settings={}){
 const level=Object.fromEntries(CONTRACT_SKILLS.map(id=>[
  id,validLevel(id,levels[id]??0)
 ]));
 const eligible=settings.assumeContractsAtMax===true;
 const f=eligible&&level.ForbiddenContract>0;
 const r=eligible&&level.RoyalContract>0;
 const pact=eligible&&level.TerrifyingPact>0;
 const goldWeight=weight(settings);
 const damageLog10=(f?scoreLog(numberAt("ForbiddenContract","A",level.ForbiddenContract)):0)
  +(r&&pact?scoreLog(numberAt("TerrifyingPact","B",level.TerrifyingPact)):0);
 const goldLog10=(r?scoreLog(numberAt("RoyalContract","A",level.RoyalContract)):0)
  +(f&&pact?scoreLog(numberAt("TerrifyingPact","A",level.TerrifyingPact)):0);
 const baseForbiddenDrain=f?numberAt("ForbiddenContract","B",level.ForbiddenContract):0;
 const baseRoyalDrain=r?numberAt("RoyalContract","B",level.RoyalContract):0;
 const baseDrain=baseForbiddenDrain===null||baseRoyalDrain===null?
  null:baseForbiddenDrain+baseRoyalDrain;
 // Native tick arithmetic is independent of whether the hypothetical
 // maximum-contract scoring option is enabled. No guessed free activation.
 const nativeTickEvidence=Object.fromEntries(CONTRACTS.map(id=>[
  id,level[id]===0?null:contractNativeTickSchedule({
   maximum:skillInfo[id]["A"+level[id]],
   baseManaCost:skillInfo[id]["B"+level[id]],
   timeUntilMax:skillInfo[id].BonusAmountD
  })
 ]));
 const titanReduction=(f||r)&&pact?
  numberAt("TerrifyingPact","C",level.TerrifyingPact):0;
 return {
  schema:"tt2-contract-conditional-v1",levels:level,
  assumptions:{maximumRampReached:eligible,manaSustainable:false,
   uptimeVerified:false,drainGrowthOverTimeModeled:false},
  activeIfAssumptionsHold:{forbidden:f,royal:r,pact,
   pactGold:f&&pact,pactDamage:r&&pact},
  damageLog10,goldLog10,weightedLog10:damageLog10+goldWeight*goldLog10,
  nativeTickEvidence,
  baseDrain:{forbidden:baseForbiddenDrain,royal:baseRoyalDrain,
   combined:baseDrain,unit:"exported-base-mana-cost-per-second"},
  pactSourceLevelComparison:settings?.currentLevels &&
   Object.hasOwn(settings.currentLevels,"TerrifyingPact")?
    compareTerrifyingPactLevels(settings.currentLevels.TerrifyingPact,
     level.TerrifyingPact):null,
  titanReduction: {duringContracts:titanReduction,addedToDamageScore:false},
  // The numerical contribution has already been included in scoreAtLevel.
  appliedInsideSkills:eligible,addToAccountBaseline:false,
  predictsStageGain:false,validatedFullManaUptime:false,
  note:"Maximum conditional bonuses only; mana sustainability is unverified."
 };
}
