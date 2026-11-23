/**
 * TT2 8.4 attack-channel evidence, for ALL six damage builds.
 *
 * Damage modifiers, Titan Skip, Stage Skip, cooldowns and activation
 * conditions are DISTINCT mechanics. This module reports the source-table
 * fields independently. It must never add Stage Skip to damage, assume a
 * burst is always active, predict stages, or alter the DP objective.
 *
 * Source catalog: pinned SkillTreeInfo2.0.csv via vendor/skills.js.
 * Skip mechanics: https://e9wiki.com/tt2/en/guides/stage-skip-and-titan-skip
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-native-adaptive-r1";
import {spellSelectionEvidence} from "./spell-scenarios.js?v=20261123-native-adaptive-r1";

// One source-specific channel per actual attack type, not one Pet-only rule.
// "charged" and "conditional" mean the listed modifier does NOT establish
// ordinary hit damage or uptime. The names are stable, untranslated IDs.
const FIELDS=Object.freeze({
 "Clan Ship":[
  {id:"clan-ship-shot",label:"Clan Ship shot",role:"normal",
   skill:"ClanShipDmg",bonus:["A","ClanShipDamage"],
   skip:[["ClanShipDmg","B","titan","ClanShipTitanSkip"],
         ["ClanShipStun","C","stage","ClanShipStageSkip"]]},
  {id:"thunder-volley",label:"Thunder Volley",role:"burst",
   spell:"ThunderVolley",skill:"ClanShipVoltage",
   bonus:["B","ThunderVolleySkillSpecialDamage"],
   skip:[["ClanShipStun","C","stage","ClanShipStageSkip"]]}
 ],
 "Pet":[
  {id:"pet-attack",label:"Pet attack",role:"normal",
   skill:"PetDmg",bonus:["A","PetDamage"],
   skip:[["PetQTE","B","titan","PetAttackTitanSkip"],
         ["BossDmgQTE","C","stage","PetAttackStageSkip"]]},
  {id:"lightning-burst",label:"Lightning Burst",role:"burst",
   skill:"PetQTE",bonus:["A","PetAttackQTEDamage"],
   skip:[["PetQTE","C","stage","PetQTEStageSkip"],
         ["PetQTE","B","titan","PetAttackTitanSkip"]]},
  {id:"flash-zip-charged",label:"Flash Zip charged pet",role:"charged",
   skill:"BossDmgQTE",bonus:["A","PetBossQTEDamage"],
   skip:[["BossDmgQTE","C","stage","PetAttackStageSkip"]],
   mechanics:[["BossDmgQTE","B","cooldown-multiplier","PetQTECooldownMult"]]}
 ],
 "Shadow Clone":[
  {id:"shadow-clone",label:"Shadow Clone",role:"normal",spell:"ShadowClone",
   skill:"CloneDmg",bonus:["A","ShadowCloneSkillAmount"],
   skip:[["CloneSkillBoost","B","titan","ShadowCloneTitanSkip"],
         ["CloneSkillBoost","C","stage","ShadowCloneStageSkip"]],
   mechanics:[["CloneSkillBoost","D","boss-skip-chance-source","ShadowCloneBossSplash"]]},
  {id:"nightmare-puppeteer",label:"Nightmare Puppeteer",role:"burst",
   spell:"ShadowClone",skill:"PuppetMaster",
   bonus:["A","ShadowCloneSkillSpecialDamage"],
   skip:[["CloneSkillBoost","C","stage","ShadowCloneStageSkip"]]}
 ],
 "Heavenly Strike":[
  {id:"heavenly-strike",label:"Heavenly Strike",role:"burst",
   spell:"BurstDamage",skill:"BurstSkillBoost",
   bonus:["A","BurstDamageSkillAmount"],
   skip:[["BurstSkillBoost","B","titan","BurstSkillTitanSkip"],
         ["BurstSkillMana","B","stage","BurstSkillStageSkip"]]}
 ],
 "Dagger":[
  {id:"dagger-attack",label:"Dagger",role:"normal",skill:"UltraDagger",
   bonus:["A","UltraDaggerDamage"],
   skip:[["UltraDagger","C","titan","UltraDaggerTitanSkip"],
         ["PoisonedBlade","C","stage","UltraDaggerStageSkip"]]},
  {id:"phantom-blades",label:"Phantom Blades",role:"conditional",
   skill:"PhantomBlades",bonus:["A","UltraDaggerDamage"],
   skip:[["PoisonedBlade","C","stage","UltraDaggerStageSkip"]]}
 ],
 "Gold Gun":[
  {id:"gold-gun",label:"Gold Gun",role:"normal",skill:"GoldGun",
   bonus:["A","GoldGunDamage"],
   skip:[["GoldGun","B","titan","GoldGunTitanSkip"]]},
  {id:"magnum-opus",label:"Magnum Opus",role:"burst",skill:"MagnumOpus",
   bonus:["A","MagnumOpusDamage"],
   skip:[["MagnumOpus","B","stage","GoldGunStageSkip"]]},
  {id:"golden-missile-skip",label:"Golden Missile skip",role:"skip-only",
   spell:"GoldenMissile",skill:"ExplosivesExpert",
   skip:[["ExplosivesExpert","B","stage","GoldenMissileStageSkip"]],
   mechanics:[["ExplosivesExpert","A","cooldown-source","GoldenMissileSkillCooldown"]]}
 ]
});

export const ATTACK_BUILD_TYPES=Object.freeze(Object.keys(FIELDS));
/** Build-generic Stage Skip source choices for an explicit minimum target.
 * All choices expose the SOURCE-local addition only, never a guessed global
 * Stage Skip or a claim that the attack can actually kill the boss.
 */
