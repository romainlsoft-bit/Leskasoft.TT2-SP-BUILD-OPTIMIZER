/**
 * Tell an optimizer user which Skill Points were NOT free to reallocate.
 * This is a provenance/uncertainty diagnostic, never an alternative score.
 * Exact SP costs are from the independent TT2 8.4 Unity SkillTreeInfo2.0.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {reductions} from "../vendor/reductions.js?v=20261123-boss-specials-r1";
import {ACTIVE_SOURCE_SKILL_SPELLS,spellEffectScorable} from "./spell-scenarios.js?v=20261123-boss-specials-r1";

export function sourceSpent(id,level,catalog=skillInfo){
 const row=catalog[id];
 if(!row)throw new RangeError("Unknown skill "+id);
 const max=Number(row.MaxLevel),n=Number(level);
 if(!Number.isSafeInteger(n)||n<0||n>max)
  throw new RangeError("Invalid level for "+id);
 let points=0;
 for(let i=0;i<n;i++){
  const cost=Number(row["Co"+i]);
  if(!Number.isSafeInteger(cost)||cost<0)
   throw new RangeError("Invalid game cost for "+id+" at "+i);
  points+=cost;
 }
 return points;
}
function protectedReason(id,settings){
 if(Object.hasOwn(ACTIVE_SOURCE_SKILL_SPELLS,id))
  return "required-active-spell-not-verified";
 if(id==="ClanQTE"&&settings.assumeCoordinatedOffensiveActive!==true)
  return "coordinated-offensive-activation-not-verified";
 if(id==="BossDmgQTE"&&settings.assumeFlashZipAtBoss!==true)
  return "flash-zip-charged-boss-qte-unverified";
 if(id==="PuppetMaster"&&settings.assumeNightmareAtBoss!==true)
  return "shadow-clone-nightmare-special-attempt-unverified";
 if(id==="MagnumOpus"&&settings.assumeMagnumOpusAtBoss!==true)
  return "magnum-opus-active-at-boss-unverified";
 if(id==="HelperDmgSkillBoost")return "war-cry-spell-not-confirmed-active";
 if(id==="PetBonusBoost"&&!spellEffectScorable("TapBoost",settings))
  return "ember-arts-fire-sword-spell-not-confirmed-active";
 if(id==="ClanShipVoltage")return "thunder-volley-spell-not-confirmed-active";
 if(id==="CriticalHit")return "dagger-mark-and-stream-of-blades-unconfirmed";
 if(id==="HelperInspiredWeaken")return "inspired-helper-activation-unverified";
 if(["ForbiddenContract","RoyalContract","TerrifyingPact"].includes(id)&&
     settings.assumeContractsAtMax!==true)
  return "contract-ramp-and-uptime-not-verified";
 if(id==="ClanShipStun"&&settings.assumeBossStunned!==true)
  return "boss-stun-uptime-not-verified";
 if(id==="HelperDmgQTE"&&Number(settings.astralActivations??0)===0)
  return "astral-orb-activation-not-verified";
 if(id==="CritSkillBoost")return "lightning-strike-count-unverified";
 if(id==="Transmutation")return "jackpot-event-probability-not-verified-for-account";
 return "conditional-skill-effect-not-verified";
}
export function buildInvestmentAudit(levels={},settings={},protectedSkills=[],
 catalog=skillInfo,communityWeights=reductions){
 const skillPoints=Number(settings.skillPoints);
 const entries=[...new Set(protectedSkills)].filter(id=>
  Object.hasOwn(catalog,id)&&Number(levels[id]??0)>0
 ).map(id=>{
  const level=Number(levels[id]);
  const importedLevel=Number(settings.currentLevels?.[id]??0);
  const protectedLevel=Math.min(level,importedLevel);
  return {id,name:catalog[id].Name,
   level,protectedLevel,
   protectedSp:sourceSpent(id,protectedLevel,catalog),
   branch:catalog[id].Branch,reason:protectedReason(id,settings),
   status:"imported-minimum-not-reoptimized",scoreAssumed:false};
 }).sort((a,b)=>b.protectedSp-a.protectedSp||a.id.localeCompare(b.id));
 const protectedSp=entries.reduce((sum,row)=>sum+row.protectedSp,0);
 const warlord=Object.entries(catalog).filter(([id,row])=>
  row.Branch==="BranchYellow"&&Number(levels[id]??0)>0);
 const warlordSp=warlord.reduce((sum,[id])=>
  sum+sourceSpent(id,levels[id],catalog),0);
 const protectedWarlordSp=entries.filter(e=>e.branch==="BranchYellow")
  .reduce((sum,e)=>sum+e.protectedSp,0);
 const tacticalId="HelperBoost";
 const tactical=Number(levels[tacticalId]??0);
 const wr=communityWeights[tacticalId]??{};
 const damageWeight=Number(wr[settings.damage]??0),
       goldWeight=Number(wr[settings.gold]??0),
       goldPriority=Number(settings.goldWeight);
 const heuristicWeight=damageWeight+goldPriority*goldWeight;
 const a=tactical>0?Number(catalog[tacticalId]["A"+tactical]):0;
 return {
  schema:"tt2-84-investment-audit-v1",status:"diagnostic-not-a-new-score",
  skillPoints:Number.isFinite(skillPoints)?skillPoints:null,
  protectedSp,
  protectedPct:skillPoints>0?100*protectedSp/skillPoints:null,
  protectedEntries:entries,
  warlordSp,protectedWarlordSp,
  warlordPct:skillPoints>0?100*warlordSp/skillPoints:null,
  tacticalInsight:{
   level:tactical,
   baseReduction:damageWeight,goldReduction:goldWeight,
   combinedHeuristicWeight:Number.isFinite(heuristicWeight)?
    heuristicWeight:null,
   modelAAmount:Number.isFinite(a)?a:null,
   sourceIsAdditivePercent:true,
   sourceSecondaryBNotSeparatelyModeled:true,
   sourceWeightValidatedAgainstNative:false,
   model:"community-origin-reduction-heuristic",
   neverAssertRealStageGain:true
  },
  assumptions:{
   contractsAtMax:settings.assumeContractsAtMax===true,
   bossStunned:settings.assumeBossStunned===true,
   astralActivations:Number(settings.astralActivations??0),
   unmodeledSkillProtection:settings.protectUnmodeledSkills!==false
  },
  protectedAllocationIsNotOptimalityProof:true,
  diagnosticAddedToScore:false
 };
}
