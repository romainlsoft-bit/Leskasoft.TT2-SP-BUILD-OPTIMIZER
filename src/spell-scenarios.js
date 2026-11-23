/**
 * TT2 8.4 spell loadout / activation hypothesis.
 * NEVER count 11 known spells as equipped: only six slots exist.
 * Source: TT2_CSV ActiveSkillInfo.csv + pinned vendor/spells.js,
 * Game Hive spell selection, skill cap source rows. This is a
 * conditional maximum-spell scenario, not proven active uptime.
 */
import {spellInfo,spell_reductions} from "../vendor/spells.js?v=20261123-conditional-score-r1";
import {skillInfo} from "../vendor/skills.js?v=20261123-conditional-score-r1";
import {ACTIVE_SPELL_CAPS} from "../vendor/active-spell-caps.js?v=20261123-conditional-score-r1";
import {resolveSpellCaps,spellTableIndex} from "./spell-caps.js?v=20261123-conditional-score-r1";
import {positiveLog10} from "./account-artifacts.js?v=20261123-conditional-score-r1";
const CATALOG_IDS=Object.keys(ACTIVE_SPELL_CAPS);
const INDEX=new Map(CATALOG_IDS.map(id=>[id.toLowerCase(),id]));
/**
 * Proven spell-to-multicast links from TT2 8.4 skill BonusTypeA/B IDs.
 * The optimistic spell-level hypothesis is not evidence of real uptime.
 */
export const MULTICAST_SKILL_SPELLS=Object.freeze({
 BurstDamageMultiCastSkill:"BurstDamage",
 TapBoostMultiCastSkill:"TapBoost",
 DualPetMultiCast:"DualPet",
 HelperBoostMultiCastSkill:"HelperBoost",
 ClanShipVoltageMultiCastSkill:"ThunderVolley",
 ShadowCloneMultiCastSkill:"ShadowClone",
 GuidedBlade:"CritBoost",
 StreamOfBladesMultiCastSkill:"StreamOfBlades",
 TwilightGatheringMultiCastSkill:"TwilightFairy",
 HandOfMidasMultiCastSkillBoost:"HandOfMidas"
});
export function multicastSkillEvidence(skillId,level,settings={}){
 const spellId=MULTICAST_SKILL_SPELLS[skillId];
 if(!spellId)return null;
 const selection=spellSelectionEvidence(settings);
 const spell=spellInfo[spellId];
 const required=ACTIVE_SPELL_CAPS[spellId]?.required??"None";
 const knownSelected=selection.valid&&selection.ids.includes(spellId);
 const minimum=Number(settings.minimums?.[required]??0);
 const retained=settings.preserveCurrent===true?Number(settings.currentLevels?.[required]??0):0;
 const unlocked=required==="None"||minimum>0||retained>0;
 const maxScenario=assumedMax(settings);
 const row=skillInfo[skillId];
 const baseCharges=Number(row?.["B"+level]??0);
 const setCharges=Number(Boolean(settings.sets?.FB))+Number(Boolean(settings.sets?.FF));
 const maximumCharges=baseCharges>0?baseCharges+setCharges:0;
 const claimed=settings.multicastAvailableCharges?.[spellId];
 const provided=claimed!==undefined&&claimed!==null;
 const verifiedCharges=provided&&Number.isSafeInteger(Number(claimed))&&
  Number(claimed)>=0;
 const status=!selection.valid?"unknown-loadout":!knownSelected?"spell-absent":
  !unlocked?"spell-locked":!maxScenario?"activation-unverified":
  provided&&!verifiedCharges?"invalid-charge-evidence":"modeled";
 const modeled=status==="modeled";
 const charges=modeled?(verifiedCharges?
  Math.min(maximumCharges,Number(claimed)):maximumCharges):0;
 return {skillId,spellId,status,modeled,
  maximumCharges,modeledCharges:charges,
  actualChargesVerified:verifiedCharges,
  sourceDurationSeconds:Number(spell?.Duration)||null,
  sourceCooldownSeconds:Number(spell?.Cooldown)||null,
  actualUptimeVerified:false,
  dataTableVersion:"8.4.0"};
}

