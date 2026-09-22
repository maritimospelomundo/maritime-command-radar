const excluded = new Set(['2493309049','2493489592','2493511950']);
const excludedTimes = new Set([1788355502000,1788382076000,1788385534000]);
export function normalize(raw,source,now=Date.now()){
 if(!raw||raw.suspected_glitch||!['SPOT','MarineTraffic','VesselAPI'].includes(source))return null;
 const time=Date.parse(raw.dateTime),{latitude,longitude}=raw;
 if(!Number.isFinite(time)||time>now+300000||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return null;
 if(source==='SPOT'&&(excluded.has(String(raw.id))||excludedTimes.has(time)))return null;
 const accuracy=raw.accuracyMeters;
 return {source,dateTime:new Date(time).toISOString(),latitude,longitude,...(Number.isFinite(accuracy)&&accuracy>=0?{accuracyMeters:accuracy}:{})};
}
export function prefer(a,b){return Date.parse(b.dateTime)-Date.parse(a.dateTime)||(a.accuracyMeters??Infinity)-(b.accuracyMeters??Infinity)||({VesselAPI:3,MarineTraffic:2,SPOT:1}[b.source]-{VesselAPI:3,MarineTraffic:2,SPOT:1}[a.source]);}
export function consolidate(points,now=Date.now()){
 const seen=new Map();for(const p of points.map(p=>normalize(p,p?.source,now)).filter(Boolean).sort(prefer)){
 if(Date.parse(p.dateTime)<now-90*86400000)continue;
 const key=[p.dateTime,p.latitude,p.longitude].join('|');if(!seen.has(key))seen.set(key,p);
 }return [...seen.values()].sort((a,b)=>Date.parse(a.dateTime)-Date.parse(b.dateTime));
}
