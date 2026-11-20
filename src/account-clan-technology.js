/**
 * TT2 8.4 Clan Technology is clan-wide, not a player's purchased skill tree.
 *
 * Source: official Game Hive DevLog #239 (2026-11-05) and DevUpdate #166
 * (2026-11-20). Neither the client's actual export field aliases nor the
 * runtime tree-wide effectiveness and stack ordering are independently
 * verified. Only allowlisted, identity-safe records are preserved.
 *
 * No clan technology entry may become a fabricated damage/skill multiplier.
 */
const RESOURCE_TYPES=new Set([
 "TitanSoulsPerDay","TitanSoulsPerPrestige","DoubleGeodeChance",
 "ClanTechCurrencyPerDay","ClanTechCurrencyPerPrestige",
 "RelicMementoBoost","RelicMementoBoostersPerPrestige",
 "GeodeChance","PetTokensPerDay"
]);
const CONDITIONAL_TYPES=new Set(["MirrorForceTeamworkBoost",
 "TeamTacticsMoraleBoost","ClanMoraleEarned","MoraleCapacityIncrease"]);
const safeLevel=value=>{
 if(value==null||value==="")return null;
 const raw=String(value).trim();
 if(!/^\d+$/.test(raw))return null;
 const n=Number(raw);
 return Number.isSafeInteger(n)&&n>=0?n:null;
};
export function clanTechnologyEvidence(profile){
 const section=profile?.sections?.clanTechnology;
 const present=section?.present===true;
 const rows=section?.records||[];
 const reasons=[];
 if(!present)reasons.push("clan-technology-not-in-export");
 if(section?.truncated===true)reasons.push("truncated-clan-technology-export");
 const ids=new Set(),entries=[],unknown=[];
 if(present&&!section.truncated){
  for(const row of rows){
   const id=String(row.id??"");
   const level=safeLevel(row.level);
   const type=typeof row.bonusType==="string"?row.bonusType:null;
   if(ids.has(id)){unknown.push({reason:"duplicate-technology-node",id});continue;}
   ids.add(id);
   if(level===null){unknown.push({reason:"unknown-clan-wide-level",id});continue;}
   const family=RESOURCE_TYPES.has(type)?"resource":
    CONDITIONAL_TYPES.has(type)?"conditional":"unclassified";
   entries.push({id,level,bonusType:type,family,
    // Source multiplier and effect stacking cannot be inferred from
    // the purchased level: the technology is shared by the clan.
    status:"unverified-clan-wide-application",addedToScore:false});
   if(family==="unclassified")
    unknown.push({id,reason:"unmapped-clan-technology-node"});
  }
 }
 return {schema:"tt2-8.4-clan-technology-evidence-v1",
  present,importedRecords:rows.length,entries,
  resourceNodes:entries.filter(x=>x.family==="resource").length,
  conditionalNodes:entries.filter(x=>x.family==="conditional").length,
  unclassifiedNodes:entries.filter(x=>x.family==="unclassified").length,
  unknown,reasons,clanWide:true,individualContributionNotUsed:true,
  valuesVerified:false,addedToScore:false,complete:false};
}
