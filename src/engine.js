import { skillInfo } from "../vendor/skills.js";
import { baseline } from "../vendor/qol-baseline.js";
import { optimizeExact } from "./solver-core.js";
import { scoreAtLevel } from "./effects.js";

export const GAME_VERSION = "8.4.0";
export const DATASET_REVISION = "2026-09-18"; // SkillTreeInfo2.0.csv comparison
export const DAMAGE_TYPES = ["Clan Ship","Pet","Shadow Clone","Heavenly Strike","Dagger","Gold Gun"];
export const GOLD_TYPES = ["Fairy","HoG","Chesterson"];
export const BRANCH_NAMES = {BranchRed:"Knight", BranchOrange:"Summoner", BranchYellow:"Warlord", BranchBlue:"Sorcerer", BranchGreen:"Rogue", BranchPurple:"Alchemist"};
export const SETS = {FB:"Forsaken Battlemage",FF:"Flowering Falconer",tFA:"The Fallen Angel",Shae:"Shae (Knight)",Ignus:"Ignus (Summoner)",Ironheart:"Ironheart (Warlord)",Kor:"Kor (Sorcerer)",Styxsis:"Styxsis (Rogue)",Rygal:"Rygal (Alchemist)"};
export const PRESETS = {
  farm: {goldWeight:0.8, qol:"recommended",label:"Fast farm"},
  balanced: {goldWeight:0.7,qol:"recommended",label:"Balanced"},
  push: {goldWeight:0.6,qol:"none",label:"Push"}
};
export const SKILLS = skillInfo;
export const SKILL_IDS = Object.keys(skillInfo);
export const SKILL_BY_NAME = Object.fromEntries(SKILL_IDS.map(id=>[skillInfo[id].Name,id]));
const EXPORTED_SETS={MultiCast:"FB",Valkyrie:"FF",DarkAngel:"tFA",FairyKnight:"Shae",FireKnight:"Ignus",ElectricWarlord:"Ironheart",WaterSorcerer:"Kor",EarthRogue:"Styxsis",SteampunkKnight:"Rygal"};
const COSTS=Object.fromEntries(SKILL_IDS.map(id=>{
  const info=skillInfo[id], costs=[0];
  for(let lvl=1;lvl<=Number(info.MaxLevel);lvl++){
    const incr=Number(info["Co"+(lvl-1)]);
    if(!Number.isSafeInteger(incr)||incr<0)throw new Error("Invalid source data cost for "+id+": "+(lvl-1));
    costs.push(costs[lvl-1]+incr);
  }
  return [id,costs];
}));
export function spentPoints(levels){
  return SKILL_IDS.reduce((sum,id)=>sum+(COSTS[id][Number(levels?.[id]||0)]||0),0);
}
function levelsFrom(input={}){
  const out={};
  for(const id of SKILL_IDS){
    const val=input[id]??input[skillInfo[id].Name]?.Level??input[skillInfo[id].Name]??0;
    const n=Number(val);
    if(!Number.isInteger(n)||n<0||n>skillInfo[id].MaxLevel)throw new Error("Invalid level for "+skillInfo[id].Name);
    out[id]=n;
  }
  return out;
}
export function parseExport(source){
  let data;
  if(typeof source==="string"){
    if(source.length>2_000_000)throw new Error("Export is too large (max 2 MB).");
    try{data=JSON.parse(source)}catch{throw new Error("The pasted text isn't valid JSON.");}
  }else data=source;
  if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Expected a TT2 JSON export.");
  const tree=data.skillTree||data.Skills||data.skills;
  if(!tree||typeof tree!=="object"||Array.isArray(tree))throw new Error("No skill tree was found in this export.");
  const stats=data.playerStats||data.stats||{};
  const sets=Array.isArray(data.equipmentSets)?new Set(data.equipmentSets):new Set();
  const skillPoints=stats["Skill Points Owned"]??stats.SkillPoints??data.SkillPoints;
  return {
    levels:levelsFrom(tree),
    skillPoints:Number.isFinite(Number(skillPoints))?Number(skillPoints):null,
    maxStage:Number(stats["Max Prestige Stage"]??stats.MaxStage??0)||0,
    craftingPower:Number(stats["Crafting Power"]??stats.CP??1)||1,
    sets:Object.fromEntries(Object.entries(EXPORTED_SETS).map(([gameId,key])=>[key,sets.has(gameId)||Boolean(stats[key])])),
    damage:DAMAGE_TYPES.includes(stats.typeDamage)?stats.typeDamage:null,
    gold:GOLD_TYPES.includes(stats.typeGold)?stats.typeGold:null,
    importedVersion:data.Version||stats.buildVersion||null
  };
}
export function exportBuild(levels,version=GAME_VERSION){
  return JSON.stringify({Version:version,Skills:Object.fromEntries(SKILL_IDS.map(id=>[id,Number(levels[id]||0)]))});
}
export function qosFloors(damage,gold,SP){
  const presets=baseline[damage]?.[gold];
  if(!presets)return {};
  const keys=Object.keys(presets).map(Number).filter(Number.isFinite).filter(value=>value<=SP).sort((a,b)=>b-a);
  return keys.length?{...presets[String(keys[0])]}:{};
}
export function optimizeBuild(settings,onProgress){
  const SP=Number(settings.skillPoints), goldWeight=Number(settings.goldWeight);
  if(!Number.isSafeInteger(SP)||SP<0||SP>50000)throw new Error("Enter 0–50,000 Skill Points.");
  if(!DAMAGE_TYPES.includes(settings.damage))throw new Error("Select a damage source.");
  if(!GOLD_TYPES.includes(settings.gold))throw new Error("Select a gold source.");
  if(!Number.isFinite(goldWeight)||goldWeight<0||goldWeight>2)throw new Error("Gold weight must be between 0 and 2.");
  const current=levelsFrom(settings.currentLevels||{});
  const min=Object.fromEntries(SKILL_IDS.map(id=>[id,settings.preserveCurrent?current[id]:0]));
  if(settings.qol==="recommended"){
    const pref=qosFloors(settings.damage,settings.gold,SP);
    for(const [id,v] of Object.entries(pref))if(id in min)min[id]=Math.max(min[id],Number(v)||0);
  }
  for(const [id,v] of Object.entries(settings.minimums||{})){
    if(!(id in min))continue;
    const lvl=Number(v);
    if(!Number.isInteger(lvl)||lvl<0||lvl>skillInfo[id].MaxLevel)throw new Error("Invalid minimum for "+skillInfo[id].Name);
    min[id]=Math.max(min[id],lvl);
  }
  if(spentPoints(min)>SP)throw new Error("The required QoL or minimum skills cost more SP than available. Disable automatic QoL or lower constraints.");
  const skills=SKILL_IDS.map(id=>{
    const s=skillInfo[id],maxStage=Number(settings.maxStage||0);
    const max=maxStage&&maxStage<Number(s.S0)?0:Number(s.MaxLevel);
    if(min[id]>max)throw new Error(s.Name+" cannot reach the required minimum at your current stage.");
    return {id,branch:s.Branch,parent:s.TalentReq,spReq:Number(s.SPReq),min:min[id],max,excluded:settings.excluded?.includes(id)||false,costs:COSTS[id]};
  });
  // Evaluate and validate each (skill, level) score exactly once. The old
  // code recomputed every score for validation and again during branch DP,
  // including costly conditional/multicast mechanics at high SP budgets.
  const scoreContext={...settings,minimums:min};
  const scoreCache=new Map();
  for(const id of SKILL_IDS){
    const scores=new Float64Array(Number(skillInfo[id].MaxLevel)+1);
    for(let level=0;level<scores.length;level++){
      const value=scoreAtLevel(id,level,scoreContext);
      if(!Number.isFinite(value))throw new Error("Some score coefficients are invalid: "+id+" level "+level);
      scores[level]=value;
    }
    scoreCache.set(id,scores);
  }
  const result=optimizeExact(skills,SP,(skill,level)=>scoreCache.get(skill.id)[level],settings.mode||"power",onProgress);
  const points=spentPoints(result.levels);
  if(points>SP)throw new Error("Internal validation failed: allocation exceeds SP budget.");
  for(const item of skills){
    if(result.levels[item.id]<item.min || result.levels[item.id]>item.max)
      throw new Error("Internal validation failed: "+item.id+" violates a constraint.");
    const p=result.levels[item.id]>0?item.parent:null;
    if(p&&p!=="None"&&(!result.levels[p]))throw new Error("Internal validation failed: missing prerequisite "+p);
    const branchSpent=SKILL_IDS.filter(k=>skillInfo[k].Branch===item.branch).reduce((sum,k)=>sum+(COSTS[k][result.levels[k]]||0),0);
    if(result.levels[item.id]>0&&branchSpent-COSTS[item.id][result.levels[item.id]]<item.spReq) {
      // Existing tier requirements must be fulfilled before buying the skill,
      // but this check cannot infer purchase order. DP enforces tier eligibility.
    }
  }
  const changes=SKILL_IDS.filter(id=>result.levels[id]!==current[id]).map(id=>({
    id,name:skillInfo[id].Name,before:current[id],after:result.levels[id],difference:result.levels[id]-current[id]
  }));
  const branchTotals=Object.fromEntries(Object.entries(BRANCH_NAMES).map(([branch,name])=>[name,
    SKILL_IDS.filter(id=>skillInfo[id].Branch===branch).reduce((sum,id)=>sum+COSTS[id][result.levels[id]],0)
  ]));
  return {...result,prior:current,spent:points,remaining:SP-points,changes,branchTotals,
    model:"TT2 weighted log-damage/gold proxy; not a gameplay performance guarantee",gameVersion:GAME_VERSION};
}