export const MAX_EQUIPPED_SPELLS=6;
export const SPELL_CAP_SKILLS=Object.freeze({
 TwilightBell:["BurstDamage","TwilightFairy"],
 SummonerAutoTap:["DualPet","TapBoost"],
 PhantomBlades:["CritBoost","StreamOfBlades"],
 AlchemistMastery:["HandOfMidas","GoldenMissile"]
});
function normalizeIds(rows){
 if(!Array.isArray(rows))return {valid:false,ids:[],unknown:[],duplicates:[],reason:"invalid-spell-loadout-format"};
 if(rows.length===0||rows.length>MAX_EQUIPPED_SPELLS)
  return {valid:false,ids:[],unknown:[],duplicates:[],reason:"invalid-equipped-spell-count"};
 const ids=[],seen=new Set(),unknown=[],duplicates=[];
 for(const raw of rows){
  const candidate=typeof raw==="string"?raw:
   raw&&typeof raw==="object"&&!Array.isArray(raw)?raw.id:null;
  const id=typeof candidate==="string"?INDEX.get(candidate.trim().toLowerCase()):null;
  if(!id){unknown.push(String(candidate??"invalid").slice(0,90));continue;}
  if(seen.has(id)){duplicates.push(id);continue;}
  seen.add(id);ids.push(id);
 }
 return {valid:!unknown.length&&!duplicates.length,ids,unknown,duplicates,
  reason:unknown.length?"unrecognized-spell-id":duplicates.length?"duplicate-spell-id":null};
}
export function spellSelectionEvidence(settings={}){
 const raw=settings?.selectedSpells;
 const imported=settings?.accountProfile?.spellLoadout;
 const settingsPresent=raw!==undefined&&raw!==null;
 const exportedPresent=imported?.present===true;
 const selected=normalizeIds(settingsPresent?raw:exportedPresent?imported.ids:null);
 const explicit=settingsPresent||exportedPresent;
 let valid=explicit&&selected.valid&&imported?.truncated!==true;
 let reason=explicit?selected.reason??null:"equipped-spell-loadout-not-exported";
 if(imported?.truncated===true){valid=false;reason="truncated-spell-loadout";}
 if(settingsPresent&&exportedPresent){
  const fromExport=normalizeIds(imported.ids);
  if(!fromExport.valid||fromExport.ids.length!==selected.ids.length||
     selected.ids.some(id=>!fromExport.ids.includes(id))){
   valid=false;reason="conflicting-spell-loadouts";
  }
 }
 return {present:explicit,valid,ids:valid?selected.ids:[],unknown:selected.unknown,
  duplicates:selected.duplicates,source:settingsPresent?"explicit-settings":
   exportedPresent?"account-export":"missing",reason,slotLimit:MAX_EQUIPPED_SPELLS};
}
const assumedMax=settings=>settings?.assumeMaxSpells===true||
 (settings?.assumeMaxSpells!==false&&Number(settings?.maxStage)>=15000);
/** Skill-specific effects of an equipped active spell have the SAME gate
 * as skill-dependent spell-cap benefits. A merely owned/unlocked spell is
 * not proof that it fills one of the six active slots or is active at boss.
 * The unlock of an SP-gated spell must already be a guaranteed minimum.
 */
export function spellEffectScorable(spellId,settings={}){
 const selection=spellSelectionEvidence(settings);
 if(!selection.valid||!selection.ids.includes(spellId)||!assumedMax(settings))
  return false;
 const requirement=ACTIVE_SPELL_CAPS[spellId]?.required;
 if(!requirement)return false;
 if(requirement==="None")return true;
 const minimum=Number(settings?.minimums?.[requirement]??0);
 const retained=settings?.preserveCurrent===true?
  Number(settings?.currentLevels?.[requirement]??0):0;
 return (Number.isSafeInteger(minimum)&&minimum>0)||
  (Number.isSafeInteger(retained)&&retained>0);
}
export function spellCapGainEligible(skillId,spellId,settings={}){
 return SPELL_CAP_SKILLS[skillId]?.includes(spellId)===true&&
  spellEffectScorable(spellId,settings);
}
const sourcedNonnegative=value=>{
 if(value===null||value===undefined||value==="")return null;
 const n=Number(String(value).replaceAll(",",""));
 return Number.isFinite(n)&&n>=0?n:null;
};
function routedWeight(spellId,settings){
 const row=spell_reductions[spellId]||{};
 const damage=row[settings.damage],gold=row[settings.gold];
 const damageWeight=typeof damage==="number"&&Number.isFinite(damage)&&damage>=0?damage:0;
 const goldWeight=typeof gold==="number"&&Number.isFinite(gold)&&gold>=0?gold:0;
 return {damageWeight,goldWeight};
}
/**
 * Suggest up to six source-relevant spells for a damage/gold build, without
 * claiming they are currently equipped, mana-sustainable or globally optimal.
 * May be shown as advice; NEVER included in the numerical score.
 */
export function recommendSourceSpellSlots(settings={},levels={},capEvidence=null){
 const caps=capEvidence??resolveSpellCaps(settings,levels);
 const weight=Number(settings.goldWeight);
 const records=[];
 for(const id of CATALOG_IDS){
  const cap=caps.spells[id];
  if(!cap?.available||cap.unmodeledLevels>0)continue;
  const index=spellTableIndex(cap.cap);
  const multiplier=index===null?null:positiveLog10(spellInfo[id]?.["A"+index]);
  const {damageWeight,goldWeight}=routedWeight(id,settings);
  if(multiplier===null||!Number.isFinite(weight))continue;
  const score=multiplier*(damageWeight+weight*goldWeight);
  if(!(score>0))continue;
  records.push({id,score,level:cap.cap,damageWeight,goldWeight});
 }
 records.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 return {ids:records.slice(0,MAX_EQUIPPED_SPELLS).map(x=>x.id),
  rows:records.slice(0,MAX_EQUIPPED_SPELLS),availableCandidates:records.length,
  modeledAsEquipped:false,addedToScore:false,
  sourceOnly:true,uptimeAndManaNotRanked:true,
  complete:false};
}

