/**
 * Source-specific Legacy/Exotic pet bonus amplification.
 * Heart of Storms / Apollo Orb (Legacy) and Sticky Fruit / Hades Orb
 * (Exotic) boost the corresponding *pet's own bonus*.
 * Raw pet-attack damage, equipment pet bonuses and seasonal Pet bonuses
 * are separate mechanics, never replaced by these four artifacts.
 */
import {ARTIFACT_CATALOG} from "../vendor/account-catalog.js?v=20261120-simple-ui-r5";
import {calculatePermanentArtifactEffects} from "./account-artifacts.js?v=20261120-simple-ui-r5";
import {resolveGemstoneEvidence} from "./account-gemstones.js?v=20261120-simple-ui-r5";
const TYPES=Object.freeze({
 Legacy:Object.freeze({damage:"LegacyPetDamageEffect",gold:"LegacyPetGoldEffect"}),
 Exotic:Object.freeze({damage:"ExoticPetDamageEffect",gold:"ExoticPetGoldEffect"})
});
const cache=new WeakMap();
const EXOTIC_EQUIPMENT_PETS=new Set(["Pet26","Pet27","Pet28","Pet29","Pet30"]);
/** Rune Heart/EquipmentPetEffect target IDs are narrower than the shared
 * SwordBoost/HelmetBoost/etc type: no TT2 8.4 evidence verifies seasonal
 * pet cross-amplification. Reuse the same predicate in active and passive
 * paths to prevent contradictory scoring.
 */
export function verifiedEquipmentPetAmplifierTarget(pet){
 return Boolean(pet&&EXOTIC_EQUIPMENT_PETS.has(pet.id));
}
export function petTier(pet){
 if(!pet)return null;
 if(pet.tier==="Transcendent"||String(pet.id).startsWith("SeasonalPet"))return "Transcendent";
 return Number(String(pet.id).slice(3))>=17?"Exotic":"Legacy";
}
export function petArtifactAmplifiers(profile){
 if(!profile)return {byTier:{Legacy:{damage:0,gold:0},Exotic:{damage:0,gold:0}},unknown:[],recognized:0};
 if(cache.has(profile))return cache.get(profile);
 const artifact=calculatePermanentArtifactEffects(profile,ARTIFACT_CATALOG);
 const gemstone=resolveGemstoneEvidence(profile);
 const byTier={},unknown=[];
 let recognized=0;
 for(const [tier,kinds] of Object.entries(TYPES)){
  byTier[tier]={damage:0,gold:0};
  for(const [kind,type] of Object.entries(kinds)){
   const row=artifact.entries.find(e=>e.bonusType===type);
   if(!row)continue;
   recognized++;
   if(row.log10===null||!Number.isFinite(row.log10)){
    unknown.push({tier,kind,id:row.id,reason:row.status});continue;
   }
   byTier[tier][kind]=row.log10;
  }
 }
 // Gemstone pet-effect multipliers are explicit exported values; they
 // amplify the same family as the matching artifact. Do not multiply by
 // GemstoneLevel research again.
 for(const [tier,kinds] of Object.entries(TYPES))
  for(const [kind,type] of Object.entries(kinds))
   byTier[tier][kind]+=gemstone.entries.filter(x=>x.bonusType===type)
    .reduce((total,row)=>total+row.log10,0);
 const rune=artifact.entries.find(x=>x.bonusType==="EquipmentPetEffect");
 const equipmentPetEffectLog10=rune?
  (Number.isFinite(rune.log10)?rune.log10:null):0;
 if(rune&&equipmentPetEffectLog10===null)
  unknown.push({tier:"equipment",kind:"pet",id:rune.id,reason:rune.status});
 const gemRune=gemstone.entries.filter(x=>x.bonusType==="EquipmentPetEffect")
  .reduce((total,row)=>total+row.log10,0);
 const result={byTier,unknown,recognized,
  equipmentPetEffectLog10:equipmentPetEffectLog10===null?null:
   equipmentPetEffectLog10+gemRune,
  exportedGemstoneAmplifiers:gemstone.entries.filter(x=>x.route==="pet").length};
 cache.set(profile,result);return result;
}
export function logPassivePetMultiplier(fullLog,level){
 if(!(level>=5)||!Number.isFinite(fullLog)||fullLog<0)return 0;
 const fraction=Math.min(1,Math.floor(level/5)*.05);
 if(fraction>=1)return fullLog;
 // Never construct an enormous 10^fullLog in floating point.
 if(fullLog>15)return fullLog+Math.log10(fraction);
 return Math.log10(1+fraction*Math.expm1(fullLog*Math.LN10));
}
