/**
 * Catalogue-version evidence for the public 8.4 skill optimizer.
 * This metadata is NOT a blanket claim that every account mechanic has
 * been verified for the version of the player's installed game.
 */
export const VERIFIED_SKILL_CATALOG_VERSION="8.4.0";
export const VERIFIED_SKILL_CATALOG_DATASET="2026-09-18";

/** Return a comparable tuple for ordinary TT2 version labels.
 * Reject ambiguous strings rather than assuming patch compatibility.
 */
export function parseTT2Version(raw){
 if(typeof raw!=="string"&&typeof raw!=="number")return null;
 const value=String(raw).trim();
 const m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,4})(?:\.\d{1,4})?$/.exec(value);
 if(!m)return null;
 const components=m.slice(1,4).map(Number);
 if(components.some(n=>!Number.isSafeInteger(n)||n<0))return null;
 return {major:components[0],minor:components[1],patch:components[2],
  label:value};
}
export function compareTT2Versions(a,b){
 const left=parseTT2Version(a),right=parseTT2Version(b);
 if(!left||!right)return null;
 for(const key of ["major","minor","patch"])
  if(left[key]!==right[key])return Math.sign(left[key]-right[key]);
 return 0;
}
export function gameVersionEvidence(importedVersion){
 const tested=VERIFIED_SKILL_CATALOG_VERSION;
 if(importedVersion===null||importedVersion===undefined||importedVersion==="")
  return {status:"unknown",exportedVersion:null,verifiedSkillCatalogVersion:tested,
   skillTreeMappingVerified:false,otherAccountMechanicsVerified:false};
 const compare=compareTT2Versions(importedVersion,tested);
 return {status:compare===null?"unrecognized":
  compare>0?"newer-than-verified":
  compare<0?"older-than-verified":"matches-verified",
  exportedVersion:String(importedVersion).slice(0,80),
  verifiedSkillCatalogVersion:tested,
  skillTreeMappingVerified:compare===0,
  // Source skill table alone cannot certify equipment, conditions, pets,
  // seasonal account mechanics or real gameplay performance.
  otherAccountMechanicsVerified:false};
}
