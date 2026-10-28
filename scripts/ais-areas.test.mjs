import {test} from 'node:test';
import assert from 'node:assert/strict';
import {areaFor,canIntensify} from './ais-areas.mjs';
import {reserve} from './reserve-ais.mjs';
const now=new Date('2026-10-28T12:51:00Z');
const p=(latitude,longitude,dateTime=now.toISOString())=>({latitude,longitude,dateTime});
const data=p=>({spotPosition:{lastKnown:p}});
const health={quotaRemaining:140,quotaAt:now.toISOString()};
test('detects Magellan and Patagonian envelopes, excludes Atlantic approach',()=>{
 assert.equal(areaFor(data(p(-52.45,-69.5)),now),'Magalhães');
 assert.equal(areaFor(data(p(-53.16,-70.91)),now),'Magalhães');
 assert.equal(areaFor(data(p(-49,-74.7)),now),'Canais patagônicos');
 assert.equal(areaFor(data(p(-48,-63.3)),now),null);
 assert.equal(areaFor(data(p(-52,-66)),now),null);
});
test('stale, future and estimated fixes cannot activate mode; newest real exit wins',()=>{
 for(const point of [p(-52.45,-69.5,'2026-10-27T12:00:00Z'),p(-52.45,-69.5,'2026-10-29T12:00:00Z'),{...p(-52.45,-69.5),estimated:true}])assert.equal(areaFor(data(point),now),null);
 const d=data(p(-52.45,-69.5,'2026-10-28T12:00:00Z'));d.vesselApiPosition={lastKnown:p(-52,-66)};assert.equal(areaFor(d,now),null);
});
test('quota must be fresh and above protected reserve',()=>{
 assert.equal(canIntensify(health,now),true);
 for(const h of [{},{...health,quotaRemaining:120},{...health,quotaAt:'2026-10-27T00:00:00Z'}])assert.equal(canIntensify(h,now),false);
});
test('intensifies within same normal slot, enforces 30 min and returns to normal outside',()=>{
 const ledger={entries:[{day:'2026-10-28',slot:1,at:'2026-10-28T12:21:00Z'}]};
 const context={data:data(p(-52.45,-69.5)),health};
 const next=reserve(ledger,now,context);assert.equal(next.entries.at(-1).mode,'restricted');
 assert.equal(reserve(next,new Date('2026-10-28T13:10:00Z'),context),null);
 assert.equal(reserve(ledger,now,{...context,data:data(p(-52,-66))}),null);
 assert.equal(reserve(ledger,now,{...context,health:{}}),null);
 assert.equal(reserve(ledger,now,{...context,health:{...health,authBlocked:true}}),null);
 assert.equal(reserve(ledger,now,{...context,health:{...health,nextAttemptAt:'2026-10-29T00:00:00Z'}}),null);
});
