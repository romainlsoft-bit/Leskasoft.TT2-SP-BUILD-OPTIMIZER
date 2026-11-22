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
import {petScenarioScore,petScenarioEvidence,availablePets} from "./pet-scenarios.js?v=20261122-combat-window-r1";
import {resolveConditionalProbabilityEvidence} from "./conditional-probabilities.js?v=20261122-combat-window-r1";

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
 const monumentPower=result?.accountIntegration?.monuments||null;
 const conservativeSetEffects=Number(permanentSetPower?.conservativeCPBaseEffects)||0;
 const missingSetCollection=permanentSetPower?.missingOwnedSetRows===true;
 const uncertainOwnedSetCounts=permanentSetPower?.ownedRosterComplete===false&&
  (Number(permanentSetPower?.recognizedSets)||0)>0;
 const conflictingCraftingPower=permanentSetPower?.craftingPower?.conflictingSettings===true;
 const unknownGearPrimaries=gearSelection.primaryUnknownCount??
  Object.values(selected).filter(x=>x.primaryModeled===false).length;
 const conditionalGearSecondaries=gearSelection.secondaryConditionalCount||0;
 const unknownGearSecondaries=gearSelection.secondaryUnknownCount??
  Object.values(selected).reduce((n,x)=>n+(Number(x.secondaryUnknown)||0),0);
 const unknownGearAmplifiers=gearSelection.unresolvedAmplifiersCount??
  Object.values(selected).reduce((n,x)=>
   n+(x.primaryAmplifierUnresolved?.length||0),0);
 const missingExplicitSelections=gearSelection.missingExplicitSelections?.length||0;
 const linkedAuraCount=gearSelection.linkedAuraCount||0;
 const unresolvedAuraLinks=gearSelection.unresolvedAuraLinks||0;
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
 const petEvidence=result?.accountIntegration?.petPassives||{};
 const activePetEvidence=petScenarioEvidence(settings);
 const hero=result?.accountIntegration?.heroProgression;
 const scroll=result?.accountIntegration?.clanScrollPower;
 const conditionalSkills=result?.conditionalSkills;
 const lightningStrike=result?.lightningStrike;
 const spellScenario=result?.spellScenario;
 const manaEvidence=result?.manaEvidence;
 const conditionalProcs=resolveConditionalProbabilityEvidence(settings?.accountProfile,
  settings,gearSelection,result?.levels);
 const specializedHelmet=["Ranged hero","Spell hero","Melee hero"].includes(selected.Helmet?.kind);
 const dominant=settings?.accountProfile?.dominantHero??null;
 const heroHelmetClassKnown=specializedHelmet&&dominant?.verified===true;
 const heroHelmetUnverified=specializedHelmet&&!heroHelmetClassKnown;
 const gaps=[];
 if(!spellScenario?.selection?.valid)gaps.push("unverified-equipped-six-spell-loadout");
 if(conditionalSkills?.unverified>0)
  gaps.push("unverified-conditional-skill-multipliers");
 if(lightningStrike?.level>0&&!lightningStrike?.sourceOnlyScenario)
  gaps.push("unverified-lightning-strike-hit-count");
 if(lightningStrike?.sourceOnlyScenario)
  gaps.push("unverified-lightning-strike-game-activation");
 if(spellScenario?.appliedToScenario)
  gaps.push("unverified-spell-uptime-mana-and-cooldowns");
 if(manaEvidence?.sustainedContractManaVerified===false&&
    result?.contractScenario?.assumptions?.maximumRampReached)
  gaps.push("unverified-sustained-contract-mana");
 if(spellScenario?.unsupported?.length)
  gaps.push("unverified-spell-source-activation-or-cap");
 if(manaEvidence?.sixSpellsAffordableAtOnce===false)
  gaps.push("selected-spell-rotation-unaffordable-at-exported-mana");
 if(manaEvidence?.initialContractDrainCoveredByPassiveRegen===false)
  gaps.push("initial-contract-drain-above-exported-passive-regen");
 if(conditionalProcs.recordedChances>0)
  gaps.push("proc-distributions-and-context-unverified");
 if(heroHelmetUnverified)gaps.push("unverified-dominant-hero-helmet");
 if(heroHelmetClassKnown)gaps.push("hero-helmet-effect-unmodeled");
 if(hero?.unresolved?.length)gaps.push("unverified-hero-progression-interactions");
 if(scroll?.truncated)gaps.push("truncated-clan-scroll-export");
 if(scroll?.boostStackComplete===false)gaps.push("unverified-clan-scroll-amplifier-stack");
 if(hero?.worldshaper?.owned&&!hero.worldshaper.applied)gaps.push("unverified-worldshaper-primary");
 if(hero?.heroLevels?.present&&!hero.heroLevels.completeRoster)
  gaps.push("incomplete-hero-level-ascension-roster");
 if(hero?.heroLevels?.dominantConflict)
  gaps.push("dominant-hero-conflicts-with-dps");
 if(scroll?.recognized>0&&!scroll?.completeRoster)
  gaps.push("unverified-clan-scroll-set-count");
 if(!inventoryPresent)gaps.push("missing-equipment-inventory");
 if(inventoryTruncated)gaps.push("truncated-equipment-inventory");
 if(missingGearSlots)gaps.push("unmodeled-gear-slots");
 if(missingExplicitSelections)gaps.push("invalid-explicit-equipment-selections");
 if(unknownGearPrimaries)gaps.push("unmodeled-equipment-primaries");
 if(unresolvedAuraLinks)gaps.push("unresolved-aura-primary-target");
 if(unknownGearSecondaries)gaps.push("unmodeled-equipment-secondaries");
 if(conditionalGearSecondaries)
  gaps.push("unverified-conditional-equipment-secondaries");
 if(unknownGearAmplifiers)gaps.push("unverified-equipment-amplifiers");
 if(unknownGemstoneBonuses)gaps.push("unmodeled-gemstone-bonuses");
 if(petEvidence.unscoredDependent>0)gaps.push("unmodeled-conditional-pet-passives");
 if(petEvidence.unknownAmplifiers>0)gaps.push("unverified-pet-amplifiers");
 if(activePetEvidence.unverifiedCrossStack)
  gaps.push("unverified-seasonal-active-pet-rune-cross-stack");
 if(gearSelection.petPrimarySourcesCount>0&&unknownGearAmplifiers>0)
  gaps.push("unverified-pet-equipment-cross-stack");
 if(artifactPower?.truncated)gaps.push("truncated-artifact-collection");
 if((artifactPower?.unknownIds||0)>0)gaps.push("unknown-artifact-identifiers");
 if(artifactPower?.ownedCountVerifiable===false)
  gaps.push("unverified-white-dwarf-artifact-count");
 if(artifactPower?.additiveDamageConservative===true)
  gaps.push("artifact-damage-pool-conservative");
 const hasMonuments=settings?.accountProfile?.sections?.monuments?.present===true||
  settings?.accountProfile?.sections?.seasonArtifacts?.present===true;
 if(hasMonuments&&monumentPower?.seasonVerified!==true)
  gaps.push("unverified-transcendence-season");
 if(monumentPower?.truncatedSections?.length)
  gaps.push("truncated-monument-export");
 if((monumentPower?.unknownIds||0)>0)
  gaps.push("unknown-monument-identifiers");
 if(monumentPower?.conflicting>0)gaps.push("conflicting-monument-records");
 if(monumentPower?.additiveUnrepresentable>0)
  gaps.push("unrepresentable-monument-damage");
 if(monumentPower?.additiveDamageConservative)
  gaps.push("monument-damage-pool-conservative");
 if(monumentPower?.unresolvedEnchantments>0||
    monumentPower?.omittedEnchantmentBoosts>0)
  gaps.push("unverified-monument-enchantments");
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
  complete:false,conditionalProcEvidence:conditionalProcs,
  inventoryPresent,inventoryTruncated,missingGearSlots,
  missingExplicitSelections,linkedAuraCount,unresolvedAuraLinks,
  heroHelmetUnverified,heroHelmetClassKnown,
  heroRosterVerified:hero?.rosterVerified===true,
  unknownGearPrimaries,unknownGearSecondaries,conditionalGearSecondaries,
  unknownGearAmplifiers,unknownGemstoneBonuses,
  researchUnresolvedNodes:researchAudit?.excludedOrConflictingNodes||0,
  researchTruncatedSections:researchAudit?.truncatedSections||[],
  artifactCollectionTruncated:artifactPower?.truncated===true,
  unknownArtifactIds:artifactPower?.unknownIds||0,
  whiteDwarfCountVerifiable:artifactPower?.ownedCountVerifiable===true,
  conservativeArtifactDamage:artifactPower?.additiveDamageConservative===true,
  monumentSeasonVerified:monumentPower?.seasonVerified===true,
  monumentCollectionTruncated:Boolean(monumentPower?.truncatedSections?.length),
  monumentUnrepresentable:monumentPower?.additiveUnrepresentable||0,
  monumentDamageConservative:monumentPower?.additiveDamageConservative===true,
  conservativeSetEffects,missingSetCollection,uncertainOwnedSetCounts,
  conflictingCraftingPower,
  invalidDamagePet,invalidGoldPet,
  petPrimarySourcesCount:gearSelection.petPrimarySourcesCount||0,
  unscoredPetPassives:petEvidence.unscoredDependent||0,
  seasonalPetEffects:petEvidence.seasonalImported||0,
  excludedActiveSeasonalRune:activePetEvidence.excludedSeasonalEquipmentRune,
  petGearCoupledScreening:gearSelection.petGearCoupledScreening===true,
  gearSearch:gearSelection.gearSearch??null,
  procChanceTalentProjectionIsUncalibrated:true,
  petAttackRateNotKnown:true,
  conditionalSkillsUnverified:conditionalSkills?.unverified||0,
  lightningStrikeSourceOnly:lightningStrike?.sourceOnlyScenario===true,
  lightningStrikeCountUnverified:lightningStrike?.level>0&&!lightningStrike?.sourceOnlyScenario,
  unresolvedAccountEffects,unknownCatalogIds,
  safeForAutomaticGearRecommendation:inventoryPresent&&!inventoryTruncated&&
   !missingExplicitSelections&&!unknownGearPrimaries&&
   !unknownGearSecondaries&&!unknownGearAmplifiers&&!unresolvedAuraLinks&&
   !heroHelmetUnverified&&!heroHelmetClassKnown,
  realStagePredictionValidated:false};
}

