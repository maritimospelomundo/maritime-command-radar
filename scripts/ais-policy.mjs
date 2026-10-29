import {areaFor,canIntensify,recentAlternative} from './ais-areas.mjs';
export function reserve(ledger,now=new Date(),context={}) {
 const local=new Date(now.getTime()-3*3600000), day=local.toISOString().slice(0,10);
 const slot=Math.floor(local.getUTCHours()/6), entries=ledger.entries||[];
 if(ledger.bootstrap)return {entries:Array.from({length:4},(_,slot)=>({day,slot,at:now.toISOString(),reason:'Conservative rollout-day reservation'}))};
 if(recentAlternative(context.data,now))return null;
 const last=Math.max(0,...entries.map(e=>Date.parse(e.at)||0));
 if(+now-last<30*60000)return null;
 if(Date.parse(context.health?.nextAttemptAt)>+now||context.health?.authBlocked)return null;
 const area=areaFor(context.data,now);
 if(area&&canIntensify(context.health,now)){
  return {entries:[...entries.filter(e=>Date.parse(e.at)>+now-7*86400000),{day,slot,at:now.toISOString(),mode:'restricted',area}]};
 }
 if(entries.some(e=>e.day===day&&e.slot===slot)||entries.filter(e=>e.day===day).length>=4)return null;
 return {entries:[...entries.filter(e=>Date.parse(e.at)>now.getTime()-7*86400000),{day,slot,at:now.toISOString()}]};
}
