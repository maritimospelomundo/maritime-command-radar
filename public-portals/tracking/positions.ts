export type Position={latitude:number;longitude:number;dateTime:string;source:string;accuracyMeters?:number};
export function valid(raw:unknown,source:string):Position|null{
 if(!raw||typeof raw!=='object')return null;
 const r=raw as Record<string,unknown>, t=typeof r.dateTime==='string'?Date.parse(r.dateTime):NaN;
 if(typeof r.latitude!=='number'||typeof r.longitude!=='number'||!Number.isFinite(r.latitude)||!Number.isFinite(r.longitude)||Math.abs(r.latitude)>90||Math.abs(r.longitude)>180||!Number.isFinite(t)||t>Date.now()+300000)return null;

 const accuracy=Number(r.accuracyMeters??r.accuracy);
 return {latitude:r.latitude,longitude:r.longitude,dateTime:new Date(t).toISOString(),source,...(Number.isFinite(accuracy)&&accuracy>=0?{accuracyMeters:accuracy}:{})};
}
export function latest(all:(Position|null)[]){const rank=(p:Position)=>p.source==='VesselAPI'?3:p.source.startsWith('MarineTraffic')?2:p.source==='SPOT'?1:0,quality=(p:Position)=>Number.isFinite(p.accuracyMeters)?1000000-p.accuracyMeters!:0;return all.filter((p):p is Position=>!!p).sort((a,b)=>Date.parse(b.dateTime)-Date.parse(a.dateTime)||quality(b)-quality(a)||rank(b)-rank(a))[0]||null;}
export function coordinate(value:number,lat:boolean){const total=Math.round(Math.abs(value)*6000),d=Math.floor(total/6000),m=((total%6000)/100).toFixed(2).replace('.',',').padStart(5,'0');return `${String(d).padStart(lat?2:3,'0')}º${m}’ ${lat?(value<0?'S':'N'):(value<0?'W':'E')}`;}
