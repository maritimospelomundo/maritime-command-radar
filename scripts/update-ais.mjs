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
  const value = response?.position ?? response?.data?.position ?? response?.data ?? response;
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
  if (response.status === 401 || response.status === 403) throw Error(`VesselAPI recusou a credencial (HTTP ${response.status}). Substitua ou reative o segredo.`);
  if (response.status === 429) throw Error('VesselAPI atingiu o limite (HTTP 429). Aguarde Retry-After.');
  if (!response.ok) throw Error(`Consulta VesselAPI recusada (HTTP ${response.status}).`);
  let payload;
  try { payload = await response.json(); } catch { throw Error('Resposta VesselAPI não contém JSON válido.'); }
  return {payload, remaining: response.headers?.get?.('x-ratelimit-remaining') ?? null};
}

async function main() {
  const file = new URL('../site/data/latest.json', import.meta.url);
  const data = JSON.parse(await readFile(file, 'utf8'));
  const result = await fetchAis(process.env.VESSELAPI_API_KEY);
  if (result.notFound) {
    console.log('VesselAPI: nenhuma posição AIS terrestre nas últimas 80 horas; dados preservados.');
    return;
  }
  const next = applyAis(data, result.payload);
  const temp = new URL('../site/data/latest.json.tmp', import.meta.url);
  await writeFile(temp, JSON.stringify(next, null, 2) + '\n');
  await rename(temp, file);
  console.log(`VesselAPI atualizada; cota restante: ${result.remaining ?? 'não informada'}.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
