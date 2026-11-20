/**
 * TT2 8.4 source-only, deterministic, 1 Hz shared-mana contract scenario.
 *
 * Derived from the pinned SkillTreeInfo2.0 and the independently audited
 * native 1Hz contract tick recurrence (docs/IL2CPP_CONTRACT_TICKS.md).
 * No automatic estimation of free ticks, event rates, runtime BonusModel
 * modifiers, skill-dependent mana regeneration, or actual activation.
 * ALWAYS diagnostic; never feed this output into the additive SP objective.
 */
import {skillInfo} from "../vendor/skills.js?v=20261120-unified-graph-r2";

const IDS=Object.freeze(["ForbiddenContract","RoyalContract"]);
const NUM=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function logPositive(raw){
 if(typeof raw!=="string"&&typeof raw!=="number")return null;
 const str=String(raw).trim();
 if(!NUM.test(str))return null;
 const [mantissa,exponent="0"]=str.toLowerCase().split("e");
 const m=Number(mantissa),e=Number(exponent);
 if(!(m>0)||!Number.isFinite(m)||!Number.isSafeInteger(e))return null;
 const log=Math.log10(m)+e;
 return Number.isFinite(log)?log:null;
}
function nonnegative(value){
 if(value===null||value===undefined||value==="")return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=0?n:null;
}
const safeInt=(raw,max)=>Number.isSafeInteger(Number(raw))&&
 raw!==null&&raw!==undefined&&raw!==""&&Number(raw)>=0&&Number(raw)<=max;
function invalid(reasons){
 return {schema:"tt2-contract-shared-mana-what-if-v1",
  status:"missing-or-invalid-inputs",reasons,
  diagnosticOnly:true,addedToScore:false,actualUptimeVerified:false,
  predictsStageGain:false};
}
/**
 * Explicit deterministic hypothetical shared-pool scenario.
 * Inputs:
 * - startingMana, manaCapacity, passiveRegenPerSecond: caller-provided.
 * - freeTicks: caller-provided integer per enabled contract, INCLUDING zero.
 * - durationSeconds: finite simulation window, max 3600.
 * - manaEvents / spellCosts: optional known events at integer second offsets.
 * Omitted events mean no additional sources/spending *in this what-if only*.
 *
 * At t=0 the first native tick fires immediately. Between ticks, passive
 * regen is credited and capped to capacity; explicit events/costs are
 * resolved before the joint contract charge. If joint payment is impossible
 * the illustration stops WITHOUT claiming the native cancellation order.
 */
