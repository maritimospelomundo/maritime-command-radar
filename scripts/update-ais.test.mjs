import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAis, fetchAis, ENDPOINT, IMO} from './update-ais.mjs';

const now = Date.parse('2026-09-22T12:00:00Z');
const seed = {
  generatedAt: '2026-09-21T10:05:00Z',
  schemaVersion: 5,
  market: {price: 1},
  spotPosition: {lastKnown: {latitude: 1, longitude: 2, dateTime: '2026-09-21T09:00:00Z'}},
  marineTrafficPosition: {lastKnown: {latitude: 3, longitude: 4, dateTime: '2026-09-21T10:00:00Z'}},
  vesselApiPosition: {lastKnown: null, history: []}
};
const payload = (extra = {}) => ({data: {position: {
  imo: IMO, latitude: 5, longitude: 6, timestamp: '2026-09-22T11:00:00Z',
  processed_timestamp: '2026-09-22T11:01:00Z', sog: 11.5, cog: 204, suspected_glitch: false, ...extra
}}});

test('stores VesselAPI separately and preserves editorial, SPOT and MarineTraffic data', () => {
  const data = applyAis(seed, payload(), now);
  assert.equal(data.vesselApiPosition.lastKnown.dateTime, '2026-09-22T11:00:00.000Z');
  assert.equal(data.vesselApiPosition.lastKnown.sourceType, 'terrestrial');
  assert.equal(data.generatedAt, seed.generatedAt);
  assert.deepEqual(data.market, seed.market);
  assert.deepEqual(data.spotPosition, seed.spotPosition);
  assert.deepEqual(data.marineTrafficPosition, seed.marineTrafficPosition);
});
test('keeps 90-day chronological deduplicated history and never rolls back lastKnown', () => {
  const newer = applyAis(seed, payload(), now);
  const repeated = applyAis(newer, payload(), now + 1000);
  assert.equal(repeated.vesselApiPosition.history.length, 1);
  const older = applyAis(repeated, payload({timestamp: '2026-09-21T11:00:00Z'}), now + 2000);
  assert.equal(older.vesselApiPosition.lastKnown.dateTime, '2026-09-22T11:00:00.000Z');
  assert.deepEqual(older.vesselApiPosition.history.map(p => p.dateTime), ['2026-09-21T11:00:00.000Z', '2026-09-22T11:00:00.000Z']);
});
test('rejects other vessels, glitches, future timestamps and invalid coordinates', () => {
  for (const extra of [{imo: 1}, {suspected_glitch: true}, {timestamp: '2026-09-23T00:00:00Z'}, {latitude: 91}, {longitude: 181}]) {
    assert.throws(() => applyAis(seed, payload(extra), now));
  }
});
test('uses fixed GET endpoint and bearer authorization', async () => {
  let call;
  const result = await fetchAis('secret', async (url, options) => {
    call = {url, options};
    return {ok: true, status: 200, headers: {get: () => '149'}, json: async () => payload()};
  });
  assert.equal(call.url, ENDPOINT);
  assert.equal(call.options.method, 'GET');
  assert.equal(call.options.headers.Authorization, 'Bearer secret');
  assert.equal(result.remaining, '149');
});
test('404 is an expected no-position result', async () => {
  const result = await fetchAis('secret', async () => ({ok: false, status: 404, headers: {get: () => '150'}}));
  assert.equal(result.notFound, true);
});
test('fails safely without leaking response bodies', async () => {
  await assert.rejects(fetchAis('', async () => {}), /VESSELAPI_API_KEY/);
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(fetchAis('secret', async () => ({ok: false, status, headers: {get: () => null}})));
  }
});
