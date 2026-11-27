import {poisonSproutEvidence} from "./poison-sprout.js?v=20261127-r1";
import {dimensionalShiftEvidence} from "./dimensional-shift.js?v=20261123-boss-specials-r1";
import {buildModelAttribution} from "./model-attribution.js?v=20261123-boss-specials-r1&dimensional=20261127-r1&poisonsprout=20261127-r1";
import {buildAccountBaseline} from "./optimization-account-baseline.js?v=20261123-boss-specials-r1";
import {VERIFIED_SKILL_CATALOG_VERSION,VERIFIED_SKILL_CATALOG_DATASET,gameVersionEvidence} from "./game-version-policy.js?v=20261123-boss-specials-r1";
import {modeledAstralOrbTaps} from "./public-optimization-policy.js?v=20261123-boss-specials-r1&poisonsprout=20261127-r1";
import { skillInfo } from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {parseExportCounter} from "./import-numbers.js?v=20261123-boss-specials-r1";
import {attackChannelEvidence,compareAttackChannels} from "./attack-channels.js?v=20261123-boss-specials-r1";
import {bossPushEvidence} from "./boss-push-evidence.js?v=20261123-boss-specials-r1";
import {resolvePushSkipTarget,verifyPushSkipTarget} from "./push-skip-target.js?v=20261123-boss-specials-r1";
import { baseline } from "../vendor/qol-baseline.js?v=20261123-boss-specials-r1";
import { optimizeExact } from "./solver-core.js?v=20261123-boss-specials-r1&pairrefine=20261127-r1&warmstart=20261127-r1";
import { scoreAtLevel } from "./effects.js?v=20261123-boss-specials-r1&season=20261126-season14-r1&score=20261123-cadence-separated-r1&ember=20261123-ember-fire-sword-gate-r1&jackpot=20261123-native-jackpot-expectation-r1&mc=20261123-multicast-no-guessed-x10-r1&crit=20261124-cleaving-crit-event-r1&ambush=20261124-ambush-conditional-gold-r1&dimensional=20261127-r1&poisonsprout=20261127-r1";
import { parseAccountProfile } from "./account-profile.js?v=20261123-boss-specials-r1";
import {resolveSpellCaps} from "./spell-caps.js?v=20261123-boss-specials-r1";
import {resolveSpellScenario,spellSelectionEvidence,SPELL_CAP_SKILLS,MULTICAST_SKILL_SPELLS,ACTIVE_SOURCE_SKILL_SPELLS,multicastSkillEvidence} from "./spell-scenarios.js?v=20261123-boss-specials-r1";
import {ACTIVE_SPELL_CAPS} from "../vendor/active-spell-caps.js?v=20261123-boss-specials-r1";
import {resolveManaEvidence} from "./mana-evidence.js?v=20261123-boss-specials-r1";
import {accountSourceCoverage} from "./account-source-coverage.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {monumentSeasonDayEvidence} from "./monument-season-day.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
import {resolveContractScenario} from "./contract-scenarios.js?v=20261123-boss-specials-r1";
import {conditionalSkillEvidence} from "./conditional-skill-evidence.js?v=20261123-boss-specials-r1&dimensional=20261127-r1&poisonsprout=20261127-r1";
import {lightningStrikeEvidence} from "./lightning-strike-evidence.js?v=20261123-boss-specials-r1";
import {buildInvestmentAudit} from "./investment-audit.js?v=20261123-boss-specials-r1&poisonsprout=20261127-r1";
import {transmutationSourceEventEvidence} from "./transmutation-native.js?v=20261123-boss-specials-r1&jackpot=20261123-native-jackpot-expectation-r1";
import {cleavingStrikeSourceEvidence} from "./cleaving-strike-native.js?v=20261123-boss-specials-r1&crit=20261124-cleaving-crit-event-r1";
import {ambushSourceEventEvidence} from "./ambush-native-score.js?v=20261123-boss-specials-r1&ambush=20261124-ambush-conditional-gold-r1";
import {resolveTacticalInsightLocal} from "./tactical-insight-local.js?v=20261123-boss-specials-r1";
import {capCurrentMaxStage,CURRENT_MAIN_GAME_STAGE_CAP} from "./current-season-policy.js?v=20261123-boss-specials-r1&season=20261126-season14-r1";
export {capCurrentMaxStage,CURRENT_MAIN_GAME_STAGE_CAP};

