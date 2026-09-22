/* Stable, additive adapter for schemaVersion 5; usable without the page or DOM. */
(function (root) {
  const rank = { critical: 4, high: 3, medium: 2, low: 1 };
  const realOnly = (item) => !/\b(?:scope|globalscope)\b/i.test(JSON.stringify(item));
  const validPoint = p => p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
  const validPosition = p => validPoint(p) && Number.isFinite(Date.parse(p.dateTime)) && Date.parse(p.dateTime) <= Date.now();
  const eventGeo = a => validPoint(a?.geo) ? a.geo : (Number.isFinite(a?.map?.x) && Number.isFinite(a?.map?.y) ? {latitude:90-a.map.y*1.8, longitude:a.map.x*3.6-180} : null);
  const passageGeo = {
    magellan:{latitude:-52.7,longitude:-70.9}, 'cape-horn':{latitude:-56,longitude:-67.3},
    sunda:{latitude:-5.9,longitude:105.9}, malacca:{latitude:4,longitude:99.5}, singapore:{latitude:1.2,longitude:103.8},
    suez:{latitude:30.3,longitude:32.5}, hormuz:{latitude:26.6,longitude:56.3}, gibraltar:{latitude:35.9,longitude:-5.6},
    'bab-el-mandeb':{latitude:12.6,longitude:43.4}, panama:{latitude:9.1,longitude:-79.7}
  };
  function proximity(current, point, level='low', date) {
    let distance = Infinity;
    if (validPoint(current) && validPoint(point)) {
      const r = x => x*Math.PI/180;
      const h = Math.sin(r(point.latitude-current.latitude)/2)**2 + Math.cos(r(current.latitude))*Math.cos(r(point.latitude))*Math.sin(r(point.longitude-current.longitude)/2)**2;
      distance = 6880.13*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
    }
    const band = !Number.isFinite(distance) ? 0 : distance<=250 ? 5 : distance<=750 ? 4 : distance<=1500 ? 3 : distance<=3000 ? 2 : 1;
    const days = (Date.now()-Date.parse(date))/86400000;
    const freshness = Number.isFinite(days) && days>=0 ? Math.max(0,300-days*10) : 0;
    return {distance, score:band*100000+(rank[level]||1)*1000+freshness-(Number.isFinite(distance)?distance/100:0)};
  }
  const sourcePoints = (config, sourceKey, sourceLabel, sourceRank) => [
    ...(Array.isArray(config?.history) ? config.history : []),
    config?.lastKnown
  ].filter(Boolean).map(p => ({ ...p, sourceKey, sourceLabel, sourceRank }));
  const accuracyRank = p => {
    const value = Number(p.accuracyMeters ?? p.accuracy);
    return Number.isFinite(value) && value >= 0 ? 1000000 - value : 0;
  };
  const selectPosition = (data) => [
    ...sourcePoints(data.vesselApiPosition, 'vesselApi', 'VesselAPI', 3),
    ...sourcePoints(data.marineTrafficPosition, 'marineTraffic', 'MarineTraffic', 2),
    ...sourcePoints(data.spotPosition, 'spot', 'SPOT', 1)
  ].filter(validPosition)
    .sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime) || accuracyRank(b) - accuracyRank(a) || b.sourceRank - a.sourceRank)[0] || null;
  function buildCommandSummary(data, resolvedPosition) {
    const current = resolvedPosition === undefined ? selectPosition(data) : (validPosition(resolvedPosition) ? resolvedPosition : null);
    const alerts = data.alertGroups.flatMap(g => g.items).filter(realOnly)
      .map(a => ({...a, ...proximity(current,eventGeo(a),a.level,a.date)}))
      .sort((a,b) => b.score-a.score || b.date.localeCompare(a.date));
    return {
      summaryVersion: 1, schemaVersion: data.schemaVersion, generatedAt: data.generatedAt,
      position: current ? { latitude: current.latitude, longitude: current.longitude, dateTime: current.dateTime, sourceKey: current.sourceKey, sourceLabel: current.sourceLabel, vesselName: data.spotPosition.vesselName } : null,
      nearbyAlerts: alerts.map(({id,level,headline,action,date,source,distance}) => ({id,level,headline,action,date,source,distanceNm:Number.isFinite(distance)?distance:null})),
      criticalAlerts: alerts.filter(a=>rank[a.level]>=3).map(({id, level, headline, action, date, source, distance}) => ({id, level, headline, action, date, source, distanceNm:Number.isFinite(distance)?distance:null})),
      tankerMarket: { week: data.market.week, sourceLabel: data.market.sourceLabel, benchmarks: data.market.benchmarks, signal: data.market.spotSignal },
      oil: { available: false, note: 'Cotação de petróleo não disponível neste snapshot.' },
      bunker: { items: data.bunker, sourceLabel: data.market.sourceLabel, note: 'Indicativo; confirmar preço, qualidade e disponibilidade antes do stem.' },
      activePsc: data.psc.regimes.filter(r => r.status === 'active').filter(realOnly),
      passageRisks: data.strategicPassages.filter(p => rank[p.risk] >= 3).filter(realOnly).map(p => ({...p,...proximity(current,passageGeo[p.id],p.risk)})).sort((a,b) => b.score-a.score)
        .map(({id, name, risk, trafficLabel, masterFocus, source, distance}) => ({id, name, risk, trafficLabel, action: masterFocus[0], source, distanceNm:Number.isFinite(distance)?distance:null})),
      energyOperations: data.petrobras.developments.filter(realOnly).filter(d => d.maritimeImpact).sort((a,b) => b.date.localeCompare(a.date)).slice(0,2)
        .map(({title, date, maritimeImpact, source}) => ({title, date, action: maritimeImpact, source})),
      commanderBrief: { date: data.briefing.date, items: data.briefing.items.filter(realOnly).filter(i => !['POSIÇÃO', 'PSC'].includes(i.category)).slice(0,3), caution: data.briefing.caution },
      transpetro: { title: data.petrobras.fleetPlan.title, operationalImpact: data.petrobras.fleetPlan.summary },
      simulatorUrl: 'https://globalscope.io'
    };
  }
  root.radarPriority = {proximity,eventGeo,passageGeo,validPosition};
  root.buildCommandSummary = buildCommandSummary;
  if (typeof module !== 'undefined') module.exports = { buildCommandSummary, proximity, eventGeo, validPosition };
})(typeof window !== 'undefined' ? window : globalThis);

