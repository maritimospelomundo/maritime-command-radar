import {readFile,writeFile} from 'node:fs/promises';
export function updateSpot(data,feed,now=Date.now()) {
 if(!Array.isArray(feed.points)||!feed.points.length||!Number.isFinite(Date.parse(feed.lastSyncAt)))throw Error('Invalid SPOT snapshot');
 const bad=new Set(['2493309049','2493489592','2493511950']);const points=[];
 for(const p of feed.points){const t=Date.parse(p.dateTime);if(bad.has(String(p.id))||!Number.isFinite(t)||t>now||t<now-90*86400000||!Number.isFinite(p.latitude)||Math.abs(p.latitude)>90||!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180)continue;if(!points.some(q=>Date.parse(q.dateTime)===t&&Math.abs(q.latitude-p.latitude)<=1e-7&&Math.abs(q.longitude-p.longitude)<=1e-7))points.push(p)}
 points.sort((a,b)=>Date.parse(a.dateTime)-Date.parse(b.dateTime));if(!points.length)throw Error('No valid points');
 const last=points.at(-1),old=data.spotPosition;
 if(old.lastKnown&&Date.parse(last.dateTime)<Date.parse(old.lastKnown.dateTime))throw Error('Refusing older position');
 const same=(a,b)=>a&&b&&Date.parse(a.dateTime)===Date.parse(b.dateTime)&&Math.abs(a.latitude-b.latitude)<=1e-7&&Math.abs(a.longitude-b.longitude)<=1e-7;
 if((old.history||[]).length===points.length&&points.every(p=>old.history.some(q=>same(p,q)))&&same(last,old.lastKnown))return false;
 data.spotPosition={...old,history:points,lastKnown:last,lastSyncAt:feed.lastSyncAt,mapUrl:'https://maps.findmespot.com/s/VCV3'};return true;
}
if(process.argv[1]?.endsWith('/update-spot.mjs')){
 const r=await fetch('https://spot-vessel-position.maritimospelomundo.workers.dev/api/positions?days=90&limit=2000',{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('SPOT snapshot HTTP '+r.status);
 const path='site/data/latest.json',data=JSON.parse(await readFile(path,'utf8'));
 if(updateSpot(data,await r.json()))await writeFile(path,JSON.stringify(data,null,2)+'\n');
}
