/**
 * Infrastructure boundary for the only two persistent browser preferences.
 * The account export is already reduced to an allowlisted, identity-free
 * profile by parseAccountProfile; raw exported JSON is never persisted.
 * No global localStorage access so denied/quota-limited storage is testable.
 */
import {sanitizeUserBuild,MAX_SAVED_STATE_TEXT}
 from "./build-input-boundary.js?v=20261123-boss-specials-r1";

export const BUILD_STORAGE_KEY="tt2_skill_optimizer_v1";
export const LANGUAGE_STORAGE_KEY="tt2_site_language";
const SUPPORTED_LOCALES=Object.freeze(["en","fr","uk","ru"]);

/** Restored state is always normalized before the controller receives it. */
export function restoreSavedBuild(storage,defaults,skills,damageTypes,goldTypes){
 try{
  const snapshot=storage?.getItem(BUILD_STORAGE_KEY);
  if(!snapshot||snapshot.length>MAX_SAVED_STATE_TEXT)return defaults;
  return sanitizeUserBuild(JSON.parse(snapshot),defaults,skills,damageTypes,goldTypes);
 }catch{return defaults;}
}

/** Failure to save must not block a calculation or store an oversized export. */
export function persistSavedBuild(storage,state){
 try{
  const snapshot=JSON.stringify(state);
  if(!snapshot||snapshot.length>MAX_SAVED_STATE_TEXT){
   storage?.removeItem(BUILD_STORAGE_KEY);
   return false;
  }
  storage?.setItem(BUILD_STORAGE_KEY,snapshot);
  return true;
 }catch{return false;}
}

/** Only an explicit user gesture may call this function. */
export function eraseSavedBrowserData(storage){
 try{
  storage?.removeItem(BUILD_STORAGE_KEY);
  storage?.removeItem(LANGUAGE_STORAGE_KEY);
  return true;
 }catch{return false;}
}

export function storeLanguage(storage,locale){
 if(!SUPPORTED_LOCALES.includes(locale))return false;
 try{storage?.setItem(LANGUAGE_STORAGE_KEY,locale);return true;}
 catch{return false;}
}
