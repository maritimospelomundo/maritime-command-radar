import {readFile, writeFile, rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const IMO = 9453896;
const ENDPOINT = 'https://api.kpler.com/v2/maritime/ais-latest';
const pointValid = p => p && typeof p.latitude === 'number' && Number.isFinite(p.latitude) && Math.abs(p.latitude)<=90 && typeof p.longitude === 'number' && Number.isFinite(p.longitude) && Math.abs(p.longitude)<=180;
const timeValid = (t, now) => typeof t==='string' && Number.isFinite(Date.parse(t)) && Date.parse(t)<=now;
const optionalNumber = (v, low, high) => typeof v==='number' && Number.isFinite(v) && v>=low && v<=high ? v : null;
const optionalText = v => typeof v==='string' && v.trim() ? v.trim().slice(0,200) : null;

export function applyAis(data, response, now=Date.now()) {
  if (response?.type!=='FeatureCollection' || !Array.isArray(response.features)) throw Error('Resposta AIS inválida.');
  const candidates=response.features.map(f=>f.properties).filter(p=>p?.imo===IMO && pointValid(p) && timeValid(p.posDt,now) && Date.parse(p.posDt)>=now-7*86400000).sort((a,b)=>Date.parse(b.posDt)-Date.parse(a.posDt));
  if (!candidates.length) throw Error('Nenhuma posição AIS válida do Abdias nos últimos sete dias. Última posição preservada.');
  const p=candidates[0], checkedAt=new Date(now).toISOString();
  const previous=data.marineTrafficPosition?.lastKnown;
  const position={latitude:p.latitude,longitude:p.longitude,dateTime:new Date(p.posDt).toISOString(),unixTime:Math.floor(Date.parse(p.posDt)/1000),eventType:'Position Report',provider:'Kpler AIS v2',vesselName:'ABDIAS NASCIMENTO',imo:IMO,mmsi:p.mmsi??null,vesselUid:p.vesselUid??null,sog:optionalNumber(p.sog,0,102.2),cog:optionalNumber(p.cog,0,359.9),heading:optionalNumber(p.heading,0,359),navStatus:optionalNumber(p.navStatus,0,14),posSrc:['TER','ROAM','SAT'].includes(p.posSrc)?p.posSrc:null};
  const result=structuredClone(data);
  result.marineTrafficPosition={...data.marineTrafficPosition,checkedAt,refreshIntervalMinutes:60,provider:'Kpler AIS v2'};
  // A successful fetch never makes the timestamp of an older AIS message newer.
  if (!previous || !pointValid(previous) || !timeValid(previous.dateTime,now) || Date.parse(position.dateTime)>Date.parse(previous.dateTime)) result.marineTrafficPosition.lastKnown=position;
  else if(Date.parse(position.dateTime)===Date.parse(previous.dateTime) && previous.latitude===position.latitude && previous.longitude===position.longitude) result.marineTrafficPosition.lastKnown={...previous,...position};
  const staticDt=timeValid(p.staticDt,now)?new Date(p.staticDt).toISOString():null;
  if(staticDt && (!data.marineTrafficPosition?.voyage?.staticDt || Date.parse(staticDt)>=Date.parse(data.marineTrafficPosition.voyage.staticDt))) result.marineTrafficPosition.voyage={destination:optionalText(p.destination),reportedEta:typeof p.eta==='string'&&Number.isFinite(Date.parse(p.eta))?new Date(p.eta).toISOString():null,staticDt,draught:optionalNumber(p.draught,0,25.5),source:'AIS informado pelo navio'};
  // generatedAt belongs to the editorial radar snapshot, not the position poll.
  return result;
}

export async function fetchAis(key, fetcher=fetch) {
  if(!key?.trim()) throw Error('Cadastre o segredo KPLER_API_KEY nas configurações do GitHub Actions.');
  let response;
  try {response=await fetcher(ENDPOINT,{method:'POST',headers:{Authorization:`Basic ${key.trim()}`,'Content-Type':'application/json'},body:JSON.stringify({filter:`imo = ${IMO}`,format:'json',limit:2,fields:'imo,mmsi,vesselUid,vesselName,latitude,longitude,posDt,staticDt,sog,cog,heading,navStatus,posSrc,destination,eta,draught'}),signal:AbortSignal.timeout(30000)});} catch {throw Error('Consulta Kpler indisponível ou excedeu 30 segundos.');}
  // Never print provider bodies or credentials in workflow logs.
  if(!response.ok) throw Error(`Consulta Kpler recusada (HTTP ${response.status}). Verifique acesso ao AIS v2 e limites da conta.`);
  try {return await response.json();} catch {throw Error('Resposta Kpler não contém JSON válido.');}
}

async function main(){
  const file=new URL('../site/data/latest.json',import.meta.url);
  const data=JSON.parse(await readFile(file,'utf8'));
  const next=applyAis(data,await fetchAis(process.env.KPLER_API_KEY));
  const temp=new URL('../site/data/latest.json.tmp',import.meta.url);
  await writeFile(temp,JSON.stringify(next,null,2)+'\n');await rename(temp,file);
  console.log('Consulta AIS concluída. Última posição válida preservada; horário editorial inalterado.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
