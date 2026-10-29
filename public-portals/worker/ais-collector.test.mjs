import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {collectAis,collectorState,observation,decision} from './ais-collector.mjs';
const now=Date.parse('2026-10-29T18:51:00Z');
const inside={source:'MarineTraffic',latitude:-52.494333,longitude:-68.623833,dateTime:'2026-10-29T15:07:00Z'};
function setup(health={}){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('./migrations/0004_ais_collector.sql',import.meta.url),'utf8'));
 const initial={ledger:{entries:[]},health:{quotaRemaining:137,quotaAt:'2026-10-29T14:25:00Z',...health}};
 sqlite.prepare('INSERT INTO ais_collector VALUES(1,0,?)').run(JSON.stringify(initial));
 const DB={prepare(sql){const stmt=sqlite.prepare(sql);return {bind(...args){return {async run(){const r=stmt.run(...args);return {meta:{changes:Number(r.changes)}}},async first(){return stmt.get(...args)}}},async first(){return stmt.get()}}}};
 return {DB,VESSELAPI_API_KEY:'test-only'};
}
const noData=()=>Promise.resolve(new Response(null,{status:404,headers:{'x-ratelimit-remaining':'136'}}));
test('stale inside position still schedules once and records provider no_data',async()=>{
 const env=setup();let count=0;
 await collectAis(env,[inside],async()=>{},async()=>{count++;return noData()},now);
 await collectAis(env,[inside],async()=>{},async()=>{count++;return noData()},now+1000);
 assert.equal(count,1);const s=await collectorState(env);
 assert.equal(s.ledger.entries[0].area,'Magalhães');assert.equal(s.health.status,'no_data');assert.equal(s.health.quotaRemaining,136);
});
test('overlapping runs reserve at most one external request',async()=>{
 const env=setup();let count=0,release;
 const blocked=new Promise(r=>release=r);
 const fetcher=async()=>{count++;await blocked;return noData()};
 const a=collectAis(env,[inside],async()=>{},fetcher,now);
 const b=collectAis(env,[inside],async()=>{},fetcher,now);
 await new Promise(r=>setTimeout(r,10));release();await Promise.all([a,b]);
 assert.equal(count,1);assert.equal((await collectorState(env)).ledger.entries.length,1);
});
test('recent alternative and missing key never spend a credit',async()=>{
 for(const missing of [false,true]){
  const env=setup();if(missing)delete env.VESSELAPI_API_KEY;
  let count=0;await collectAis(env,missing?[inside]:[{...inside,dateTime:new Date(now-10*60000).toISOString()}],async()=>{},async()=>{count++;return noData()},now);
  assert.equal(count,0);assert.equal((await collectorState(env)).ledger.entries.length,0);
 }
});
test('quota floor stops intensity within an already used baseline slot',()=>{
 const ledger={entries:[{day:'2026-10-29',slot:2,at:'2026-10-29T15:51:00Z'}]};
 const h={quotaRemaining:120,quotaAt:new Date(now).toISOString()};
 assert.equal(decision(ledger,h,[inside],now).next,null);
});
test('authentication failures block later requests and never expose secrets',async()=>{
 const env=setup();let count=0;
 const fetcher=async()=>{count++;return new Response('secret-body',{status:401})};
 await collectAis(env,[inside],async()=>{},fetcher,now);
 await collectAis(env,[inside],async()=>{},fetcher,now+HOUR);
 const s=await collectorState(env);assert.equal(count,1);assert.equal(s.health.authBlocked,true);assert.ok(!JSON.stringify(s).includes('secret'));
});
const HOUR=3600000;
test('429 preserves Retry-After and reservation; network error cannot silently retry',async()=>{
 const env=setup();await collectAis(env,[inside],async()=>{},async()=>new Response(null,{status:429,headers:{'retry-after':'7200'}}),now);
 const s=await collectorState(env);assert.equal(s.ledger.entries.length,1);assert.equal(Date.parse(s.health.nextAttemptAt),now+2*HOUR);
});
test('valid observation saved centrally with original time, speed and course',async()=>{
 const env=setup();let saved;
 await collectAis(env,[inside],async(_,p)=>{saved=p},async()=>Response.json({vesselPosition:{latitude:-52.5,longitude:-69,timestamp:'2026-10-29T18:45:00Z',sog:11,cog:270,imo:9453896}},{headers:{'x-ratelimit-remaining':'136'}}),now);
 assert.equal(saved[0].dateTime,'2026-10-29T18:45:00.000Z');assert.equal(saved[0].sog,11);assert.equal((await collectorState(env)).health.status,'ok');
});
test('invalid, future, wrong-vessel and null coordinates never become a position',()=>{
 const p={latitude:-52.5,longitude:-69,timestamp:'2026-10-29T18:45:00Z'};
 for(const v of [{...p,latitude:null},{...p,imo:123},{...p,timestamp:'2026-10-30T18:45:00Z'},{...p,suspected_glitch:true}])assert.throws(()=>observation(v,now));
});
