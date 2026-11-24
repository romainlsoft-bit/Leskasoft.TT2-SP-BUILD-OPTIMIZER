import test from "node:test";
import assert from "node:assert/strict";
import {parseAccountProfile} from "../src/account-profile.js";
import {resolveTranscendenceAge} from "../src/account-temporal.js";
import {resolveMonumentEvidence} from "../src/account-monuments.js";
import {extractFixedAccountPower} from "../src/account-power.js";
import {availablePets,petPassiveEvidence,OFFICIAL_SEASON13_PET_ROSTER}
 from "../src/pet-scenarios.js";

const before=new Date("2026-11-23T23:59:59.000Z");
const after=new Date("2026-11-24T00:00:00.000Z");
const season13=parseAccountProfile({
 playerStats:{"Transcendence Season":13},
 petLevels:{Pet1:150,SeasonalPet1:80,SeasonalPet2:60,SeasonalPet5:40},
 monuments:{SeasonalArtifact34:{level:50,enchanted:false}}
});

test("Game Hive start and community-only end are separately attributed",()=>{
 const b=resolveTranscendenceAge(season13,before);
 const a=resolveTranscendenceAge(season13,after);
 assert.equal(b.season,"13");
 assert.equal(b.estimatedEndDate,"2026-11-24");
 assert.equal(b.endDateSource,"community-e9wiki-unofficial");
 assert.equal(b.estimatedSeasonEnded,false);
 assert.equal(a.estimatedSeasonEnded,true);
 assert.equal(a.expirationOfficiallyConfirmed,false);
 assert.equal(b.betweenSeasons,false);
 assert.equal(a.betweenSeasons,true);
});
test("archived season-13 monument primaries and additive damage do not leak after estimated rollover",()=>{
 const b=resolveMonumentEvidence(season13,before);
 const a=resolveMonumentEvidence(season13,after);
 assert.equal(b.seasonVerified,true);
 assert.equal(a.seasonVerified,false);
 const original=b.entries.find(x=>x.id==="SeasonalArtifact34");
 const stale=a.entries.find(x=>x.id==="SeasonalArtifact34");
 assert.equal(original.damageEligible,true);
 assert.equal(stale.damageEligible,false);
 assert.equal(stale.appliedToScore,false);
 assert.equal(stale.formulaStatus,"ignored-post-season13-reset");
});
test("only Game Hive's ten season-13 pets count, and none persists past the estimated end",()=>{
 assert.equal(OFFICIAL_SEASON13_PET_ROSTER.length,10);
 const active=availablePets(season13,before).map(x=>x.id);
 assert.ok(active.includes("Pet1"));
 assert.ok(active.includes("SeasonalPet2"));
 assert.ok(active.includes("SeasonalPet5"));
 assert.ok(!active.includes("SeasonalPet1"),
  "Clang appears in the CSV but not the official season-13 pet roster");
 const old=availablePets(season13,after).map(x=>x.id);
 assert.deepEqual(old,["Pet1"]);
 const power=petPassiveEvidence(season13,after);
 assert.equal(power.seasonalImported,0);
});
test("same account profile is recached each UTC day, dropping outdated season-13 multipliers",()=>{
 const x=extractFixedAccountPower(season13,before);
 const sameDay=extractFixedAccountPower(season13,new Date("2026-11-23T12:00:00Z"));
 const y=extractFixedAccountPower(season13,after);
 assert.equal(x,sameDay);
 assert.notEqual(x,y);
 assert.equal(x.monumentEffects.seasonVerified,true);
 assert.equal(y.monumentEffects.seasonVerified,false);
 assert.equal(y.monumentEffects.additiveDamageApplied,false);
 assert.equal(y.petPassives.seasonalImported,0);
});
test("missing/new season roster never infers season-14 pet effects from season-13 data",()=>{
 const later=parseAccountProfile({
  playerStats:{"Transcendence Season":14},
  petLevels:{Pet1:10,SeasonalPet2:90}
 });
 assert.deepEqual(availablePets(later,after).map(x=>x.id),["Pet1"]);
 const unknown=parseAccountProfile({petLevels:{Pet1:10,SeasonalPet2:90}});
 assert.ok(availablePets(unknown,before).some(x=>x.id==="SeasonalPet2"),
  "Unstated season retains the prior positive-export evidence without claiming season-13 parity");
});
