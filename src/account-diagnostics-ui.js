/**
 * Present supported TT2 account effects and limitations without modifying
 * game scores. Rendering stays separate from account modeling and state IO.
 * All dynamic content is inserted as textContent (safe from HTML injection).
 */
export function createAccountDiagnosticsRenderer({getById,doc,tr,numberText,formatLogMultiplier,seasonNotice}){
 const $=getById,document=doc,SEASON14_NOTICE=seasonNotice;
function renderAccountIntegration(result){
 let panel=$("account-integration-diagnostic");
 if(!panel){
  panel=document.createElement("div");
  panel.id="account-integration-diagnostic";
  panel.className="result-detail account-integration-note";
  panel.setAttribute("role","status");
  const disclaimer=document.querySelector(".math-disclaimer");
  if(!disclaimer)return;
  disclaimer.insertAdjacentElement("afterend",panel);
 }
 const power=result.fixedAccount,coverage=result.accountIntegration;
 const sourceCoverage=result.accountSourceCoverage;
 if(!power||!coverage){panel.hidden=true;return;}
 const counts=Number(coverage.unmodeledEffects||0);
 const timed=coverage.timedSetPower||{};
 const knownOrUnknown=n=>Number.isSafeInteger(n)&&n>=0?numberText(n):tr("not verifiable from this export");
 panel.hidden=false;
 panel.textContent=tr(
  "Account baseline (verified formulas only): Damage {damage}, Gold {gold}; {count} numerical effects imported. {unresolved} artifact/set effects remain uncalibrated. Not a validated total build-power estimate.",
  {
   damage:formatLogMultiplier(power.damageLog10),
   gold:formatLogMultiplier(power.goldLog10),
   count:numberText(power.matched||0),
   unresolved:numberText(counts)
  }
 )+" "+tr("Coverage: timed effects scored {applied}/{total}; hero weapon sets {weapons}; Clan Scroll sets {scrolls}. These figures are not predicted stages.",{
  applied:numberText(timed.applied||0),
  total:numberText(timed.calculated||0),
  weapons:knownOrUnknown(coverage.heroWeaponFullSets),
  scrolls:knownOrUnknown(coverage.clanScrollCompleteSets)
 });
 const petAudit=coverage.petPassives;
 if(petAudit?.imported>0)
  panel.textContent+=" "+tr(
   "Pet audit: {imported} pets, {direct} fixed passive bonuses ({seasonal} Transcendent), {gear} seasonal equipment-pet primaries and {unscored} conditional pet effects not included in fixed damage. Tap/Hero damage is build-reduced, not universal. No stages predicted.",
   {imported:numberText(petAudit.imported),
    direct:numberText(petAudit.scored),
    seasonal:numberText(petAudit.seasonalDirect||0),
    gear:numberText(petAudit.seasonalEquipment||0),
    unscored:numberText(petAudit.unscoredDependent||0)});
 const hero=coverage.heroProgression,clan=coverage.clanScrollPower;
  if(hero&&(hero.rosterVerified||hero.missingHeroes<37))
   panel.textContent+=" "+tr(
    "Hero weapons: {sets} full sets, base damage {damage}, Ringing: {ringing}, Worldshaper: {mythic}; dominant hero: {hero}. Individual weapon and helmet conversions still require hero DPS.",
    {sets:knownOrUnknown(hero.fullSets),
      damage:hero.baseSetLog10===null?tr("not verifiable from this export"):
       formatLogMultiplier(hero.baseSetLog10),
      ringing:hero.ringing?.verified?tr("yes"):tr("no"),
      mythic:hero.mythicSmith?.applied?tr("yes"):tr("no"),
      hero:hero.strongest?.verified?hero.strongest.id+" ("+hero.strongest.heroClass+")":
       tr("not verifiable from this export")});
  if(clan?.recognized>0)
   panel.textContent+=" "+tr(
    "Clan Scrolls: {count} recognized, full roster: {complete}; Quill: {quill}, Stamp: {stamp}, Dragon Weaver: {dragon}. Cross-stacking may be unresolved; this is not a stage forecast.",
    {count:numberText(clan.recognized),complete:clan.completeRoster?tr("yes"):tr("no"),
     quill:clan.quill?.applied?tr("yes"):tr("no"),
     stamp:clan.stamp?.applied?tr("yes"):tr("no"),
     dragon:clan.scrollTutor?.applied?tr("yes"):tr("no")});
  if(hero?.heroLevels?.present)
   panel.textContent+=" "+tr(
    "Hero level/ascension snapshot: {count} heroes, complete: {complete}, current DPS: {dps}. Already-applied weapon/helmet bonuses are never counted twice.",
    {count:numberText(hero.heroLevels.parsedCount),
      complete:hero.heroLevels.completeRoster?tr("yes"):tr("no"),
      dps:hero.heroLevels.dpsComplete?tr("available"):tr("not verifiable from this export")});
  const artifacts=coverage.artifacts;
 if(artifacts&&(artifacts.identified>0||artifacts.unknownIds>0||
    artifacts.explicitlyUnowned>0||artifacts.truncated)){
  const knownFactor=n=>Number.isFinite(n)?numberText(n):
   tr("not verifiable from this export");
  panel.textContent+=" "+tr(
   "Artifacts: {count} recognized, {scored} scored main effects; Magnifier ×{magnifier} affecting {damageTargets} artifacts, Fergus ×{fergus} affecting {goldTargets}. White Dwarf ownership count: {owned}. Additive Artifact Damage is a conservative baseline, not predicted stages.",
   {count:numberText(artifacts.identified||0),scored:numberText(artifacts.modeled||0),
    magnifier:knownFactor(artifacts.magnifier?.factor),
    damageTargets:numberText(artifacts.supportedMagnifierTargets||0),
    fergus:knownFactor(artifacts.treasure?.factor),
    goldTargets:numberText(artifacts.supportedTreasureTargets||0),
    owned:knownOrUnknown(artifacts.ownedArtifactCount)});
  if(artifacts.unknownIds>0||artifacts.explicitlyUnowned>0||artifacts.truncated)
   panel.textContent+=" "+tr(
    "Artifact source warnings: {unknown} unknown IDs, {unowned} salvaged or explicitly unowned records, truncated: {truncated}. Unverifiable effects and White Dwarf counts are excluded rather than guessed.",
    {unknown:numberText(artifacts.unknownIds||0),
     unowned:numberText(artifacts.explicitlyUnowned||0),
     truncated:artifacts.truncated?tr("yes"):tr("no")});
 }
 const permanent=coverage.permanentSetPower;
 if(permanent?.recognizedSets>0){
  panel.textContent+=" "+tr(
   "Permanent sets: {sets} unlocked (including {unique} Unique); {direct} direct bonuses and {gear} equipment-primary boosts calculated using Crafting Power {cp}. These are not a complete damage model.",
   {sets:numberText(permanent.recognizedSets),
    unique:numberText(permanent.uniqueOwned||0),
    direct:numberText(permanent.directEffects||0),
    gear:numberText(permanent.equipmentEffects||0),
    cp:permanent.craftingPower?.level===null
     ?tr("not verifiable from this export")
     :numberText(permanent.craftingPower.level)}
  );
  if(permanent.countedEffectsApplied>0)
   panel.textContent+=" "+tr(
    "{count} effects per owned equipment set were scored from the completed-set collection ({mythic} Mythic, {legendary} Legendary and {unique} Unique sets).",
    {count:numberText(permanent.countedEffectsApplied),
     mythic:numberText(permanent.ownedCounts?.Mythic||0),
     legendary:numberText(permanent.ownedCounts?.Legendary||0),
     unique:numberText(permanent.ownedCounts?.Unique||0)});
  if(permanent.ownedRosterComplete===false)
   panel.textContent+=" "+tr(
    "Bonuses per completed set cannot be verified without a complete unlocked-set collection; unknown counts were not scored.");
  if(permanent.conservativeCPBaseEffects>0)
   panel.textContent+=" "+tr(
    "{count} set multipliers use only their minimum unboosted value because Crafting Power is not confirmed.",
    {count:numberText(permanent.conservativeCPBaseEffects)});
  if(permanent.craftingPower?.conflictingSettings)
   panel.textContent+=" "+tr(
    "The Crafting Power from the account export overrides a conflicting form value.");
 }
 const monuments=coverage.monuments;
 if(monuments&&!sourceCoverage?.seasonCalendar?.betweenSeasons&&
    (monuments.identified>0||monuments.unknownIds>0||
    monuments.truncatedSections?.length)){
  panel.textContent+=" "+tr("Monuments (season {season}): {known} recognized, {scored} primary/count effects scored. Additive Monument Damage: {damage} from {components} eligible monuments, included only once as a conservative All Damage baseline. Enchantment multipliers are not guessed; neither these values nor the proxy are stage predictions.",{
   season:monuments.season??tr("not verifiable from this export"),
   known:numberText(monuments.identified||0),
   scored:numberText(monuments.scored||0),
   damage:formatLogMultiplier(monuments.additiveDamageLog10),
   components:numberText(monuments.additiveComponents||0)
  });
  if(monuments.unknownIds||monuments.conflicts||monuments.truncatedSections?.length||
    monuments.additiveUnrepresentable){
   panel.textContent+=" "+tr("Monument limitations: {unknown} unknown IDs, {conflicts} stale/conflicting entries, {truncated} truncated sections and {unrepresentable} non-representable damage terms. Missing season, per-day conditions and unverified completed-set counts remain excluded.",{
    unknown:numberText(monuments.unknownIds||0),
    conflicts:numberText(monuments.conflicts||0),
    truncated:numberText(monuments.truncatedSections?.length||0),
    unrepresentable:numberText(monuments.additiveUnrepresentable||0)
   });
  }
 }
 const treeSets=coverage.skillTreeSetPower;
 if(treeSets?.applied>0)
  panel.textContent+=" "+tr(
   "Skill-tree mythic sets: {count} active bonuses contribute {damage} log10 All Damage from the actual SP allocation. This contribution is already inside the skill score.",
   {count:numberText(treeSets.applied),
    damage:treeSets.skillScoreLog10.toFixed(2)});
 if(treeSets?.completedSetRosterPresent===false)
  panel.textContent+=" "+tr(
   "No unlocked-set collection was found in the export; skill-tree set bonuses cannot be verified.");
 const spells=result.spellScenario;
 const mana=result.manaEvidence;
 if(spells){
  panel.textContent+=" "+tr(
   "Spells: {count}/6 equipped slots verified: {verified}; max-level scenario: {active}; selected spell baseline: {damage} damage, {gold} gold. Unverified loadouts contribute no spell multiplier.",
   {count:numberText(spells.slots),verified:spells.selection?.valid?tr("yes"):tr("no"),
     active:spells.assumedMaxLevelScenario?tr("yes"):tr("no"),
     damage:formatLogMultiplier(spells.damageLog10),
     gold:formatLogMultiplier(spells.goldLog10)});
 }
 if(spells?.recommendation?.ids?.length)
  panel.textContent+=" "+tr(
   "Source-based six-spell candidates: {spells}. Suggestions only: not automatically equipped, not scored, and not mana/uptime optimized.",
   {spells:spells.recommendation.ids.join(", ")});
 if(mana)
  panel.textContent+=" "+tr(
   "Mana audit: {cost} mana for one cast of each selected spell; exported pool: {pool}, regen: {regen}. Multicast, contract ramp and actual uptime remain unverified.",
   {cost:mana.spellManaCostOneCast===null?tr("not verifiable from this export"):
     numberText(mana.spellManaCostOneCast),
    pool:mana.exportedFinalManaPool===null?tr("not verifiable from this export"):
     numberText(mana.exportedFinalManaPool),
    regen:mana.exportedFinalManaRegenPerSecond===null?
     tr("not verifiable from this export"):numberText(mana.exportedFinalManaRegenPerSecond)});
 if(sourceCoverage?.seasonCalendar?.season==="14")
  panel.textContent+=" "+tr(SEASON14_NOTICE);
 if(sourceCoverage?.seasonCalendar?.betweenSeasons)
  panel.textContent+=" "+tr(
   "Transcendence season 13 has ended. Archived monuments and Transcendent pets are excluded from calculations, even if an old import still lists them. Current maximum stage: 180,000. Only permanent pets count until the next season is verified.");
 if(sourceCoverage){
  const system=id=>sourceCoverage.systems.find(x=>x.id===id);
  const desc=id=>{
   const x=system(id);
   return [x?.importedRecords??0,x?.fixedScoreRows??0,x?.unresolved??0]
    .map(numberText).join("/");
  };
  panel.textContent+=" "+tr(
   "Account calculation sources (imported / directly credited / unresolved): Titan research {titan}; Gemstone research {gemResearch}; gems {gems}; artifacts {artifacts}; monuments {monuments}. Titan Souls and extra Gemstone levels are progression resources, not automatically damage.",
   {titan:desc("titanResearch"),gemResearch:desc("gemstoneResearch"),
    gems:desc("gemstones"),artifacts:desc("artifacts"),
    monuments:desc("monuments")});
  panel.textContent+=" "+tr(
   sourceCoverage.clanTechnology?.present?
    "Clan Technology is recognized as a clan-wide system, but its exported effects cannot yet be independently verified or added to the SP score.":"Clan Technology is not included in this export; its clan-wide effects remain unknown.");
 }
 const monumentEnchant=result.accountIntegration?.monuments;
 if(!sourceCoverage?.seasonCalendar?.betweenSeasons&&
    monumentEnchant?.omittedEnchantmentBoosts>0&&
    Number.isFinite(monumentEnchant.hypotheticalEnchantmentDeltaLog10))
  panel.textContent+=" "+tr(
   "Monument enchantment what-if: +{delta} log10 versus the source-based conservative pool under an unverified stacking assumption. This bonus is NOT included in the SP score.",{
    delta:monumentEnchant.hypotheticalEnchantmentDeltaLog10.toFixed(2)});
 const seasonDay=result.monumentSeasonDay;
 if(!sourceCoverage?.seasonCalendar?.betweenSeasons&&seasonDay?.totalEntries>0)
  panel.textContent+=" "+tr(
   "Season-day monuments: {count} source effects identified, {calculable} illustrative compounded examples; none is silently credited as guaranteed damage. Season changes reset monuments.",{
    count:numberText(seasonDay.totalEntries),
    calculable:numberText(seasonDay.illustrableEntries)});
 const modeled=result.modeledScenario;
 if(modeled){
  panel.textContent+=" "+tr(
   "Modeled log10 score: skills {skills}, account {account}, equipped gear {gear}, active pets above passive {pets}; combined {total}. Not predicted stages.",
   {skills:modeled.skillLog10.toFixed(2),
    account:modeled.fixedAccountLog10.toFixed(2),
    gear:modeled.equippedGearLog10.toFixed(2),
    pets:modeled.activePetsAbovePassivesLog10.toFixed(2),
    total:modeled.totalLog10.toFixed(2)}
  );
 }
 if(result.modeledScenario?.coverage){
  const limitations=result.modeledScenario.coverage;
  if(limitations.inventoryTruncated)
   panel.textContent+=" "+tr("Incomplete equipment inventory: automatic gear selection is disabled.");
  if(limitations.missingExplicitSelections>0)
   panel.textContent+=" "+tr("{count} requested equipment choices could not be verified and were not scored.",
    {count:numberText(limitations.missingExplicitSelections)});
  if(limitations.conditionalSkillsUnverified>0)
   panel.textContent+=" "+tr("Some conditional skills have unverified activation or stacking; their damage was not guessed.");
  if(limitations.lightningStrikeCountUnverified)
   panel.textContent+=" "+tr("Lightning Strike hits per boss are unknown; current SP levels are protected, but no speculative damage is scored.");
  else if(limitations.lightningStrikeSourceOnly)
   panel.textContent+=" "+tr("Lightning Strike source-only estimate uses an explicitly supplied hit count; actual proc rate remains unverified.");
 }
 if(result.petSearch?.shortlistOnly)
  panel.textContent+=" "+tr(
   "Pet comparison may omit candidates in large owned rosters; compare only the evaluated setups.");
 const coupled=result.modeledScenario?.coverage;
 if(coupled?.petGearCoupledScreening)
  panel.textContent+=" "+tr("Coupled pet/gear search: equipment primaries are reconsidered for each active pet pair; {sources} equipment-pet passive sources, {excluded} seasonal rune interactions excluded. This is a bounded proxy, not a stage prediction.",{
   sources:numberText(coupled.petPrimarySourcesCount||0),
   excluded:numberText(coupled.excludedActiveSeasonalRune?.length||0)
  });
 const resources=coverage.researchResources;
 if(resources?.gemstones?.present||resources?.titanSouls?.present){
  const notKnown=tr("not verifiable from this export");
  const gems=resources.gemstones?.totalsVerifiable===true
   ?"+"+numberText(resources.gemstones.extraLevelsFromResearch):notKnown;
  const souls=resources.titanSouls;
  const soulKnown=souls?.totalsVerifiable===true;
  panel.textContent+=" "+tr(
   "Research from export: Gemstone Research {levels} levels; Titan Souls {daily}/day, {prestige}/prestige, +{chance}% raw drop chance. Resource bonuses are not damage multipliers.",
   {levels:gems,daily:soulKnown?"+"+numberText(souls.bonusPerDay):notKnown,
    prestige:soulKnown?"+"+numberText(souls.bonusPerPrestige):notKnown,
    chance:soulKnown?numberText(Math.round(souls.rawChanceBonusFraction*100000)/1000):notKnown}
  );
  if(resources.audit?.incomplete)panel.textContent+=" "+tr(
   "Research export is incomplete or contradictory: {count} ambiguous records/sections. Affected bonuses were excluded and aggregate resource rates cannot be verified.",
   {count:numberText(resources.audit.excludedOrConflictingNodes)});
 }
}

 return renderAccountIntegration;
}
