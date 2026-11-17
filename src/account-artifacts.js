/**
 * Common main-effect formula used by TT2Master's artifact optimizer:
 * 1 + EffectPerLevel * Level^GrowthExpo.
 * Enchantment multiplies EffectPerLevel by EnchantmentMagnitude (Parrot's
 * community artifact optimizer notes; both source tables have this column).
 * The result is kept in log10 to handle scientific levels > 1e308.
 *
 * This is the main effect only, NOT the separate additive artifact/monument
 * damage or contextual multipliers (active spells, pets, hero damage, etc).
 */
const SCIENTIFIC=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/;
export function positiveLog10(value){
 if(typeof value!=="string"&&typeof value!=="number")return null;
 const s=String(value).trim();
 if(!SCIENTIFIC.test(s))return null;
 // Splitting the exponent avoids Number("1e9999") becoming Infinity.
 const matched=s.match(/^(\d+(?:\.\d*)?|\.\d+)(?:[Ee]([+-]?\d+))?$/);
 const a=Number(matched[1]),power=Number(matched[2]||0);
 if(!(a>0)||!Number.isFinite(a)||!Number.isSafeInteger(power))return null;
 return Math.log10(a)+power;
}
export function log10OnePlusPower(exponent){
 if(exponent===null||!Number.isFinite(exponent))return null;
 // log10(1 + 10^exponent), stable for tiny and enormous exponents.
 return exponent>16?exponent:exponent < -16?
  Math.pow(10,exponent)/Math.LN10:
  Math.log10(1+Math.pow(10,exponent));
}
export function computeArtifactEffect(catalog,level,enchanted=false){
 const lv=positiveLog10(level),per=positiveLog10(catalog?.perLevel??catalog?.effectPerLevel);
 const growth=Number(catalog?.growthExpo),max=Number(catalog?.maxLevel);
 if(lv===null||per===null||!Number.isFinite(growth)||growth<0||
   !Number.isFinite(max)||max<0)return {status:"invalid-level-or-scaling",log10:null};
 // Capped levels must be integers within the source limit. Zero max = uncapped.
 if(max>0){
  const numeric=Number(level);
  if(!Number.isSafeInteger(numeric)||numeric<1||numeric>max)
   return {status:"invalid-capped-level",log10:null};
 }
 const enchantMagnitude=enchanted?positiveLog10(catalog.enchantedMagnitude??catalog.enchantmentMagnitude):0;
 if(enchantMagnitude===null)return {status:"unknown-enchantment-magnitude",log10:null};
 const exponent=per+growth*lv+enchantMagnitude;
 const log10=log10OnePlusPower(exponent);
 const rawLog10=log10OnePlusPower(per+growth*lv);
 return {status:log10===null?"unrepresentable-scaling":"computed-main-effect",
  log10,rawLog10,
  enchantmentDeltaLog10:log10===null||rawLog10===null?null:log10-rawLog10,
  enchanted:enchanted===true,
  formula:"1 + (EffectPerLevel * EnchantmentMagnitude_if_enchanted) * Level^GrowthExpo",
  includesArtifactOrMonumentDamage:false};
}
const DIRECT_DAMAGE=new Set(["AllDamage","PetDamage","ClanShipDamage",
 "GoldGunDamage","UltraDaggerDamage","BurstDamageSkillAmount",
 "ShadowCloneSkillAmount"]);
const DIRECT_GOLD=new Set(["GoldAll","FairyGold","GoldBoss","GoldChesterson","ChestAmount"]);
export function isDirectBonusType(bonusType){
 return DIRECT_DAMAGE.has(bonusType)||DIRECT_GOLD.has(bonusType);
}
/** Preserve unsupported effects as evidence, never apply them generically. */
// Game Hive v5.10 (DevLog #88): these uncapped artifacts with a Boost
// icon also receive the appropriate amplifier; Titania receives BOTH.
// v5.19 additionally included White Dwarf (capped) in The Magnifier.
// Generic uncapped Dmg/Gold icon categories remain eligible separately.
const MAGNIFIER_EXTRAS=new Set([
 "Artifact10","Artifact76","Artifact101","Artifact6","Artifact102",
 "Artifact78","Artifact52","Artifact75","Artifact7","Artifact103",
 "Artifact41","Artifact96","Artifact11","Artifact77","Artifact100",
 "Artifact85"
]);
const TREASURE_EXTRAS=new Set(["Artifact53","Artifact97","Artifact9","Artifact77"]);
function artifactBoostFactor(group,id,catalog){
 const rows=group.get(id)||[];
 if(!rows.length)return {factor:1,status:"not-owned"};
 const levels=[...new Set(rows.map(x=>x.level).filter(x=>x!=null).map(String))];
 const enchants=[...new Set(rows.map(x=>x.enchanted).filter(x=>x!==undefined))];
 // Identical mirrored export records represent one owned amplifier.
 // Conflicting level / enchantment evidence remains unusable.
 if(levels.length!==1||enchants.length>1)
  return {factor:null,status:"conflicting-artifact-amplifier"};
 const effect=computeArtifactEffect(catalog[id],levels[0],enchants[0]===true);
 return {factor:effect.log10===null?null:Math.pow(10,effect.log10),status:effect.status};
}
/** The Magnifier and The Treasure boost the MAIN effect of supported
 * artifacts (not the separate additive Artifact Damage sum). TT2 patches
 * 5.10 and 5.19 explicitly include Heart of Storms, Sticky Fruit, Apollo
 * Orb, Hades Orb and The White Dwarf.
 */
