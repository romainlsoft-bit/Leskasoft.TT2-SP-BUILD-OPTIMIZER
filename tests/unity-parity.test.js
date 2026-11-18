import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditSnapshot,auditUnityDirectory,canonicalValue,parseCsv,
 readSourceRows,compareRows,PLAYABLE_SPELL_IDS,vendorRows,UNITY_84_SNAPSHOT}
 from '../scripts/unity-parity.mjs';

test('All vendored game facts match the independent Unity 8.4 snapshot',()=>{
 const result=auditSnapshot();
 assert.deepEqual(result.issues,[]);
 assert.equal(result.ok,true);
 assert.equal(PLAYABLE_SPELL_IDS.length,11);
 assert.equal(Object.keys(UNITY_84_SNAPSHOT).length,4);
});
test('Huge scientific magnitudes are normalized without IEEE754 conversion',()=>{
 assert.equal(canonicalValue('1.20e+9999'),'12e9998');
 assert.equal(canonicalValue('1.20E+00'),'12e-1');
 assert.equal(canonicalValue(1.2),'12e-1');
 assert.equal(canonicalValue('TRUE'),'true');
 assert.equal(canonicalValue('False'),'false');
 assert.equal(canonicalValue('None'),'None');
 assert.equal(canonicalValue('-'),'-');
});
test('CSV handles quoted commas, BOM and newlines',()=>{
 const rows=parseCsv('\uFEFFId,Description,Number\r\nX,"Hello, ""world""\nagain",1.20E+00\r\n');
 assert.deepEqual(rows,[{Id:'X',Description:'Hello, "world"\nagain',Number:'1.20E+00'}]);
 assert.throws(()=>parseCsv('a,b\n"hello,broken'),/Unclosed/);
 assert.throws(()=>parseCsv('a,b\nx'),/column mismatch/);
});
test('Independent source matching rejects a changed bonus even if numeric notation differs',()=>{
 assert.deepEqual(compareRows({X:{A:'1.2E+03'}},{X:{A:'1200'}}),[]);
 assert.ok(compareRows({X:{A:'1.2E+03'}},{X:{A:'1.3E+03'}})[0].includes('X.A'));
 assert.ok(!auditSnapshot({...vendorRows(),pets:{}}).ok);
});
test('Only eleven playable spell entries are compared; fairy technical placeholders are not',()=>{
 const csv='ActiveSkillID,BonusTypeA,A0,RunWhileInactive\nBurstDamage,Damage,1e3,TRUE\nAllDamageFairy,AllDamage,,FALSE\n';
 assert.deepEqual(readSourceRows('spells',csv),{BurstDamage:{BonusTypeA:'Damage',A0:'1e3',RunWhileInactive:'TRUE'}});
});