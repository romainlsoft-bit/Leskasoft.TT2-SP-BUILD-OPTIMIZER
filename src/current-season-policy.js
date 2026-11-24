/**
 * Current post-Transcendence game context, 2026-11-24.
 *
 * The user confirmed season 13 has ended and the current universal main
 * game cap is 180,000. The E9 community calendar lists 2026-11-24 as
 * the rollover date. No season 14 launch has been verified yet.
 *
 * Fail closed: archived season-13 monuments and seasonal pet levels may
 * NOT re-enter the damage/gold or pet-selection score merely because a
 * stale export omits its season number. Update this policy once Game Hive
 * announces the next season; do not silently trust old CSV IsActive flags.
 */
export const CURRENT_MAIN_GAME_STAGE_CAP=180000;
export const POST_SEASON13_UTC="2026-11-24T00:00:00.000Z";
export const VERIFIED_NEXT_SEASON_START_UTC=null;
export const CURRENT_PET_SOURCE_PROVENANCE=Object.freeze({
 permanentPetCount:30,archivedTranscendentPetCount:15,
 permanentPetInfoGitSha:"c6f367e2ec38d7348c44974edde7de3c679ce300",
 transcendentPetInfoGitSha:"7d0b47e117a5dadaf2b6774394874791690c83f6",
 catalogVerifiedOn:"2026-11-24",
 source:"rawrzcookie/TT2_CSV:csv/PetInfo.csv and csv/EndgamePetInfo.csv",
 currentSelection:"permanent-only; between Transcendence seasons"
});

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
export function capCurrentMaxStage(value){
 const n=Number(value);
 if(!Number.isFinite(n)||n<0)return 0;
 return Math.min(Math.floor(n),CURRENT_MAIN_GAME_STAGE_CAP);
}