export function resolveSpellScenario(settings={},levels={},capEvidence=null){
 const selection=spellSelectionEvidence(settings);
 const caps=capEvidence??resolveSpellCaps(settings,levels);
 const assumed=assumedMax(settings);
 const rows=[],unsupported=[],bySpell={};
 let damageLog10=0,goldLog10=0,manaOneCast=0,missingManaCosts=0;
 if(!selection.valid)unsupported.push(selection.reason);
 if(!assumed)unsupported.push("maximum-spell-activation-not-assumed");
 for(const id of selection.ids){
  const cap=caps.spells[id],table=spellInfo[id];
  if(!cap||!table){unsupported.push("unknown-spell:"+id);continue;}
  const baseLevel=ACTIVE_SPELL_CAPS[id].baseCap+cap.bonusFromSet;
  const baseIndex=spellTableIndex(baseLevel),finalIndex=spellTableIndex(cap.cap);
  const amount=baseIndex!==null?positiveLog10(table["A"+baseIndex]):null;
  const finalAmount=finalIndex!==null?positiveLog10(table["A"+finalIndex]):null;
  const missingFinal=cap.cap>cap.tabulatedLevel||finalAmount===null;
  const baseMana=baseIndex!==null?sourcedNonnegative(table["M"+baseIndex]):null;
  const finalMana=finalIndex!==null?sourcedNonnegative(table["M"+finalIndex]):null;
  const capSkill=Object.entries(SPELL_CAP_SKILLS).find(([,ids])=>ids.includes(id))?.[0]??null;
  const capMarginalScored=cap.bonusFromSP>0&&capSkill!==null&&
   spellCapGainEligible(capSkill,id,settings);
  if(cap.bonusFromSP>0&&!capMarginalScored)
   unsupported.push("unverified-cross-branch-cap-marginal:"+id);
  const duration=sourcedNonnegative(table.Duration),cooldown=sourcedNonnegative(table.Cooldown);
  const {damageWeight,goldWeight}=routedWeight(id,settings);
  const eligible=cap.available&&amount!==null&&baseLevel<=cap.tabulatedLevel;
  const credited=eligible&&assumed;
  // Only the unmodified level-30 (or level-35 Fallen Angel) baseline
  // can enter the ledger. The SP-induced cap increase is scored inside
  // scoreAtLevel. NEVER add the final cap's full multiplier again.
  const d=credited?amount*damageWeight:0;
  const g=credited?amount*goldWeight:0;
  damageLog10+=d;goldLog10+=g;
  if(!cap.available)unsupported.push("spell-not-unlocked:"+id);
  if(missingFinal)unsupported.push("spell-level-exceeds-source-table:"+id);
  if(!eligible&&!missingFinal&&cap.available)unsupported.push("unknown-base-spell-effect:"+id);
  if(finalMana===null){missingManaCosts++;unsupported.push("unknown-mana-cost:"+id);}
  else manaOneCast+=finalMana;
  const row={id,baseLevel,cap:cap.cap,finalSourceLevel:cap.tabulatedLevel,
   unmodeledLevels:cap.unmodeledLevels,available:cap.available,
   assumedActive:credited,baseLog10:amount,
   finalCapLog10:finalAmount,capMarginalLog10:finalAmount!==null&&amount!==null?
    finalAmount-amount:null,capMarginalAlreadyInSkillScore:capMarginalScored,
   capMarginalUnscored:cap.bonusFromSP>0&&!capMarginalScored,
   damageWeight,goldWeight,damageLog10:d,goldLog10:g,
   baseManaCost:baseMana,finalManaCost:finalMana,
   sourceDurationSeconds:duration,sourceCooldownSeconds:cooldown,
   source:"8.4 ActiveSkillInfo table; conditional selected spell"};
  rows.push(row);bySpell[id]=row;
 }
 const weight=Number(settings?.goldWeight);
 const weightedLog10=damageLog10+(Number.isFinite(weight)?weight:0)*goldLog10;
 const recommendation=recommendSourceSpellSlots(settings,levels,caps);
 const multicast=Object.fromEntries(Object.keys(MULTICAST_SKILL_SPELLS)
  .map(id=>[id,multicastSkillEvidence(id,Number(levels[id]??0),settings)]));
 return {schema:"tt2-spell-scenario-v1",selection,slots:selection.ids.length,
  recommendation,multicast,
  sourceSpellCount:CATALOG_IDS.length,rows,bySpell,unsupported,
  damageLog10,goldLog10,weightedLog10,
  manaOneCast:selection.valid&&rows.length===selection.ids.length&&
   rows.every(row=>row.available)&&!missingManaCosts?manaOneCast:null,missingManaCosts,
  sourceDurationsNotEffectiveUptime:true,
  assumedMaxLevelScenario:assumed,actualActivationVerified:false,
  manaSustainableVerified:false,activeSpellSlotsVerified:selection.valid,
  appliedToScenario:selection.valid&&assumed&&rows.some(x=>x.assumedActive),
  addedToSkillScore:false,addedToFixedAccount:false,
  mayAddToScenarioLedgerOnly:true,complete:false};
}
