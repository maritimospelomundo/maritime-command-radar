import {shoreSchema} from './shore-schema';
import {normalize,consolidate,prefer} from './position-policy.mjs';
const RADAR='https://maritimospelomundo.github.io/maritime-command-radar/data/latest.json';
const SPOT='https://spot-vessel-position.maritimospelomundo.workers.dev/api/positions?days=90&limit=2000';
async function authorized(request:Request,expected:string){
 const value=request.headers.get('Authorization')||'';
 if(!expected||!/^Bearer [A-Za-z0-9_-]{40,100}$/.test(value))return false;
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value.slice(7)));
 return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')===expected;
}
async function save(env:any,points:any[]){
 const accepted=consolidate(points);const statements=accepted.map((p:any)=>env.DB.prepare('INSERT INTO vessel_positions(id,data,recorded_ms) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind([p.source,p.dateTime,p.latitude,p.longitude].join('|'),JSON.stringify(p),Date.parse(p.dateTime)));
 for(let i=0;i<statements.length;i+=50)await env.DB.batch(statements.slice(i,i+50));
 await env.DB.prepare('DELETE FROM vessel_positions WHERE recorded_ms < ?').bind(Date.now()-90*86400000).run();
 return accepted.length;
}
async function positions(env:any){const rows=await env.DB.prepare('SELECT data FROM vessel_positions WHERE recorded_ms >= ? ORDER BY recorded_ms ASC').bind(Date.now()-90*86400000).all();return consolidate(rows.results.map((r:any)=>JSON.parse(r.data)));}
async function sync(env:any){
 const sources=await Promise.allSettled([fetch(RADAR,{signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw Error('radar HTTP '+r.status);const d:any=await r.json();return [['vesselApiPosition','VesselAPI'],['marineTrafficPosition','MarineTraffic'],['spotPosition','SPOT']].flatMap(([key,source])=>[...(Array.isArray(d[key]?.history)?d[key].history:[]),d[key]?.lastKnown].map(p=>normalize(p,source)).filter(Boolean))}),fetch(SPOT,{signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw Error('spot HTTP '+r.status);const d:any=await r.json();if(!Array.isArray(d.points))throw Error('spot');return d.points.map((p:any)=>normalize(p,'SPOT')).filter(Boolean)})]);
 for(const result of sources)if(result.status==='fulfilled')await save(env,result.value);
 await env.DB.prepare('INSERT INTO sync_state(id,checked_at,unavailable) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,unavailable=excluded.unavailable').bind(new Date().toISOString(),Number(sources.some(s=>s.status==='rejected'))).run();
 return sources.map((s,i)=>({source:i===0?'radar':'spot',ok:s.status==='fulfilled',...(s.status==='rejected'?{error:String(s.reason?.message||'unavailable')}:{points:s.value.length})}));
}
export default {
 async scheduled(_event:any,env:any,ctx:any){ctx.waitUntil(sync(env))},
 async fetch(request:Request,env:any){
 const origin=request.headers.get('Origin');const allowed=origin===env.PAGES_ORIGIN;
 const headers:Record<string,string>={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Vary':'Origin'};
 if(allowed){headers['Access-Control-Allow-Origin']=origin!;headers['Access-Control-Allow-Headers']='Authorization, Content-Type';headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';}
 const json=(data:any,status=200)=>Response.json(data,{status,headers});
 if(origin&&!allowed)return json({error:'Origem não autorizada.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const path=new URL(request.url).pathname;
 const scope=path==='/api/position'?'TRACK_HASH':path==='/api/shore'?'SHORE_HASH':path==='/api/import'?'SYNC_HASH':null;
 if(!scope)return json({error:'Não encontrado.'},404);
 if(!await authorized(request,env[scope]))return json({error:'Link inválido ou incompleto.'},401);
 try{
 if(path==='/api/import'){
  if(request.method!=='POST')return json({error:'Método não permitido.'},405);
  const raw=await request.text();if(raw.length>3500000)return json({error:'Limite excedido.'},413);
  const data=JSON.parse(raw);
  if(data.shore){const shore=shoreSchema.parse(data.shore);await env.DB.prepare('INSERT INTO publications(id,data,captured_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,captured_at=excluded.captured_at WHERE excluded.captured_at > publications.captured_at').bind('shore',JSON.stringify(shore),shore.capturedAt).run();}
  if(data.positions&&!Array.isArray(data.positions))return json({error:'Posições inválidas.'},400);
  const accepted=await save(env,(data.positions||[]).slice(0,5000));const sourceStatus=data.refresh===true?await sync(env):undefined;return json({ok:true,accepted,sourceStatus});
 }
 if(request.method!=='GET')return json({error:'Método não permitido.'},405);
 const history=await positions(env),position=[...history].sort(prefer)[0]||null;
 const state=await env.DB.prepare('SELECT checked_at,unavailable FROM sync_state WHERE id=1').first();
 const unavailable=!state||!!state.unavailable||Date.now()-Date.parse(state.checked_at)>2*3600000;
 if(path==='/api/position')return json({history,position,sources:['VesselAPI','MarineTraffic','SPOT'].map(s=>[...history].filter(p=>p.source===s).sort(prefer)[0]).filter(Boolean),retentionDays:90,unavailable,storageUnavailable:false,checkedAt:new Date().toISOString()});
 const pub=await env.DB.prepare("SELECT data FROM publications WHERE id='shore'").first();
 if(!pub)return json({error:'Aguardando a primeira publicação do Comandante.'},503);
 return json({data:JSON.parse(pub.data),positions:history.filter(p=>Date.parse(p.dateTime)>=Date.now()-15*86400000),position,positionUnavailable:unavailable,checkedAt:new Date().toISOString()});
 }catch{return json({error:'Consulta ou atualização indisponível.'},503)}
 }
};
