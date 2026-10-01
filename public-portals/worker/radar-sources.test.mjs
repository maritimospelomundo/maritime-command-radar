import {test} from 'node:test';
import assert from 'node:assert/strict';
import {radarPositions,URLS} from './radar-sources.mjs';
const point={dateTime:new Date().toISOString(),latitude:-23.13,longitude:-44.48};
const payload={vesselApiPosition:{lastKnown:point}};
test('raw repository recovers Pages outage',async()=>{
 const p=await radarPositions(async url=>url===URLS[0]?Response.json(payload):new Response('',{status:503}));
 assert.equal(p.length,1);assert.equal(p[0].dateTime,point.dateTime);
});
test('Pages recovers raw repository timeout',async()=>{
 assert.equal((await radarPositions(async url=>{if(url===URLS[0])throw Error('timeout');return Response.json(payload)})).length,1);
});
test('both failures remain an explicit unavailable state',async()=>{
 await assert.rejects(radarPositions(async()=>Response.json({})),/Both radar sources unavailable/);
});
test('both copies retain their points so newer raw data is not lost to stale Pages',async()=>{
 const old={...point,dateTime:new Date(Date.now()-3600000).toISOString()};
 const points=await radarPositions(async url=>Response.json(url===URLS[0]?payload:{vesselApiPosition:{lastKnown:old}}));
 assert.equal(points.length,2);assert.equal(points[0].dateTime,point.dateTime);
});
