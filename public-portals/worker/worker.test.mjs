// The integration test consumes the temporary bundle built by the verification command.
// Run PORTALS_WORKER_BUNDLE=/absolute/path/to/bundle.mjs node --test worker/worker.test.mjs
import{test}from'node:test';import assert from'node:assert/strict';
test('API rejects missing/wrong keys before touching D1; allowed CORS does not grant access',{skip:!process.env.PORTALS_WORKER_BUNDLE},async()=>{
 const {default:worker}=await import(process.env.PORTALS_WORKER_BUNDLE);
 const env={PAGES_ORIGIN:'https://maritimospelomundo.github.io',TRACK_HASH:'f'.repeat(64),SHORE_HASH:'e'.repeat(64)};
 for(const path of ['/api/position','/api/shore']){
  for(const authorization of ['',`Bearer ${'a'.repeat(43)}`]){
   const r=await worker.fetch(new Request('https://example.com'+path,{headers:{Origin:env.PAGES_ORIGIN,Authorization:authorization}}),env);
   assert.equal(r.status,401);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(r.headers.get('Access-Control-Allow-Origin'),path==='/api/position'?'*':env.PAGES_ORIGIN);
  }
 }
 const r=await worker.fetch(new Request('https://example.com/api/position',{headers:{Origin:'https://other.example'}}),env);assert.equal(r.status,401);
});

test('Windy can read positions with a valid key but cannot access shore or import', {skip:!process.env.PORTALS_WORKER_BUNDLE}, async()=>{
 const {default:worker}=await import(process.env.PORTALS_WORKER_BUNDLE);
 const key='a'.repeat(43), hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('');
 const env={PAGES_ORIGIN:'https://maritimospelomundo.github.io',TRACK_HASH:hash,DB:{prepare:()=>({bind:()=>({all:async()=>({results:[]})}),first:async()=>({checked_at:new Date().toISOString(),unavailable:0})})}};
 for(const origin of ['https://www.windy.com','https://windy.com','null','capacitor://localhost','https://other.example']){
  const headers={Origin:origin,Authorization:`Bearer ${key}`};
  const r=await worker.fetch(new Request('https://example.com/api/position',{headers}),env);
  assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'*');assert.equal(r.headers.get('Access-Control-Allow-Credentials'),null);assert.deepEqual((await r.json()).history,[]);
  const preflight=await worker.fetch(new Request('https://example.com/api/position',{method:'OPTIONS',headers:{Origin:origin}}),env);
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Methods'),'GET, OPTIONS');
  assert.equal((await worker.fetch(new Request('https://example.com/api/position',{headers:{Origin:origin}}),env)).status,401);
  for(const path of ['/api/shore','/api/import'])assert.equal((await worker.fetch(new Request('https://example.com'+path,{headers}),env)).status,403);
  assert.equal((await worker.fetch(new Request('https://example.com/api/position',{method:'POST',headers}),env)).status,403);
 }
});
