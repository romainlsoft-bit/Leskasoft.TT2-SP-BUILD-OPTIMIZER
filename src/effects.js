/**
 * Numerically stable, audited log10 score model for TT2 build comparison.
 * This is a damage/gold proxy, not a model of real farming speed or all
 * conditional cross-skill interactions. See docs/MATH_AUDIT.md.
 */
import { skillInfo } from "../vendor/skills.js?v=20261122-ti-sensitivity-r1";
import { reductions } from "../vendor/reductions.js?v=20261122-ti-sensitivity-r1";
import { spellInfo, spell_reductions } from "../vendor/spells.js?v=20261122-ti-sensitivity-r1";
import {spellTableIndex} from "./spell-caps.js?v=20261122-ti-sensitivity-r1";
import {spellCapGainEligible,multicastSkillEvidence} from "./spell-scenarios.js?v=20261122-ti-sensitivity-r1";
import {lightningStrikeSkillScore} from "./lightning-strike-evidence.js?v=20261122-ti-sensitivity-r1";
import {petCombatTechniquesIncrement,petEquipmentCombatTechniquesIncrement} from "./pet-scenarios.js?v=20261122-ti-sensitivity-r1";
import {skillTreeSetScore} from "./skill-tree-set-effects.js?v=20261122-ti-sensitivity-r1";
import {contractSkillScore} from "./contract-scenarios.js?v=20261122-ti-sensitivity-r1";
import {cooldownFrequencyGainLog10} from "./flash-zip.js?v=20261122-ti-sensitivity-r1";

const num=(v,fallback=0)=>{ const x=Number(v); return Number.isFinite(x)?x:fallback; };
const lg=v=>Math.log10(num(v)>0?num(v):1);
const spellMap={TwilightBell:["BurstDamage","TwilightFairy"],SummonerAutoTap:["DualPet","TapBoost"],PhantomBlades:["CritBoost","StreamOfBlades"],AlchemistMastery:["HandOfMidas","GoldenMissile"]};
const mcA=[1,100,10000,1000000,100000000,1000000000];
const mcB=[1,10,100,1000,10000,50000];

