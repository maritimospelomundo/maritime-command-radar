import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import adapter from '../site/command-summary.js';
const data = JSON.parse(await readFile(new URL('../site/data/latest.json', import.meta.url), 'utf8'));
const { buildCommandSummary } = adapter;
test('summary preserves schema and source data without mutation', () => {
  const original = JSON.stringify(data);
  const s = buildCommandSummary(data);
  assert.equal(s.schemaVersion, 5);
  assert.equal(s.summaryVersion, 1);
  assert.equal(s.generatedAt, data.generatedAt);
  assert.equal(JSON.stringify(data), original);
  assert.equal(s.activePsc.length, data.psc.regimes.filter(r => r.status === 'active').length);
  assert.ok(s.criticalAlerts.every(a => ['high','critical'].includes(a.level)));
  assert.deepEqual(s.tankerMarket.benchmarks, data.market.benchmarks);
  assert.ok(s.transpetro.operationalImpact);
});
test('newest valid source wins, including history and invalid points', () => {
  const d = structuredClone(data);
  d.spotPosition.history = [{latitude: 1, longitude: 2, dateTime:'2099-01-01T00:00:00Z'}, {latitude:91,longitude:2,dateTime:'2100-01-01T00:00:00Z'}];
  assert.equal(buildCommandSummary(d).position.sourceLabel, 'SPOT');
  d.marineTrafficPosition.lastKnown = {latitude:3,longitude:4,dateTime:'2099-02-01T00:00:00Z'};
  assert.equal(buildCommandSummary(d).position.sourceLabel, 'MarineTraffic');
});
test('missing position does not remove critical operational information', () => {
  const s = buildCommandSummary(data, null);
  assert.equal(s.position, null);
  assert.ok(s.criticalAlerts.length && s.passageRisks.length && s.commanderBrief.items.length);
});
test('resolved live position can override the static snapshot', () => {
  const p = {latitude:1,longitude:2,dateTime:'2099-01-01T00:00:00Z',sourceKey:'spot',sourceLabel:'SPOT'};
  assert.equal(buildCommandSummary(data, p).position.dateTime, p.dateTime);
});
test('SCOPE results never enter summary, even if added to briefing or alerts', () => {
  const d = structuredClone(data);
  d.briefing.items.unshift({category:'SCOPE',title:'Simulation',summary:'GlobalScope results'});
  d.alertGroups[0].items.unshift({...d.alertGroups[0].items[0], headline:'SCOPE simulated closure'});
  const {simulatorUrl, ...s} = buildCommandSummary(d);
  assert.equal(simulatorUrl, 'https://globalscope.io');
  assert.doesNotMatch(JSON.stringify(s), /\b(scope|globalscope)\b/i);
  assert.equal(s.scopeAnalysis, undefined);
});
test('oil quotes are explicitly unavailable, not fabricated', () => {
  assert.equal(buildCommandSummary(data).oil.available, false);
});
