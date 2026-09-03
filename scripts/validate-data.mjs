import { readFile } from 'node:fs/promises';

const path = new URL('../site/data/latest.json', import.meta.url);
const data = JSON.parse(await readFile(path, 'utf8'));
const errors = [];
const required = ['schemaVersion', 'generatedAt', 'status', 'spotPosition', 'marineTrafficPosition', 'dailyWatch', 'market', 'alertGroups', 'strategicPassages', 'reportingSystems', 'psc', 'petrobras', 'bunker', 'briefing', 'sources', 'updatePolicy'];

for (const key of required) if (data[key] === undefined) errors.push(`campo obrigatório ausente: ${key}`);
if (data.schemaVersion !== 5) errors.push('schemaVersion deve ser 5');
if (Number.isNaN(Date.parse(data.generatedAt))) errors.push('generatedAt deve ser uma data ISO válida');
if (!Number.isFinite(data.spotPosition?.lastKnown?.latitude) || !Number.isFinite(data.spotPosition?.lastKnown?.longitude) || Number.isNaN(Date.parse(data.spotPosition?.lastKnown?.dateTime))) errors.push('spotPosition.lastKnown deve conter posição e data válidas');
if (data.marineTrafficPosition?.lastKnown !== null && (!Number.isFinite(data.marineTrafficPosition?.lastKnown?.latitude) || !Number.isFinite(data.marineTrafficPosition?.lastKnown?.longitude) || Number.isNaN(Date.parse(data.marineTrafficPosition?.lastKnown?.dateTime)))) errors.push('marineTrafficPosition.lastKnown deve ser nulo ou conter posição e data válidas');

const lists = [
  ['dailyWatch.horizons', data.dailyWatch?.horizons],
  ['dailyWatch.modules', data.dailyWatch?.modules],
  ['market.benchmarks', data.market?.benchmarks],
  ['market.history.weeks', data.market?.history?.weeks],
  ['market.history.series', data.market?.history?.series],
  ['market.indices', data.market?.indices],
  ['alertGroups', data.alertGroups],
  ['strategicPassages', data.strategicPassages],
  ['reportingSystems', data.reportingSystems],
  ['psc.mous', data.psc?.mous],
  ['psc.regimes', data.psc?.regimes],
  ['psc.readiness', data.psc?.readiness],
  ['petrobras.metrics', data.petrobras?.metrics],
  ['petrobras.markets', data.petrobras?.markets],
  ['petrobras.operations', data.petrobras?.operations],
  ['petrobras.routes', data.petrobras?.routes],
  ['petrobras.basins', data.petrobras?.basins],
  ['petrobras.developments', data.petrobras?.developments],
  ['petrobras.fleetPlan.metrics', data.petrobras?.fleetPlan?.metrics],
  ['bunker', data.bunker],
  ['briefing.items', data.briefing?.items],
  ['sources', data.sources]
];

for (const [name, value] of lists) if (!Array.isArray(value) || value.length === 0) errors.push(`${name} deve ser uma lista não vazia`);

for (const [index, benchmark] of (data.market?.benchmarks || []).entries()) {
  if (!benchmark.segment || !Number.isFinite(benchmark.value)) errors.push(`market.benchmarks[${index}] inválido`);
}
for (const [index, passage] of (data.strategicPassages || []).entries()) {
  if (!passage.id || !passage.name || !['critical', 'high', 'medium', 'low'].includes(passage.risk) || !passage.trafficLabel || !passage.reporting || !Array.isArray(passage.masterFocus) || passage.masterFocus.length === 0) errors.push(`strategicPassages[${index}] inválida`);
  try { new URL(passage.source?.url); } catch { errors.push(`strategicPassages[${index}].source.url inválida`); }
}
for (const [index, system] of (data.reportingSystems || []).entries()) {
  if (!system.id || !system.name || !['mandatory', 'voluntary', 'conditional'].includes(system.type) || !system.when || !system.report) errors.push(`reportingSystems[${index}] inválido`);
  try { new URL(system.source?.url); } catch { errors.push(`reportingSystems[${index}].source.url inválida`); }
}
for (const [index, regime] of (data.psc?.regimes || []).entries()) {
  if (!regime.name || !['active', 'announced', 'unconfirmed', 'national'].includes(regime.status) || !regime.campaign || !regime.tankerFocus) errors.push(`psc.regimes[${index}] inválido`);
  try { new URL(regime.source?.url); } catch { errors.push(`psc.regimes[${index}].source.url inválida`); }
}
for (const [groupIndex, group] of (data.alertGroups || []).entries()) {
  if (!group.id || !group.title || !Array.isArray(group.items) || group.items.length < 3) errors.push(`alertGroups[${groupIndex}] deve ter identificação e pelo menos 3 itens`);
  for (const [itemIndex, alert] of (group.items || []).entries()) {
    if (!['critical', 'high', 'medium', 'low'].includes(alert.level)) errors.push(`alertGroups[${groupIndex}].items[${itemIndex}].level inválido`);
    if (!alert.id || !alert.region || !alert.headline || !alert.summary || !alert.details || !alert.action) errors.push(`alertGroups[${groupIndex}].items[${itemIndex}] incompleto`);
    if (!Number.isFinite(alert.map?.x) || !Number.isFinite(alert.map?.y) || alert.map.x < 0 || alert.map.x > 100 || alert.map.y < 0 || alert.map.y > 100) errors.push(`alertGroups[${groupIndex}].items[${itemIndex}].map inválido`);
    try { new URL(alert.source?.url); } catch { errors.push(`alertGroups[${groupIndex}].items[${itemIndex}].source.url inválida`); }
  }
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

const alertCount = data.alertGroups.reduce((sum, group) => sum + group.items.length, 0);
console.log(`latest.json válido: ${data.generatedAt}; ${data.sources.length} fontes; ${alertCount} alertas; ${data.strategicPassages.length} passagens; ${data.reportingSystems.length} sistemas de reporte; ${data.psc.regimes.length} regimes PSC.`);
