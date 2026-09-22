import {readFile, writeFile} from 'node:fs/promises';
const token=process.env.CLOUDFLARE_API_TOKEN, account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('Cloudflare credentials missing');
const name='abdias-public-portals';
async function api(path,body){
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();
 if(!response.ok||!data.success)throw Error(`Cloudflare request failed (${response.status}; codes ${(data.errors||[]).map(e=>e.code).join(',')})`);
 return data.result;
}
let db;
for(let page=1;page<=100;page++){
 const list=await api(`/d1/database?per_page=100&page=${page}`);
 db=list.find(d=>d.name===name);if(db||list.length<100)break;
}
if(!db)db=await api('/d1/database',{name});
const hashes=JSON.parse(await readFile(new URL('./access-hashes.json',import.meta.url),'utf8'));
for(const key of ['TRACK_HASH','SHORE_HASH','SYNC_HASH'])if(!/^[a-f0-9]{64}$/.test(hashes[key]))throw Error(`Invalid ${key}`);
await writeFile(new URL('./wrangler.json',import.meta.url),JSON.stringify({name,main:'index.ts',compatibility_date:'2026-09-01',workers_dev:true,triggers:{crons:['17 * * * *']},vars:{PAGES_ORIGIN:'https://maritimospelomundo.github.io',...hashes},d1_databases:[{binding:'DB',database_name:name,database_id:db.uuid,migrations_dir:'migrations'}]},null,2));
console.log('Cloudflare database and deployment configuration ready.');
