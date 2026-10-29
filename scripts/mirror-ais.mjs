import {readFile,writeFile} from 'node:fs/promises';
import {applyAis} from './update-ais.mjs';
const response=await fetch('https://abdias-public-portals.maritimospelomundo.workers.dev/api/ais',{signal:AbortSignal.timeout(30000),cache:'no-store'});
if(!response.ok)throw Error('Central AIS mirror unavailable');
const body=await response.json();
if(body.collector!=='cloudflare-cron'||!Array.isArray(body.points)||!body.health)throw Error('Collector not initialized');
let data=JSON.parse(await readFile('site/data/latest.json','utf8'));
for(const point of body.points){
 const present=[...(data.vesselApiPosition?.history||[]),data.vesselApiPosition?.lastKnown].some(p=>p&&Date.parse(p.dateTime)===Date.parse(point.dateTime)&&Math.abs(p.latitude-point.latitude)<1e-7&&Math.abs(p.longitude-point.longitude)<1e-7);
 if(!present)data=applyAis(data,point);
}
await writeFile('site/data/latest.json',JSON.stringify(data,null,2)+'\n');
await writeFile('site/data/ais-health.json',JSON.stringify({...body.health,collector:body.collector,lastDecision:body.lastDecision},null,2)+'\n');