export function simulateContractTimeline(levels={},scenario=null){
 if(!scenario||scenario.enabled!==true)return {
  schema:"tt2-contract-shared-mana-what-if-v1",status:"not-requested",
  diagnosticOnly:true,addedToScore:false,actualUptimeVerified:false,
  predictsStageGain:false
 };
 const reasons=[];
 const active=IDS.filter(id=>{
  const n=Number(levels?.[id]??0);
  if(!safeInt(n,Number(skillInfo[id].MaxLevel)))
   reasons.push("invalid-level:"+id);
  return n>0;
 });
 const pactLevel=Number(levels?.TerrifyingPact??0);
 if(!safeInt(pactLevel,Number(skillInfo.TerrifyingPact.MaxLevel)))
  reasons.push("invalid-level:TerrifyingPact");
 const duration=scenario.durationSeconds;
 if(!safeInt(duration,3600)||Number(duration)<1)
  reasons.push("duration-must-be-integer-1-to-3600");
 const initial=nonnegative(scenario.startingMana);
 const capacity=nonnegative(scenario.manaCapacity);
 const regen=nonnegative(scenario.passiveRegenPerSecond);
 if(initial===null)reasons.push("starting-mana-required");
 if(capacity===null)reasons.push("mana-capacity-required");
 if(regen===null)reasons.push("passive-regen-required");
 if(initial!==null&&capacity!==null&&initial>capacity)
  reasons.push("starting-mana-exceeds-capacity");
 const free={},terms={};
 for(const id of active){
  const n=Number(levels[id]),f=scenario.freeTicks?.[id];
  if(!safeInt(f,3600))reasons.push("free-ticks-required:"+id);
  else free[id]=Number(f);
  const base=nonnegative(skillInfo[id]["B"+n]);
  const logMax=logPositive(skillInfo[id]["A"+n]);
  const until=nonnegative(skillInfo[id].BonusAmountD);
  if(base===null||logMax===null||!(until>0))
   reasons.push("invalid-source-terms:"+id);
  terms[id]={level:n,sourceBaseCost:base,sourceMaxLog10:logMax,
   sourceRampSeconds:until};
 }
 const events=[];
 for(const [kind,key] of [["mana","manaEvents"],["spell","spellCosts"]]){
  const list=scenario[key]??[];
  if(!Array.isArray(list)){reasons.push("invalid-events:"+key);continue;}
  for(const row of list){
   const second=row?.second,amount=nonnegative(row?.amount);
   if(!safeInt(second,3600)||Number(second)>=Number(duration)||amount===null){
    reasons.push("invalid-event:"+key);continue;
   }
   events.push({kind,second:Number(second),amount});
  }
 }
 if(reasons.length)return invalid(reasons);
 if(!active.length)return {schema:"tt2-contract-shared-mana-what-if-v1",
  status:"no-active-contract-talents",enabled:true,
  diagnosticOnly:true,addedToScore:false,actualUptimeVerified:false,
  predictsStageGain:false,activeContracts:[],samples:[]};
 const p=pactLevel>0?skillInfo.TerrifyingPact:null;
 const pactGold=p?logPositive(p["A"+pactLevel]):0;
 const pactDamage=p?logPositive(p["B"+pactLevel]):0;
 if(pactGold===null||pactDamage===null)return invalid(["pact-source-value-unrepresentable"]);
 const grouped=new Map();
 for(const e of events){
  if(!grouped.has(e.second))grouped.set(e.second,{mana:0,spell:0});
  const row=grouped.get(e.second);
  row[e.kind]+=e.amount;
  if(!Number.isFinite(row[e.kind]))return invalid(["event-total-overflows"]);
 }
 let mana=initial,spent=0,chargedTicks=Object.fromEntries(active.map(id=>[id,0]));
 let fundedTicks=0,firstUnfundedSecond=null,firstFailureReason=null,last=null;
 const samples=[],bySecond=new Set([0,1,2,5,10,15,30,60,120,300,600,1200,1800,3599,
  Number(duration)-1]);
 for(let second=0;second<Number(duration);second++){
  const event=grouped.get(second)??{mana:0,spell:0};
  // The first tick is immediate: no passive regeneration at second 0.
  if(second>0)mana=Math.min(capacity,mana+regen);
  mana=Math.min(capacity,mana+event.mana);
  if(!Number.isFinite(mana)){firstUnfundedSecond=second;
   firstFailureReason="mana-overflow";break;}
  if(mana+1e-9<event.spell){
   firstUnfundedSecond=second;firstFailureReason="known-spell-cost-not-affordable";break;
  }
  mana=Math.max(0,mana-event.spell);
  let required=0;
  const charge={},logs={};
  for(const id of active){
   const tick=second+1;
   const charged=Math.max(0,tick-free[id]);
   charge[id]=charged>0?charged*terms[id].sourceBaseCost:0;
   required+=charge[id];
   logs[id]=terms[id].sourceMaxLog10*
    Math.min(1,tick/terms[id].sourceRampSeconds);
  }
  if(!Number.isFinite(required)){firstUnfundedSecond=second;
   firstFailureReason="contract-cost-overflow";break;}
  if(mana+1e-9<required){
   firstUnfundedSecond=second;firstFailureReason="joint-contract-payment-not-affordable";break;
  }
  mana=Math.max(0,mana-required);spent+=required;
  for(const id of active)if(charge[id]>0)chargedTicks[id]++;
  const row={second,ticks:second+1,manaAfter:mana,manaCharged:required,
   cumulativeManaCharged:spent,
   sourceForbiddenDamageLog10:logs.ForbiddenContract??0,
   sourceRoyalGoldLog10:logs.RoyalContract??0,
   pactFullDamageLog10:active.includes("RoyalContract")?pactDamage:0,
   pactFullGoldLog10:active.includes("ForbiddenContract")?pactGold:0,
   pactInstantaneousApplicationUnverified:true};
  last=row;fundedTicks++;
  if(bySecond.has(second))samples.push(row);
 }
 return {schema:"tt2-contract-shared-mana-what-if-v1",
  status:"simulated",mode:"explicit-passive-regen-and-known-events-only",
  activeContracts:active,terms,
  assumptions:{
   initialMana:initial,manaCapacity:capacity,passiveRegenPerSecond:regen,
   freeTicks:free,
   otherManaSourcesAbsentExceptListedEvents:true,
   otherManaSpendsAbsentExceptListedSpells:true,
   contractTickOrdering:"joint-payment-test-at-1Hz",
   gameRuntimeMaximumsVerified:false,
   actualActivationTimingVerified:false,
   allRuntimeSetModifiersVerified:false
  },
  knownManaEventCount:events.filter(e=>e.kind==="mana").length,
  knownSpellCostCount:events.filter(e=>e.kind==="spell").length,
  horizonSeconds:Number(duration),fundedTicks,simulatedActiveSeconds:fundedTicks,
  reachesHorizon:fundedTicks===Number(duration),
  firstUnfundedSecond,firstFailureReason,
  totalContractManaCharged:spent,remainingMana:mana,
  reachedSourceRampMaximum:Object.fromEntries(active.map(id=>[
   id,fundedTicks>=terms[id].sourceRampSeconds
  ])),
  lastFundedTick:last,samples,
  conditionalPactFullEffectsNotRampedOrCredited:true,
  diagnosticOnly:true,addedToScore:false,actualUptimeVerified:false,
  predictsStageGain:false,
  note:"Hypothetical tick and mana budget, not observed game uptime or stage performance."
 };
}
