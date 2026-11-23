/**
 * Source-grounded *single-hit* boss comparison for every TT2 damage build.
 *
 * Titan/boss HP: E9 2026-11-21 (from game formula), see:
 * https://e9wiki.com/tt2/en/guides/titan-hp-and-damage
 * Source-dependent Stage Skip and Shadow Clone chance:
 * https://e9wiki.com/tt2/en/guides/stage-skip-and-titan-skip
 *
 * Critical limits: this evaluates one user-observed hit (NOT DPS, uptime,
 * repeated attacks, contract duration, true boss HP modifiers or stage gain).
 * A talent's source modifier is NOT an absolute hit damage.
 */
import {attackChannelEvidence} from "./attack-channels.js?v=20261123-boss-specials-r1";

const LOG10_12=Math.log10(1.2);
const LOG10_138=Math.log10(1.38);
const LOG10_113=Math.log10(1.13);
const BOSS_BLOCK=Object.freeze([8,2,3,4,5]);
const SKIP_SPECIAL=Object.freeze(new Set([
 "lightning-burst","clan-ship-shot","heavenly-strike",
 "thunder-volley","golden-missile-skip"
]));

function stageNumber(value){
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<1||n>10_000_000)
  throw new RangeError("Boss stage must be an integer between 1 and 10,000,000");
 return n;
}
/** Exponent-safe source normal Titan HP (log10, not a JS BigNumber). */
export function normalTitanHpLog10(stage){
 const s=stageNumber(stage);
 const beyond100=Math.max(0,s-100),beyond180k=Math.max(0,s-180000);
 return Math.log10(17.5)+Math.min(100,s)*LOG10_138+
  0.03*beyond100**1.098-0.03*beyond180k**1.0002*LOG10_12;
}
/** Unmodified baseline boss HP before titan HP reductions and ±30% roll. */
export function unmodifiedBossHpLog10(stage){
 const s=stageNumber(stage);
 const bossModifier=Math.min(Math.log10(500),0.005*s*LOG10_113);
 const blockModifier=Math.log10(BOSS_BLOCK[s%5]);
 return normalTitanHpLog10(s)+bossModifier+blockModifier;
}
/** Accept scientific TT2 hit notation WITHOUT ever computing 10^exponent.
 * A plain decimal such as 1234.5 is also allowed; the browser must not
 * coerce e40000 to Number first.
 */
export function parseObservedHitLog10(value){
 if(value===undefined||value===null||String(value).trim()==="")
  return null;
 const raw=String(value).trim();
 if(raw.length>90)throw new RangeError("Invalid observed hit notation");
 const match=/^(\+?(?:\d+(?:\.\d*)?|\.\d+))(?:[eE]([+-]?\d{1,8}))?$/.exec(raw);
 if(!match)throw new RangeError("Observed hit must use decimal or scientific notation");
 const mantissa=Number(match[1]),exponent=Number(match[2]??0);
 if(!Number.isFinite(mantissa)||mantissa<=0||!Number.isSafeInteger(exponent)||
    Math.abs(exponent)>10_000_000)
  throw new RangeError("Observed hit must be positive and finite");
 const log=Math.log10(mantissa)+exponent;
 if(!Number.isFinite(log))throw new RangeError("Observed hit exponent overflow");
 return log;
}
const statusForBoss=(hitLog,hpLog)=>{
 // Random titan HP can vary by ±30%. These are UNMODIFIED HP bounds:
 // artifact/skills that lower boss HP are unknown here.
 const low=hpLog+Math.log10(.7),high=hpLog+Math.log10(1.3);
 if(hitLog>=high)return "above-unmodified-upper-roll";
 if(hitLog>=low)return "depends-on-hp-roll";
 return "below-unmodified-lower-roll";
};
function sourceSkipFor(channel){
 const fields=channel.skip.filter(x=>x.kind==="stage"&&x.level>0&&
  x.status==="source-tabulated"&&Number.isFinite(x.value));
 // The selected channel may list more than one *alternative* path or
 // inherited field; add no shared Stage Skip and never double count.
 return fields.map(x=>({
  talent:x.skillId,bonusType:x.sourceBonusType,
  additionalStageSkip:x.value,
  status:"source-talent-only"
 }));
}
function shadowCloneRoll(channel){
 if(channel.id==="nightmare-puppeteer")return {
  chanceIfBossKilled:1,source:"special-clone-hit",verifiedUptime:false};
 if(channel.id!=="shadow-clone")return null;
 const row=channel.mechanics.find(x=>x.kind==="boss-skip-chance-source");
 if(row?.value==null||row.level===0)return {chanceIfBossKilled:null,
  source:"missing-shadow-boss-splash-source",verifiedUptime:false};
 return {chanceIfBossKilled:Math.min(1,Math.max(0,(row.value-.01)/.99)),
  source:"shadow-clone-boss-splash",verifiedUptime:false};
}
/** Show the boss requirements and relative observed single hit for all
 * six damage builds, independently from the SP score. Observations are
 * only valid for the exact attack channel and active buffs that produced
 * them. No hidden assumption that a QTE hit happens every boss attempt.
 */
