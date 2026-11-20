/**
 * Permanent completed-set effects, with Crafting Power's (CP-1)^Expo
 * improvement curve. This was previously only in the raw dependency catalog.
 *
 * TT2 8.4 EquipmentSetInfo.csv:
 *   effective bonus = Amount * Inc ^ ((CP-1) ^ Expo).
 * See community Crafting & Equipment Set Information (updated 2022) and the
 * actual per-row Amount/Inc/Expo values for 8.4.
 *
 * Work in log10; direct unconditional multipliers go to the account damage/
 * gold baseline, slot-specific equipment multipliers to the gear primary.
 * All OTHER types remain explicit unresolved/conditional evidence, never
 * inflated as generic damage. PerDay set effects are entirely separate.
 *
 * A missing CP permits only an identified baseline LOWER BOUND at CP=1.
 * This must never be called the user's exact bonus or a game-stage estimate.
 */
import {EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js?v=20261120-math-safety-r3";
import {resolveUniqueOwnership} from "./account-unique.js?v=20261120-math-safety-r3";
import {positiveLog10} from "./account-artifacts.js?v=20261120-math-safety-r3";

const DIRECT=new Set([
 "AllDamage","BossDamage","GoldAll","PetDamage","FairyGold",
 "GoldBoss","ChestAmount","GoldChesterson","UltraDaggerDamage",
 "GoldGunDamage","BurstDamageSkillAmount","ClanShipDamage",
 "ShadowCloneSkillAmount"
]);
const EQUIPMENT=new Set([
 "SwordBoost","HelmetBoost","ArmorBoost","AuraBoost","SlashBoost",
 "AllEquipmentEffect"
]);
/**
 * Multipliers of the form "×A per completed [rarity] equipment set".
 * Source: TT2 8.4 EquipmentSetInfo and the Game Hive 2.12 Mechanized Sword
 * devlog, TT2 community discussion about exponentiating by owned sets.
 * Only apply when a COMPLETE, non-truncated completed-set collection was
 * actually exported. We do not use currently held gear to infer full sets.
 */
const PER_SET=Object.freeze({
 DamagePerEquipmentSet:{kind:null,bonusType:"AllDamage"},
 DamagePerMythicSet:{kind:"Mythic",bonusType:"AllDamage"},
 DamagePerLegendarySet:{kind:"Legendary",bonusType:"AllDamage"},
 DamagePerUniqueSet:{kind:"Unique",bonusType:"AllDamage"},
 GoldPerLegendarySet:{kind:"Legendary",bonusType:"GoldAll"}
});
const SET_BY_ID=new Map(Object.keys(EQUIPMENT_SET_CATALOG)
 .map(id=>[id.toLowerCase(),id]));
const cache=new WeakMap();

function validCP(value){
 if(value===undefined||value===null||value==="")return null;
 const n=Number(value);
 return Number.isSafeInteger(n)&&n>=1&&n<=1000000?n:null;
}
export function resolveCraftingPower(profile,settings={}){
 const imported=validCP(profile?.stats?.craftingPower);
 const candidate=validCP(settings?.craftingPower);
 if(imported!==null)return {level:imported,
  source:"account-export",
  // If the UI still holds a value from a different import, prioritize the
  // actual account stat; do not silently rewrite the account export.
  conflictingSettings: candidate!==null&&candidate!==imported};
 if(candidate!==null&&candidate>1)return {level:candidate,
  source:"settings-fallback-unverified",conflictingSettings:false};
 return {level:null,source:"missing-crafting-power",
  conflictingSettings:false};
}
export function calculateCraftedSetMultiplier(effect,craftingPower){
 const amount=positiveLog10(effect?.amount);
 const inc=positiveLog10(effect?.inc);
 const expo=Number(effect?.expo);
 if(amount===null||inc===null||amount<0||inc<0||
  !Number.isFinite(expo)||expo<0||expo>4)
  return {log10:null,status:"unsupported-set-scaling"};
 const cp=validCP(craftingPower);
 if(cp===null)return {log10:amount,baseLog10:amount,
  improvementLog10:null,status:"base-lower-bound-CP-unknown",
  craftingPower:null,conservative:true};
 const effective=(cp-1)**expo;
 const improved=inc*effective;
 const log10=amount+improved;
 if(!Number.isFinite(log10))
  return {log10:null,status:"unrepresentable-crafting-scaling"};
 return {log10,baseLog10:amount,improvementLog10:improved,
  status:"crafting-power-formula",craftingPower:cp,conservative:false};
}

function canonicalOwnedSets(profile){
 const ids=[],unknown=[],sources=Object.create(null);
 const unique=resolveUniqueOwnership(profile);
 const candidates=[
  ...(profile?.ownedSetIds||[]).map(id=>({id,source:"completed-set-collection"})),
  ...unique.ownedIds.map(id=>({id,source:"owned-unique-equipment"}))
 ];
 const added=new Set();
 for(const row of candidates){
  const id=SET_BY_ID.get(String(row.id).toLowerCase());
  if(!id){unknown.push({id:row.id,reason:"unknown-set-id"});continue}
  if(!added.has(id)){added.add(id);ids.push(id)}
  (sources[id]??=new Set()).add(row.source);
 }
 return {ids,unknown,sources:Object.fromEntries(
  Object.entries(sources).map(([id,s])=>[id,[...s]])),
  uniqueOwned:unique.ownedCount};
}

export function resolvePermanentSetPower(profile,settings={}){
 if(!profile||typeof profile!=="object")
  return {entries:[],byType:{},appliedDirect:0,appliedEquipment:0,
   unknown:[],ownedSetCount:0,uniqueOwnedCount:0,complete:false,
   craftingPower:resolveCraftingPower(null,settings)};
 const cp=resolveCraftingPower(profile,settings);
 const key=cp.level===null?"unknown":"cp-"+cp.level;
 const existing=cache.get(profile);
 if(existing?.has(key))return existing.get(key);
 const owned=canonicalOwnedSets(profile);
 const entries=[],byType=Object.create(null),unknown=[...owned.unknown];
 // An exported completed-set roster is independent of the currently
 // equipped/owned gear and retains bonuses after all pieces are sold.
 // Only a full roster permits a verified exponent for per-set bonuses.
 const ownedRosterComplete=profile.sections?.equipmentSets?.present===true&&
  profile.sections?.equipmentSets?.truncated!==true&&owned.unknown.length===0;
 const ownedCounts={All:owned.ids.length,Mythic:0,Legendary:0,Unique:0,
  Rare:0,Event:0};
 for(const id of owned.ids){
  const kind=EQUIPMENT_SET_CATALOG[id]?.type;
  if(kind&&Object.hasOwn(ownedCounts,kind))ownedCounts[kind]++;
 }
 let appliedDirect=0,appliedEquipment=0,unresolved=0,conservative=0,
  countedEffectsApplied=0;
 for(const id of owned.ids){
  const set=EQUIPMENT_SET_CATALOG[id];
  if(!set||set.enabled===false)continue;
  for(const [index,bonus] of set.bonuses.entries()){
   if(bonus.perDay===true)continue;
   const counted=PER_SET[bonus.type]||null;
   const route=DIRECT.has(bonus.type)||counted?"direct":
    EQUIPMENT.has(bonus.type)?"equipment":"unresolved";
   const effect=route==="unresolved"?{log10:null,status:"conditional-or-additive-set-effect"}:
    calculateCraftedSetMultiplier(bonus,cp.level);
   const count=counted?(counted.kind===null?ownedCounts.All:
    ownedCounts[counted.kind]):null;
   const countKnown=!counted||ownedRosterComplete;
   // A multiplier per owned set is raised to the number of completed sets;
   // the multiplier is NOT added once per item or per inventory piece.
   // Without a complete set roster, its exponent is unknown, not zero.
   const outputType=counted?.bonusType??bonus.type;
   const log10=countKnown&&effect.log10!==null?
    effect.log10*(count??1):null;
   const apply=route!=="unresolved"&&log10!==null&&Number.isFinite(log10);
   const reason=!countKnown?"unknown-completed-set-count":effect.status;
   if(apply){
    byType[outputType]=(byType[outputType]||0)+log10;
    if(route==="direct")appliedDirect++;else appliedEquipment++;
    if(counted)countedEffectsApplied++;
    if(effect.conservative)conservative++;
   }else{
    unresolved++;
    if(route!=="unresolved")
     unknown.push({system:"sets",id,bonusType:bonus.type,reason});
   }
   entries.push({system:"sets",id,index,bonusType:outputType,
    sourceBonusType:bonus.type,kind:set.type,route,perDay:false,
    amount:bonus.amount,inc:bonus.inc,expo:bonus.expo,
    countKind:counted?(counted.kind??"All"):null,
    count:countKnown?count:null,countVerified:countKnown,
    log10:apply?log10:null,
    baseLog10:effect.baseLog10??null,
    craftingPower:effect.craftingPower??null,
    conservative:effect.conservative===true,
    status:apply?counted?"counted-equipment-set-multiplier":
     effect.status:"not-scored-"+reason,
    appliedToAccount:apply&&route==="direct",
    appliedToEquipment:apply&&route==="equipment",
    source:owned.sources[id]});
  }
 }
 const result={entries,byType,unknown,craftingPower:cp,
  recognizedSets:owned.ids.length,ownedSetCount:owned.ids.length,
  uniqueOwnedCount:owned.uniqueOwned,
  appliedDirect,appliedEquipment,unresolved,conservative,
  countedEffectsApplied,ownedRosterComplete,ownedCounts,
  perDayProcessedHere:false,
  ownedSetSectionTruncated:profile.sections?.equipmentSets?.truncated===true,
  complete:false};
 const cacheFor=existing||new Map();
 cacheFor.set(key,result);if(!existing)cache.set(profile,cacheFor);
 return result;
}
