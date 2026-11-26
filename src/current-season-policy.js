/**
 * Transcendence season 14 began on 2026-11-26 (TT2 Wiki).
 *
 * 180,000 is the main-game Transcendence ENTRY THRESHOLD, not a ceiling
 * for seasonal Max Stage. The period 24-26 November has no active season.
 * Season 14 starts 26 November according to community TT2 Wiki.
 *
 * Fail closed: archived season-13 monuments and seasonal pet levels may
 * NOT re-enter the damage/gold or pet-selection score merely because a
 * stale export omits its season number. Keep dated source provenance;
 * do not silently trust old CSV IsActive flags.
 */
export const CURRENT_MAIN_GAME_STAGE_CAP=180000;
// Historical name retained for compatibility; this is the entry threshold.
export const TRANSCENDENCE_ENTRY_STAGE=CURRENT_MAIN_GAME_STAGE_CAP;
export const CURRENT_TRANSCENDENCE_SEASON=14;
export const POST_SEASON13_UTC="2026-11-24T00:00:00.000Z";
export const VERIFIED_NEXT_SEASON_START_UTC="2026-11-26T00:00:00.000Z";
export const CURRENT_PET_SOURCE_PROVENANCE=Object.freeze({
 permanentPetCount:30,archivedTranscendentPetCount:15,
 permanentPetInfoGitSha:"c6f367e2ec38d7348c44974edde7de3c679ce300",
 transcendentPetInfoGitSha:"b2e8ffe778f22f6742447284ac05ede113f6c992",
 season13UnityPetVariantGitSha:"3d4ac87949893f3619d3c8d43d3638eec55de820",
 catalogVerifiedOn:"2026-11-26",
 source:"rawrzcookie/TT2_CSV:csv/PetInfo.csv and csv/EndgamePetInfo.csv",
 currentSelection:"season-14: ten active Unity variant A pets, positive season-14 exported levels only"
});

/** True only after the documented season-14 start; invalid dates fail closed. */
export function isCurrentSeasonStarted(at=new Date()){
 const ms=at instanceof Date?at.getTime():Date.parse(at);
 return Number.isFinite(ms)&&ms>=Date.parse(VERIFIED_NEXT_SEASON_START_UTC);
}
export function currentPostSeasonMode(at=new Date()){
 const ms=at instanceof Date?at.getTime():Date.parse(at);
 if(!Number.isFinite(ms))return true; // unknown date: do not credit seasonal power
 const after=ms>=Date.parse(POST_SEASON13_UTC);
 const next=VERIFIED_NEXT_SEASON_START_UTC&&
  ms>=Date.parse(VERIFIED_NEXT_SEASON_START_UTC);
 return Boolean(after&&!next);
}

/**
 * Treat imported/locally persisted pre-reset 250k+ Max Stage as archival
 * evidence. Keep 0 (unknown/unreported) rather than manufacturing a
 * current 180k achievement.
 */
export function capCurrentMaxStage(value,profile=null,manualCurrentSeason=false,at=new Date()){
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<0)return 0;
 const inSeason14=isCurrentSeasonStarted(at);
 const importedSeason=Number(profile?.stats?.transcendenceSeason);
 // A positive stage above 180k belongs to the new season ONLY with
 // explicit current-season metadata, or new manual input after rollover.
 // Historical/unstamped exports and restored URLs remain capped at 180k.
 if(inSeason14&&(importedSeason===CURRENT_TRANSCENDENCE_SEASON||
   (!Number.isFinite(importedSeason)&&manualCurrentSeason===true)))
  return n;
 return Math.min(n,TRANSCENDENCE_ENTRY_STAGE);
}
