/**
 * Display names from Game Hive patch notes vs internal EquipmentSetInfo.csv
 * identifiers. These are identity aliases, never additional owned sets.
 * Worldshaper (7.11): x1.25 each hero weapon boost.
 * Dragon Weaver (7.4): +25% individual and full-set hero scroll bonus.
 * Only the primary rows are matched; relic secondary is NOT synthesized.
 * https://gamehive.com/blog/devlog-171-version-7-4-0-patch-notes/
 * https://www.reddit.com/r/TapTitans2/comments/1l4vfkk/
 */
const ALIASES=Object.freeze({
 theworldshaper:"MythicSmith",worldshaper:"MythicSmith",
 dragonweaver:"ScrollTutor"
});
export function canonicalEquipmentSetId(raw){
 if(typeof raw!=="string")return raw;
 const normalized=raw.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g,"");
 return ALIASES[normalized]??raw;
}
export function equipmentSetAliasEvidence(profile){
 const records=profile?.sections?.equipmentSets?.records||[];
 const mirrors=new Map(),aliases=[];
 for(const row of records){
  const canonicalId=canonicalEquipmentSetId(row.id);
  if(canonicalId!==row.id)aliases.push({exportedId:row.id,canonicalId});
  if(["MythicSmith","ScrollTutor"].includes(canonicalId))
   mirrors.set(canonicalId,(mirrors.get(canonicalId)||0)+1);
 }
 return {aliases,mirroredIds:[...mirrors].filter(([,n])=>n>1).map(([id])=>id),
  incomplete:profile?.sections?.equipmentSets?.truncated===true,
  source:"8.4 EquipmentSetInfo primary rows + Game Hive 7.4 and 7.11 patch notes",
  relicEffectsMatched:false};
}
