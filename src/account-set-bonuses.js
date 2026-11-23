/**
 * Source-derived PerDay equipment set effects.
 * EquipmentSetInfo.csv exposes Amount, Inc=1, Expo=1, PerDay=true,
 * and MaxValue. For these specific rows bonus(day)=min(Amount^day,MaxValue).
 * No bonus is calculated without a reliable date from the TT2 export.
 *
 * Only direct damage/gold types can enter the current account score.
 * Conditional, skill boost, crit and equipment dependent types remain
 * visible but unscored until their conversion to build power is verified.
 */
import {EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js?v=20261123-ti-measured-r1";
import {resolveSetCompletionDates} from "./account-temporal.js?v=20261123-ti-measured-r1";

const DIRECT_TYPES=new Set([
 "AllDamage","GoldAll","PetDamage","FairyGold","ChestAmount","UltraDaggerDamage",
 "GoldGunDamage","BurstDamageSkillAmount"
]);
const safeLog=value=>{
 const n=Number(value);
 return Number.isFinite(n)&&n>0?Math.log10(n):null;
};
export function extractTimedSetPower(profile,now=new Date()){
 const dates=resolveSetCompletionDates(profile,now);
 const entries=[],byType=Object.create(null);
 let calculated=0,applied=0,omitted=0;
 // Duplicate records must never multiply a permanent account bonus.
 for(const id of new Set(profile?.ownedSetIds||[])){
  const set=EQUIPMENT_SET_CATALOG[id];
  if(!set)continue;
  for(const effect of set.bonuses){
   if(effect.perDay!==true)continue;
   const days=dates[id]?.days??null;
   const amount=Number(effect.amount),inc=Number(effect.inc),expo=Number(effect.expo);
   const maxLog=safeLog(effect.maxValue);
   // Reject any CSV values that don't implement the known daily scaling.
   const formulaValid=Number.isFinite(amount)&&amount>1&&inc===1&&expo===1&&maxLog!==null&&maxLog>=0;
   const log10=formulaValid&&Number.isSafeInteger(days)&&days>=0
    ?Math.min(days*Math.log10(amount),maxLog):null;
   const scoring=log10!==null&&DIRECT_TYPES.has(effect.type);
   const status=log10===null
    ?days===null?"ignored-missing-set-completion-date":"ignored-unsupported-daily-scaling"
    :scoring?"calculated-direct-type":"calculated-unscored-interaction";
   if(log10!==null)calculated++;else omitted++;
   if(scoring){byType[effect.type]=(byType[effect.type]||0)+log10;applied++;}
   entries.push({setId:id,bonusType:effect.type,days,log10,
    maxValue:effect.maxValue,formulaValid,status,appliedToScore:scoring});
  }
 }
 return {entries,byType,calculated,applied,omitted,
  source:"TT2 8.4 EquipmentSetInfo.csv PerDay/Amount/MaxValue",
  complete:false};
}
