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
/** Log10 of a positive scientific decimal, including very long mantissas.
 * Parses the leading 16 significant digits and the decimal position;
 * neither an overflowing mantissa nor an underflowing mantissa gets fed
 * through Number() before extracting the order of magnitude.
 */
export function positiveLog10(value){
 if(typeof value!=="string"&&typeof value!=="number")return null;
 const s=String(value).trim();
 if(s.length>10000||!SCIENTIFIC.test(s))return null;
 const matched=s.match(/^(\d+(?:\.\d*)?|\.\d+)(?:[Ee]([+-]?\d+))?$/);
 if(!matched)return null;
 const power=Number(matched[2]||0);
 if(!Number.isSafeInteger(power))return null;
 const parts=matched[1].split(".");
 const whole=parts.length===2?parts[0]:""+parts[0];
 const digits=(parts[0]||"")+(parts[1]||"");
 const first=digits.search(/[1-9]/);
 if(first<0)return null;
 // The position of the first nonzero digit determines the decimal order;
 // the leading 16 digits determine the normalized coefficient.
 const lead=digits.slice(first,first+16);
 const coefficient=Number(lead)/Math.pow(10,lead.length-1);
 const order=whole.length-first-1;
 const result=power+order+Math.log10(coefficient);
 return Number.isFinite(result)?result:null;
}
export function log10OnePlusPower(exponent){
 if(exponent===null||!Number.isFinite(exponent))return null;
 // log10(1 + 10^exponent), stable for tiny and enormous exponents.
 // Math.log10(1+x) loses most significant digits for x~=1e-12
 // because 1+x first rounds to the nearest representable double.
 // log1p preserves tiny artifact/monument marginal bonuses. For large
 // exponents use the identity log10(1+10^x)=x+log10(1+10^-x)
 // so no 10^x temporary can overflow.
 return exponent>16?
  exponent+Math.log1p(Math.pow(10,-exponent))/Math.LN10:
  Math.log1p(Math.pow(10,exponent))/Math.LN10;
}
/**
 * Main effect with log10(coefficient amplifier), avoiding construction of
 * 10^1000 (overflow) even when the final log10 bonus is finite.
 */
export function computeArtifactEffectWithLogAmplifier(
 catalog,level,enchanted=false,amplifierLog10=0
){
 const lv=positiveLog10(level);
 const per=positiveLog10(catalog?.perLevel??catalog?.effectPerLevel);
 const growth=Number(catalog?.growthExpo),max=Number(catalog?.maxLevel);
 if(lv===null||per===null||!Number.isFinite(growth)||growth<0||
    !Number.isFinite(max)||max<0)
  return {status:"invalid-level-or-scaling",log10:null};
 if(max>0){
  const numeric=Number(level);
  if(!Number.isSafeInteger(numeric)||numeric<1||numeric>max)
   return {status:"invalid-capped-level",log10:null};
 }
 const enchantMagnitude=enchanted?
  positiveLog10(catalog.enchantedMagnitude??catalog.enchantmentMagnitude):0;
 if(enchantMagnitude===null)
  return {status:"unknown-enchantment-magnitude",log10:null};
 if(typeof amplifierLog10!=="number"||!Number.isFinite(amplifierLog10))
  return {status:"invalid-main-effect-amplifier",log10:null};
 // The amplifier multiplies EffectPerLevel INSIDE 1 + coefficient*level^g.
 const rawExponent=per+growth*lv+amplifierLog10;
 const finalExponent=rawExponent+enchantMagnitude;
 const rawLog10=log10OnePlusPower(rawExponent);
 const log10=log10OnePlusPower(finalExponent);
 return {status:log10===null?"unrepresentable-scaling":"computed-main-effect",
  log10,rawLog10,
  enchantmentDeltaLog10:log10===null||rawLog10===null?null:
   log10-rawLog10,
  enchanted:enchanted===true,
  formula:"1 + (EffectPerLevel * EnchantmentMagnitude_if_enchanted) * Level^GrowthExpo",
  includesArtifactOrMonumentDamage:false};
}
/** Numeric factor API retained for callers with ordinary, finite values. */
export function computeArtifactEffect(catalog,level,enchanted=false,coefficientFactor=1){
 if(typeof coefficientFactor!=="number"||!Number.isFinite(coefficientFactor)||
    coefficientFactor<=0)
  return {status:"invalid-main-effect-amplifier",log10:null};
 return computeArtifactEffectWithLogAmplifier(catalog,level,enchanted,
  Math.log10(coefficientFactor));
}
const DIRECT_DAMAGE=new Set(["AllDamage","AllHelperDamage","BossDamage","TapDamage","CritDamage","PetDamage","ClanShipDamage",
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
 if(!rows.length)return {factor:1,log10:0,status:"not-owned"};
 const levels=[...new Set(rows.map(x=>x.level).filter(x=>x!=null).map(String))];
 const enchants=[...new Set(rows.map(x=>x.enchanted).filter(x=>x!==undefined))];
 // Identical mirrored export records represent one owned amplifier.
 // Conflicting level / enchantment evidence remains unusable.
 if(levels.length!==1||enchants.length>1)
  return {factor:null,log10:null,status:"conflicting-artifact-amplifier"};
 const effect=computeArtifactEffect(catalog[id],levels[0],enchants[0]===true);
 const log10=Number.isFinite(effect.log10)?effect.log10:null;
 const rawFactor=log10===null?null:Math.pow(10,log10);
 const factor=Number.isFinite(rawFactor)?rawFactor:null;
 // Ordinary factor may be unrepresentable while logarithmic source remains valid.
 return {factor,log10,status:effect.status};
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
  const incompleteBoost=(boostDamage&&magnifier.log10===null)||
   (boostGold&&treasure.log10===null);
  const amplifierLog10=incompleteBoost?null:
   (boostDamage?magnifier.log10:0)+(boostGold?treasure.log10:0);
  const rawFactor=amplifierLog10===null?null:Math.pow(10,amplifierLog10);
  const factor=Number.isFinite(rawFactor)?rawFactor:null;
  // Add source logs. Never multiply two potentially enormous JS numbers.
  const amplifiedEffect=effect.log10===null||incompleteBoost?null:
   computeArtifactEffectWithLogAmplifier(data,levels[0],
    enchanted===true,amplifierLog10);
  const amplifiedLog10=amplifiedEffect?.log10??null;
  // A truncated export is not a reliable account snapshot. Keep the
  // calculations for audit but do not score a potentially partial roster.
  const scoreable=!truncated&&amplifiedLog10!==null&&
   Number.isFinite(amplifiedLog10)&&isDirectBonusType(data.bonusType);
  if(scoreable)byType[data.bonusType]=(byType[data.bonusType]||0)+amplifiedLog10;
  entries.push({system:"artifacts",id,name:data.name,bonusType:data.bonusType,
   level:levels.length===1?levels[0]:null,
   enchanted,log10:amplifiedLog10,rawLog10:effect.rawLog10??null,
   unamplifiedLog10:effect.log10??null,
   magnifierApplied:boostDamage&&magnifier.log10!==null&&magnifier.log10>0,
   treasureApplied:boostGold&&treasure.log10!==null&&treasure.log10>0,
   amplificationFactor:factor,
   amplificationLog10:amplifierLog10,
   enchantmentDeltaLog10:amplifiedEffect?.enchantmentDeltaLog10??null,
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