function sourceSkillScoreAtLevel(id,level,settings){
  if(level===0)return 0;
  const info=skillInfo[id];
  if(!info||!Number.isInteger(level)||level<0||level>Number(info.MaxLevel))throw new Error("Invalid talent level: "+id);
  const A=n=>num(info["A"+n]), B=n=>num(info["B"+n]), C=n=>num(info["C"+n]);
  const r=num(reductions[id]?.[settings.damage])+num(reductions[id]?.[settings.gold])*num(settings.goldWeight);
  const goldWeight=num(settings.goldWeight);
  const lr=fn=>fn(level)-fn(0);
  const logA=n=>lg(A(n)),logB=n=>lg(B(n)),logC=n=>lg(C(n));
  const multicast=multicastSkillEvidence(id,level,settings);
  if(multicast){
    if(!multicast.modeled||multicast.modeledCharges===0)return 0;
    const count=multicast.modeledCharges;
    if(id==="TwilightGatheringMultiCastSkill")
      return r*(count*(1+logA(level))+logC(level));
    if(id==="HandOfMidasMultiCastSkillBoost"){
      const otherGold=settings.gold==="Chesterson"?0:1;
      const idx=Math.max(0,Math.min(5,count));
      return r*(lg(mcA[idx])+idx*logA(level))
        +otherGold*goldWeight*lg(mcB[idx]);
    }
    return r*count*(1+logA(level));
  }
  switch(id){
    case "PetBonusBoost":
      return r*lr(logA)+num(reductions.TapDmg?.[settings.damage])*lr(logB);
    case "BossDmgQTE": {
      // A is the QTE damage per activation. B < 1 is a shorter
      // cooldown, never a damage penalty.
      const cadence=cooldownFrequencyGainLog10(B(level),settings);
      const heartOfGold=settings.gold==="HoG"?
       goldWeight*cooldownFrequencyGainLog10(B(level),settings,"heartOfGold"):0;
      return r*logA(level)+r*cadence+heartOfGold;
    }
    case "HelperInspiredWeaken":
    case "ClanShipVoltage":
    case "CriticalHit":
      return r*lr(n=>logA(n)+logB(n));
    case "CombatTechniques":
      // Combat Techniques also raises active pet level; this conditional
      // benefit depends on which pet is used at boss / gold-collection time.
      return petEquipmentCombatTechniquesIncrement(settings,level)
       +petCombatTechniquesIncrement(settings,level);
    case "HelperBoost":
      // Sensitivity test: the community weight is not native-calibrated.
      // Excluding it does NOT imply Tactical Insight has zero real value.
      if(settings.excludeUnverifiedTacticalInsight===true)return 0;
      return r*lr(n=>Math.log10(1+A(n)));
    case "HelperDmgQTE": {
      // Astral Awakening damage is gained per tapped orb (up to five).
      // Previously the optimizer silently assumed all five were activated.
      const activations=Number(settings.astralActivations ?? 0);
      return activations*r*lr(logA);
    }
    case "PhilosophersFlux":
      // Skill A is BossDamageDuringSnap, C is non-boss TitanDamage.
      // Only the former matters for the limit-stage boss.
      return settings.assumeSnapActive===true ? r*lr(logA) : 0;
    case "QuickFortune":
      // Skill B is AllGoldDuringHayst. A is cloaking chance, not damage.
      return settings.assumeHaystActive===true ? goldWeight*lr(logB) : 0;
    case "LoadedDice":
      // Unlike Quick Fortune, B is unconditionally AllGold.
      return r*lr(logA)+goldWeight*lr(logB);
    // Native BonusInfo declares these as mana capacity / regeneration
    // resources, not direct damage or gold. Historical 0.05 reduction
    // factors were QoL proxies without a verified damage conversion.
    // Keep their skill-tree-set SP benefit (scoreAtLevel wrapper) and
    // any explicit QoL minimums, but never award fabricated damage.
    case "MPCapacityBoost":
    case "ManaStealSkillBoost":
      return 0;
    // The native TT2 BonusInfo catalog marks these effects as conditional
    // (stunned target, Shadow Clone active, applied dagger poison, Sprout
    // stacks). A community reduction is not proof of 100% availability.
    case "ClanShipStun":
      return settings.assumeBossStunned===true?r*lr(logA):0;
    case "BossTimer":
    case "PoisonedBlade":
    case "KratosSummon":
      // The active-uptime, stack, or additive-percentage conversion has not
      // been verified; never score a fabricated permanent multiplier.
      return 0;
    case "ForbiddenContract":
    case "RoyalContract":
      // Damage, gold and mana assumptions are source-specific. Never treat
      // maximum contract effects as passive, always-on multipliers.
      return contractSkillScore(id,level,settings);
    case "CloneDmg":
      return r*lr(n=>logA(n)+Math.log10((4+B(n))/4));
    case "CritSkillBoost":
      return r*lightningStrikeSkillScore(level,settings);
    case "TerrifyingPact":
      // A = gold under Forbidden, B = damage under Royal. The solver may
      // award only those pieces whose corresponding contract is guaranteed.
      return contractSkillScore(id,level,settings);
    default: {
      const spells=spellMap[id];
      if(!spells)return r*lr(logA);
      const additional=spells.reduce((sum,spellId)=>{
        // The cap only has a marginal spell benefit when this spell is
        // actually in the verified six-slot loadout and is active in the
        // hypothetical max-level scenario. A late tree unlock in another
        // branch must be guaranteed by minimums before awarding its gain.
        if(!spellCapGainEligible(id,spellId,settings))return sum;
        const spell=spellInfo[spellId];
        const weight=num(spell_reductions[spellId]?.[settings.damage])+num(spell_reductions[spellId]?.[settings.gold])*goldWeight;
        // A0 = spell level 1, A29 = level 30, A39 = level 40.
        // Never infer an extra A40 value from the source table.
        const base=(settings.sets?.tFA||
         settings.accountProfile?.ownedSetIds?.includes("DarkAngel"))?35:30;
        const max=Object.keys(spell).filter(k=>/^A\d+$/.test(k)).map(k=>num(k.slice(1))).reduce((a,b)=>Math.max(a,b),base);
        const get=n=>lg(spell["A"+Math.min(max,spellTableIndex(base+B(n)))]);
        return sum+weight*lr(get);
      },0);
      return r*lr(logA)+additional;
    }
  }
}
/**
 * SP-tree set bonuses are marginal benefits of investment in this exact
 * branch, and therefore must be added *inside* the DP scoreAtLevel table.
 * Never add them to the fixed account baseline (that would leave optimum
 * SP allocations unchanged and double count their final multiplier).
 */
export function scoreAtLevel(id,level,settings){
 const baseline=sourceSkillScoreAtLevel(id,level,settings);
 if(level===0)return baseline;
 return baseline+skillTreeSetScore(id,level,settings);
}
export function assertFiniteScores(ids,settings){
  const issues=[];
  for(const id of ids)for(let level=0;level<=skillInfo[id].MaxLevel;level++){
    try {if(!Number.isFinite(scoreAtLevel(id,level,settings)))issues.push(id+" level "+level+": non-finite");}
    catch(e){issues.push(id+" level "+level+": "+e.message);}
  }
  return issues;
}
