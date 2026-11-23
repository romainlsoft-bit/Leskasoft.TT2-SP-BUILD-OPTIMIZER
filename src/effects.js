/**
 * Numerically stable, audited log10 score model for TT2 build comparison.
 * This is a damage/gold proxy, not a model of real farming speed or all
 * conditional cross-skill interactions. See docs/MATH_AUDIT.md.
 */
import { skillInfo } from "../vendor/skills.js?v=20261123-boss-specials-r1";
import { reductions } from "../vendor/reductions.js?v=20261123-boss-specials-r1";
import { spellInfo, spell_reductions } from "../vendor/spells.js?v=20261123-boss-specials-r1";
import {spellTableIndex} from "./spell-caps.js?v=20261123-boss-specials-r1";
import {spellCapGainEligible,multicastSkillEvidence,spellEffectScorable,ACTIVE_SOURCE_SKILL_SPELLS} from "./spell-scenarios.js?v=20261123-boss-specials-r1";
import {lightningStrikeSkillScore} from "./lightning-strike-evidence.js?v=20261123-boss-specials-r1";
import {petCombatTechniquesIncrement,petEquipmentCombatTechniquesIncrement} from "./pet-scenarios.js?v=20261123-boss-specials-r1";
import {skillTreeSetScore} from "./skill-tree-set-effects.js?v=20261123-boss-specials-r1";
import {contractSkillScore} from "./contract-scenarios.js?v=20261123-boss-specials-r1";
import {tacticalInsightLocalScore} from "./tactical-insight-local.js?v=20261123-boss-specials-r1";
import {transmutationSourceEventEvidence} from "./transmutation-native.js?v=20261123-boss-specials-r1&jackpot=20261123-native-jackpot-expectation-r1";
import {nativeMulticastSkillScore} from "./multicast-native-score.js?v=20261123-boss-specials-r1&mc=20261123-multicast-no-guessed-x10-r1";