export function calculatePermanentArtifactEffects(profile,catalog){
 const index=new Map(Object.values(catalog).flatMap(x=>[
  [x.id.toLowerCase(),x.id],[x.name.toLowerCase(),x.id]]));
 const records=profile?.sections?.artifacts?.records||[],group=new Map(),unknown=[];
 let explicitlyUnowned=0;
 for(const record of records){
  if(record.salvaged===true||record.owned===false){explicitlyUnowned++;continue;}
  const id=index.get(String(record.id).toLowerCase());
  if(!id){unknown.push({id:record.id,reason:"unknown-artifact-id"});continue;}
  if(!group.has(id))group.set(id,[]);
  group.get(id).push(record);
 }
 const entries=[],byType={};
 const truncated=profile?.sections?.artifacts?.truncated===true;
 const magnifier=artifactBoostFactor(group,"Artifact80",catalog);
 const treasure=artifactBoostFactor(group,"Artifact81",catalog);
 for(const [id,rows] of group){
  const data=catalog[id];
  const levels=[...new Set(rows.map(x=>x.level).filter(x=>x!=null).map(String))];
  const enchants=[...new Set(rows.map(x=>x.enchanted).filter(x=>x!==undefined))];
  const conflict=levels.length>1||enchants.length>1;
  const knownEnchantment=enchants.length===1;
  const enchanted=knownEnchantment?enchants[0]:null;
  const enhancementCanChangePower=positiveLog10(data.enchantedMagnitude)!==0;
  // An absent enchant flag is NOT evidence that the artifact is unenchanted.
  // For enchantable items keep the coefficient unknown and do not score it.
  const effect=conflict?{status:"conflicting-source-records",log10:null}:
   !knownEnchantment&&enhancementCanChangePower?
    {status:"unknown-enchantment-state",log10:null}:
    computeArtifactEffect(data,levels[0],enchanted===true);
  const boostDamage=(data.maxLevel===0&&data.bonusIcon==="Dmg")||
   MAGNIFIER_EXTRAS.has(id);
  const boostGold=(data.maxLevel===0&&data.bonusIcon==="Gold")||
   TREASURE_EXTRAS.has(id);
  const incompleteBoost=(boostDamage&&magnifier.factor===null)||
   (boostGold&&treasure.factor===null);
  const factor=(boostDamage?magnifier.factor:1)*(boostGold?treasure.factor:1);
  const amplifiedLog10=effect.log10===null||incompleteBoost?
   null:effect.log10*factor;
  // A truncated export is not a reliable account snapshot. Keep the
  // calculations for audit but do not score a potentially partial roster.
  const scoreable=!truncated&&amplifiedLog10!==null&&
   Number.isFinite(amplifiedLog10)&&isDirectBonusType(data.bonusType);
  if(scoreable)byType[data.bonusType]=(byType[data.bonusType]||0)+amplifiedLog10;
  entries.push({system:"artifacts",id,name:data.name,bonusType:data.bonusType,
   level:levels.length===1?levels[0]:null,
   enchanted,log10:amplifiedLog10,rawLog10:effect.rawLog10??null,
   unamplifiedLog10:effect.log10??null,
   magnifierApplied:boostDamage&&magnifier.factor!==1,
   treasureApplied:boostGold&&treasure.factor!==1,
   amplificationFactor:incompleteBoost?null:factor,
   enchantmentDeltaLog10:effect.enchantmentDeltaLog10===null||
    incompleteBoost?null:effect.enchantmentDeltaLog10*factor,
   appliedToScore:scoreable,status:truncated?
    "truncated-artifact-collection":incompleteBoost?
    "unknown-artifact-amplifier":conflict?"conflicting-source-records":
    scoreable?"computed-direct-effect":effect.status==="computed-main-effect"?
    "computed-unscored-interaction":effect.status,
   // DamageBonus is a distinct additive artifact-damage pool.
   artifactDamageModeled:false,complete:false});
 }
 return {entries,byType,unknown,truncated,
  // Source record IDs are canonicalized and counted once. This alone
  // cannot prove completeness when the input is truncated or has unknown IDs.
  ownedCountVerifiable:!truncated&&unknown.length===0,
  magnifier:{owned:group.has("Artifact80"),factor:magnifier.factor,status:magnifier.status},
  treasure:{owned:group.has("Artifact81"),factor:treasure.factor,status:treasure.status},
  recognized:entries.length,
  computed:entries.filter(x=>x.log10!==null).length,
  scored:entries.filter(x=>x.appliedToScore).length,
  duplicateRecords:records.length-unknown.length-explicitlyUnowned-entries.length,
  explicitlyUnowned,scoreExcludedBecauseTruncated:truncated,
  complete:false};
}
