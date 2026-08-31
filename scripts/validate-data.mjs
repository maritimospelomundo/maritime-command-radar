import { readFile } from 'node:fs/promises';

const path = new URL('../site/data/latest.json', import.meta.url);
const data = JSON.parse(await readFile(path, 'utf8'));
const errors = [];
const required = ['schemaVersion', 'generatedAt', 'status', 'market', 'risks', 'psc', 'petrobras', 'bunker', 'briefing', 'sources', 'updatePolicy'];

for (const key of required) if (data[key] === undefined) errors.push(`campo obrigatório ausente: ${key}`);
if (data.schemaVersion !== 2) errors.push('schemaVersion deve ser 2');
if (Number.isNaN(Date.parse(data.generatedAt))) errors.push('generatedAt deve ser uma data ISO válida');

const lists = [
  ['market.benchmarks', data.market?.benchmarks],
  ['market.history.weeks', data.market?.history?.weeks],
  ['market.history.series', data.market?.history?.series],
  ['market.indices', data.market?.indices],
  ['risks', data.risks],
  ['psc.mous', data.psc?.mous],
  ['psc.readiness', data.psc?.readiness],
  ['petrobras.metrics', data.petrobras?.metrics],
  ['petrobras.fleetPlan.metrics', data.petrobras?.fleetPlan?.metrics],
  ['bunker', data.bunker],
  ['briefing.items', data.briefing?.items],
  ['sources', data.sources]
];

for (const [name, value] of lists) if (!Array.isArray(value) || value.length === 0) errors.push(`${name} deve ser uma lista não vazia`);

for (const [index, benchmark] of (data.market?.benchmarks || []).entries()) {
  if (!benchmark.segment || !Number.isFinite(benchmark.value)) errors.push(`market.benchmarks[${index}] inválido`);
}
for (const [index, risk] of (data.risks || []).entries()) {
  if (!['critical', 'high', 'medium', 'low'].includes(risk.level)) errors.push(`risks[${index}].level inválido`);
  if (!risk.region || !risk.driver || !risk.action) errors.push(`risks[${index}] incompleto`);
}
for (const [index, source] of (data.sources || []).entries()) {
  try {
    const url = new URL(source.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    errors.push(`sources[${index}].url inválida`);
  }
}

if (errors.length) {
  console.error(`latest.json inválido:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`latest.json válido: ${data.generatedAt}; ${data.sources.length} fontes; ${data.risks.length} riscos.`);
