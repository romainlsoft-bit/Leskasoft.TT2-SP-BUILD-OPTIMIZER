/**
 * TT2 source-reduced, boss-push equipment multipliers.
 *
 * Exact primary/secondary effect identities only. Reductions.TapDmg and
 * AllHelperDmg are the tracked rawrzcookie conversion tables. These are
 * damage-conversion coefficients, NOT arbitrary optimization weights.
 * Chance, crit, spell uptime, conditional hero families and per-resource
 * equipment effects deliberately remain unscored.
 */
import {reductions} from "../vendor/reductions.js";
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
const PER_GOLD=Object.freeze({
 FairyGold:"Fairy",
 GoldBoss:"HoG",
 ChestAmount:"Chesterson",GoldChesterson:"Chesterson"
});
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
 if(type==="GoldAll")return {weight,status:GOLD_TYPES.includes(gold)?"direct":"inapplicable",
  source:"explicit-gold-family"};
 if(Object.hasOwn(PER_GOLD,type))return {
  weight:gold===PER_GOLD[type]?weight:0,
  status:gold===PER_GOLD[type]?"direct":"inapplicable",
  source:"explicit-gold-family"};
 if(Object.hasOwn(REDUCED,type)){
  const key=REDUCED[type];
  const ratio=reductions[key]?.[damage];
  if(DAMAGES.includes(damage)&&Number.isFinite(ratio)&&ratio>=0&&ratio<=1)
   return {weight:ratio,status:ratio>0?"converted":"inapplicable",
    source:"vendor/reductions.js:"+key};
  return {weight:null,status:"unknown-reduction",source:"vendor/reductions.js:"+key};
 }
 if(type==="NonBossDamage")return {weight:0,status:"inapplicable",source:"boss-push-scenario"};
 return {weight:null,status:"unverified-dependency",source:null};
}
export const EQUIPMENT_AURA_TARGETS=Object.freeze({
 SwordBoost:"Sword",SwordPrimaryEffect:"Sword",
 HelmetBoost:"Helmet",HelmetPrimaryEffect:"Helmet",
 SlashBoost:"Slash",SlashPrimaryEffect:"Slash"
});