export function calculateModeledScenario(result,settings,gearSelection){
 if(!result||!settings)throw new TypeError("Missing optimization result or settings");
 const skillLog10=finite(result.score,"skill-tree");
 const fixedAccountLog10=finite(result.fixedAccount?.weightedLog10,"fixed-account");
 const equippedGearLog10=finite(gearSelection?.independentScore??0,"equipment");
 const activePetsAbovePassivesLog10=finite(
  petScenarioScore(settings,0),"selected-pets");
 // The baseline A29/A34 spell multipliers are NOT in the account or SP
 // ledger. SP-induced cap marginal increments are already in scoreAtLevel.
 const selectedSpellBaselineLog10=finite(result.spellScenario?.appliedToScenario?
  result.spellScenario.weightedLog10:0,"six selected spell baseline");
 const totalLog10=finite(skillLog10+fixedAccountLog10+
  equippedGearLog10+activePetsAbovePassivesLog10+
  selectedSpellBaselineLog10,"total");
 const accountAdjusted=finite(result.accountAdjustedScore,"account-adjusted");
 const discrepancy=Math.abs(accountAdjusted-(skillLog10+fixedAccountLog10));
 if(discrepancy>1e-7*Math.max(1,Math.abs(accountAdjusted)))
  throw new Error("Fixed account baseline differs from engine accountAdjustedScore");
 const fixed=result.fixedAccount;
 const coverage=modeledScenarioCoverage(result,settings,gearSelection);
 const conditionalProcs=coverage.conditionalProcEvidence;
 return {
  schema:"tt2-modeled-scenario-v1",
  totalLog10,skillLog10,fixedAccountLog10,equippedGearLog10,
  activePetsAbovePassivesLog10,selectedSpellBaselineLog10,
  spellScenario:result.spellScenario??null,
  manaEvidence:result.manaEvidence??null,
  conditionalProcs,
  damageLog10:finite(fixed.damageLog10,"damage"),
  goldLog10:finite(fixed.goldLog10,"gold"),
  goldWeight:Number(settings.goldWeight),
  components:result.spellScenario?.appliedToScenario?5:4,
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