export const GAME_VERSION = VERIFIED_SKILL_CATALOG_VERSION;
export const DATASET_REVISION = VERIFIED_SKILL_CATALOG_DATASET; // SkillTreeInfo2.0.csv comparison
export const DAMAGE_TYPES = ["Clan Ship","Pet","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"];
export const GOLD_TYPES = ["Fairy","HoG","Chesterson"];
export const BRANCH_NAMES = {BranchRed:"Knight", BranchOrange:"Summoner", BranchYellow:"Warlord", BranchBlue:"Sorcerer", BranchGreen:"Rogue", BranchPurple:"Alchemist"};
export const SETS = {FB:"Forsaken Battlemage",FF:"Flowering Falconer",tFA:"The Fallen Angel",Shae:"Shae (Knight)",Ignus:"Ignus (Summoner)",Ironheart:"Ironheart (Warlord)",Kor:"Kor (Sorcerer)",Styxsis:"Styxsis (Rogue)",Rygal:"Rygal (Alchemist)"};
export const PRESETS = {
  farm: {goldWeight:0.8, qol:"recommended",label:"Fast farm"},
  balanced: {goldWeight:0.7,qol:"recommended",label:"Balanced"},
  push: {goldWeight:0.6,qol:"none",label:"Push"}
};
export const SKILLS = skillInfo;
export const SKILL_IDS = Object.keys(skillInfo);
export const SKILL_BY_NAME = Object.fromEntries(SKILL_IDS.map(id=>[skillInfo[id].Name,id]));
const EXPORTED_SETS={MultiCast:"FB",Valkyrie:"FF",DarkAngel:"tFA",FairyKnight:"Shae",FireKnight:"Ignus",ElectricWarlord:"Ironheart",WaterSorcerer:"Kor",EarthRogue:"Styxsis",SteampunkKnight:"Rygal"};
/** Set ownership is taken exclusively from explicitly unlocked export
 * collections; missing collections are UNKNOWN, never manual checkbox input.
 * Restore/exported shares may not reuse stale cached UI toggles.
 */
