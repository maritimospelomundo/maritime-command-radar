import {readFile, writeFile, rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const IMO = 9453896;
export const ENDPOINT = `https://api.vesselapi.com/v1/vessel/${IMO}/position?filter.idType=imo`;
const DAY = 86400000;
const pointValid = p => p && Number.isFinite(Number(p.latitude ?? p.lat)) && Math.abs(Number(p.latitude ?? p.lat)) <= 90 && Number.isFinite(Number(p.longitude ?? p.lon ?? p.lng)) && Math.abs(Number(p.longitude ?? p.lon ?? p.lng)) <= 180;
const timeValue = p => p?.timestamp ?? p?.dateTime ?? p?.time ?? p?.position_timestamp;
const timeValid = (t, now) => typeof t === 'string' && Number.isFinite(Date.parse(t)) && Date.parse(t) <= now;
const optionalNumber = (v, low, high) => Number.isFinite(Number(v)) && Number(v) >= low && Number(v) <= high ? Number(v) : null;
const optionalText = v => typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : null;
const sourcePosition = response => {
  const value = response?.vesselPosition ?? response?.position ?? response?.data?.position ?? response?.data ?? response;
  return Array.isArray(value) ? value[0] : value;
};
const keyOf = p => [p.dateTime, p.latitude, p.longitude].join('|');

export function applyAis(data, response, now = Date.now()) {
  const p = sourcePosition(response);
  if (!p || p.suspected_glitch === true || !pointValid(p) || !timeValid(timeValue(p), now)) throw Error('Resposta VesselAPI sem posição terrestre válida.');
  if (p.imo != null && Number(p.imo) !== IMO) throw Error('Resposta VesselAPI pertence a outro navio.');
  const dateTime = new Date(timeValue(p)).toISOString();
  if (Date.parse(dateTime) < now - 90 * DAY) throw Error('Posição VesselAPI fora da retenção de 90 dias.');

  const importedAt = new Date(now).toISOString();
  const position = {
    dateTime,
    unixTime: Math.floor(Date.parse(dateTime) / 1000),
    latitude: Number(p.latitude ?? p.lat),
    longitude: Number(p.longitude ?? p.lon ?? p.lng),
    eventType: 'Position Report',
    sourceType: 'terrestrial',
    importedAt,
    sog: optionalNumber(p.sog ?? p.speed, 0, 102.2),
    cog: optionalNumber(p.cog ?? p.course, 0, 359.9),
    heading: optionalNumber(p.heading, 0, 359),
    navStatus: optionalText(p.nav_status ?? p.navStatus),
    accuracyMeters: optionalNumber(p.accuracy_meters ?? p.accuracy, 0, 100000)
  };
  for (const key of Object.keys(position)) if (position[key] === null) delete position[key];

  const result = structuredClone(data);
  const current = data.vesselApiPosition?.lastKnown;
  const baseHistory = Array.isArray(data.vesselApiPosition?.history) ? data.vesselApiPosition.history : [];
  const history = [...baseHistory, current, position].filter(Boolean)
    .filter(pointValid)
    .filter(item => timeValid(item.dateTime, now) && Date.parse(item.dateTime) >= now - 90 * DAY)
    .sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime))
    .filter((item, index, list) => index === 0 || keyOf(item) !== keyOf(list[index - 1]));

  result.vesselApiPosition = {
    label: 'VesselAPI',
    provider: 'VesselAPI terrestrial AIS',
    checkedAt: importedAt,
    refreshIntervalMinutes: 360,
    history,
    lastKnown: !current || Date.parse(dateTime) >= Date.parse(current.dateTime) ? position : current
  };
  return result;
}

export async function fetchAis(key, fetcher = fetch) {
  if (!key?.trim()) throw Error('Cadastre o segredo VESSELAPI_API_KEY nas configurações do GitHub Actions.');
  let response;
  try {
    response = await fetcher(ENDPOINT, {
      method: 'GET',
      headers: {Authorization: `Bearer ${key.trim()}`, Accept: 'application/json'},
      signal: AbortSignal.timeout(30000)
    });
  } catch {
    throw Error('Consulta VesselAPI indisponível ou excedeu 30 segundos.');
  }
  if (response.status === 404) return {notFound: true, remaining: response.headers?.get?.('x-ratelimit-remaining') ?? null};
  if (response.status === 401 || response.status === 403) throw Object.assign(Error(`VesselAPI recusou a credencial (HTTP ${response.status}). Substitua ou reative o segredo.`),{authBlocked:true});
  if (response.status === 429) {const retry=response.headers?.get?.('retry-after');const seconds=Number(retry);const until=retry&&Number.isFinite(seconds)?Date.now()+seconds*1000:Date.parse(retry);throw Object.assign(Error('VesselAPI atingiu o limite (HTTP 429). Aguarde Retry-After.'),{nextAttemptAt:new Date(Math.max(Date.now()+3600000,Number.isFinite(until)?until:Date.now()+86400000)).toISOString()});}
  if (!response.ok) throw Error(`Consulta VesselAPI recusada (HTTP ${response.status}).`);
  let payload;
  try { payload = await response.json(); } catch { throw Error('Resposta VesselAPI não contém JSON válido.'); }
  return {payload, remaining: response.headers?.get?.('x-ratelimit-remaining') ?? null};
}

async function main() {
  const file = new URL('../site/data/latest.json', import.meta.url);
  const healthFile = new URL('../site/data/ais-health.json', import.meta.url);
  let previous={};try{previous=JSON.parse(await readFile(healthFile,'utf8'));}catch{}
  const attemptedAt=new Date().toISOString();
  try {
    const data=JSON.parse(await readFile(file,'utf8'));
    const result=await fetchAis(process.env.VESSELAPI_API_KEY);
    let next=data;
    if(!result.notFound){next=applyAis(data,result.payload);const temp=new URL('../site/data/latest.json.tmp',import.meta.url);await writeFile(temp,JSON.stringify(next,null,2)+'\n');await rename(temp,file);}
    const status=result.notFound?'no_data':data.vesselApiPosition?.lastKnown?.dateTime===next.vesselApiPosition?.lastKnown?.dateTime?'unchanged':'ok';
    await writeFile(healthFile,JSON.stringify({...previous,status,lastAttemptAt:attemptedAt,lastSuccessAt:new Date().toISOString(),dataAt:next.vesselApiPosition?.lastKnown?.dateTime||null,error:null,quotaRemaining:result.remaining==='Unlimited'?'Unlimited':result.remaining!==null&&result.remaining!==''&&Number.isFinite(Number(result.remaining))?Number(result.remaining):null,quotaAt:new Date().toISOString(),nextAttemptAt:null,authBlocked:false},null,2)+'\n');
    console.log(JSON.stringify({status,dataAt:next.vesselApiPosition?.lastKnown?.dateTime||null}));
  } catch(error){
    await writeFile(healthFile,JSON.stringify({...previous,status:'failed',lastAttemptAt:attemptedAt,error:error.message,nextAttemptAt:error.nextAttemptAt||new Date(Date.now()+3600000).toISOString(),authBlocked:error.authBlocked||false,quotaRemaining:null},null,2)+'\n');throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

