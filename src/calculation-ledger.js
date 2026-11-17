/**
 * Single numerical ledger for a complete candidate setup.
 *
 * This is NOT a game-stage estimator. It assembles the independently
 * modeled log10 terms without recomputing or reapplying any account source:
 *
 * - skill-tree optimized score: dependent on allocated SP;
 * - fixed account score: main artifacts, research, eligible monuments,
 *   direct passive pets and dated bonuses already computed by the engine;
 * - primary + recognized secondary effects of exactly the selected 5 gear;
 * - incremental effect of two separately selected active pets above their
 *   already-counted passive baseline.
 *
 * Do not add another fixedAccountScore here, nor multiply these values by
 * account Gemstone levels. Both would double-count existing contributions.
 */
import {petScenarioScore,availablePets} from "./pet-scenarios.js?v=20261117-contract-coupling";

function finite(value,label){
 if(typeof value!=="number"||!Number.isFinite(value))
  throw new TypeError("Non-finite modeled "+label+" log10 score");
 return value;
}

export function modeledScenarioCoverage(result,settings,gearSelection={}){
 const selected=gearSelection.selected||{};
 const unresolvedAccountEffects=Number(result?.accountIntegration?.unmodeledEffects)||0;
 const unknownCatalogIds=Number(result?.accountIntegration?.unknownCatalogIds)||0;
 const unknownGemstoneBonuses=Number(result?.accountIntegration?.gemstoneEffects?.unresolved)||0;
 const permanentSetPower=result?.accountIntegration?.permanentSetPower||null;
 const artifactPower=result?.accountIntegration?.artifacts||null;
 const conservativeSetEffects=Number(permanentSetPower?.conservativeCPBaseEffects)||0;
 const missingSetCollection=permanentSetPower?.missingOwnedSetRows===true;
 const uncertainOwnedSetCounts=permanentSetPower?.ownedRosterComplete===false&&
  (Number(permanentSetPower?.recognizedSets)||0)>0;
 const conflictingCraftingPower=permanentSetPower?.craftingPower?.conflictingSettings===true;
 const unknownGearPrimaries=gearSelection.primaryUnknownCount??
  Object.values(selected).filter(x=>x.primaryModeled===false).length;
 const unknownGearSecondaries=gearSelection.secondaryUnknownCount??
  Object.values(selected).reduce((n,x)=>n+(Number(x.secondaryUnknown)||0),0);
 const unknownGearAmplifiers=gearSelection.unresolvedAmplifiersCount??
  Object.values(selected).reduce((n,x)=>
   n+(x.primaryAmplifierUnresolved?.length||0),0);
 const missingExplicitSelections=gearSelection.missingExplicitSelections?.length||0;
 const inventoryPresent=settings?.accountProfile?.sections?.equipmentInventory?.present===true;
 const inventoryTruncated=gearSelection.inventoryTruncated===true||
  settings?.accountProfile?.sections?.equipmentInventory?.truncated===true;
 const available=availablePets(settings?.accountProfile);
 const damagePet=settings?.selectedDamagePet??null;
 const goldPet=settings?.selectedGoldPet??null;
 const invalidDamagePet=damagePet!==null&&
  !available.some(x=>x.id===damagePet&&x.equipType==="Damage");
 const invalidGoldPet=goldPet!==null&&
  !available.some(x=>x.id===goldPet&&x.equipType==="Support");
 const missingGearSlots=Math.max(0,5-Object.keys(selected).length);
 const gaps=[];
 if(!inventoryPresent)gaps.push("missing-equipment-inventory");
 if(inventoryTruncated)gaps.push("truncated-equipment-inventory");
 if(missingGearSlots)gaps.push("unmodeled-gear-slots");
 if(missingExplicitSelections)gaps.push("invalid-explicit-equipment-selections");
 if(unknownGearPrimaries)gaps.push("unmodeled-equipment-primaries");
 if(unknownGearSecondaries)gaps.push("unmodeled-equipment-secondaries");
 if(unknownGearAmplifiers)gaps.push("unverified-equipment-amplifiers");
 if(unknownGemstoneBonuses)gaps.push("unmodeled-gemstone-bonuses");
 if(artifactPower?.truncated)gaps.push("truncated-artifact-collection");
 if((artifactPower?.unknownIds||0)>0)gaps.push("unknown-artifact-identifiers");
 if(artifactPower?.ownedCountVerifiable===false)
  gaps.push("unverified-white-dwarf-artifact-count");
 if(artifactPower?.additiveDamageConservative===true)
  gaps.push("artifact-damage-pool-conservative");
 const researchAudit=result?.accountIntegration?.researchResources?.audit;
 if(researchAudit?.incomplete)gaps.push("incomplete-resource-research-export");
 if(conservativeSetEffects)gaps.push("crafting-power-unverified");
 if(missingSetCollection)gaps.push("truncated-owned-set-collection");
 if(uncertainOwnedSetCounts)gaps.push("unverified-set-ownership-counts");
 if(conflictingCraftingPower)gaps.push("conflicting-crafting-power-input");
 if(result?.contractScenario?.assumptions?.maximumRampReached===true&&
    !result.contractScenario.validatedFullManaUptime)
  gaps.push("unverified-contract-mana-uptime");
 if(invalidDamagePet||invalidGoldPet)gaps.push("invalid-selected-pet");
 if(result?.accountIntegration?.skillTreeSetPower?.completedSetRosterPresent===false)
  gaps.push("unknown-skill-tree-set-ownership");
 if(unresolvedAccountEffects||unknownCatalogIds)gaps.push("incomplete-account-formulas");
 // A structurally complete export is not a calibrated game simulation.
 gaps.push("unverified-stage-HP-and-cross-skill-interactions");
 return {gaps,
  complete:false,inventoryPresent,inventoryTruncated,missingGearSlots,
  missingExplicitSelections,unknownGearPrimaries,unknownGearSecondaries,
  unknownGearAmplifiers,unknownGemstoneBonuses,
  researchUnresolvedNodes:researchAudit?.excludedOrConflictingNodes||0,
  researchTruncatedSections:researchAudit?.truncatedSections||[],
  artifactCollectionTruncated:artifactPower?.truncated===true,
  unknownArtifactIds:artifactPower?.unknownIds||0,
  whiteDwarfCountVerifiable:artifactPower?.ownedCountVerifiable===true,
  conservativeArtifactDamage:artifactPower?.additiveDamageConservative===true,
  conservativeSetEffects,missingSetCollection,uncertainOwnedSetCounts,
  conflictingCraftingPower,
  invalidDamagePet,invalidGoldPet,
  unresolvedAccountEffects,unknownCatalogIds,
  safeForAutomaticGearRecommendation:inventoryPresent&&!inventoryTruncated&&
   !missingExplicitSelections,
  realStagePredictionValidated:false};
}

