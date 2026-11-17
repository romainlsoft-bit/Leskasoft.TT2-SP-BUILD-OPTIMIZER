/**
 * Explicit TT2 v8.0+ gemstone-effect ledger.
 *
 * The post-8.0 export contains 24 fixed gemstone identities; the numeric
 * primary/secondary multipliers are already computed by the game. Mystic
 * Research GemstoneLevel grants are a separate level resource and MUST NOT
 * be multiplied into those exported multipliers again.
 *
 * Duplicate identifiers, conflicting mirrors, truncated exports, missing
 * effect values and malformed scientific numbers are excluded from scoring.
 * Unknown bonus types remain in diagnostics, never assigned invented damage
 * reductions.
 */
const EFFECT=/^([A-Za-z][A-Za-z0-9_]*):((?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?)$/;
const DIRECT=new Set([
 "AllDamage","BossDamage","ClanShipDamage","PetDamage",
 "ShadowCloneSkillAmount","CloneDmg","BurstDamageSkillAmount",
 "UltraDaggerDamage","GoldGunDamage","GoldAll","FairyGold",
 "GoldBoss","GoldChesterson","ChestAmount"
]);
const EQUIPMENT=new Set([
 "AllEquipmentEffect","SwordBoost","HelmetBoost","ArmorBoost",
 "AuraBoost","SlashBoost"
]);
const cache=new WeakMap();
function positiveMultiplierLog10(value){
 const text=String(value??"").trim();
 const m=text.match(/^(\d+(?:\.\d*)?|\.\d+)(?:[Ee]([+-]?\d+))?$/);
 if(!m)return null;
 const significant=Number(m[1]),exponent=Number(m[2]??0);
 if(!(significant>0)||!Number.isFinite(significant)||
    !Number.isSafeInteger(exponent))return null;
 const log10=Math.log10(significant)+exponent;
 return Number.isFinite(log10)&&log10>=0?log10:null;
}
function normalizedLevel(value){
 if(value===undefined||value===null)return null;
 if(typeof value!=="string"&&typeof value!=="number")return "invalid";
 const s=String(value).trim();
 if(!/^\d+$/.test(s))return "invalid";
 const n=Number(s);
 return Number.isSafeInteger(n)&&n>=0?n:"invalid";
}
function recordsEqual(a,b){
 // Mirrors are accepted only when every observable number matches.
 const normalize=row=>JSON.stringify({
  level:normalizedLevel(row.level),
  primary:row.primary??null,
  secondary:Array.isArray(row.secondary)?row.secondary:
   typeof row.secondary==="string"?[row.secondary]:[]
 });
 return normalize(a)===normalize(b);
}
export function resolveGemstoneEvidence(profile){
 if(profile&&typeof profile==="object"&&cache.has(profile))return cache.get(profile);
 const source=profile?.sections?.gemstones;
 const unknown=[],entries=[],byType=Object.create(null);
 const records=Array.isArray(source?.records)?source.records:[];
 const groups=new Map();
 let duplicateMirrors=0,excluded=0;
 if(source?.truncated===true){
  unknown.push({system:"gemstones",reason:"truncated-gemstone-export"});
 }else{
  for(const row of records){
   const key=String(row.id??"").trim().toLowerCase();
   if(!key||key.length>90){
    unknown.push({system:"gemstones",id:String(row.id??"").slice(0,90),
     reason:"invalid-gemstone-id"});
    excluded++;continue;
   }
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(row);
  }
  for(const [key,items] of groups){
   const row=items[0],id=row.id;
   if(!items.every(x=>recordsEqual(row,x))){
    unknown.push({system:"gemstones",id,reason:"conflicting-gemstone-records"});
    excluded++;continue;
   }
   duplicateMirrors+=items.length-1;
   const level=normalizedLevel(row.level);
   if(level==="invalid"){
    unknown.push({system:"gemstones",id,reason:"invalid-gemstone-level"});
    excluded++;continue;
   }
   const bonuses=[
    ...(typeof row.primary==="string"?[{slot:"primary",value:row.primary}]:[]),
    ...(Array.isArray(row.secondary)?row.secondary:
       typeof row.secondary==="string"?[row.secondary]:[])
       .map((value,index)=>({slot:"secondary:"+index,value}))
   ];
   if(!bonuses.length){
    unknown.push({system:"gemstones",id,reason:"missing-explicit-bonus"});
    excluded++;continue;
   }
   const seen=new Set();
   for(const bonus of bonuses){
    const matched=bonus.value.match(EFFECT);
    if(!matched){
     unknown.push({system:"gemstones",id,slot:bonus.slot,reason:"invalid-bonus-format"});
     continue;
    }
    const type=matched[1],log10=positiveMultiplierLog10(matched[2]);
    if(log10===null){
     unknown.push({system:"gemstones",id,slot:bonus.slot,
      reason:"invalid-or-subunit-multiplier"});
     continue;
    }
    const identity=type+":"+matched[2];
    if(seen.has(identity)){
     unknown.push({system:"gemstones",id,slot:bonus.slot,
      reason:"repeated-identical-effect"});
     continue;
    }
    seen.add(identity);
    const route=DIRECT.has(type)?"direct":EQUIPMENT.has(type)?"equipment":"unresolved";
    if(route==="unresolved")
     unknown.push({system:"gemstones",id,slot:bonus.slot,
      bonusType:type,reason:"dependent-or-unknown-bonus-type"});
    entries.push({system:"gemstones",id,slot:bonus.slot,
     level,bonusType:type,log10,route,
     // Diagnostic evidence is not the same as a validated game formula.
     appliedToScore:route==="direct",appliedToEquipment:route==="equipment"});
    // Only recognized, explicitly exported bonuses enter a numeric account
    // score; conditional types must not receive guessed reductions.
    if(route!=="unresolved")byType[type]=(byType[type]||0)+log10;
   }
  }
 }
 const result={present:source?.present===true,recorded:records.length,
  recognized:groups.size,excluded,duplicateMirrors,
  entries,byType,unknown,
  directEffects:entries.filter(x=>x.route==="direct").length,
  equipmentEffects:entries.filter(x=>x.route==="equipment").length,
  unresolvedEffects:entries.filter(x=>x.route==="unresolved").length,
  // Explicit exported bonuses may already incorporate research/sets.
  researchLevelsAddedToExportedValues:false,
  effectiveGemstoneLevel:null,complete:false};
 if(profile&&typeof profile==="object")cache.set(profile,result);
 return result;
}
