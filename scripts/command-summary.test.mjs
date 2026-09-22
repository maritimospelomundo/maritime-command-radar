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
  d.marineTrafficPosition.lastKnown = {latitude:3,longitude:4,dateTime:new Date(Date.now()-10800000).toISOString()};
  d.spotPosition.history = [{latitude: 1, longitude: 2, dateTime:new Date(Date.now()-7200000).toISOString()}, {latitude:91,longitude:2,dateTime:'2100-01-01T00:00:00Z'}];
  assert.equal(buildCommandSummary(d).position.sourceLabel, 'SPOT');
  d.marineTrafficPosition.lastKnown = {latitude:3,longitude:4,dateTime:new Date(Date.now()-3600000).toISOString()};
  assert.equal(buildCommandSummary(d).position.sourceLabel, 'MarineTraffic');
});
test('missing position does not remove critical operational information', () => {
  const s = buildCommandSummary(data, null);
  assert.equal(s.position, null);
  assert.ok(s.criticalAlerts.length && s.passageRisks.length && s.commanderBrief.items.length);
});
test('resolved live position can override the static snapshot', () => {
  const p = {latitude:1,longitude:2,dateTime:new Date(Date.now()-7200000).toISOString(),sourceKey:'spot',sourceLabel:'SPOT'};
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


test('nearby medium event outranks distant critical event after position moves', () => {
 const d=structuredClone(data); const base=d.alertGroups[0].items[0];
 d.alertGroups=[{items:[{...base,id:'west',level:'medium',geo:{latitude:0,longitude:0}},{...base,id:'east',level:'critical',geo:{latitude:0,longitude:90}}]}];
 const pos=longitude=>({latitude:0,longitude,dateTime:new Date(Date.now()-1000).toISOString(),sourceKey:'spot',sourceLabel:'SPOT'});
 assert.equal(buildCommandSummary(d,pos(0)).nearbyAlerts[0].id,'west');
 assert.equal(buildCommandSummary(d,pos(90)).nearbyAlerts[0].id,'east');
 assert.equal(buildCommandSummary(d,pos(0)).criticalAlerts[0].id,'east');
});
test('future and invalid positions cannot override valid lastKnown', () => {
 const d=structuredClone(data);
 const original=buildCommandSummary(d).position;
 d.spotPosition.history=[{latitude:0,longitude:0,dateTime:'2099-01-01T00:00:00Z'},{latitude:null,longitude:0,dateTime:new Date().toISOString()}];
 assert.deepEqual(buildCommandSummary(d).position,original);
});
test('missing event coordinates remain unknown, never zero distance', () => {
 const d=structuredClone(data); delete d.alertGroups[0].items[0].map; delete d.alertGroups[0].items[0].geo;
 const item=buildCommandSummary(d).nearbyAlerts.find(a=>a.id===d.alertGroups[0].items[0].id);
 assert.equal(item.distanceNm,null);
});

test('VesselAPI participates as a separate source and original UTC wins', () => {
  const d = structuredClone(data);
  d.vesselApiPosition = {lastKnown: {latitude:5, longitude:6, dateTime:new Date(Date.now()-1800000).toISOString()}};
  d.marineTrafficPosition.lastKnown = {latitude:3, longitude:4, dateTime:new Date(Date.now()-3600000).toISOString()};
  assert.equal(buildCommandSummary(d).position.sourceLabel, 'VesselAPI');
  d.spotPosition.lastKnown = {latitude:1, longitude:2, dateTime:new Date(Date.now()-600000).toISOString()};
  assert.equal(buildCommandSummary(d).position.sourceLabel, 'SPOT');
});
test('equal original timestamps use accuracy then source order only as tie-breakers', () => {
  const d = structuredClone(data);
  const dateTime = new Date(Date.now()-1000).toISOString();
  d.vesselApiPosition = {lastKnown: {latitude:5, longitude:6, dateTime, accuracyMeters:500}};
  d.marineTrafficPosition.lastKnown = {latitude:3, longitude:4, dateTime, accuracyMeters:25};
  d.spotPosition.lastKnown = {latitude:1, longitude:2, dateTime};
  assert.equal(buildCommandSummary(d).position.sourceLabel, 'MarineTraffic');
  delete d.marineTrafficPosition.lastKnown.accuracyMeters;
  delete d.vesselApiPosition.lastKnown.accuracyMeters;
  assert.equal(buildCommandSummary(d).position.sourceLabel, 'VesselAPI');
});
