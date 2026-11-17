import {skillInfo} from "../vendor/skills.js";
import {ACTIVE_SPELL_CAPS} from "../vendor/active-spell-caps.js";
const SPELLS_BY_SKILL={
 TwilightBell:["BurstDamage","TwilightFairy"],
 SummonerAutoTap:["DualPet","TapBoost"],
 PhantomBlades:["CritBoost","StreamOfBlades"],
 AlchemistMastery:["HandOfMidas","GoldenMissile"]
};
const SKILL_BY_SPELL=Object.fromEntries(Object.entries(SPELLS_BY_SKILL).flatMap(
 ([skill,spells])=>spells.map(spell=>[spell,skill])));
export function spellCapBonus(skillId,level){
 const item=skillInfo[skillId],n=Number(level);
 if(!item||!SPELLS_BY_SKILL[skillId]||!Number.isInteger(n)||n<0||n>item.MaxLevel)return 0;
 const bonus=Number(item["B"+n]);
 return Number.isInteger(bonus)&&bonus>=0?bonus:0;
}
export function resolveSpellCaps(settings,levels={}){
 const stage=Number(settings?.maxStage);
 const assumeAllActive=settings?.assumeMaxSpells===true||(Number.isFinite(stage)&&stage>=15000);
 const fallenAngel=Boolean(settings?.sets?.tFA||settings?.accountProfile?.ownedSetIds?.includes("DarkAngel"));
 const spells={};let unmodeled=0;
 for(const [id,data] of Object.entries(ACTIVE_SPELL_CAPS)){
  const skill=SKILL_BY_SPELL[id],extra=skill?spellCapBonus(skill,levels[skill]||0):0;
  const cap=data.baseCap+(fallenAngel?5:0)+extra;
  const available=data.required==="None"||Number(levels[data.required]||0)>0;
  const missing=available&&assumeAllActive?Math.max(0,cap-data.maxTabulated):0;
  if(missing>0)unmodeled++;
  spells[id]={cap,tabulatedLevel:Math.min(cap,data.maxTabulated),unmodeledLevels:missing,
   assumedActive:available&&assumeAllActive,available,bonusFromSP:extra,
   bonusFromSet:fallenAngel?5:0};
 }
 return {spells,assumeAllActive,fallenAngel,unmodeledSpells:unmodeled,
  complete:assumeAllActive&&unmodeled===0};
}
