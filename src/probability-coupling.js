/**
 * Floor-anchored lower bound for cross-talent probability interactions.
 * Source-only expectations, not measured player proc rates.
 * The additive solver continues to optimize exactly its documented proxy.
 */
import {skillInfo} from "../vendor/skills.js?v=20261123-boss-specials-r1";
import {reductions} from "../vendor/reductions.js?v=20261123-boss-specials-r1";
import {positiveLog10} from "./account-artifacts.js?v=20261123-boss-specials-r1";
import {binaryExpectedMultiplierLog10} from "./conditional-probabilities.js?v=20261123-boss-specials-r1";
import {GUIDE_BASE_MULTIPLE_TITAN_CHANCE} from "./ambush-native-score.js?v=20261123-boss-specials-r1&ambush=20261124-ambush-conditional-gold-r1";

const ids=["HeavyStrikes","Transmutation","MultiMonsters","LovePotion","LoadedDice"];
function level(id,levels){
 const n=Number(levels?.[id]??0);
 if(!Number.isSafeInteger(n)||n<0||n>Number(skillInfo[id].MaxLevel))
  throw new RangeError("Invalid probability talent level: "+id);
 return n;
}
function fraction(id,n){
 const value=Number(skillInfo[id]["B"+n]);
 if(!Number.isFinite(value)||value<0||value>1)
  throw new RangeError("Invalid chance for "+id);
 return value;
}
function magnitude(id,n){
 const value=n===0?0:positiveLog10(skillInfo[id]["A"+n]);
 if(value===null||value<0)throw new Error("Invalid event multiplier "+id);
 return value;
}
function dice(n,settings){
 if(settings.assumeHaystActive!==true||n===0)return 1;
 const value=Number(skillInfo.LoadedDice["A"+n]);
 if(!Number.isFinite(value)||value<1)throw new Error("Invalid Hayst multiplier");
 return value;
}
function weight(id,settings){
 return Number(reductions[id]?.[settings.damage]??0)+
  Number(settings.goldWeight??0)*Number(reductions[id]?.[settings.gold]??0);
}
function expected(p,m){
 // The pinned source-only maximum chance remains below 1 even after
 // Loaded Dice. Reject changed domains rather than assume monotonicity
 // across a probability cap (where the lower-bound proof can fail).
 if(!Number.isFinite(p)||p<0||p>1)throw new RangeError("Source probability exceeds unit interval");
 if(m===0||p===0)return 0;
 const value=binaryExpectedMultiplierLog10(p,m);
 if(value===null||!Number.isFinite(value))throw new Error("Invalid expectation");
 return value;
}
function loveGain(ambush,love,settings){
 const p=GUIDE_BASE_MULTIPLE_TITAN_CHANCE,m=magnitude("MultiMonsters",ambush);
 return weight("MultiMonsters",settings)*Math.max(0,
  expected(p+fraction("LovePotion",love),m)-expected(p,m));
}
function events(levels,settings){
 const love=level("LovePotion",levels);
 return [
  {id:"HeavyStrikes",p:settings.damage==="Heavenly Strike"?1:fraction("HeavyStrikes",level("HeavyStrikes",levels)),
   log:magnitude("HeavyStrikes",level("HeavyStrikes",levels)),guaranteed:settings.damage==="Heavenly Strike"},
  {id:"Transmutation",p:fraction("Transmutation",level("Transmutation",levels)),
   log:magnitude("Transmutation",level("Transmutation",levels)),guaranteed:false},
  {id:"MultiMonsters",p:GUIDE_BASE_MULTIPLE_TITAN_CHANCE+fraction("LovePotion",love),
   log:magnitude("MultiMonsters",level("MultiMonsters",levels)),guaranteed:false}
 ];
}
function diceGain(levels,n,settings){
 const factor=dice(n,settings);
 if(factor===1)return 0;
 return events(levels,settings).reduce((sum,event)=>{
  if(event.guaranteed)return sum;
  return sum+weight(event.id,settings)*Math.max(0,
   expected(event.p*factor,event.log)-expected(event.p,event.log));
 },0);
}
export function probabilityCouplingSkillScore(id,n,settings={}){
 if(!["LovePotion","LoadedDice"].includes(id))return 0;
 const floors=settings.minimums??{};
 n=level(id,{[id]:n});
 if(id==="LovePotion")return loveGain(level("MultiMonsters",floors),n,settings);
 return diceGain(floors,n,settings);
}
export function probabilityCouplingEvidence(levels={},settings={}){
 const chosen=Object.fromEntries(ids.map(id=>[id,level(id,levels)]));
 const floors=Object.fromEntries(ids.map(id=>[id,level(id,settings.minimums)]));
 const love=loveGain(chosen.MultiMonsters,chosen.LovePotion,settings);
 const hayst=diceGain(chosen,chosen.LoadedDice,settings);
 const creditedLove=probabilityCouplingSkillScore("LovePotion",chosen.LovePotion,settings);
 const creditedHayst=probabilityCouplingSkillScore("LoadedDice",chosen.LoadedDice,settings);
 const total=love+hayst,credited=creditedLove+creditedHayst;
 return {schema:"tt2-floor-anchored-probability-coupling-v1",floors,chosen,
  haystFactor:dice(chosen.LoadedDice,settings),
  sourceOnlyJointIncrementLog10:total,creditedIncrementLog10:credited,
  residualUnscoredLog10:Math.max(0,total-credited),
  lovePotion:{jointIncrementLog10:love,creditedIncrementLog10:creditedLove},
  loadedDice:{jointIncrementLog10:hayst,creditedIncrementLog10:creditedHayst},
  rows:events(chosen,settings).map(event=>({...event,
   probabilityWithHayst:event.guaranteed?1:event.p*dice(chosen.LoadedDice,settings),
   routeWeight:weight(event.id,settings)})),
  sourceOnly:true,accountProcRatesVerified:false,globallyExactJointModel:false,
  residualAddedToScore:false,creditedInsideSkills:true};
}
