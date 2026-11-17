import {test} from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile,profileCoverage,PROFILE_SECTION_NAMES} from "../src/account-profile.js";
import {parseExport} from "../src/engine.js";
import {scoreAtLevel} from "../src/effects.js";

test("Full TT2 8.4 export recognizes account mechanics, not private player identity",()=>{
 const raw={
  Version:"8.4.0",Skills:{PetDmg:2},
  playerName:"PERSONAL_PLAYER_NAME",accountId:"PRIVATE_ACCOUNT_ID",email:"private@example.test",
  playerStats:{"Skill Points Owned":600,"Crafting Power":4,"Titan Souls":"1.2e999","Lifetime Relics":"3.5E+1200"},
  artifacts:{"Book of Shadows":{Level:"1.33e9999",IsEnchanted:true}},
  gemstones:Array.from({length:24},(_,i)=>({id:"Gem"+i,Level:i+1,PrimaryBonus:"AllDamage"})),
  gemstonesResearch:{"gem-a":{Level:10}},titanCards:[{Name:"Titan A",Level:12}],
  forbiddenResearch:{"node-one":{Level:6}},petLevels:{"Mousy":134},
  passiveSkills:{"Arcane Bargain":4},monuments:{"Ancient One":{Level:"1e400"}},
  heroWeapons:{"Hero 1":3},equipmentSets:["MultiCast","DarkAngel","SteampunkKnight"],
  equippedEquipment:{"Slash":{Name:"Pet Slash",Level:10}},
  equipmentInventory:[{id:"Sword1",name:"Mighty Sword",slot:"Sword",bonusType:"AllDamage",bonusAmount:"2e80"}]
 };
 const parsed=parseExport(JSON.stringify(raw)),p=parsed.profile;
 assert.equal(p.gameVersion,"8.4.0");
 assert.equal(p.stats.titanSouls,"1.2e999");
 assert.equal(p.stats.lifetimeRelics,"3.5E+1200");
 assert.equal(p.sections.artifacts.records[0].level,"1.33e9999");
 assert.equal(p.sections.artifacts.records[0].enchanted,true);
 assert.equal(p.sections.gemstones.count,24);
 assert.equal(p.sections.equipmentInventory.count,1);
 assert.equal(p.sections.equipmentInventory.records[0].bonusAmount,"2e80");
 assert.ok(p.fixedSystemKeys.includes("gemstones"));
 assert.ok(p.fixedSystemKeys.includes("forbiddenResearch"));
 for(const section of ["mysticResearch","titanCards","forbiddenResearch","equippedGear"])
  assert.equal(p.sections[section].count,1);
 assert.equal(p.ownedSetIds.length,3);
 assert.equal(parsed.sets.FB,true);
 assert.equal(parsed.sets.tFA,true);
 assert.equal(parsed.sets.Rygal,true);
 assert.equal(parsed.skillPoints,600);
 assert.equal(parsed.craftingPower,4);
 for(const secret of ["PERSONAL_PLAYER_NAME","PRIVATE_ACCOUNT_ID","private@example.test"])
  assert.ok(!JSON.stringify(p).includes(secret));
 assert.ok(profileCoverage(p).some(x=>x.key==="gemstones"&&x.count===24));
 const context={damage:"Pet",gold:"Fairy",goldWeight:0.7,sets:parsed.sets};
 assert.ok(Number.isFinite(scoreAtLevel("SummonerAutoTap",10,context)));
 assert.ok(Number.isFinite(scoreAtLevel("SummonerAutoTap",10,{...context,sets:{}})));
});
test("Skill-tree-only exports and pre-8.0 gemstone schemas stay compatible",()=>{
 const parsed=parseExport('{"Version":"8.4.0","Skills":{"TapDmg":1}}');
 assert.equal(parsed.levels.TapDmg,1);
 assert.equal(profileCoverage(parsed.profile).length,0);
 assert.equal(parsed.profile.sections.gemstones.present,false);
 assert.deepEqual(parsed.profile.ownedSetIds,[]);
 const old=parseAccountProfile({Version:"7.18.0",gemstones:Array.from({length:10},(_,i)=>({Id:"Gem"+i,Level:1}))});
 assert.equal(old.sections.gemstones.count,10);
 assert.equal(old.sections.mysticResearch.present,false);
 assert.equal(parseAccountProfile({gemstones:null}).sections.gemstones.present,false);
 assert.equal(PROFILE_SECTION_NAMES.length,13);
});
test("Import is bounded and rejects unsafe keys",()=>{
 const p=parseAccountProfile({
  gemstones:Array.from({length:600},(_,i)=>({id:"g"+i,level:i})),
  artifacts:JSON.parse('{"__proto__":4,"constructor":4,"prototype":4,"safe":7}')
 });
 assert.equal(p.sections.gemstones.count,600);
 assert.equal(p.sections.gemstones.records.length,512);
 assert.equal(p.sections.gemstones.truncated,true);
 assert.deepEqual(p.sections.artifacts.records.map(x=>x.id),["safe"]);
});
