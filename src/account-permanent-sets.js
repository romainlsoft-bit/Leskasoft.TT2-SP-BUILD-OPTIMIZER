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
import {EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js";
import {resolveUniqueOwnership} from "./account-unique.js";
import {positiveLog10} from "./account-artifacts.js";

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
 let appliedDirect=0,appliedEquipment=0,unresolved=0,conservative=0;
 for(const id of owned.ids){
  const set=EQUIPMENT_SET_CATALOG[id];
  if(!set||set.enabled===false)continue;
  for(const [index,bonus] of set.bonuses.entries()){
   if(bonus.perDay===true)continue;
   const route=DIRECT.has(bonus.type)?"direct":
    EQUIPMENT.has(bonus.type)?"equipment":"unresolved";
   const effect=route==="unresolved"?{log10:null,status:"conditional-or-additive-set-effect"}:
    calculateCraftedSetMultiplier(bonus,cp.level);
   const apply=route!=="unresolved"&&effect.log10!==null;
   if(apply){
    byType[bonus.type]=(byType[bonus.type]||0)+effect.log10;
    if(route==="direct")appliedDirect++;else appliedEquipment++;
    if(effect.conservative)conservative++;
   }else{
    unresolved++;
    if(route!=="unresolved")
     unknown.push({system:"sets",id,bonusType:bonus.type,reason:effect.status});
   }
   entries.push({system:"sets",id,index,bonusType:bonus.type,
    kind:set.type,route,perDay:false,
    amount:bonus.amount,inc:bonus.inc,expo:bonus.expo,
    log10:apply?effect.log10:null,
    baseLog10:effect.baseLog10??null,
    craftingPower:effect.craftingPower??null,
    conservative:effect.conservative===true,
    status:apply?effect.status:"not-scored-"+effect.status,
    appliedToAccount:apply&&route==="direct",
    appliedToEquipment:apply&&route==="equipment",
    source:owned.sources[id]});
  }
 }
 const result={entries,byType,unknown,craftingPower:cp,
  recognizedSets:owned.ids.length,ownedSetCount:owned.ids.length,
  uniqueOwnedCount:owned.uniqueOwned,
  appliedDirect,appliedEquipment,unresolved,conservative,
  perDayProcessedHere:false,
  ownedSetSectionTruncated:profile.sections?.equipmentSets?.truncated===true,
  complete:false};
 const cacheFor=existing||new Map();
 cacheFor.set(key,result);if(!existing)cache.set(profile,cacheFor);
 return result;
}