const num=(v,fallback=0)=>{ const x=Number(v); return Number.isFinite(x)?x:fallback; };
const lg=v=>Math.log10(num(v)>0?num(v):1);
const spellMap={TwilightBell:["BurstDamage","TwilightFairy"],SummonerAutoTap:["DualPet","TapBoost"],PhantomBlades:["CritBoost","StreamOfBlades"],AlchemistMastery:["HandOfMidas","GoldenMissile"]};

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
    // Only source A (per-cast stack multiplier) and the verified
    // available stack count can enter this conditional score. The old
    // arbitrary +1 log10 per charge, guessed Hand of Midas gold tables
    // and unverified Twilight Gloom C were NOT sourced multipliers.
    return nativeMulticastSkillScore(id,level,multicast,r).scoreLog10;
  }
  switch(id){
    case "PetBonusBoost":
      // Source A = permanent PetDamage. Source B = TapBoostSkillAmount:
      // Fire Sword damage, not unconditional pet damage. Only credit B
      // when the real six-slot loadout verifies Fire Sword in the
      // current maximum-spell scenario. Never infer passive uptime.
      return r*lr(logA)+(spellEffectScorable("TapBoost",settings)?
       num(reductions.TapDmg?.[settings.damage])*lr(logB):0);
    case "BossDmgQTE": {
      // Flash Zip A applies only to the charged pet boss QTE, not to
      // an ordinary Pet attack or Lightning Burst. An assumed boss
      // burst has to be explicitly selected, not inferred from ownership.
      if(settings.assumeFlashZipAtBoss!==true)return 0;
      // A is per-activation burst damage. B is cooldown, not a damage
      // multiplier. Even with a known time window and base cooldown, an
      // extra *opportunity* does not prove another hit or gold collection.
      // Report rate separately; never convert it into damage/gold proxy.
      return r*logA(level);
    }
    case "HelperInspiredWeaken":
      // A = damage for *inspired* helpers; B = helper COUNT, not a
      // second unconditional damage multiplier. Without confirmed inspired
      // activation, do not award damage for an invisible effect.
      return settings.assumeInspiredHelpersActive===true?r*lr(logA):0;
    case "ClanShipVoltage":
      // A belongs to Thunder Volley, not an ordinary Clan Ship shot.
      // B is explicitly SPECIAL-attack damage: never count its maximum
      // on every shot. The special hit needs separate explicit evidence.
      if(!spellEffectScorable("ThunderVolley",settings))return 0;
      return r*lr(logA)+
       (settings.assumeThunderVolleySpecialHit===true?r*lr(logB):0);
    case "CriticalHit":
      // A = Stream of Blades spell amount; B = target-marked Dagger
      // damage. Neither is an always-on normal dagger multiplier.
      return (spellEffectScorable("StreamOfBlades",settings)?
        r*lr(logA):0)+
       (settings.assumeDaggerTargetMarked===true?r*lr(logB):0);
    case "CombatTechniques":
      // Combat Techniques also raises active pet level; this conditional
      // benefit depends on which pet is used at boss / gold-collection time.
      return petEquipmentCombatTechniquesIncrement(settings,level)
       +petCombatTechniquesIncrement(settings,level);
    case "HelperBoost": {
      const measured=tacticalInsightLocalScore(level,settings);
      if(measured!==null)return measured;
      // Sensitivity test: the community weight is not native-calibrated.
      // Excluding it does NOT imply Tactical Insight has zero real value.
      if(settings.excludeUnverifiedTacticalInsight===true)return 0;
      return r*lr(n=>Math.log10(1+A(n)));
    }
    case "ClanQTE":
      // Coordinated Offensive boosts heroes only while the summoned
      // clanmate is active at the boss. Never assume permanent uptime.
      return settings.assumeCoordinatedOffensiveActive===true?r*lr(logA):0;
    case "HelperDmgSkillBoost":
      // Heroic Might is a War Cry/HelperBoost *spell* boost. It was
      // previously credited even when the spell was not equipped.
      return spellEffectScorable("HelperBoost",settings)?r*lr(logA):0;
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
    case "Transmutation":
      // A = JackpotGold, B = JackpotGoldChance. This is a conditional
      // eligible-event reward, NOT unconditional All Gold. With no
      // verified account-level chance distribution for a proposed tree,
      // score the source-only (B) expected-event scenario, not log10(A).
      // Its report explicitly disclaims a verified in-game expectation.
      return goldWeight*num(reductions.Transmutation?.[settings.gold])*
       transmutationSourceEventEvidence(level).sourceOnlyExpectedGoldLog10;
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
    case "PuppetMaster":
      // A = Shadow Clone Nightmare Damage on a special attempt.
      // B is special-attempt RATE, not an unconditional hit multiplier.
      // Never credit Nightmare Damage on ordinary Shadow Clone hits.
      return settings.assumeNightmareAtBoss===true?r*lr(logA):0;
    case "MagnumOpus":
      // A is damage only while Magnum Opus is charged and activated.
      // Gold Gun's ordinary shots do not inherit this amount at boss.
      return settings.assumeMagnumOpusAtBoss===true?r*lr(logA):0;
    case "CloneDmg":
      // A is native Shadow Clone damage. B is attack RATE, not a
      // damage multiplier. The old (4+B)/4 assumed an undocumented
      // four-attacks/second baseline and silently guessed attack uptime.
      return r*lr(logA);
    case "CritSkillBoost":
      return r*lightningStrikeSkillScore(level,settings);
    case "TerrifyingPact":
      // A = gold under Forbidden, B = damage under Royal. The solver may
      // award only those pieces whose corresponding contract is guaranteed.
      return contractSkillScore(id,level,settings);
    default: {
      const nativeSpell=ACTIVE_SOURCE_SKILL_SPELLS[id];
      const nativeScore=!nativeSpell||spellEffectScorable(nativeSpell,settings)?
        r*lr(logA):0;
      const spells=spellMap[id];
      if(!spells)return nativeScore;
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
      return nativeScore+additional;
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
