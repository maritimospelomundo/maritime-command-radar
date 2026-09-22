import type {Position} from './positions';
export function periodPoints(points:Position[],days:number,now:number){return points.filter(p=>Date.parse(p.dateTime)>=now-days*86400000&&Date.parse(p.dateTime)<=now).sort((a,b)=>Date.parse(a.dateTime)-Date.parse(b.dateTime));}
// Rhumb direction aligns the symbol with the straight segment on the Mercator map.
export function trackDirection(history:Position[],position:Position):number|null{
 const unique=new Map<string,Position>();for(const p of [...history,position])unique.set(`${p.dateTime}:${p.latitude}:${p.longitude}`,p);
 const points=[...unique.values()].sort((a,b)=>Date.parse(a.dateTime)-Date.parse(b.dateTime));
 if(points.length<2)return null;const a=points.at(-2)!,b=points.at(-1)!;
 if(Date.parse(b.dateTime)<=Date.parse(a.dateTime))return null;
 const rad=Math.PI/180;let dx=(b.longitude-a.longitude)*rad;
 if(dx>Math.PI)dx-=2*Math.PI;if(dx< -Math.PI)dx+=2*Math.PI;
 const merc=(lat:number)=>Math.log(Math.tan(Math.PI/4+Math.max(-89.999,Math.min(89.999,lat))*rad/2));
 const dy=merc(b.latitude)-merc(a.latitude);
 if(Math.abs(dx)+Math.abs(dy)<1e-12)return null;
 return (Math.atan2(dx,dy)/rad+360)%360;
}
