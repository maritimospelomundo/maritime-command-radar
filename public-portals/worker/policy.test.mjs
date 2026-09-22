import{test}from'node:test';import assert from'node:assert/strict';import{normalize,consolidate,prefer}from'./position-policy.mjs';
const now=Date.parse('2026-09-22T12:00:00Z');
test('exclude all three home tests, preserve later points and other sources',()=>{
 const a={id:'2493309049',latitude:10,longitude:20,dateTime:'2026-09-02T13:25:02Z'};
 const b={id:'2493489592',latitude:11,longitude:21,dateTime:'2026-09-02T20:47:56Z'};
 assert.equal(normalize(a,'SPOT',now),null);assert.equal(normalize({...b,id:undefined},'SPOT',now),null);
 assert.equal(normalize({...a,id:'2493511950',latitude:12,longitude:22,dateTime:'2026-09-02T21:45:34Z'},'SPOT',now),null);assert.ok(normalize({...a,id:'future',dateTime:'2026-09-03T00:00:00Z'},'SPOT',now));assert.ok(normalize(a,'MarineTraffic',now));
});
test('original observation time wins; source rank breaks ties; duplicates collapse',()=>{
 const a={source:'VesselAPI',latitude:1,longitude:2,dateTime:'2026-09-20T10:00:00Z'};const b={...a,source:'SPOT',dateTime:'2026-09-21T10:00:00Z'};
 const result=consolidate([a,b,{...a,source:'SPOT'},a],now);assert.equal(result.length,2);assert.equal(result[0].source,'VesselAPI');assert.equal([...result].sort(prefer)[0].source,'SPOT');
});
test('invalid and expired coordinates cannot enter track',()=>{assert.equal(normalize({latitude:NaN,longitude:0,dateTime:'2026-09-20'},'SPOT',now),null);assert.deepEqual(consolidate([{latitude:0,longitude:0,dateTime:'2026-01-01',source:'SPOT'}],now),[])});
