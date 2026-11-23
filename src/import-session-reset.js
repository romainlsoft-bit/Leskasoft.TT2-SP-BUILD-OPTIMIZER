/**
 * Keep import-session combat assumptions local to the account that supplied
 * them. Importing a different TT2 export MUST NOT reuse its hypothetical
 * shared-mana parameters or previously chosen equipment/pet pair.
 *
 * This changes neither the imported skill levels nor any permanent settings
 * such as interface language or the user's preferred damage/gold playstyle.
 */
export function resetAccountDependentOptions(state){
 if(!state||typeof state!=="object")
  throw new TypeError("TT2 import session state must be an object.");
 state.contractTimeline=null;
 state.contractMultiScenario=null;
 state.assumeContractsAtMax=false;
 state.assumeCoordinatedOffensiveActive=false;
 state.assumeFlashZipAtBoss=false;
 state.assumeNightmareAtBoss=false;
 state.assumeMagnumOpusAtBoss=false;
 state.tacticalInsightCalibration=null;
 state.selectedDamagePet=null;
 state.selectedGoldPet=null;
 state.comparePetScenarios=true;
 state.selectedEquipment={};
 return state;
}
