/**
 * Gold-source routing shared by skill, gear and fixed-account paths.
 * Chesterson amount boosts Fairy chest gold even without a Chesterson
 * titan on screen (TT2 Compendium: Chesterson Incense / Pet-Fairy).
 * Duration and spawn-chance bonuses have no multiplicative conversion.
 */
export function goldSourceReduction(type,gold){
 switch(type){
  case "GoldAll":return 1;
  case "FairyGold":return gold==="Fairy"?1:0;
  case "GoldBoss":return gold==="HoG"?1:0;
  case "ChestAmount":
  case "GoldChesterson":return gold==="Fairy"||gold==="Chesterson"?1:0;
  case "ChestersonGoldStageAmount":return null;
  default:return null;
 }
}
