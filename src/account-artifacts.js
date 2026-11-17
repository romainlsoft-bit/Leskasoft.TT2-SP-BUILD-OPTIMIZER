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
const DIRECT_GOLD=new Set(["GoldAll","FairyGold","GoldBoss","GoldChesterson"]);
export function isDirectBonusType(bonusType){
 return DIRECT_DAMAGE.has(bonusType)||DIRECT_GOLD.has(bonusType);
}
/** Preserve unsupported effects as evidence, never apply them generically. */
export function calculatePermanentArtifactEffects(profile,catalog){
 const index=new Map(Object.values(catalog).flatMap(x=>[
  [x.id.toLowerCase(),x.id],[x.name.toLowerCase(),x.id]]));
 const records=profile?.sections?.artifacts?.records||[],group=new Map(),unknown=[];
 for(const record of records){
  const id=index.get(String(record.id).toLowerCase());
  if(!id){unknown.push({id:record.id,reason:"unknown-artifact-id"});continue;}
  if(!group.has(id))group.set(id,[]);
  group.get(id).push(record);
 }
 const entries=[],byType={};
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
  const scoreable=effect.log10!==null&&isDirectBonusType(data.bonusType);
  if(scoreable)byType[data.bonusType]=(byType[data.bonusType]||0)+effect.log10;
  entries.push({system:"artifacts",id,name:data.name,bonusType:data.bonusType,
   level:levels.length===1?levels[0]:null,
   enchanted,log10:effect.log10??null,rawLog10:effect.rawLog10??null,
   enchantmentDeltaLog10:effect.enchantmentDeltaLog10??null,
   appliedToScore:scoreable,status:conflict?"conflicting-source-records":
    scoreable?"computed-direct-effect":effect.status==="computed-main-effect"?
    "computed-unscored-interaction":effect.status,
   // DamageBonus is a distinct additive artifact-damage pool.
   artifactDamageModeled:false,complete:false});
 }
 return {entries,byType,unknown,recognized:entries.length,
  computed:entries.filter(x=>x.log10!==null).length,
  scored:entries.filter(x=>x.appliedToScore).length,
  duplicateRecords:records.length-unknown.length-entries.length,
  complete:false};
}