export function calculateModeledScenario(result,settings,gearSelection){
 if(!result||!settings)throw new TypeError("Missing optimization result or settings");
 const skillLog10=finite(result.score,"skill-tree");
 const fixedAccountLog10=finite(result.fixedAccount?.weightedLog10,"fixed-account");
 const equippedGearLog10=finite(gearSelection?.independentScore??0,"equipment");
 const activePetsAbovePassivesLog10=finite(
  petScenarioScore(settings,0),"selected-pets");
 const totalLog10=finite(skillLog10+fixedAccountLog10+
  equippedGearLog10+activePetsAbovePassivesLog10,"total");
 const accountAdjusted=finite(result.accountAdjustedScore,"account-adjusted");
 const discrepancy=Math.abs(accountAdjusted-(skillLog10+fixedAccountLog10));
 if(discrepancy>1e-7*Math.max(1,Math.abs(accountAdjusted)))
  throw new Error("Fixed account baseline differs from engine accountAdjustedScore");
 const fixed=result.fixedAccount;
 const coverage=modeledScenarioCoverage(result,settings,gearSelection);
 return {
  schema:"tt2-modeled-scenario-v1",
  totalLog10,skillLog10,fixedAccountLog10,equippedGearLog10,
  activePetsAbovePassivesLog10,
  damageLog10:finite(fixed.damageLog10,"damage"),
  goldLog10:finite(fixed.goldLog10,"gold"),
  goldWeight:Number(settings.goldWeight),
  components:4,
  fixedAccountRecognized:Number(fixed.matched)||0,
  selectedGearCount:Object.keys(gearSelection?.selected||{}).length,
  selectedDamagePet:settings.selectedDamagePet??null,
  selectedGoldPet:settings.selectedGoldPet??null,
  unresolvedDependencyCount:coverage.unresolvedAccountEffects,
  coverage,
  // The existing solver optimizes only its documented additive proxy.
  optimizedForActualStages:false,allAccountEffectsModeled:false,
  supportsAutomaticCrossBuildSelection:false
 };
}

/**
 * Difference between candidate scores, in log10 units. Never call this an
 * in-game stage gain: log10 damage and the real game stage HP curve differ.
 */
export function compareModeledScenarios(a,b){
 if(a?.schema!=="tt2-modeled-scenario-v1"||b?.schema!=="tt2-modeled-scenario-v1")
  throw new TypeError("Incompatible modeled scenario");
 return finite(a.totalLog10-b.totalLog10,"scenario difference");
}
