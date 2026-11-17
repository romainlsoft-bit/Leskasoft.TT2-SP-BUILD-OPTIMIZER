/**
 * Numerically stable, audited log10 score model for TT2 build comparison.
 * This is a damage/gold proxy, not a model of real farming speed or all
 * conditional cross-skill interactions. See docs/MATH_AUDIT.md.
 */
import { skillInfo } from "../vendor/skills.js";
import { reductions } from "../vendor/reductions.js";
import { spellInfo, spell_reductions } from "../vendor/spells.js";
import {spellTableIndex} from "./spell-caps.js";
import { clone } from "../vendor/clone.js";
import {petCombatTechniquesIncrement,petEquipmentCombatTechniquesIncrement} from "./pet-scenarios.js?v=20261117-skill-sp-sets";
import {skillTreeSetScore} from "./skill-tree-set-effects.js";

const num=(v,fallback=0)=>{ const x=Number(v); return Number.isFinite(x)?x:fallback; };
const lg=v=>Math.log10(num(v)>0?num(v):1);
const multicastIds=new Set(["BurstDamageMultiCastSkill","TapBoostMultiCastSkill","DualPetMultiCast","HelperBoostMultiCastSkill","ClanShipVoltageMultiCastSkill","ShadowCloneMultiCastSkill","GuidedBlade","StreamOfBladesMultiCastSkill"]);
const spellMap={TwilightBell:["BurstDamage","TwilightFairy"],SummonerAutoTap:["DualPet","TapBoost"],PhantomBlades:["CritBoost","StreamOfBlades"],AlchemistMastery:["HandOfMidas","GoldenMissile"]};
const mcA=[1,100,10000,1000000,100000000,1000000000];
const mcB=[1,10,100,1000,10000,50000];

function lightningStrike(info,level,settings) {
  const CC=Boolean(settings.CC);
  const CP=Math.max(1,num(settings.craftingPower,1));
  const SC=String(settings.sClone||(settings.sets?.tFA?35:30));
  const attempts=Math.min(2000,Math.max(0,Math.floor(0.022*num(clone[SC],100)*(CC?1.5*Math.pow(1.005,Math.pow(CP-1,0.8)):1)*num(settings.timeToKill,8))));
  const one=n=>{
    let power=1,score=0;
    const a=num(info["A"+n]),b=num(info["B"+n]);
    for(let i=0;i<attempts;i++){
      const p=a*power;
      if(p>=1)return 300; // probability limit requires separate real-game verification
      if(p>0)score-=Math.log10(1-p);
      power*=b;
    }
    return score;
  };
  return one(level)-one(0);
}
function sourceSkillScoreAtLevel(id,level,settings){
  if(level===0)return 0;
  const info=skillInfo[id];
  if(!info||!Number.isInteger(level)||level<0||level>Number(info.MaxLevel))throw new Error("Invalid talent level: "+id);
  const A=n=>num(info["A"+n]), B=n=>num(info["B"+n]), C=n=>num(info["C"+n]);
  const r=num(reductions[id]?.[settings.damage])+num(reductions[id]?.[settings.gold])*num(settings.goldWeight);
  const goldWeight=num(settings.goldWeight);
  const mc=Number(Boolean(settings.sets?.FB))+Number(Boolean(settings.sets?.FF));
  const lr=fn=>fn(level)-fn(0);
  const logA=n=>lg(A(n)),logB=n=>lg(B(n)),logC=n=>lg(C(n));
  if(multicastIds.has(id))return r*lr(n=>(B(n)?B(n)+mc:0)*(1+logA(n)));
  switch(id){
    case "TwilightGatheringMultiCastSkill":
      return r*lr(n=>(B(n)?B(n)+mc:0)*(1+logA(n))+logC(n));
    case "PetBonusBoost":
      return r*lr(logA)+num(reductions.TapDmg?.[settings.damage])*lr(logB);
    case "BossDmgQTE":
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
    case "ForbiddenContract":
    case "RoyalContract":
      // The table gives MAXIMUM ramped bonuses, not always-on effects.
      // These require sustained mana and time at the push-limit boss.
      return settings.assumeContractsAtMax===true ? r*lr(logA) : 0;
    case "CloneDmg":
      return r*lr(n=>logA(n)+Math.log10((4+B(n))/4));
    case "CritSkillBoost":
      return r*lightningStrike(info,level,settings);
    case "TerrifyingPact": {
      // Pact applies only while the corresponding contract is active.
      // Never score its max gold/damage buffs as unconditional bonuses.
      if(settings.assumeContractsAtMax!==true)return 0;
      // Do not assume contracts are enabled merely because they are selectable.
      // Include synergy only when minimum/preserved levels guarantee activation.
      const force=id=>num(settings.minimums?.[id]||(settings.preserveCurrent?settings.currentLevels?.[id]:0))>0;
      return (force("ForbiddenContract")?r*lr(logA):0)+(force("RoyalContract")?lr(logB):0);
    }
    case "PoisonedBlade":
      return r*lr(n=>Math.log10(1+10*A(n)));
    case "HandOfMidasMultiCastSkillBoost": {
      const otherGold=settings.gold==="Chesterson"?0:1;
      const idx=n=>Math.max(0,Math.min(5,B(n)?B(n)+mc:0));
      return r*lr(n=>lg(mcA[idx(n)])+idx(n)*logA(n))
        +otherGold*goldWeight*lr(n=>lg(mcB[idx(n)]));
    }
    case "KratosSummon":
      return r*lr(n=>B(n)*logA(n));
    default: {
      const spells=spellMap[id];
      if(!spells)return r*lr(logA);
      const additional=spells.reduce((sum,spellId)=>{
        const spell=spellInfo[spellId];
        const weight=num(spell_reductions[spellId]?.[settings.damage])+num(spell_reductions[spellId]?.[settings.gold])*goldWeight;
        // A0 = spell level 1, A29 = level 30, A39 = level 40.
        // Never infer an extra A40 value from the source table.
        const base=settings.sets?.tFA?35:30;
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
