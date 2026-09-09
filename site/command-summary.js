/* Stable, additive adapter for schemaVersion 5; usable without the page or DOM. */
(function (root) {
  const rank = { critical: 4, high: 3, medium: 2, low: 1 };
  const realOnly = (item) => !/\b(?:scope|globalscope)\b/i.test(JSON.stringify(item));
  const selectPosition = (data) => [
    ...[...(data.spotPosition.history || []), data.spotPosition.lastKnown].filter(Boolean).map(p => ({ ...p, sourceKey: 'spot', sourceLabel: 'SPOT' })),
    ...[...(data.marineTrafficPosition.history || []), data.marineTrafficPosition.lastKnown].filter(Boolean).map(p => ({ ...p, sourceKey: 'marineTraffic', sourceLabel: 'MarineTraffic' }))
  ].filter(p => Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180 && Number.isFinite(Date.parse(p.dateTime)))
    .sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime))[0] || null;
  function buildCommandSummary(data, resolvedPosition) {
    const current = resolvedPosition === undefined ? selectPosition(data) : resolvedPosition;
    const alerts = data.alertGroups.flatMap(g => g.items).filter(realOnly)
      .filter(a => rank[a.level] >= 3).sort((a, b) => rank[b.level] - rank[a.level] || b.date.localeCompare(a.date));
    return {
      summaryVersion: 1, schemaVersion: data.schemaVersion, generatedAt: data.generatedAt,
      position: current ? { latitude: current.latitude, longitude: current.longitude, dateTime: current.dateTime, sourceKey: current.sourceKey, sourceLabel: current.sourceLabel, vesselName: data.spotPosition.vesselName } : null,
      criticalAlerts: alerts.map(({id, level, headline, action, date, source}) => ({id, level, headline, action, date, source})),
      tankerMarket: { week: data.market.week, sourceLabel: data.market.sourceLabel, benchmarks: data.market.benchmarks, signal: data.market.spotSignal },
      oil: { available: false, note: 'Cotação de petróleo não disponível neste snapshot.' },
      bunker: { items: data.bunker, sourceLabel: data.market.sourceLabel, note: 'Indicativo; confirmar preço, qualidade e disponibilidade antes do stem.' },
      activePsc: data.psc.regimes.filter(r => r.status === 'active').filter(realOnly),
      passageRisks: data.strategicPassages.filter(p => rank[p.risk] >= 3).filter(realOnly).sort((a,b) => rank[b.risk] - rank[a.risk])
        .map(({id, name, risk, trafficLabel, masterFocus, source}) => ({id, name, risk, trafficLabel, action: masterFocus[0], source})),
      energyOperations: data.petrobras.developments.filter(realOnly).filter(d => d.maritimeImpact).sort((a,b) => b.date.localeCompare(a.date)).slice(0,2)
        .map(({title, date, maritimeImpact, source}) => ({title, date, action: maritimeImpact, source})),
      commanderBrief: { date: data.briefing.date, items: data.briefing.items.filter(realOnly).filter(i => !['POSIÇÃO', 'PSC'].includes(i.category)).slice(0,3), caution: data.briefing.caution },
      transpetro: { title: data.petrobras.fleetPlan.title, operationalImpact: data.petrobras.fleetPlan.summary },
      simulatorUrl: 'https://globalscope.io'
    };
  }
  root.buildCommandSummary = buildCommandSummary;
  if (typeof module !== 'undefined') module.exports = { buildCommandSummary };
})(typeof window !== 'undefined' ? window : globalThis);
