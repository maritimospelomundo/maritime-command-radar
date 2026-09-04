import { readFile, writeFile } from 'node:fs/promises';

const DATA_PATH = new URL('../site/data/latest.json', import.meta.url);
const SCOPE_BASE = 'https://globalscope.io';
const SUMMARY_MARKER = '],"shocks":';
const MAX_PREFIX_BYTES = 96 * 1024;

const passageMap = {
  bab_el_mandeb: { passageId: 'bab-el-mandeb', name: 'Bab-el-Mandeb', latitude: 12.6, longitude: 43.4 },
  bosporus: { passageId: 'bosporus', name: 'Estreito de Bósforo', latitude: 41.0, longitude: 29.0 },
  english_channel: { passageId: 'english-channel', name: 'Canal da Mancha', latitude: 50.8, longitude: 0.2 },
  gibraltar: { passageId: 'gibraltar', name: 'Estreito de Gibraltar', latitude: 35.9, longitude: -5.6 },
  hormuz: { passageId: 'hormuz', name: 'Estreito de Ormuz', latitude: 26.6, longitude: 56.3 },
  kattegat: { passageId: 'kattegat', name: 'Kattegat', latitude: 56.5, longitude: 11.0 },
  lombok: { passageId: 'lombok', name: 'Estreito de Lombok', latitude: -8.7, longitude: 115.7 },
  malacca: { passageId: 'malacca', name: 'Estreito de Malaca', latitude: 4.0, longitude: 99.5 },
  panama: { passageId: 'panama', name: 'Canal do Panamá', latitude: 9.1, longitude: -79.7 },
  suez: { passageId: 'suez', name: 'Canal de Suez', latitude: 30.3, longitude: 32.5 },
  sunda: { passageId: 'sunda', name: 'Estreito de Sunda', latitude: -5.9, longitude: 105.9 },
  taiwan: { passageId: 'taiwan', name: 'Estreito de Taiwan', latitude: 23.7, longitude: 120.3 }
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} em ${url}`);
  return response.json();
}

async function fetchSummary(name) {
  const controller = new AbortController();
  const response = await fetch(`${SCOPE_BASE}/scenario/${name}/data-summary`, {
    headers: { accept: 'application/json' },
    signal: controller.signal
  });
  if (!response.ok || !response.body) throw new Error(`${response.status} ao consultar ${name}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let prefix = '';
  try {
    while (prefix.length < MAX_PREFIX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      prefix += decoder.decode(value, { stream: true });
      const markerIndex = prefix.indexOf(SUMMARY_MARKER);
      if (markerIndex !== -1) {
        controller.abort();
        const summaryJson = `${prefix.slice(0, markerIndex + 1)}}`;
        const parsed = JSON.parse(summaryJson);
        if (!Array.isArray(parsed.summary) || parsed.summary.length === 0) throw new Error(`Resumo vazio para ${name}`);
        return parsed.summary;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  throw new Error(`Resumo de ${name} não localizado nos primeiros ${MAX_PREFIX_BYTES} bytes`);
}

const percent = (scenario, baseline, key) => baseline[key] ? ((scenario[key] / baseline[key]) - 1) * 100 : 0;
const rounded = (value) => Math.round(value * 10) / 10;

function analyseScenario(name, scenario, baseline) {
  const points = scenario.map((row, index) => ({
    day: row.day,
    priceChangePercent: percent(row, baseline[index], 'avg_price'),
    supplyChangePercent: percent(row, baseline[index], 'supply_mbpd'),
    throughputChangePercent: percent(row, baseline[index], 'throughput_mbpd'),
    storagePercent: row.storage_pct
  }));
  const peakPrice = points.reduce((best, row) => Math.abs(row.priceChangePercent) > Math.abs(best.priceChangePercent) ? row : best);
  const lowSupply = points.reduce((best, row) => row.supplyChangePercent < best.supplyChangePercent ? row : best);
  const lowThroughput = points.reduce((best, row) => row.throughputChangePercent < best.throughputChangePercent ? row : best);
  const magnitude = Math.max(Math.abs(peakPrice.priceChangePercent), Math.abs(lowSupply.supplyChangePercent), Math.abs(lowThroughput.throughputChangePercent));
  const modelRisk = magnitude >= 20 ? 'critical' : magnitude >= 10 ? 'high' : magnitude >= 3 ? 'medium' : 'low';
  const recovery = points.find((row) => row.day > 40 && Math.abs(row.priceChangePercent) < 1 && Math.abs(row.supplyChangePercent) < 1 && Math.abs(row.throughputChangePercent) < 1);
  const meta = passageMap[name];
  return {
    id: name,
    ...meta,
    modelRisk,
    peakDay: peakPrice.day,
    peakPriceChangePercent: rounded(peakPrice.priceChangePercent),
    minimumSupplyChangePercent: rounded(lowSupply.supplyChangePercent),
    minimumThroughputChangePercent: rounded(lowThroughput.throughputChangePercent),
    recoveryLabel: recovery ? `Retorno a ±1% no dia ${recovery.day}` : 'Sem retorno a ±1% em 60 dias'
  };
}

const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
const listing = await fetchJson(`${SCOPE_BASE}/scenarios`);
const available = listing.scenarios.map(({ name }) => name).filter((name) => name === 'baseline' || passageMap[name]);
const baseline = await fetchSummary('baseline');
const scenarios = [];
const failures = [];

const pending = available.filter((item) => item !== 'baseline');
for (let index = 0; index < pending.length; index += 4) {
  const batch = pending.slice(index, index + 4);
  const results = await Promise.allSettled(batch.map(async (name) => analyseScenario(name, await fetchSummary(name), baseline)));
  results.forEach((result, resultIndex) => {
    if (result.status === 'fulfilled') scenarios.push(result.value);
    else failures.push(`${batch[resultIndex]}: ${result.reason.message}`);
  });
  if (index + 4 < pending.length) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

if (scenarios.length === 0) throw new Error(`Nenhum cenário SCOPE atualizado. ${failures.join('; ')}`);

data.scopeAnalysis = {
  updatedAt: new Date().toISOString(),
  status: failures.length ? 'partial' : 'current',
  sourceUrl: SCOPE_BASE,
  methodologyUrl: `${SCOPE_BASE}/methodology`,
  scenarioWindow: '60 dias · fechamento no dia 10 · reabertura no dia 40',
  modelNote: 'Simulação de equilíbrio espacial. Não é cotação, previsão nem recomendação de rota.',
  baselineLabel: 'Cenário-base SCOPE sem choque',
  failures,
  scenarios
};

if (!data.sources.some(({ name }) => name === 'SCOPE / GlobalScope')) {
  data.sources.push({
    name: 'SCOPE / GlobalScope',
    url: SCOPE_BASE,
    scope: 'Simulações de interrupção em rotas mundiais de petróleo',
    typeLabel: 'Modelo acadêmico / aberto'
  });
}
if (!data.updatePolicy.includes('SCOPE')) {
  data.updatePolicy += ' Os cenários SCOPE são comparados ao cenário-base do próprio modelo e permanecem identificados como simulação, sem substituir cotações reais.';
}

await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`SCOPE atualizado: ${scenarios.length} cenários; ${failures.length} falhas.`);
