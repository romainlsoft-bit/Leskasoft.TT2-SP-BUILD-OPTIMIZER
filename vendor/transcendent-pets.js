// Rechecked 2026-11-24 against rawrzcookie/TT2_CSV/csv/EndgamePetInfo.csv,
// Git blob 7d0b47e117a5dadaf2b6774394874791690c83f6.
// All 15 archived Transcendent pet IDs/coefficients match. These are not
// CURRENT eligible pets after the season-13 reset: keep only as catalog
// provenance and for historical imports, never as guaranteed account power.
/**
 * Transcendent seasonal pets, from EndgamePetInfo.csv. They appear in TT2
 * exports as SeasonalPet1..SeasonalPet15. Their bonus improves every 5
 * levels starting at 5; they reset with the Transcendence season.
 * Do not gate ownership using CSV IsActive: the file can describe a different
 * season than the player's current export. Rank only positive exported levels.
 * Source: https://github.com/rawrzcookie/TT2_CSV/blob/main/csv/EndgamePetInfo.csv
 */
export const TRANSCENDENT_PETS=Object.freeze({
  "SeasonalPet1": {
    "id": "SeasonalPet1",
    "name": "Clang",
    "tier": "Transcendent",
    "type": "ArmorBoost",
    "equipType": "Support",
    "base": 10,
    "inc": 5,
    "improve": 300,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet2": {
    "id": "SeasonalPet2",
    "name": "Scaly",
    "tier": "Transcendent",
    "type": "GoldAll",
    "equipType": "Support",
    "base": 10,
    "inc": 5,
    "improve": 300,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet3": {
    "id": "SeasonalPet3",
    "name": "Snuggles",
    "tier": "Transcendent",
    "type": "AllHelperDamage",
    "equipType": "Damage",
    "base": 10,
    "inc": 2,
    "improve": 60,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet4": {
    "id": "SeasonalPet4",
    "name": "Chitter",
    "tier": "Transcendent",
    "type": "TapDamage",
    "equipType": "Damage",
    "base": 10,
    "inc": 2,
    "improve": 60,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet5": {
    "id": "SeasonalPet5",
    "name": "Daisy",
    "tier": "Transcendent",
    "type": "JackpotGold",
    "equipType": "Support",
    "base": 10,
    "inc": 5,
    "improve": 300,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet6": {
    "id": "SeasonalPet6",
    "name": "Quippy",
    "tier": "Transcendent",
    "type": "HelmetBoost",
    "equipType": "Damage",
    "base": 10,
    "inc": 2,
    "improve": 60,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet7": {
    "id": "SeasonalPet7",
    "name": "Lullabye",
    "tier": "Transcendent",
    "type": "AllDamage",
    "equipType": "Damage",
    "base": 10,
    "inc": 2,
    "improve": 60,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet8": {
    "id": "SeasonalPet8",
    "name": "Lemon",
    "tier": "Transcendent",
    "type": "CritDamage",
    "equipType": "Damage",
    "base": 10,
    "inc": 2,
    "improve": 60,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet9": {
    "id": "SeasonalPet9",
    "name": "Watson",
    "tier": "Transcendent",
    "type": "JackpotGold",
    "equipType": "Support",
    "base": 10,
    "inc": 5,
    "improve": 300,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet10": {
    "id": "SeasonalPet10",
    "name": "Felix",
    "tier": "Transcendent",
    "type": "GoldAll",
    "equipType": "Support",
    "base": 10,
    "inc": 5,
    "improve": 300,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet11": {
    "id": "SeasonalPet11",
    "name": "Sonara",
    "tier": "Transcendent",
    "type": "GoldAll",
    "equipType": "Support",
    "base": 10,
    "inc": 5,
    "improve": 300,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet12": {
    "id": "SeasonalPet12",
    "name": "Brushleaf",
    "tier": "Transcendent",
    "type": "AllDamage",
    "equipType": "Damage",
    "base": 10,
    "inc": 2,
    "improve": 60,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet13": {
    "id": "SeasonalPet13",
    "name": "Sandy",
    "tier": "Transcendent",
    "type": "JackpotGold",
    "equipType": "Support",
    "base": 10,
    "inc": 5,
    "improve": 300,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet14": {
    "id": "SeasonalPet14",
    "name": "Clawsette",
    "tier": "Transcendent",
    "type": "AuraBoost",
    "equipType": "Damage",
    "base": 10,
    "inc": 2,
    "improve": 60,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  },
  "SeasonalPet15": {
    "id": "SeasonalPet15",
    "name": "Owlivia",
    "tier": "Transcendent",
    "type": "SlashBoost",
    "equipType": "Damage",
    "base": 10,
    "inc": 2,
    "improve": 60,
    "improvementLimit": 10000,
    "improvementStart": 5,
    "improvementEvery": 5,
    "seasonAvailabilityUnverified": true
  }
});
