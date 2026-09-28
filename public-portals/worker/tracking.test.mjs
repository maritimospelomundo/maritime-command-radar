import{test}from'node:test';import assert from'node:assert/strict';
const digest=async(s)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
test('tracking requires a server session; statistics require the private sync key',{skip:!process.env.PORTALS_WORKER_BUNDLE},async()=>{
 const {default:worker}=await import(process.env.PORTALS_WORKER_BUNDLE);const key='a'.repeat(43);const env={PAGES_ORIGIN:'https://maritimospelomundo.github.io',TRACK_HASH:await digest(key),SYNC_HASH:await digest('b'.repeat(43))};const headers={Origin:env.PAGES_ORIGIN,Authorization:'Bearer '+key};
 assert.equal((await worker.fetch(new Request('https://example.com/api/tracking',{headers}),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://example.com/api/tracking/stats',{headers}),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://example.com/api/tracking/login',{headers}),env)).status,405);
 assert.equal((await worker.fetch(new Request('https://example.com/api/tracking/login',{method:'POST',headers,body:'{}'}),env)).status,403);
});
test('unknown registration and rate limit cannot mint a session',{skip:!process.env.PORTALS_WORKER_BUNDLE},async()=>{
 const {default:worker}=await import(process.env.PORTALS_WORKER_BUNDLE);const key='a'.repeat(43);let attempts=0;
 const env={PAGES_ORIGIN:'https://maritimospelomundo.github.io',TRACK_HASH:await digest(key),DB:{prepare(sql){return {bind(){return this},async run(){if(sql.startsWith('INSERT INTO tracking_attempts'))attempts++},async first(){return sql.includes('SELECT attempts')?{attempts}:null}}}}};
 const req=()=>new Request('https://example.com/api/tracking/login',{method:'POST',headers:{Authorization:'Bearer '+key},body:JSON.stringify({registration:'INVALID'})});
 assert.equal((await worker.fetch(req(),env)).status,403);attempts=20;assert.equal((await worker.fetch(req(),env)).status,429);
});
