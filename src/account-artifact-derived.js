/**
 * Additive Artifact Damage contributes to All Damage after Heavenly Sword.
 * This is a conservative source-backed account baseline (lower bound):
 * only recognized, positive-level artifacts; any unknown enchantment boost
 * is omitted rather than invented. Magnifier never amplifies this sum.
 * White Dwarf's per-owned-artifact bonus is a distinct multiplier,
 * and its eligible Magnifier effect is handled by artifact-effects.
 */
import {ARTIFACT_CATALOG,SEASON_ARTIFACT_CATALOG} from "../vendor/account-catalog.js";
import {additiveDamageEvidence} from "./account-damage-pools.js";
export function artifactDerivedPower(profile,artifactEffects){
 if(!profile?.sections?.artifacts?.present)
  return {entries:[],ownedArtifactCount:null,unmodeled:["missing-artifact-collection"],
   complete:false};
 const source=artifactEffects||{entries:[],unknown:[]};
 const valid=source.entries.filter(x=>x.level!==null&&
  !["conflicting-source-records"].includes(x.status)&&
  ARTIFACT_CATALOG[x.id]);
 const count=valid.length;
 const entries=[],unmodeled=[];
 const dwarf=valid.find(x=>x.id==="Artifact85");
 if(dwarf&&Number.isFinite(dwarf.log10)&&count>0){
  entries.push({id:"Artifact85",system:"whiteDwarf",
   bonusType:"AllDamage",log10:dwarf.log10*count,
   ownedArtifacts:count,mainEffectLog10:dwarf.log10,
   magnifierApplied:dwarf.magnifierApplied===true,
   status:"verified-artifact-count"});
 }else if(dwarf)unmodeled.push("white-dwarf-effect-not-calculable");
 const pool=additiveDamageEvidence(source,{entries:[]},
  ARTIFACT_CATALOG,SEASON_ARTIFACT_CATALOG);
 const raw=pool.artifacts.unenchantedPoolLog10;
 if(raw!==null&&Number.isFinite(raw)){
  const hs=valid.find(x=>x.id==="Artifact26");
  const hsLog=Number.isFinite(hs?.log10)?hs.log10:0;
  entries.push({id:"artifactDamage",system:"artifactDamage",
   bonusType:"AllDamage",log10:raw+hsLog,rawPoolLog10:raw,
   heavenlySwordLog10:hsLog,rawComponents:pool.artifacts.components,
   complete:false,conservative:true});
  if(hs&&!Number.isFinite(hs.log10))unmodeled.push("heavenly-sword-effect-unknown");
 }else unmodeled.push("artifact-damage-pool-unavailable");
 for(const row of pool.rejected)unmodeled.push(row.reason);
 if(source.unknown?.length)unmodeled.push("unknown-artifact-identifiers");
 return {entries,ownedArtifactCount:count,unmodeled,
  partialDamagePool:pool.artifacts,complete:false};
}