export function sourcedStageSkipChannels(damage){
 if(!Object.hasOwn(FIELDS,damage))
  throw new RangeError("Unknown damage source: "+String(damage));
 // Charged is a temporary Pet damage state, not a separate hit.
 // It must not be offered as an attack-specific Stage Skip target.
 return FIELDS[damage].filter(spec=>spec.role!=="charged").flatMap(spec=>(spec.skip||[])
  .filter(row=>row[2]==="stage")
  .map(([skillId,column,,bonusType])=>({
   id:spec.id,label:spec.label,role:spec.role,
   sourceSkillId:skillId,sourceColumn:column,sourceBonusType:bonusType,
   requiredSpell:spec.spell??null
  })));
}

const MAX_LEVEL=id=>Number(skillInfo[id]?.MaxLevel);
function levelFor(levels,id){
 const value=Number(levels?.[id]??0),max=MAX_LEVEL(id);
 if(!Number.isSafeInteger(value)||value<0||!Number.isSafeInteger(max)||value>max)
  throw new RangeError("Invalid source attack level: "+id);
 return value;
}
function readField(levels,[id,key,kind,bonusType]){
 const info=skillInfo[id];
 if(!info||info["BonusType"+key]!==bonusType)
  throw new Error("Attack evidence source mismatch: "+id+" "+key+" "+bonusType);
 // BonusTypeD uses a source CONSTANT (BonusAmountD), not a level D1
 // column. Reading D1 would silently erase Shadow Clone boss-skip data.
 const level=levelFor(levels,id),sourceField=key==="D"?"BonusAmountD":key+level;
 const raw=info[sourceField];
 const number=typeof raw==="number"?raw:
  typeof raw==="string"&&raw.trim()!==""&&raw!=="-"?Number(raw):NaN;
 return {skillId:id,skillName:info.Name,level,sourceField,
  sourceBonusType:bonusType,kind,
  value:Number.isFinite(number)?number:null,
  status:level===0?"not-invested":Number.isFinite(number)?"source-tabulated":"unavailable-source-row"};
}
function spellGate(spec,selection){
 if(!spec.spell)return "not-required";
 if(!selection.valid)return "unverified-loadout";
 return selection.ids.includes(spec.spell)?"equipped":"not-equipped";
}
export function attackChannelEvidence(settings={},levels={}){
 const damage=settings.damage;
 if(!Object.hasOwn(FIELDS,damage))
  throw new RangeError("Unknown damage source: "+String(damage));
 const selection=spellSelectionEvidence(settings);
 const channels=FIELDS[damage].map(spec=>{
  const level=levelFor(levels,spec.skill);
  const main=spec.bonus?
   readField(levels,[spec.skill,spec.bonus[0],"damage-modifier",spec.bonus[1]]):null;
  const skip=(spec.skip||[]).map(row=>readField(levels,row));
  const mechanics=(spec.mechanics||[]).map(row=>readField(levels,row));
  const spell=spellGate(spec,selection);
  const available=level>0&&spell!=="not-equipped"&&spell!=="unverified-loadout";
  return {id:spec.id,label:spec.label,damage,role:spec.role,
   skillId:spec.skill,level,requiredSpell:spec.spell??null,spellStatus:spell,
   status:level===0?"not-invested":spell==="not-equipped"?"spell-not-equipped":
    spell==="unverified-loadout"?"unverified-spell-selection":"source-eligible",
   sourceDamageModifier:main,
   // These are talent multipliers, NOT complete hit damage or DPS.
   sourceModifierLog10:available&&main?.value>0?Math.log10(main.value):null,
   skip,mechanics,
   actualActivationVerified:false,actualDamagePerHitVerified:false,
   realStageSkipVerified:false};
 });
 return {schema:"tt2-attack-channel-evidence-v1",damage,gold:settings.gold??null,
  channels,attackCount:channels.length,allSixBuildsSupported:true,
  sourceDataVersion:"8.4.0",importedVersion:settings.importedVersion??null,
  selectedSpellsVerified:selection.valid,spellLoadoutReason:selection.reason,
  sourceModifiersAreNotIndependentDps:true,
  cooldownAndSkipNeverAddedToDamage:true,
  scoreChanged:false,stagePredictionValidated:false,
  notes:"Skill-table evidence, not an active-combat or stage prediction."};
}
/** Before/after comparisons across identical channels, never a stage forecast.
 * All six builds and all three gold choices use the same implementation.
 */
