/**
 * Public skill-build links contain editable preferences only.
 * Never serialize accountProfile, player identity, equipped inventory or
 * private local browser state into a shared URL.
 * Backward compatible with existing #build=<UTF8-base64-json> links.
 */
import {sanitizeUserBuild,parseSharedBuildHash,MAX_SHARED_BUILD_HASH}
 from "./build-input-boundary.js?v=20261123-boss-specials-r1";

export function createPublicSharePayload(state,defaults,skills,damageTypes,goldTypes){
 // A malformed level must be refused before the link is copied.
 sanitizeUserBuild(state,defaults,skills,damageTypes,goldTypes,{strict:true});
 return {
  sp:state.skillPoints,st:state.maxStage,
  ss:(state.stageSeason===14||
   String(state.accountProfile?.stats?.transcendenceSeason)==="14")?14:null,
  da:state.damage,go:state.gold,p:state.playstyle,q:state.qol,
  w:state.goldWeight,cp:state.craftingPower,tk:state.timeToKill,
  cl:state.sClone,cur:state.currentLevels,min:state.minimums,
  exc:state.excluded,keep:state.preserveCurrent,
  protect:state.protectUnmodeledSkills!==false
 };
}

/** Encode Unicode JSON as UTF-8 bytes before base64, not legacy unescape(). */
export function createShareableBuildLink(currentUrl,state,defaults,skills,damageTypes,goldTypes){
 const payload=createPublicSharePayload(state,defaults,skills,damageTypes,goldTypes);
 const bytes=new TextEncoder().encode(JSON.stringify(payload));
 let binary="";
 for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
 const fragment="#build="+btoa(binary);
 if(fragment.length>MAX_SHARED_BUILD_HASH)
  throw new RangeError("Build link is too large");
 return String(currentUrl).split("#")[0]+fragment;
}

export function readSharedBuild(hash,skills,damageTypes,goldTypes){
 return parseSharedBuildHash(hash,skills,damageTypes,goldTypes);
}
