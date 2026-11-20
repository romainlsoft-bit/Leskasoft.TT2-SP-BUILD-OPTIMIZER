/**
 * Permanent artifact-derived damage is split into two independent routes:
 * - White Dwarf: its (Magnifier-boosted) per-artifact MAIN effect, repeated
 *   for every distinct owned, non-salvaged artifact;
 * - additive Artifact Damage: sum(DamageBonus * level) as a conservative
 *   account baseline, with Heavenly Sword's main effect applied ONCE.
 *
 * Neither Magnifier nor Treasure of Fergus directly multiplies the additive
 * pool. Missing/enchantment-ambiguous records are not silently completed.
 */
import {ARTIFACT_CATALOG,SEASON_ARTIFACT_CATALOG} from "../vendor/account-catalog.js?v=20261120-math-safety-r3";
import {additiveDamageEvidence} from "./account-damage-pools.js?v=20261120-math-safety-r3";
import {positiveLog10} from "./account-artifacts.js?v=20261120-math-safety-r3";
export function artifactDerivedPower(profile,artifactEffects){
 if(!profile?.sections?.artifacts?.present)
  return {entries:[],ownedArtifactCount:null,ownedCountVerifiable:false,
   unmodeled:["missing-artifact-collection"],complete:false};
 const source=artifactEffects||{entries:[],unknown:[]};
 const truncated=profile.sections.artifacts.truncated===true;
 // A catalog row at level 0 does NOT establish ownership. Incomplete or
 // invalid levels without independent collection evidence make the EXACT
 // count unknowable, not an additional permanent White Dwarf exponent.
 const validOwned=source.entries.filter(x=>{
  if(x.level==null)return false;
  // A valid, positive source level is independent acquisition evidence.
  // Reuse the scientific parser; Number("1e9999") would overflow.
  const magnitude=positiveLog10(x.level);
  return magnitude!==null&&magnitude>=0;
 });
 const uncertainOwned=validOwned.length!==source.entries.length;
 const exactCount=!truncated&&!source.unknown?.length&&!uncertainOwned;
 const count=exactCount?validOwned.length:null;
 const entries=[],unmodeled=[];
 const dwarf=source.entries.find(x=>x.id==="Artifact85");
 if(dwarf&&Number.isFinite(dwarf.log10)&&count!==null&&count>0){
  entries.push({id:"Artifact85",system:"whiteDwarf",bonusType:"AllDamage",
   log10:dwarf.log10*count,ownedArtifacts:count,
   mainEffectLog10:dwarf.log10,magnifierApplied:dwarf.magnifierApplied===true,
   status:"verified-artifact-count",appliedToScore:true});
 }else if(dwarf)unmodeled.push(count===null?
  "white-dwarf-ownership-count-unverifiable":"white-dwarf-effect-not-calculable");
 const pool=additiveDamageEvidence(source,{entries:[]},
  ARTIFACT_CATALOG,SEASON_ARTIFACT_CATALOG);
 const raw=pool.artifacts.unenchantedPoolLog10;
 // The sum of confirmed terms is a lower bound if any source is missing.
 // Enchantment of main effects does not justify multiplying DamageBonus.
 // Never borrow White Dwarf or Magnifier effects for this pool.
 if(!truncated&&raw!==null&&Number.isFinite(raw)){
  const hs=source.entries.find(x=>x.id==="Artifact26");
  const hsKnown=Number.isFinite(hs?.log10);
  const hsLog=hsKnown?hs.log10:0;
  entries.push({id:"artifactDamage",system:"artifactDamage",
   bonusType:"AllDamage",log10:raw+hsLog,rawPoolLog10:raw,
   heavenlySwordLog10:hsKnown?hsLog:null,
   rawComponents:pool.artifacts.components,complete:false,
   conservative:true,appliedToScore:true});
  if(hs&&!hsKnown)unmodeled.push("heavenly-sword-effect-unknown");
 }else unmodeled.push(truncated?
  "truncated-artifact-collection":"artifact-damage-pool-unavailable");
 for(const row of pool.rejected)unmodeled.push(row.reason);
 if(source.unknown?.length)unmodeled.push("unknown-artifact-identifiers");
 return {entries,ownedArtifactCount:count,ownedCountVerifiable:exactCount,
  whiteDwarfApplied:entries.some(x=>x.system==="whiteDwarf"),
  unmodeled,partialDamagePool:pool.artifacts,complete:false};
}
