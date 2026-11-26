/**
 * Strict boundary for browser-controlled optimizer preferences.
 * The skill catalogue, not a build link or localStorage, supplies identifiers
 * and MaxLevel. Keep this module browser/Node compatible and free of UI state.
 */
export const MAX_SHARED_BUILD_HASH=32768;
export const MAX_SAVED_STATE_TEXT=4_000_000;
const isRecord=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const asNumber=(value,low,high,fallback,strict=false)=>{
 if(value===undefined||value===null||value==="")return fallback;
 if((typeof value!=="number"&&typeof value!=="string")||
   (typeof value==="string"&&!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim()))||
   !Number.isFinite(Number(value))||Number(value)<low||Number(value)>high){
  if(strict)throw new TypeError("Invalid shared build numeric parameter");
  return fallback;
 }
 return Number(value);
};
function levels(value,skills,strict){
 if(!isRecord(value)){
  if(strict)throw new TypeError("Skill levels must be an object");
  return {};
 }
 const cleaned={};
 for(const id of Object.keys(value)){
  if(!own(skills,id)){
   if(strict)throw new TypeError("Unknown skill in shared build");
   continue;
  }
  const input=value[id];
  const max=Number(skills[id].MaxLevel);
  const number=asNumber(input,0,max,null,strict);
  if(number===null||!Number.isSafeInteger(number)){
   if(strict)throw new TypeError("Skill level must be an integer within the source cap");
   continue;
  }
  cleaned[id]=number;
 }
 return cleaned;
}
function exclusions(value,skills,strict){
 if(!Array.isArray(value)){
  if(strict)throw new TypeError("Excluded skills must be a list");
  return [];
 }
 const clean=[];
 for(const id of value){
  if(typeof id!=="string"||!own(skills,id)){
   if(strict)throw new TypeError("Unknown excluded skill");
   continue;
  }
  if(!clean.includes(id))clean.push(id);
 }
 return clean;
}
function scalar(value,choices,fallback,strict=false){
 if(value===undefined||value===null)return fallback;
 if(choices.includes(value))return value;
 if(strict)throw new TypeError("Invalid shared build choice");
 return fallback;
}
/**
 * Reuse the same validation for saved state and shareable links.
 * Invalid saved fields fail closed to defaults without losing the account.
 * Invalid shared fields fail as a whole; never silently load a different tree.
 */
export function sanitizeUserBuild(saved,defaults,skills,damageTypes,goldTypes,{strict=false}={}){
 if(!isRecord(saved)){
  if(strict)throw new TypeError("Shared build must be an object");
  return {...defaults};
 }
 const input={...defaults};
 // Only known settings may be restored from local storage; legacy options
 // are overwritten separately by publicOptimizationSettings.
 const allowed=Object.keys(defaults);
 for(const key of allowed)if(own(saved,key))input[key]=saved[key];
 input.currentLevels=levels(input.currentLevels,skills,strict);
 input.minimums=levels(input.minimums,skills,strict);
 input.excluded=exclusions(input.excluded,skills,strict);
 input.damage=scalar(input.damage,damageTypes,defaults.damage,strict);
 input.gold=scalar(input.gold,goldTypes,defaults.gold,strict);
 input.playstyle=scalar(input.playstyle,["farm","balanced","push"],defaults.playstyle,strict);
 input.qol=scalar(input.qol,["recommended","none","custom"],defaults.qol,strict);
 for(const [key,min,max] of [
  ["skillPoints",0,50000],["maxStage",0,1e12],["goldWeight",0,2],
  ["craftingPower",1,1e9],["timeToKill",.1,1e6],["sClone",1,35]
 ]){
  input[key]=asNumber(input[key],min,max,defaults[key],strict);
 }
 for(const key of ["skillPoints","maxStage","craftingPower","sClone"])
  if(!Number.isSafeInteger(input[key])){
   if(strict)throw new TypeError("Shared build requires integer "+key);
   input[key]=defaults[key];
  }
 for(const key of ["preserveCurrent","protectUnmodeledSkills"])
  input[key]=input[key]===true;
 input.stageSeason=input.stageSeason===14?14:null;
 const equipment={};
 if(isRecord(input.selectedEquipment)){
  for(const key of ["Sword","Helmet","Armor","Slash","Aura"]){
   const id=input.selectedEquipment[key];
   if(typeof id==="string"&&id.length<=120&&id!=="__proto__")equipment[key]=id;
  }
 }
 input.selectedEquipment=equipment;
 for(const key of ["selectedDamagePet","selectedGoldPet"]){
  const id=input[key];
  input[key]=typeof id==="string"&&/^[A-Za-z0-9_-]{1,40}$/.test(id)?id:null;
 }
 input.accountProfile=isRecord(input.accountProfile)&&
  input.accountProfile.schema==="tt2-account-profile-v1"&&
  isRecord(input.accountProfile.sections)?input.accountProfile:null;
 input.sourceImported=saved.sourceImported===true&&input.accountProfile!==null;
 input.importedVersion=typeof input.importedVersion==="string"&&
  input.importedVersion.length<=60?input.importedVersion:null;
 input.sets=isRecord(input.sets)?input.sets:{};
 return input;
}
/**
 * Validate the compressed-link JSON before it reaches any HTML interpolator.
 * The fragment is a public configuration only, never a full-account export.
 */
export function parseSharedBuildHash(hash,skills,damageTypes,goldTypes){
 if(typeof hash!=="string"||!hash.startsWith("#build="))
  throw new TypeError("Invalid build link");
 if(hash.length>MAX_SHARED_BUILD_HASH)throw new RangeError("Build link is too large");
 const token=hash.slice(7);
 if(!token||!/^[A-Za-z0-9+/]+={0,2}$/.test(token))
  throw new TypeError("Invalid base64 build link");
 const bytes=Uint8Array.from(atob(token),char=>char.charCodeAt(0));
 const decoded=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
 const value=JSON.parse(decoded);
 if(!isRecord(value))throw new TypeError("Build link must contain an object");
 const candidate={
  damage:value.da,gold:value.go,skillPoints:value.sp,
  maxStage:value.st,stageSeason:value.ss,
  playstyle:value.p,qol:value.q,goldWeight:value.w,
  craftingPower:value.cp,timeToKill:value.tk,sClone:value.cl,
  currentLevels:value.cur??{},minimums:value.min??{},
  excluded:value.exc??[],preserveCurrent:value.keep===true,
  protectUnmodeledSkills:value.protect!==false
 };
 // Validate all explicit fields, but allow old links to omit new settings.
 const defaults={
  damage:"Clan Ship",gold:"Fairy",skillPoints:0,maxStage:0,
  stageSeason:null,playstyle:"balanced",qol:"recommended",
  goldWeight:.7,craftingPower:1,timeToKill:8,sClone:30,
  currentLevels:{},minimums:{},excluded:[],
  preserveCurrent:false,protectUnmodeledSkills:true,
  selectedEquipment:{},selectedDamagePet:null,selectedGoldPet:null,
  accountProfile:null,sets:{}
 };
 for(const [field,source] of Object.entries({
  damage:"da",gold:"go",skillPoints:"sp",maxStage:"st",
  playstyle:"p",qol:"q",goldWeight:"w",craftingPower:"cp",
  timeToKill:"tk",sClone:"cl"
 }))if(!own(value,source)||value[source]===null)
  candidate[field]=defaults[field];
 const clean=sanitizeUserBuild(candidate,defaults,skills,damageTypes,goldTypes,{strict:true});
 clean.stageSeason=value.ss===14?14:null;
 return clean;
}
