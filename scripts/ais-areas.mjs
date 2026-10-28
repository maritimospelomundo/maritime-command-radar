// Operational polling envelopes only: not navigational routes or legal limits.
// Regions: DIRECTEMAR, Pilotaje en el Estrecho de Magallanes.
// https://www.directemar.cl/directemar/site/edic/base/port/estrechodemagallanes_es.html
// Coordinates are approximate management envelopes (longitude, latitude).
export const areas=[
 {name:'Magalhães',polygon:[[-68.1,-52.1],[-69.7,-52.1],[-70.7,-52.5],[-71.2,-53.4],[-71.5,-53.9],[-72.5,-53.5],[-73.3,-53.2],[-74.9,-52.4],[-75.4,-52.5],[-74.9,-53.1],[-73.5,-53.7],[-72.4,-54.1],[-71.1,-54.1],[-70.5,-53.3],[-70.2,-52.9],[-69.5,-52.7],[-68.1,-52.6]]},
 {name:'Canais patagônicos',polygon:[[-74.3,-47.5],[-75.4,-47.5],[-75.5,-49],[-75.5,-50.5],[-74.6,-51.5],[-74.2,-52.6],[-73.3,-53.1],[-72.9,-52.7],[-73.5,-51.4],[-74,-50.5],[-74.2,-49],[-74.3,-48]]}
];
export function inside(p,polygon){let yes=false;const x=p.longitude,y=p.latitude;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [a,b]=polygon[i],[c,d]=polygon[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;}
export function areaFor(data,now=new Date()){
 const points=['spotPosition','marineTrafficPosition','vesselApiPosition'].flatMap(k=>[data?.[k]?.lastKnown,...(data?.[k]?.history||[])]).filter(p=>p&&!p.estimated&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180&&Date.parse(p.dateTime)<=+now&&+now-Date.parse(p.dateTime)<=3*3600000).sort((a,b)=>Date.parse(b.dateTime)-Date.parse(a.dateTime));
 const p=points[0];return p?areas.find(a=>inside(p,a.polygon))?.name||null:null;
}
export function canIntensify(health,now=new Date()){
 const age=+now-Date.parse(health?.quotaAt);const remaining=health?.quotaRemaining;
 return age>=0&&age<=12*3600000&&(remaining==='Unlimited'||(Number.isFinite(remaining)&&remaining>120));
}
