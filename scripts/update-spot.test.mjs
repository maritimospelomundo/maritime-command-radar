import assert from 'node:assert/strict';import {updateSpot} from './update-spot.mjs';
const now=Date.parse('2026-11-01T12:00:00Z'),p={id:'one',dateTime:'2026-11-01T10:00:00Z',latitude:-48,longitude:-75};
const data={schemaVersion:5,generatedAt:'editorial',marineTrafficPosition:{keep:true},spotPosition:{lastKnown:p,history:[p],lastSyncAt:'old'}};
assert.equal(updateSpot(data,{points:[p],lastSyncAt:'2026-11-01T11:00:00Z'},now),false);assert.equal(data.spotPosition.lastSyncAt,'old');
const q={...p,id:'two',dateTime:'2026-11-01T11:00:00Z',latitude:-47.9};assert.equal(updateSpot(data,{points:[p,q],lastSyncAt:'2026-11-01T11:10:00Z'},now),true);assert.equal(data.generatedAt,'editorial');assert.deepEqual(data.marineTrafficPosition,{keep:true});assert.equal(data.spotPosition.history.length,2);
assert.throws(()=>updateSpot(data,{points:[p],lastSyncAt:'2026-11-01T11:20:00Z'},now));console.log('PASS unchanged heartbeat, new observation, unrelated blocks and rollback refusal');