export function compareAttackChannels(settings,before={},after={}){
 const a=attackChannelEvidence(settings,before);
 const b=attackChannelEvidence(settings,after);
 return {schema:"tt2-attack-channel-delta-v1",damage:a.damage,gold:a.gold,
  channels:b.channels.map((channel,index)=>{
   const previous=a.channels[index];
   const skip=channel.skip.map((entry,j)=>({
    skillId:entry.skillId,kind:entry.kind,
    before:previous.skip[j].value,after:entry.value,
    delta:entry.value===null||previous.skip[j].value===null?null:
     entry.value-previous.skip[j].value
   }));
   const delta=channel.sourceModifierLog10!==null&&
    previous.sourceModifierLog10!==null?
    channel.sourceModifierLog10-previous.sourceModifierLog10:null;
   return {id:channel.id,label:channel.label,role:channel.role,
    priorLevel:previous.level,level:channel.level,
    sourceDamageModifierLog10Delta:delta,skip};
  }),
  stageGainPredicted:false,scoreChanged:false};
}

/** Native-tabulated direct modifiers for an explicitly selected killing
 * attack. Do not offer charged states, skip-only paths, or conditional
 * attacks with no verified activation. The B column of Thunder Volley is
 * intentionally different from the A column of its source talent.
 */
export function sourcedDamageChannels(damage){
 if(!Object.hasOwn(FIELDS,damage))
  throw new RangeError("Unknown damage source: "+String(damage));
 return FIELDS[damage].filter(spec=>
  ["normal","burst"].includes(spec.role)&&spec.bonus).map(spec=>{
   const [column,bonusType]=spec.bonus;
   const row=skillInfo[spec.skill];
   if(!row||row["BonusType"+column]!==bonusType)
    throw new Error("Native attack channel source mismatch: "+spec.id);
   return {id:spec.id,label:spec.label,role:spec.role,
    sourceSkillId:spec.skill,sourceSkillName:row.Name,
    sourceColumn:column,sourceBonusType:bonusType,
    requiredSpell:spec.spell??null,
    isNotCompleteAttackDps:true,activationUnverified:true};
  });
}
