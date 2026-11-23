/**
 * TT2 source-reduced, boss-push equipment multipliers.
 *
 * Exact primary/secondary effect identities only. Reductions.TapDmg and
 * AllHelperDmg are the tracked rawrzcookie conversion tables. These are
 * damage-conversion coefficients, NOT arbitrary optimization weights.
 * Chance, crit, spell uptime, conditional hero families and per-resource
 * equipment effects deliberately remain unscored.
 */
import {reductions} from "../vendor/reductions.js?v=20261123-native-attack-r1";
import {goldSourceReduction} from "./gold-source-reductions.js?v=20261123-native-attack-r1";
const DAMAGES=["Pet","Clan Ship","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"];
const GOLD_TYPES=["Fairy","HoG","Chesterson"];
const UNIVERSAL=new Set(["AllDamage","BossDamage"]);
const PER_DAMAGE=Object.freeze({
 PetDamage:"Pet",
 ClanShipDamage:"Clan Ship",
 ShadowCloneSkillAmount:"Shadow Clone",CloneDmg:"Shadow Clone",
 ShadowCloneDamage:"Shadow Clone",
 BurstDamageSkillAmount:"Heavenly Strike",HeavenlyStrikeDamage:"Heavenly Strike",
 UltraDaggerDamage:"Dagger",DaggerDamage:"Dagger",
 GoldGunDamage:"Gold Gun"
});
const DIRECT_GOLD_EFFECTS=new Set(["FairyGold","GoldBoss","ChestAmount","GoldChesterson"]);
const REDUCED=Object.freeze({
 TapDamage:"TapDmg",TapDmg:"TapDmg",
 AllHelperDamage:"AllHelperDmg",AllHeroDamage:"AllHelperDmg",HeroDamage:"AllHelperDmg"
});
export function equipmentEffectReduction(type,settings={}){
 const damage=settings.damage,gold=settings.gold;
 const weight=Math.max(0,Number(settings.goldWeight)||0);
 if(UNIVERSAL.has(type))return {weight:1,status:"direct",source:"direct-boss-damage"};
 if(Object.hasOwn(PER_DAMAGE,type))return {
  weight:damage===PER_DAMAGE[type]?1:0,
  status:damage===PER_DAMAGE[type]?"direct":"inapplicable",
  source:"explicit-damage-family"};
 if(type==="GoldAll"||DIRECT_GOLD_EFFECTS.has(type)){
  const conversion=goldSourceReduction(type,gold);
  const scoreWeight=GOLD_TYPES.includes(gold)?weight*conversion:0;
  return {weight:scoreWeight,
   status:scoreWeight>0?"direct":"inapplicable",
   source:"shared-gold-source-reduction"};
 }
 if(type==="ChestersonGoldStageAmount")return {
  weight:null,status:"unverified-duration",source:"chesterson-duration-not-gold-multiplier"};
 if(Object.hasOwn(REDUCED,type)){
  const key=REDUCED[type];
  const ratio=reductions[key]?.[damage];
  if(DAMAGES.includes(damage)&&Number.isFinite(ratio)&&ratio>=0&&ratio<=1)
   return {weight:ratio,status:ratio>0?"converted":"inapplicable",
    source:"vendor/reductions.js:"+key};
  return {weight:null,status:"unknown-reduction",source:"vendor/reductions.js:"+key};
 }
 // Angelic Radiance guarantees a Heavenly Strike critical hit. Other
 // damage sources cannot apply Crit Damage unconditionally.
 if(type==="CritDamage"||type==="CriticalDamage")
  return damage==="Heavenly Strike"?
   {weight:1,status:"converted",source:"guaranteed-heavenly-strike-critical-hit"}:
   {weight:null,status:"unverified-dependency",source:"crit-chance-not-verified"};
 if(type==="NonBossDamage")return {weight:0,status:"inapplicable",source:"boss-push-scenario"};
 return {weight:null,status:"unverified-dependency",source:null};
}
export const EQUIPMENT_AURA_TARGETS=Object.freeze({
 SwordBoost:"Sword",SwordPrimaryEffect:"Sword",
 HelmetBoost:"Helmet",HelmetPrimaryEffect:"Helmet",
 SlashBoost:"Slash",SlashPrimaryEffect:"Slash"
});