export function ownedSetFlags(profile){
 const ids=new Set(profile?.ownedSetIds||[]);
 return Object.fromEntries(Object.entries(EXPORTED_SETS).map(([id,key])=>[key,ids.has(id)]));
}
const COSTS=Object.fromEntries(SKILL_IDS.map(id=>{
  const info=skillInfo[id], costs=[0];
  for(let lvl=1;lvl<=Number(info.MaxLevel);lvl++){
    const incr=Number(info["Co"+(lvl-1)]);
    if(!Number.isSafeInteger(incr)||incr<0)throw new Error("Invalid source data cost for "+id+": "+(lvl-1));
    costs.push(costs[lvl-1]+incr);
  }
  return [id,costs];
}));
export function spentPoints(levels){
  return SKILL_IDS.reduce((sum,id)=>sum+(COSTS[id][Number(levels?.[id]||0)]||0),0);
}
function levelsFrom(input={}){
  const out={};
  for(const id of SKILL_IDS){
    const val=input[id]??input[skillInfo[id].Name]?.Level??input[skillInfo[id].Name]??0;
    const n=Number(val);
    if(!Number.isInteger(n)||n<0||n>skillInfo[id].MaxLevel)throw new Error("Invalid level for "+skillInfo[id].Name);
    out[id]=n;
  }
  return out;
}
export function parseExport(source){
  let data;
  if(typeof source==="string"){
    if(source.length>8_000_000)throw new Error("Export is too large (max 8 MB).");
    try{data=JSON.parse(source)}catch{throw new Error("The pasted text isn't valid JSON.");}
  }else data=source;
  if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Expected a TT2 JSON export.");
  const tree=data.skillTree||data.Skills||data.skills;
  if(!tree||typeof tree!=="object"||Array.isArray(tree))throw new Error("No skill tree was found in this export.");
  const profile=parseAccountProfile(data);
  const stats=data.playerStats||data.stats||{};
  const skillPoints=stats["Skill Points Owned"]??stats.SkillPoints??data.SkillPoints;
  const levels=levelsFrom(tree),spent=spentPoints(levels);
  const declaredBudget=parseExportCounter(skillPoints,"Skill Points");
  return {
    levels,
    skillPoints:declaredBudget,
    skillPointsSpent:spent,
    budgetSource:declaredBudget===null?"inferred":"declared",
    budgetInconsistent:declaredBudget!==null&&declaredBudget<spent,
    maxStage:capCurrentMaxStage(parseExportCounter(
     stats["Max Prestige Stage"]??stats.MaxStage,"Max Stage")??0,profile),
    craftingPower:Number(stats["Crafting Power"]??stats.CP??1)||1,
    sets:ownedSetFlags(profile),
    setOwnershipKnown:profile.sections.equipmentSets.present,
    damage:DAMAGE_TYPES.includes(stats.typeDamage)?stats.typeDamage:null,
    gold:GOLD_TYPES.includes(stats.typeGold)?stats.typeGold:null,
    importedVersion:data.Version||stats.buildVersion||null,
    versionCompatibility:gameVersionEvidence(data.Version||stats.buildVersion||null),
    profile
  };
}
export function exportBuild(levels,version=GAME_VERSION){
  return JSON.stringify({Version:version,Skills:Object.fromEntries(SKILL_IDS.map(id=>[id,Number(levels[id]||0)]))});
}
export function qosFloors(damage,gold,SP){
  const presets=baseline[damage]?.[gold];
  if(!presets)return {};
  const keys=Object.keys(presets).map(Number).filter(Number.isFinite).filter(value=>value<=SP).sort((a,b)=>b-a);
  return keys.length?{...presets[String(keys[0])]}:{};
}
export function optimizeBuild(settings,onProgress,branchCache=null){
  // Preserve stage >180k only for a current-season export or an explicit
  // manual run, never for a stale season-13 account profile.
  settings={...settings,maxStage:capCurrentMaxStage(
   settings.maxStage,settings.accountProfile,!settings.accountProfile)};
  const SP=Number(settings.skillPoints), goldWeight=Number(settings.goldWeight);
  if(!Number.isSafeInteger(SP)||SP<0||SP>50000)throw new Error("Enter 0–50,000 Skill Points.");
  if(!DAMAGE_TYPES.includes(settings.damage))throw new Error("Select a damage source.");
  if(!GOLD_TYPES.includes(settings.gold))throw new Error("Select a gold source.");
  if(!Number.isFinite(goldWeight)||goldWeight<0||goldWeight>2)throw new Error("Gold weight must be between 0 and 2.");
  const astralActivations=Number(settings.astralActivations ?? 0);
  if(!Number.isInteger(astralActivations)||astralActivations<0||astralActivations>5)
    throw new Error("Astral Awakening activations must be between 0 and 5.");
  const combatContext={...settings,astralActivations,
    assumeHaystActive:settings.assumeHaystActive===true,
    assumeSnapActive:settings.assumeSnapActive===true,
    assumeContractsAtMax:settings.assumeContractsAtMax===true,
    assumeBossStunned:settings.assumeBossStunned===true,
    assumeCoordinatedOffensiveActive:settings.assumeCoordinatedOffensiveActive===true,
    assumeFlashZipAtBoss:settings.assumeFlashZipAtBoss===true,
    assumeNightmareAtBoss:settings.assumeNightmareAtBoss===true,
    assumeMagnumOpusAtBoss:settings.assumeMagnumOpusAtBoss===true};
  // Parse and validate controlled, source-specific local observations once.
  // When absent, preserve historical community/exclusion options unchanged.
  const tiLocal=resolveTacticalInsightLocal(settings);
  combatContext.resolvedTacticalInsightLocal=tiLocal;
  const current=levelsFrom(settings.currentLevels||{});
  const min=Object.fromEntries(SKILL_IDS.map(id=>[id,settings.preserveCurrent?current[id]:0]));
  // Protect current investments that the proxy deliberately scores as zero
  // because their real activation/uptime is unknown. Otherwise the solver
  // will remove useful push skills and put their SP elsewhere, misleadingly
  // calling the result optimal. This is NOT a branch budget cap.
  const protectedSkills=[];
  const spellSelection=spellSelectionEvidence(combatContext);
  const spellCapEvidenceIsIncomplete=!spellSelection.valid||
   !(combatContext.assumeMaxSpells===true||
     (combatContext.assumeMaxSpells!==false&&Number(combatContext.maxStage)>=15000));
  // Only explicitly enabled, source-limited contract scenario comparisons
  // may test reallocating these three otherwise protected skills.
  const policy=settings.contractMultiScenario||{};
  const activeFraction=Number(policy.activeFraction);
  const contractReallocationAllowed=
    settings.allowContractScenarioReallocation===true&&
    policy.enabled===true&&
    policy.pactAtMaxDuringFundedTicks===true&&
    settings.contractTimeline?.enabled===true&&
    policy.activeFraction!==""&&policy.activeFraction!=null&&
    Number.isFinite(activeFraction)&&activeFraction>=0&&activeFraction<=1;
  const maximumSpellsAssumed=combatContext.assumeMaxSpells===true||
    (combatContext.assumeMaxSpells!==false&&Number(combatContext.maxStage)>=15000);
  const selectedModeledSpell=id=>maximumSpellsAssumed&&
    spellSelection.valid&&spellSelection.ids.includes(id);
  if(settings.qol==="recommended"){
    const pref=qosFloors(settings.damage,settings.gold,SP);
    for(const [id,v] of Object.entries(pref))if(id in min)min[id]=Math.max(min[id],Number(v)||0);
  }
  for(const [id,v] of Object.entries(settings.minimums||{})){
    if(!(id in min))continue;
    const lvl=Number(v);
    if(!Number.isInteger(lvl)||lvl<0||lvl>skillInfo[id].MaxLevel)throw new Error("Invalid minimum for "+skillInfo[id].Name);
    min[id]=Math.max(min[id],lvl);
  }
  // A selected and modeled spell is a HARD loadout constraint. Its
  // unlock must not disappear while DP optimizes only marginal skill gains;
  // otherwise the final ledger loses a nonconstant baseline and DP bounds
  // do not apply to the final score.
  const selectedSpellUnlocks=[];
  if(spellSelection.valid&&!spellCapEvidenceIsIncomplete){
    for(const id of spellSelection.ids){
      const requirement=ACTIVE_SPELL_CAPS[id]?.required;
      if(!requirement||requirement==="None")continue;
      if(!Object.hasOwn(skillInfo,requirement))
       throw new Error("Unknown selected spell unlock requirement: "+id);
      min[requirement]=Math.max(min[requirement],1);
      selectedSpellUnlocks.push(requirement);
    }
  }
  // Determine multicast uncertainty against the same effective spell
  // unlocks that will be passed to the scoring table. A selected spell
  // is not "locked" merely because its guaranteed unlock was implicit.
  const protectionContext={...combatContext,minimums:min};
  const uncertainSkills=[
    ...(spellCapEvidenceIsIncomplete?Object.keys(SPELL_CAP_SKILLS):[]),
    // The community score previously credited these spell effects even
    // when the relevant active spell was absent or the combat state unknown.
    ...(!selectedModeledSpell("HelperBoost")?["HelperDmgSkillBoost"]:[]),
    // Preserve imported Ember Arts investments if their Fire Sword B
    // component cannot be modeled, even though Pet Damage A is known.
    ...(!selectedModeledSpell("TapBoost")?["PetBonusBoost"]:[]),
    // Unknown active spells cannot be silently removed from an imported tree.
    ...Object.entries(ACTIVE_SOURCE_SKILL_SPELLS)
      .filter(([,spell])=>!selectedModeledSpell(spell))
      .map(([id])=>id),
    ...(combatContext.assumeCoordinatedOffensiveActive===true?[]:["ClanQTE"]),
    ...(combatContext.assumeFlashZipAtBoss===true?[]:["BossDmgQTE"]),
    ...(combatContext.assumeNightmareAtBoss===true?[]:["PuppetMaster"]),
    ...(combatContext.assumeMagnumOpusAtBoss===true?[]:["MagnumOpus"]),
    ...(!selectedModeledSpell("ThunderVolley")?["ClanShipVoltage"]:[]),
    ...(!selectedModeledSpell("StreamOfBlades")&&
      combatContext.assumeDaggerTargetMarked!==true?["CriticalHit"]:[]),
    ...(combatContext.assumeInspiredHelpersActive===true?[]:
      ["HelperInspiredWeaken"]),
    ...Object.keys(MULTICAST_SKILL_SPELLS).filter(id=>
      !multicastSkillEvidence(id,Math.max(1,current[id]),protectionContext).modeled),
    ...(combatContext.assumeContractsAtMax||contractReallocationAllowed?[]:
      ["ForbiddenContract","RoyalContract","TerrifyingPact"]),
    ...(combatContext.assumeHaystActive?[]:["QuickFortune"]),
    ...(combatContext.assumeSnapActive?[]:["PhilosophersFlux"]),
    ...(astralActivations>0?[]:["HelperDmgQTE"]),
    ...(combatContext.equipmentPetCoverageComplete===true?[]:["CombatTechniques"]),
    ...(combatContext.assumeBossStunned?[]:["ClanShipStun"]),
    // Jackpot rewards depend on actual account chance and gold event.
    // Keep imported Transmutation SP while source-only expectation is
    // an incomplete model, instead of silently resetting a useful skill.
    // Twilight multicast C = Gloom damage only when a Twilight
    // Fairy has actually struck. The available stacks do not prove
    // Gloom activation, so protect already-invested source C levels.
    "TwilightGatheringMultiCastSkill",
    // Cleaving Strike A = critical-hit damage, not universal damage.
    // For non-HS sources, the account-wide critical probability is unknown.
    // Keep their imported levels when applying a talent-only event model.
    ...(combatContext.damage==="Heavenly Strike"?[]:["HeavyStrikes"]),
    // The player's actual multiple-Titan encounter frequency is unknown.
    // Do not erase an imported Ambush investment from a source-only model.
    "MultiMonsters",
    ...(!dimensionalShiftEvidence(1,protectionContext).completeForSelectedPrimaryProxy?["BossTimer"]:[]),
    ...["PoisonedBlade","KratosSummon"].filter(id=>!poisonSproutEvidence(id,1,combatContext).eligible),
    "Transmutation",
    ...(combatContext.assumeSourceOnlyLightningStrike===true&&
      Number.isSafeInteger(combatContext.lightningStrikeHits)&&
      combatContext.lightningStrikeHits>=0&&
      combatContext.lightningStrikeHits<=2000?[]:["CritSkillBoost"])
  ];
  if(settings.protectUnmodeledSkills!==false&&!settings.preserveCurrent){
    for(const id of new Set(uncertainSkills)){
      if(current[id]>0){
        min[id]=Math.max(min[id],current[id]);
        protectedSkills.push(id);
      }
    }
  }
  // A two-point observed TI scenario is only justified WITHIN its
  // measured interval. The lower level's SP cost is a real hard minimum.
  if(tiLocal.enabled)
    min.HelperBoost=Math.max(min.HelperBoost,tiLocal.lowerLevel);
  // Optional attack-specific source Stage Skip is a REAL constraint on
  // talent levels. It is not converted into fictitious attack damage.
  // The same mechanism works for all six damage builds and gold sources.
  const pushSkipRequested=resolvePushSkipTarget(combatContext);
  for(const [id,level] of Object.entries(pushSkipRequested.requiredLevels))
    min[id]=Math.max(min[id],level);
  if(combatContext.assumeContractsAtMax){
    // Opt-in means both contracts exist and reach full bonus at the boss.
    // Minimums also make the conditional Terrifying Pact score consistent.
    min.ForbiddenContract=Math.max(min.ForbiddenContract,1);
    min.RoyalContract=Math.max(min.RoyalContract,1);
  }
  if(spentPoints(min)>SP)throw new Error("The required QoL or minimum skills cost more SP than available. Disable automatic QoL or lower constraints.");
  const skills=SKILL_IDS.map(id=>{
    const s=skillInfo[id],maxStage=Number(settings.maxStage||0);
    const sourceMax=maxStage&&maxStage<Number(s.S0)?0:Number(s.MaxLevel);
    const max=id==="HelperBoost"&&tiLocal.enabled?
      Math.min(sourceMax,tiLocal.upperLevel):sourceMax;
    if(min[id]>max)throw new Error(s.Name+" cannot reach the required minimum at your current stage.");
    return {id,branch:s.Branch,parent:s.TalentReq,spReq:Number(s.SPReq),min:min[id],max,excluded:settings.excluded?.includes(id)||false,costs:COSTS[id]};
  });
  // Evaluate and validate each (skill, level) score exactly once. The old
  // code recomputed every score for validation and again during branch DP,
  // including costly conditional/multicast mechanics at high SP budgets.
  const scoreContext={...combatContext,minimums:min};
  const scoreCache=new Map();
  for(const id of SKILL_IDS){
    const scores=new Float64Array(Number(skillInfo[id].MaxLevel)+1);
    for(let level=0;level<scores.length;level++){
      const value=scoreAtLevel(id,level,scoreContext);
      if(!Number.isFinite(value))throw new Error("Some score coefficients are invalid: "+id+" level "+level);
      scores[level]=value;
    }
    scoreCache.set(id,scores);
  }
  const result=optimizeExact(skills,SP,(skill,level)=>scoreCache.get(skill.id)[level],"power",onProgress,{branchCache,initialLevels:current});
  const modelAttribution=buildModelAttribution({result,current,scoreCache,scoreContext,tiLocal,settings,SKILL_IDS,skillInfo,BRANCH_NAMES,GAME_VERSION});
  const points=spentPoints(result.levels);
  if(points>SP)throw new Error("Internal validation failed: allocation exceeds SP budget.");
  for(const item of skills){
    if(result.levels[item.id]<item.min || result.levels[item.id]>item.max)
      throw new Error("Internal validation failed: "+item.id+" violates a constraint.");
    const p=result.levels[item.id]>0?item.parent:null;
    if(p&&p!=="None"&&(!result.levels[p]))throw new Error("Internal validation failed: missing prerequisite "+p);
    const branchSpent=SKILL_IDS.filter(k=>skillInfo[k].Branch===item.branch).reduce((sum,k)=>sum+(COSTS[k][result.levels[k]]||0),0);
    if(result.levels[item.id]>0&&branchSpent-COSTS[item.id][result.levels[item.id]]<item.spReq) {
      // Existing tier requirements must be fulfilled before buying the skill,
      // but this check cannot infer purchase order. DP enforces tier eligibility.
    }
  }
  const changes=SKILL_IDS.filter(id=>result.levels[id]!==current[id]).map(id=>({
    id,name:skillInfo[id].Name,before:current[id],after:result.levels[id],difference:result.levels[id]-current[id]
  }));
  const branchTotals=Object.fromEntries(Object.entries(BRANCH_NAMES).map(([branch,name])=>[name,
    SKILL_IDS.filter(id=>skillInfo[id].Branch===branch).reduce((sum,id)=>sum+COSTS[id][result.levels[id]],0)
  ]));
  const {power,timed,permanentSetPower,fixedAccount,dependencyReport,skillTreeSetPower,newlyResolvedSetEffects,remainingUnmodeledEffects}=buildAccountBaseline(settings,result.levels);
  const jackpotSourceOnly=transmutationSourceEventEvidence(
   result.levels.Transmutation??0);
  const criticalSourceOnly=cleavingStrikeSourceEvidence(
   result.levels.HeavyStrikes??0,scoreContext.damage);
  const ambushSourceOnly=ambushSourceEventEvidence(
   result.levels.MultiMonsters??0);
  const contractScenario=resolveContractScenario(result.levels,scoreContext);
  const conditionalSkills=conditionalSkillEvidence(result.levels,scoreContext);
  const lightningStrike=lightningStrikeEvidence(result.levels,scoreContext);
   const investmentAudit=buildInvestmentAudit(result.levels,scoreContext,protectedSkills);
  const spellCaps=resolveSpellCaps(scoreContext,result.levels);
  const spellScenario=resolveSpellScenario(scoreContext,result.levels,spellCaps);
  const manaEvidence=resolveManaEvidence(scoreContext,result.levels,spellScenario,contractScenario);
  const accountCoverage=accountSourceCoverage(settings.accountProfile,power,
   scoreContext,{permanentSetPower,timedSetPower:timed});
  const seasonDayMonuments=monumentSeasonDayEvidence(dependencyReport.monuments,
   scoreContext);
  const pushSkipTarget=verifyPushSkipTarget(pushSkipRequested,result.levels);
  const attackChannels=attackChannelEvidence(scoreContext,result.levels);
  const attackChannelChanges=compareAttackChannels(scoreContext,current,result.levels);
  // Observed damage belongs ONLY to the player's *imported/current* tree
  // with their real buffs. Never transfer it to a new proposed SP allocation.
  // The proposed tree receives source-only evidence without any observed hit.
  const hasBossStage=Number(scoreContext.pushBossStage??scoreContext.maxStage)>=1;
  const bossPushCurrent=hasBossStage?
   bossPushEvidence(scoreContext,current):null;
  const bossPushProposed=hasBossStage?
   bossPushEvidence({...scoreContext,pushObservedAttackChannelId:null,
    pushObservedHitDamage:null},result.levels):null;
  return {...result,prior:current,spent:points,remaining:SP-points,
     effectiveMaxStage:scoreContext.maxStage,mainGameStageCap:CURRENT_MAIN_GAME_STAGE_CAP,
     changes,branchTotals,protectedSkills,investmentAudit,
    attackChannels,attackChannelChanges,modelAttribution,pushSkipTarget,
    bossPushCurrent,bossPushProposed,
    accountSourceCoverage:accountCoverage,monumentSeasonDay:seasonDayMonuments,
    selectedSpellUnlocks,spellBaselineInvariantUnderSkillOptimization:
     spellSelection.valid&&!spellCapEvidenceIsIncomplete,
    spellCaps,spellScenario,manaEvidence,contractScenario,conditionalSkills,lightningStrike,
    jackpotSourceOnly,criticalSourceOnly,ambushSourceOnly,
    accountIntegration:{
      skillTreeSetPower:{
       applied:skillTreeSetPower.applied,recognized:skillTreeSetPower.recognized,
       branchCoefficientLog10:skillTreeSetPower.byBranch,
       spentByBranch:skillTreeSetPower.spentByBranch,
       skillScoreLog10:skillTreeSetPower.damageLog10,
       unmodeled:skillTreeSetPower.unresolved,
       includedInSkillScore:true,
       addedToFixedAccount:false,
       completedSetRosterPresent:settings.accountProfile?.sections?.equipmentSets?.present===true,
       complete:false
      },
      timedSetPower:{calculated:timed.calculated,applied:timed.applied,omitted:timed.omitted},
      permanentSetPower:{
       recognizedSets:permanentSetPower.recognizedSets,
       uniqueOwned:permanentSetPower.uniqueOwnedCount,
       directEffects:permanentSetPower.appliedDirect,
       equipmentEffects:permanentSetPower.appliedEquipment,
       conservativeCPBaseEffects:permanentSetPower.conservative,
       countedEffectsApplied:permanentSetPower.countedEffectsApplied,
       ownedCounts:{...permanentSetPower.ownedCounts},
       ownedRosterComplete:permanentSetPower.ownedRosterComplete,
       craftingPower:permanentSetPower.craftingPower,
       unresolvedEffects:permanentSetPower.unresolved,
       missingOwnedSetRows:permanentSetPower.ownedSetSectionTruncated,
       complete:false
      },
      gemstoneEffects:{
        direct:dependencyReport.gemstones.directEffects,
        equipment:dependencyReport.gemstones.equipmentEffects,
        pet:dependencyReport.gemstones.petEffects,
        unresolved:dependencyReport.gemstones.unknown.length,
        duplicateMirrors:dependencyReport.gemstones.duplicateMirrors,
        researchLevelsAppliedAgain:false,
        complete:false
      },
      researchResources:{
        gemstones:dependencyReport.researchResources.gemstones,
        titanSouls:dependencyReport.researchResources.titanSouls,
        unknownNodes:dependencyReport.researchResources.unknown.length,
        audit:dependencyReport.researchResources.audit,
        complete:false
      },
      monuments:{catalog:dependencyReport.monuments.catalogCount,
        activeInCatalog:dependencyReport.monuments.activeInCatalog,
        identified:dependencyReport.monuments.recognized,
        duplicated:dependencyReport.monuments.importedRecords-dependencyReport.monuments.recognized,
        conflicts:dependencyReport.monuments.conflicts,
        seasonDays:dependencyReport.monuments.seasonDays,
        perSeasonDay:dependencyReport.monuments.perSeasonDay,
        modeled:dependencyReport.monuments.modeled,
        ...power.monumentEffects},
      petPassives:power.petPassives,
      artifactDerived:power.artifactDerived,
      additiveDamage:{
        artifactPool:dependencyReport.additiveDamage.artifacts,
        monumentPool:dependencyReport.additiveDamage.monuments,
        appliedToScore:power.monumentEffects?.additiveDamageApplied===true
      },
      artifacts:{identified:dependencyReport.permanentArtifacts.recognized,
        computed:dependencyReport.permanentArtifacts.computed,
        modeled:dependencyReport.permanentArtifacts.scored,
        ...power.artifactEffects,
        whiteDwarfApplied:power.artifactDerived?.whiteDwarfApplied===true,
        ownedCountVerifiable:power.artifactDerived?.ownedCountVerifiable===true,
        ownedArtifactCount:power.artifactDerived?.ownedArtifacts??null,
        damagePoolComponents:power.artifactDerived?.poolComponents??0,
        additiveDamageConservative:power.artifactDerived?.conservativeDamage===true},
      uniqueOwnedCount:dependencyReport.uniqueEquipment.ownedCount,
      uniquePermanentBonusesModeled:false,
      heroProgression:{
        fullSets:power.heroProgression?.weapons?.completeSets??null,
        rosterVerified:power.heroProgression?.weapons?.completeRosterVerified===true,
        missingHeroes:power.heroProgression?.weapons?.missingHeroes??37,
        invalidLevels:power.heroProgression?.weapons?.invalidLevels??0,
        duplicateIds:power.heroProgression?.weapons?.duplicates?.length??0,
        baseSetLog10:power.heroProgression?.baseSetLog10??null,
        weaponSetFactor:power.heroProgression?.setFactor??null,
        individualWeaponFactor:power.heroProgression?.individualFactor??null,
        baseHeroDamageUnreduced:true,
        ringing:power.heroProgression?.ringing??null,
        mythicSmith:power.heroProgression?.mythicSmith??null,
        worldshaper:power.heroProgression?.worldshaper??null,
        morgelai:power.heroProgression?.morgelai??null,
        strongest:power.heroProgression?.strongest??null,
        heroLevels:power.heroProgression?.heroLevels??null,
        aliasEvidence:power.heroProgression?.aliasEvidence??null,
        individualWeaponRows:power.heroProgression?.individual??[],
        individuallyScored:false,
        baseBonusScored:(power.heroProgression?.entries?.length||0)>0,
        boosters:power.heroProgression?.artifactBoosters||[],
        unresolved:power.heroProgression?.unresolved||[],
        individualWeaponsScored:false,
        amplifiersScored:power.heroProgression?.amplifiersScored===true,complete:false
       },
       clanScrollPower:power.clanScrollPower,
       heroWeaponFullSets:dependencyReport.heroWeapons.completeSets,
      heroWeaponMissingIds:dependencyReport.heroWeapons.missingHeroes,
      clanScrollLevels:dependencyReport.clanScrolls.totalLevels,
      clanScrollSetBoostPercent:dependencyReport.clanScrolls.setBonusPercent,
      clanScrollCompleteSets:dependencyReport.clanScrolls.fullSets,
      sourceCatalogs:{sets:dependencyReport.sets.length,artifacts:dependencyReport.artifacts.length},
      unmodeledEffects:remainingUnmodeledEffects,
      newlyResolvedSetEffects,
      unmodeledEffectsBeforePermanentSetFormulas:dependencyReport.unmodeledEffects,
      unknownCatalogIds:dependencyReport.unknown.length,
      releaseReady:false
    },
    fixedAccount:{...fixedAccount,
      matched:power.matched+permanentSetPower.appliedDirect+timed.applied,
      unknown:power.unknown,
      available:power.available||timed.applied>0||permanentSetPower.appliedDirect>0,
      complete:power.complete,
      // Exact per-source values are used for diagnostics, not for an
      // unsupported claim of a complete end-to-end damage simulation.
      examples:power.entries.filter(e=>e.bonusType==="PetDamage").slice(0,6),
      artifactEffects:power.artifactEffects,monumentEffects:power.monumentEffects,
      timedSetBonuses:timed.entries.filter(x=>x.log10!==null).slice(0,30),
      permanentSetBonuses:permanentSetPower.entries.filter(x=>x.appliedToAccount).slice(0,85)
     },
    // Add fixed account context to each build's total proxy. Marginal SP
    // optimization remains mathematically unchanged by a constant.
    accountAdjustedScore:result.score+fixedAccount.weightedLog10,
    combatAssumptions:{hayst:combatContext.assumeHaystActive,
      snap:combatContext.assumeSnapActive,
      coordinatedOffensive:combatContext.assumeCoordinatedOffensiveActive,
      flashZipAtBoss:combatContext.assumeFlashZipAtBoss,
      nightmareAtBoss:combatContext.assumeNightmareAtBoss,
      magnumOpusAtBoss:combatContext.assumeMagnumOpusAtBoss,
      astralActivations:modeledAstralOrbTaps(result.levels,astralActivations),
      astralMaxAvailable:5,
      poisonApplications:poisonSproutEvidence("PoisonedBlade",result.levels.PoisonedBlade,scoreContext).modeledStacks,
      sproutStacks:poisonSproutEvidence("KratosSummon",result.levels.KratosSummon,scoreContext).modeledStacks,
      idealBossAssumptionsOnly:[
       combatContext.assumeHaystActive,combatContext.assumeSnapActive,
       combatContext.assumeCoordinatedOffensiveActive,
       combatContext.assumeFlashZipAtBoss,
       combatContext.assumeNightmareAtBoss,
       combatContext.assumeMagnumOpusAtBoss].every(Boolean),
      actualBossUptimeVerified:false,
      contractsAtMax:combatContext.assumeContractsAtMax},
    model:"TT2 weighted log-damage/gold proxy; not a gameplay performance guarantee",
    gameVersion:GAME_VERSION,importedGameVersion:settings.importedVersion??null,
    sourceDataGameVersion:GAME_VERSION};
}
