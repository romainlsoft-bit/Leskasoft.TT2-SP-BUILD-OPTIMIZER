/** Recognize owned Unique items whether equipped, unequipped or listed
 * as completed sets. No invented Crafting Power or damage coefficients.
 */
import {EQUIPMENT_SET_CATALOG} from "../vendor/account-catalog.js?v=20261123-native-attack-r1";
import {UNIQUE_EQUIPMENT_TO_SET} from "../vendor/unique-equipment.js?v=20261123-native-attack-r1";
const UNIQUE_SET_IDS=Object.freeze(Object.values(EQUIPMENT_SET_CATALOG)
 .filter(x=>x.type==="Unique").map(x=>x.id));
const INDEX=new Map([
 ...UNIQUE_SET_IDS.map(id=>[id.toLowerCase(),id]),
 ...Object.entries(UNIQUE_EQUIPMENT_TO_SET).map(([equipmentId,setId])=>[equipmentId.toLowerCase(),setId])
]);
function find(value){
 if(typeof value!=="string"&&typeof value!=="number")return null;
 return INDEX.get(String(value).trim().toLowerCase())||null;
}
export function resolveUniqueOwnership(profile){
 const hits=new Map();
 const add=(value,source)=>{
  const id=find(value);
  if(!id)return;
  if(!hits.has(id))hits.set(id,new Set());
  hits.get(id).add(source);
 };
 for(const id of profile?.ownedSetIds||[])add(id,"completed-sets");
 for(const key of ["uniqueEquipment","equipmentInventory","equippedGear"])
  for(const record of profile?.sections?.[key]?.records||[]){
   add(record.id,key);
   add(record.setId,key);
  }
 const ownedIds=[...hits.keys()].sort();
 return {
  ownedIds,ownedCount:ownedIds.length,
  sourceBySet:Object.fromEntries(ownedIds.map(id=>[id,[...hits.get(id)].sort()])),
  catalogCount:UNIQUE_SET_IDS.length,
  ownershipVerifiedFromExport:ownedIds.length>0,
  rosterComplete:false,permanentBonusesModeled:false
 };
}
