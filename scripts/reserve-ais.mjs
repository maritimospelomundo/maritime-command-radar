import {readFileSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
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
function main(){
 const git=(...args)=>execFileSync('git',args,{stdio:'inherit'});
 git('pull','--ff-only','origin','main');
 const file='data/ais-request-ledger.json';
 // A missing ledger fails closed: never infer credits from successful positions.
 if(!existsSync(file))throw Error('Missing request ledger');
 const previous=JSON.parse(readFileSync(file,'utf8'));
 const data=JSON.parse(readFileSync('site/data/latest.json','utf8'));
 const health=existsSync('site/data/ais-health.json')?JSON.parse(readFileSync('site/data/ais-health.json','utf8')):{};
 const next=reserve(previous,new Date(),{data,health});
 if(!next){console.log('VesselAPI skipped by freshness, interval or quota policy; no request reserved.');return;}
 writeFileSync(file,JSON.stringify(next,null,2)+'\n');
 git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com');
 git('add',file);git('commit','-m','Reserve VesselAPI request slot [skip ci]');
 // Only authorize a request after durable reservation. Failed requests also consume a slot.
 git('push','origin','HEAD:main');
 if(!previous.bootstrap)appendFileSync(process.env.GITHUB_OUTPUT,'allowed=true\n');
 else console.log('Rollout-day budget reserved; collection resumes next Brasilia day.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();

