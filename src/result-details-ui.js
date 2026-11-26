/**
 * Presentation-only diagnostics for model score, attack sources and optional
 * internal comparison reports. All score/proc decisions are made in engine.
 * Invariant: dynamic HTML values must pass through the injected escape helper.
 */
export function createResultDetailRenderers({getById,doc,tr,safe,numberText,exportBuild}){
 const $=getById,document=doc;
/**
 * Same table-backed attack / skip diagnostics for ALL damage builds.
 * Deliberately do not sum source modifiers, skip counts or cooldowns
 * into total hit damage or the SP optimization score.
 */
function renderAttackChannelEvidence(result){
 let el=$("attack-channel-diagnostics");
 if(!el){
  el=document.createElement("details");
  el.id="attack-channel-diagnostics";el.className="result-detail";
  $("combat-assumptions-summary").insertAdjacentElement("afterend",el);
 }
 const report=result.attackChannels;
 if(!report){el.hidden=true;return;}
 el.hidden=false;
 const rows=report.channels.map(channel=>{
  const bonus=channel.sourceModifierLog10===null?"":(" · "+
   safe(tr("Source talent modifier: +{value} log10 (not total hit damage)",
    {value:channel.sourceModifierLog10.toFixed(3)})));
  const skip=channel.skip.filter(x=>x.value!==null&&x.level>0&&x.value>0)
   .map(x=>safe(x.skillName)+": "+
    safe(tr(x.kind==="stage"?"Stage Skip":"Titan Skip"))+" "+
    safe(numberText(x.value))).join(" · ");
  const note=channel.status==="unverified-spell-selection"?
   " · "+safe(tr("Spell loadout unknown")):
   channel.status==="spell-not-equipped"?
    " · "+safe(tr("Required spell not equipped")):"";
  return "<div class='tree-row'><span><strong>"+safe(channel.label)+
   "</strong> · "+safe(channel.skillId)+" "+
   safe(tr("level"))+" "+safe(numberText(channel.level))+
   bonus+note+(skip?" · "+skip:"")+"</span></div>";
 });
 el.innerHTML="<summary>"+safe(tr("Attack channels and stage skips"))+
  "</summary><p class='hint'>"+
  safe(tr("Source-table diagnostics for the selected damage build. Stage Skip, cooldowns, hit damage and uptime are separate mechanics. No stage gain or combat DPS is predicted, and the SP score is unchanged."))+
  "</p>"+rows.join("");
}
/** Skill-level proxy attribution is intentionally separate from real attack DPS. */
function renderModelAttribution(result){
 let el=$("model-score-attribution");
 if(!el){
  el=document.createElement("details");
  el.id="model-score-attribution";el.className="result-detail";
  $("attack-channel-diagnostics").insertAdjacentElement("afterend",el);
 }
 const audit=result.modelAttribution;
 if(!audit){el.hidden=true;return;}
 el.hidden=false;
 const branches=Object.entries(audit.byBranch).map(([name,value])=>
  "<div class='tree-row'><span>"+safe(tr(name))+
  "</span><strong>"+safe(value.toFixed(2))+" log10</strong></div>");
 const top=audit.top.map(x=>
  "<div class='tree-row'><span>"+safe(x.name)+
  " · "+safe(tr(x.branch))+" · "+safe(tr("level"))+" "+
  safe(numberText(x.level))+
  (x.conditionalSourceUnverified?" · "+safe(tr("Conditional or unverified model weight")):"")+
  "</span><strong>"+safe(x.scoreLog10.toFixed(2))+" log10</strong></div>");
 const ti=audit.tacticalInsightLocal;
 const experimental=ti?.enabled===true?
  "<p class='hint'>"+safe(tr(
   "Measured local Tactical Insight calibration: levels {low}–{high}, observed log10 damage gain {damage} and log10 gold gain {gold}. Native A is an interpolation coordinate only; no level outside this interval is eligible.",{
    low:numberText(ti.lowerLevel),high:numberText(ti.upperLevel),
    damage:ti.damageGainLog10.toFixed(3),gold:ti.goldGainLog10.toFixed(3)}))+"</p>":
  audit.tacticalInsightCommunityWeightExcluded===true?
  "<p class='hint'>"+safe(tr("Experimental: the unverified community Tactical Insight coefficient was excluded from this allocation. This is a sensitivity comparison, not evidence of zero in-game benefit or a proven stronger build."))+"</p>":"";
 const comparison=audit.tacticalInsightSensitivity;
 const sensitivity=comparison?.status==="compared-same-model-context"?
  "<p class='hint'>"+safe(tr(
   "Tactical Insight sensitivity: proposed minus current is {community} log10 with the community coefficient, versus {excluded} log10 without that coefficient.",{
    community:comparison.community.proposedMinusCurrentLog10.toFixed(3),
    excluded:comparison.heuristicExcluded.proposedMinusCurrentLog10.toFixed(3)
   }))+"</p>"+
  (comparison.proposedPositiveOnlyWithCommunityCoefficient?
   "<p class='hint'>"+safe(tr(
    "Warning: the proposed allocation only wins under the unverified Tactical Insight coefficient. Compare both trees in the game's Stats panel before applying it."))+"</p>":"")+
  "<p class='hint'>"+safe(tr(
   "This compares two existing trees only, without reoptimizing or predicting stages. Other uncertain skills remain unchanged."))+"</p>":"";
 const alt=result.tacticalInsightAlternative;
 const altView=alt?.status==="explored"?
  "<h4>"+safe(tr("Tactical Insight: alternative SP allocation"))+"</h4>"+
  "<p class='hint'>"+safe(tr(
   "The alternative is optimized with the unverified community Tactical Insight coefficient excluded. It keeps the same SP budget, pets, equipment and constraints; neither allocation is proven better in game."))+"</p>"+
  "<p>"+safe(tr(
   "Alternative minus main build: {excluded} log10 without the TI coefficient; {community} log10 with it. These are proxy-score differences, not stages.",{
    excluded:alt.excludedTI.alternativeMinusOriginalLog10.toFixed(3),
    community:alt.community.alternativeMinusOriginalLog10.toFixed(3)
   }))+"</p>"+
  "<label>"+safe(tr("Alternative build JSON (copy to compare in game)"))+
  "<textarea readonly rows='5' class='export-json' aria-label='Alternative TI build JSON'>"+
  safe(exportBuild(alt.levels))+"</textarea></label>":"";
 const critNotice=Number(result.criticalSourceOnly?.level??0)>0&&
  result.criticalSourceOnly.guaranteedByHeavenlyStrike!==true?
  "<p class='hint'>"+safe(tr("Cleaving Strike critical damage is chance-weighted for non-Heavenly Strike builds using its native talent chance, not guaranteed on every attack. This is a source-only estimate: the account's total critical chance and actual hit eligibility are unverified."))+"</p>":"";
 const ambushNotice=Number(result.ambushSourceOnly?.level??0)>0&&
  result.modelAttribution?.gold==="Chesterson"?
  "<p class='hint'>"+safe(tr("Ambush Multiple Titan Gold is conditional on encountering a multi-Titan group. The proxy uses only the documented 1% base group chance; your real chance, spawn distribution and other modifiers are not verified. Max Multiple Titan Count is not a probability."))+"</p>":"";
 const jackpotNotice=Number(result.jackpotSourceOnly?.level??0)>0?
  "<p class='hint'>"+safe(tr("Transmutation Jackpot Gold is scored as a source-only chance-weighted gold event, not permanent All Gold. Your account's actual Jackpot chance and event mix are not verified."))+"</p>":"";
 el.innerHTML="<summary>"+safe(tr("Why the proxy invests in these trees"))+
  "</summary><p class='hint'>"+
  safe(tr("Modeled skill contributions only; a high contribution is not proof of real combat power. The comparison does not alter the build."))+
  "</p>"+experimental+sensitivity+jackpotNotice+critNotice+ambushNotice+branches.join("")+
  "<h4>"+safe(tr("Largest modeled talent contributions"))+"</h4>"+top.join()+altView;
}
/** One observed hit from the CURRENT tree only; the recommendation is
 * deliberately shown as source evidence, not as a projected hit value.
 */
function renderBossPushEvidence(result){
 let el=$("boss-push-evidence");
 if(!el){
  el=document.createElement("details");
  el.id="boss-push-evidence";el.className="result-detail";
  $("model-score-attribution").insertAdjacentElement("afterend",el);
 }
 const current=result.bossPushCurrent,proposed=result.bossPushProposed;
 if(!current||!proposed){el.hidden=true;return;}
 el.hidden=false;
 const fmt=n=>Number(n).toFixed(2);
 const rows=current.channels.map(c=>{
  const suggested=proposed.channels.find(x=>x.id===c.id);
  const source=c.sourceStageSkip.map(x=>x.talent+" +"+x.additionalStageSkip).join(", ");
  const recommended=suggested?.sourceStageSkip.map(x=>x.talent+" +"+x.additionalStageSkip).join(", ")||"—";
  const title=safe(tr(c.label));
  const val=c.observed?.compared===true?
   " · "+safe(tr("Observed single-hit HP margin: {value} log10",{
    value:(c.observed.unmodifiedHpMarginLog10>=0?"+":"")+
     fmt(c.observed.unmodifiedHpMarginLog10)}))+
   " · "+safe(tr({
    "above-unmodified-upper-roll":"Hit exceeds the unmodified +30% HP roll",
    "depends-on-hp-roll":"Hit depends on the unmodified HP roll",
    "below-unmodified-lower-roll":"Hit is below the unmodified -30% HP roll"
   }[c.observed.status]??"Unverified observation")):
   c.observed?" · "+safe(tr("Observed attack cannot be verified for this tree")):"";
  return "<div class='tree-row'><span><strong>"+title+"</strong> · "+
   safe(tr("Current talent"))+" "+safe(numberText(c.sourceTalentLevel))+" · "+
   safe(tr("Proposed talent"))+" "+safe(numberText(suggested?.sourceTalentLevel??0))+
   (source?" · "+safe(tr("Current source Stage Skip"))+": "+safe(source):"")+
   (recommended?" · "+safe(tr("Proposed source Stage Skip"))+": "+safe(recommended):"")+
   val+"</span></div>";
 });
 el.innerHTML="<summary>"+safe(tr("Boss HP and attack channels"))+
 "</summary><p>"+safe(tr("Unmodified boss HP at stage {stage}: 10^{power}",{
  stage:numberText(current.stage),power:fmt(current.unmodifiedBossHpLog10)}))+
 "</p><p class='hint'>"+safe(tr(
 "This panel compares theoretical boss HP and attack-talent Stage Skip sources. It does not measure hit damage or predict stage gains."))+
 "</p>"+rows.join("");
}
 return {renderAttackChannelEvidence,renderModelAttribution,renderBossPushEvidence};
}
