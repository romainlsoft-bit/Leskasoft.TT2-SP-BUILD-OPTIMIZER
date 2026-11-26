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
 state.assumeCoordinatedOffensiveActive=true;
 state.assumeFlashZipAtBoss=true;
 state.assumeNightmareAtBoss=true;
 state.assumeMagnumOpusAtBoss=true;
 state.tacticalInsightCalibration=null;
 state.excludeUnverifiedTacticalInsight=false;
 state.assumeHaystActive=true;
 state.assumeSnapActive=true;
 state.astralActivations=5;
 state.pushAttackChannelId="";state.pushSourceStageSkipTarget=0;
 state.pushFrontierEnabled=false;
 state.attackDamageFrontierEnabled=false;state.attackDamageChannelId="";
 state.selectedDamagePet=null;
 state.selectedGoldPet=null;
 state.comparePetScenarios=false;
 state.selectedEquipment={};
 return state;
}
