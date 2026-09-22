// The integration test consumes the temporary bundle built by the verification command.
// Run PORTALS_WORKER_BUNDLE=/absolute/path/to/bundle.mjs node --test worker/worker.test.mjs
import{test}from'node:test';import assert from'node:assert/strict';
test('API rejects missing/wrong keys before touching D1; allowed CORS does not grant access',{skip:!process.env.PORTALS_WORKER_BUNDLE},async()=>{
 const {default:worker}=await import(process.env.PORTALS_WORKER_BUNDLE);
 const env={PAGES_ORIGIN:'https://maritimospelomundo.github.io',TRACK_HASH:'f'.repeat(64),SHORE_HASH:'e'.repeat(64)};
 for(const path of ['/api/position','/api/shore']){
  for(const authorization of ['',`Bearer ${'a'.repeat(43)}`]){
   const r=await worker.fetch(new Request('https://example.com'+path,{headers:{Origin:env.PAGES_ORIGIN,Authorization:authorization}}),env);
   assert.equal(r.status,401);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(r.headers.get('Access-Control-Allow-Origin'),env.PAGES_ORIGIN);
  }
 }
 const r=await worker.fetch(new Request('https://example.com/api/position',{headers:{Origin:'https://other.example'}}),env);assert.equal(r.status,403);
});