export function bossPushEvidence(settings={},levels={}){
 const stage=stageNumber(settings.pushBossStage??settings.maxStage);
 const report=attackChannelEvidence(settings,levels);
 const hp=unmodifiedBossHpLog10(stage);
 const selected=settings.pushObservedAttackChannelId??null;
 const observation=selected?
  parseObservedHitLog10(settings.pushObservedHitDamage):null;
 if(selected&&!report.channels.some(channel=>channel.id===selected))
  throw new RangeError("Observed hit attack does not belong to the selected build");
 const channels=report.channels.map(channel=>{
  const isState=channel.role==="charged";
  const observed=channel.id===selected?observation:null;
  const knownSpell=channel.spellStatus==="equipped"||
   channel.spellStatus==="not-required";
  const eligible=channel.status==="source-eligible"&&!isState;
  const compare=observed===null?null:
   !eligible?{status:channel.status==="spell-not-equipped"?
    "spell-not-equipped":isState?"not-an-attack":
     "attack-activation-unverified",compared:false}:
   {status:statusForBoss(observed,hp),compared:true,
    observedHitLog10:observed,unmodifiedBossHpLog10:hp,
    unmodifiedHpMarginLog10:observed-hp,
    upperRandomHpMarginLog10:observed-hp-Math.log10(1.3),
    lowerRandomHpMarginLog10:observed-hp-Math.log10(.7),
    perHitOnly:true,fullCombatWindowModeled:false};
  return {id:channel.id,label:channel.label,role:channel.role,
   sourceTalent:channel.skillId,sourceTalentLevel:channel.level,
   spellStatus:channel.spellStatus,eligibleForObservedHit:eligible,
   sourceDamageModifierLog10:channel.sourceModifierLog10,
   sourceStageSkip:sourceSkipFor(channel),
   fullSkipSource:SKIP_SPECIAL.has(channel.id),
   shadowCloneSplash:shadowCloneRoll(channel),
   observed:compare,
   activeAtBossVerified:false,sourceCooldownApplied:false,
   observedHitIsNotDerivedFromTalentMultiplier:true};
 });
 return {schema:"tt2-boss-push-evidence-v1",damage:report.damage,
  gold:report.gold,stage,
  unmodifiedBossHpLog10:hp,
  minHpRollLog10:hp+Math.log10(.7),
  maxHpRollLog10:hp+Math.log10(1.3),
  selectedAttack: selected,
  observedHitSupplied:observation!==null,
  channels,
  source:"e9-tt2-2026-11-22-game-formula",
  sourceDataVersion:report.sourceDataVersion,
  includesUnknownHpReductions:false,includesSharedStageSkip:false,
  predictsRealMaxStage:false,calculatesAttackDps:false,
  comparesOneObservedHitOnly:true,
  modifiesSkillPointAllocation:false};
}
