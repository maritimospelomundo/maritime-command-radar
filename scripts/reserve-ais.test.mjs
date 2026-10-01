import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reserve} from './reserve-ais.mjs';
test('hourly recovery reserves at most four daily calls, including failures',()=>{
 let ledger={entries:[]},count=0;
 for(let h=3;h<27;h++){
  const next=reserve(ledger,new Date(Date.UTC(2026,9,2,h,21)));
  if(next){count++;ledger=next;}
 }
 assert.equal(count,4);
 assert.deepEqual(ledger.entries.map(e=>e.slot),[0,1,2,3]);
});
test('late delivery uses actual slot; retry cannot spend again',()=>{
 const at=new Date('2026-10-02T20:21:00Z');
 const ledger=reserve({entries:[]},at);
 assert.equal(ledger.entries[0].slot,2);
 assert.equal(reserve(ledger,at),null);
 assert.ok(reserve(ledger,new Date('2026-10-02T21:21:00Z')));
});
test('daily cap remains enforced even with malformed repeated slots',()=>{
 assert.equal(reserve({entries:Array.from({length:4},()=>({day:'2026-10-02',slot:0,at:'2026-10-02T03:21:00Z'}))},new Date('2026-10-02T21:21:00Z')),null);
});

test('migration blocks all slots on actual activation day, even after delayed approval',()=>{
 const at=new Date('2026-10-05T16:00:00Z');
 const ledger=reserve({bootstrap:true,entries:[]},at);
 assert.equal(ledger.entries.length,4);
 assert.equal(reserve(ledger,at),null);
 assert.ok(reserve(ledger,new Date('2026-10-06T03:21:00Z')));
});
