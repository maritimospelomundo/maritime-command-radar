import {reserve} from '../../scripts/ais-policy.mjs';
import {areaFor,recentAlternative,canIntensify} from '../../scripts/ais-areas.mjs';
import seedLedger from '../../data/ais-request-ledger.json' with {type:'json'};
import seedHealth from '../../site/data/ais-health.json' with {type:'json'};

const HOUR=3600000;
export const AIS_URL='https://api.vesselapi.com/v1/vessel/9453896/position?filter.idType=imo';
const iso=ms=>new Date(ms).toISOString();
export async function collectorState(env){
 const row=await env.DB.prepare('SELECT version,data FROM ais_collector WHERE id=1').first();
 return row?{version:row.version,...JSON.parse(row.data)}:null;
}
function contextFor(points){
 return Object.fromEntries([['SPOT','spotPosition'],['MarineTraffic','marineTrafficPosition'],['VesselAPI','vesselApiPosition']].map(([source,key])=>[key,{history:points.filter(p=>p.source===source)}]));
}
export function decision(ledger,health,points,now){
 const data=contextFor(points),date=new Date(now),area=areaFor(data,date);
 const next=reserve(ledger,date,{data,health});
 const reason=next?'request_reserved':recentAlternative(data,date)?'recent_alternative':health.authBlocked?'authentication_blocked':Date.parse(health.nextAttemptAt)>now?'provider_backoff':area&&!canIntensify(health,date)?'quota_reserve_or_unknown':'interval_or_normal_budget';
 return {next,area,reason};
}
export function observation(payload,now){
 let p=payload?.vesselPosition??payload?.position??payload?.data?.position??payload?.data??payload;
 if(Array.isArray(p))p=p[0];
 const lat=p?.latitude??p?.lat,lon=p?.longitude??p?.lon??p?.lng;
 const time=p?.timestamp??p?.dateTime??p?.time??p?.position_timestamp;
 if(!p||p.suspected_glitch===true||(p.imo!=null&&Number(p.imo)!==9453896)||lat==null||lon==null||!Number.isFinite(Number(lat))||Math.abs(Number(lat))>90||!Number.isFinite(Number(lon))||Math.abs(Number(lon))>180||!Number.isFinite(Date.parse(time))||Date.parse(time)>now||Date.parse(time)<now-90*24*HOUR)throw Error('invalid_observation');
 const result={source:'VesselAPI',sourceType:'terrestrial',dateTime:iso(Date.parse(time)),latitude:Number(lat),longitude:Number(lon)};
 for(const [key,value,max] of [['sog',p.sog??p.speed,102.2],['cog',p.cog??p.course,359.9],['heading',p.heading,359],['accuracyMeters',p.accuracy_meters??p.accuracy,100000]])if(value!=null&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=max)result[key]=Number(value);
 return result;
}
// No visitor request invokes this function. Only the scheduled handler collects.
export async function collectAis(env,points,save,fetcher=fetch,now=Date.now()){
 await env.DB.prepare('INSERT OR IGNORE INTO ais_collector(id,version,data) VALUES(1,0,?)').bind(JSON.stringify({ledger:seedLedger,health:seedHealth})).run();
 const state=await collectorState(env);
 if(Date.parse(state.inFlightUntil)>now)return {reason:'in_flight'};
 const {next,area,reason}=decision(state.ledger,state.health,points,now);
 const draft={...state};delete draft.version;
 draft.lastDecision={at:iso(now),reason,area};
 if(!env.VESSELAPI_API_KEY){draft.lastDecision.reason='missing_key';}
 const allowed=!!next&&!!env.VESSELAPI_API_KEY;
 if(allowed){
  draft.ledger=next;
  draft.inFlightUntil=iso(now+2*60000);
  draft.health={...draft.health,lastAttemptAt:iso(now),status:'reserved',quotaRemaining:typeof draft.health.quotaRemaining==='number'?Math.max(0,draft.health.quotaRemaining-1):draft.health.quotaRemaining};
 }
 // Atomic version check: only one cron invocation may reserve a credit.
 const lock=await env.DB.prepare('UPDATE ais_collector SET data=?,version=version+1 WHERE id=1 AND version=?').bind(JSON.stringify(draft),state.version).run();
 if(lock.meta.changes!==1)return {reason:'concurrent_run'};
 if(!allowed)return draft.lastDecision;
 try{
  const r=await fetcher(AIS_URL,{headers:{Authorization:'Bearer '+env.VESSELAPI_API_KEY,Accept:'application/json'},signal:AbortSignal.timeout(30000)});
  const raw=r.headers.get('x-ratelimit-remaining');
  const remaining=raw==='Unlimited'?'Unlimited':raw!==null&&raw!==''&&Number.isFinite(Number(raw))?Number(raw):null;
  draft.health={...draft.health,quotaRemaining:remaining,quotaAt:iso(now)};
  if(r.status===401||r.status===403)throw Object.assign(Error('provider_authentication'),{authBlocked:true});
  if(r.status===429){const retry=r.headers.get('retry-after');const seconds=retry===null?NaN:Number(retry);const until=Number.isFinite(seconds)?now+seconds*1000:Date.parse(retry);throw Object.assign(Error('provider_rate_limit'),{nextAttemptAt:iso(Math.max(now+HOUR,Number.isFinite(until)?until:now+24*HOUR))});}
  if(!r.ok&&r.status!==404)throw Error('provider_http_'+r.status);
  let status='no_data',dataAt=state.health.dataAt||null;
  if(r.status!==404){
   const point=observation(await r.json(),now);
   // The portal store preserves the most recent observation and the 90-day history.
   await save(env,[point]);
   const latest=points.filter(p=>p.source==='VesselAPI').map(p=>Date.parse(p.dateTime));
   const newest=Math.max(Date.parse(dataAt)||0,...latest,Date.parse(point.dateTime));
   dataAt=iso(newest);status=newest>Math.max(Date.parse(state.health.dataAt)||0,...latest)?'ok':'unchanged';
  }
  draft.health={...draft.health,status,dataAt,lastSuccessAt:iso(now),error:null,authBlocked:false,nextAttemptAt:null};
 }catch(error){
  // Never record provider bodies, headers, URLs containing secrets or raw fetch errors.
  const safe=/^(provider_[a-z_0-9]+|invalid_observation)$/.test(error.message)?error.message:'collection_or_storage_failed';
  draft.health={...draft.health,status:'failed',error:safe,quotaRemaining:null,authBlocked:!!error.authBlocked,nextAttemptAt:error.nextAttemptAt||iso(now+HOUR)};
 }
 draft.inFlightUntil=null;
 await env.DB.prepare('UPDATE ais_collector SET data=?,version=version+1 WHERE id=1 AND version=?').bind(JSON.stringify(draft),state.version+1).run();
 return {reason,status:draft.health.status};
}
