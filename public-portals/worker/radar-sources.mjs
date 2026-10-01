import {normalize} from './position-policy.mjs';
export const URLS=[
 'https://raw.githubusercontent.com/maritimospelomundo/maritime-command-radar/main/site/data/latest.json',
 'https://maritimospelomundo.github.io/maritime-command-radar/data/latest.json'
];
export async function radarPositions(fetcher=fetch){
 const results=await Promise.allSettled(URLS.map(async url=>{
  const r=await fetcher(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'},cache:'no-store'});
  if(!r.ok)throw Error('radar HTTP '+r.status);
  const d=await r.json();
  const points=[['vesselApiPosition','VesselAPI'],['marineTrafficPosition','MarineTraffic'],['spotPosition','SPOT']].flatMap(([key,source])=>[...(Array.isArray(d[key]?.history)?d[key].history:[]),d[key]?.lastKnown].map(p=>normalize(p,source)).filter(Boolean));
  if(!points.length)throw Error('radar has no valid positions');
  return points;
 }));
 const good=results.filter(r=>r.status==='fulfilled');
 if(!good.length)throw Error('Both radar sources unavailable');
 return good.flatMap(r=>r.value);
}
