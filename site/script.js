const portal = document.querySelector('#portal');
const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.topbar nav');
const svgNs = 'http://www.w3.org/2000/svg';

menuButton?.addEventListener('click', () => nav?.classList.toggle('nav-open'));
nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => nav.classList.remove('nav-open')));

const byId = (id) => document.getElementById(id);
const setText = (id, value) => { const node = byId(id); if (node) node.textContent = value ?? '—'; };
const clear = (node) => { while (node?.firstChild) node.removeChild(node.firstChild); };
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svgElement = (tag, attrs = {}) => {
  const node = document.createElementNS(svgNs, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
};

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
let positionContext = null;

const toRadians = (value) => value * Math.PI / 180;
const toDegrees = (value) => value * 180 / Math.PI;
const validCoordinate = (latitude, longitude) => Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
const mapToCoordinates = (map) => ({ latitude: 90 - (map.y * 1.8), longitude: (map.x * 3.6) - 180 });

function distanceNm(a, b) {
  const radiusNm = 3440.065;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radiusNm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function bearingDegrees(a, b) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function projectPoint(origin, course, distance) {
  const angular = distance / 3440.065;
  const bearing = toRadians(course);
  const lat1 = toRadians(origin.latitude);
  const lon1 = toRadians(origin.longitude);
  const latitude = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
  const longitude = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(latitude));
  return { latitude: toDegrees(latitude), longitude: ((toDegrees(longitude) + 540) % 360) - 180 };
}

function positionAgeLabel(dateTime) {
  const minutes = Math.max(0, (Date.now() - Date.parse(dateTime)) / 60000);
  if (minutes < 90) return `${Math.round(minutes)} min atrás`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h atrás`;
  return `${Math.round(minutes / 1440)} dias atrás`;
}

function coordinatesLabel(point) {
  const formatDdm = (value, degreeDigits, positive, negative) => {
    const absolute = Math.abs(value);
    const degrees = Math.floor(absolute);
    const minutes = ((absolute - degrees) * 60).toFixed(2).replace('.', ',');
    return `${String(degrees).padStart(degreeDigits, '0')}º${minutes.padStart(5, '0')}' ${value >= 0 ? positive : negative}`;
  };
  return `Lat: ${formatDdm(point.latitude, 2, 'N', 'S')}  Long: ${formatDdm(point.longitude, 3, 'E', 'W')}`;
}

function pointTimestamp(point) {
  const unix = Number(point?.unixTime);
  if (Number.isFinite(unix)) return unix > 1e12 ? unix : unix * 1000;
  return Date.parse(point?.dateTime);
}

function batteryLabel(state) {
  return ({ GOOD: 'Boa', OK: 'Boa', LOW: 'Baixa', CRITICAL: 'Crítica' }[String(state || '').toUpperCase()] || 'Não informada');
}

function relevanceFor(point, level = 'low') {
  if (!positionContext || !point) return { distance: Infinity, projectedDistance: Infinity, score: 0 };
  const distance = distanceNm(positionContext.current, point);
  const projectedDistance = positionContext.projected ? distanceNm(positionContext.projected, point) : distance;
  const effectiveDistance = Math.min(distance, projectedDistance);
  const levelWeight = { critical: 5200, high: 3600, medium: 2100, low: 900 }[level] || 900;
  const proximity = Math.max(0, 6500 - effectiveDistance);
  const routeBonus = projectedDistance + 40 < distance ? 900 : 0;
  return { distance, projectedDistance, score: levelWeight + proximity + routeBonus };
}

function distanceBand(distance) {
  if (!Number.isFinite(distance)) return 'Posição indisponível';
  if (distance <= 250) return `Imediato · ${number.format(distance)} MN`;
  if (distance <= 750) return `Próximo · ${number.format(distance)} MN`;
  if (distance <= 1500) return `Regional · ${number.format(distance)} MN`;
  return `Global · ${number.format(distance)} MN`;
}

async function resolveSourcePosition(config, sourceKey, sourceLabel) {
  let points = [];
  if (config?.endpoint) {
    try {
      const response = await fetch(config.endpoint, { cache: 'no-store' });
      if (response.ok) points = (await response.json()).points || [];
    } catch { /* usa o último snapshot publicado */ }
  }
  if (!points.length && Array.isArray(config?.history)) points = config.history;
  if (!points.length && config?.lastKnown) points = [config.lastKnown];
  points = points.filter((point) => validCoordinate(Number(point.latitude), Number(point.longitude)))
    .map((point) => ({ ...point, latitude: Number(point.latitude), longitude: Number(point.longitude), sourceKey, sourceLabel }))
    .filter((point) => Number.isFinite(pointTimestamp(point)))
    .sort((a, b) => pointTimestamp(a) - pointTimestamp(b));
  return { current: points.at(-1) || null, points, isLive: Boolean(config?.endpoint && points.length > 1), mapUrl: config?.mapUrl };
}

async function resolvePosition(spotConfig, marineTrafficConfig) {
  const [spot, marineTraffic] = await Promise.all([
    resolveSourcePosition(spotConfig, 'spot', 'SPOT'),
    resolveSourcePosition(marineTrafficConfig, 'marineTraffic', 'MarineTraffic')
  ]);
  const points = [...spot.points, ...marineTraffic.points]
    .sort((a, b) => pointTimestamp(a) - pointTimestamp(b))
    .filter((point, index, list) => index === 0 || pointTimestamp(point) !== pointTimestamp(list[index - 1]) || point.latitude !== list[index - 1].latitude || point.longitude !== list[index - 1].longitude);
  if (!points.length) return null;
  const current = points.at(-1);
  const previous = points.at(-2);
  let course = null;
  let speed = null;
  let projected = null;
  if (previous) {
    const hours = (pointTimestamp(current) - pointTimestamp(previous)) / 3600000;
    if (hours > 0) {
      speed = distanceNm(previous, current) / hours;
      course = bearingDegrees(previous, current);
      if (speed <= 30) projected = projectPoint(current, course, speed * 24);
    }
  }
  return { current, previous, course, speed, projected, sourceStates: { spot, marineTraffic } };
}

function assertData(data) {
  const required = ['schemaVersion', 'generatedAt', 'status', 'spotPosition', 'marineTrafficPosition', 'dailyWatch', 'market', 'alertGroups', 'strategicPassages', 'scopeAnalysis', 'reportingSystems', 'psc', 'petrobras', 'bunker', 'briefing', 'sources', 'updatePolicy'];
  const missing = required.filter((key) => data?.[key] === undefined);
  if (missing.length) throw new Error(`Campos ausentes: ${missing.join(', ')}`);
  if (data.schemaVersion !== 5) throw new Error('Versão do esquema de dados incompatível.');
  if (!Array.isArray(data.market.benchmarks) || !Array.isArray(data.alertGroups) || !Array.isArray(data.strategicPassages) || !Array.isArray(data.scopeAnalysis.scenarios) || !Array.isArray(data.reportingSystems) || !Array.isArray(data.psc.regimes) || !Array.isArray(data.sources)) throw new Error('Listas de dados inválidas.');
}

function renderDailyWatch(dailyWatch) {
  const horizons = byId('horizon-grid');
  clear(horizons);
  dailyWatch.horizons.forEach((item) => {
    const card = element('article', `horizon-card ${item.level}`);
    const head = element('header');
    head.append(element('small', '', item.label), element('b', '', item.value));
    card.append(head, element('p', '', item.summary));
    horizons.append(card);
  });

  const compact = byId('watch-modules');
  const detail = byId('watch-detail-grid');
  clear(compact);
  clear(detail);
  dailyWatch.modules.forEach((item) => {
    const card = element('a', `watch-card status-${item.status}`);
    card.href = safeUrl(item.source.url);
    card.target = '_blank';
    card.rel = 'noreferrer';
    const copy = element('div');
    copy.append(element('small', '', item.label), element('b', '', item.value), element('p', '', item.summary));
    card.append(element('i', '', item.icon), copy);
    compact.append(card);

    const full = element('article');
    const head = element('header');
    const labels = element('div');
    labels.append(element('small', '', item.label), element('h3', '', item.value));
    head.append(element('i', '', item.icon), labels);
    const source = element('a', '', `${item.source.name} ↗`);
    source.href = safeUrl(item.source.url);
    source.target = '_blank';
    source.rel = 'noreferrer';
    full.append(head, element('p', '', item.summary), source);
    detail.append(full);
  });
}

function safeUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
}

function confidenceLabel(value) {
  return ({ high: 'Confiança alta', medium: 'Confiança média', low: 'Confiança baixa' })[value] || 'Confiança não informada';
}

function renderHeader(data) {
  const generated = new Date(data.generatedAt);
  const stamp = dateTime.format(generated).replace(',', ' ·');
  const alerts = data.alertGroups.flatMap(({ items }) => items);
  const highCount = alerts.filter(({ level }) => level === 'high' || level === 'critical').length;
  setText('snapshot-status', data.status.snapshotLabel);
  setText('snapshot-time', `${stamp} UTC`);
  setText('radar-market-week', data.market.week);
  setText('pulse-status', data.status.label);
  setText('pulse-alerts', `${highCount} ${highCount === 1 ? 'registro' : 'registros'}`);
  setText('pulse-psc', data.psc.pulseLabel);
  setText('pulse-next-review', data.status.nextReview);
  setText('footer-snapshot', `Snapshot · ${stamp} UTC`);
}

function renderMarket(data) {
  const cards = byId('market-cards');
  clear(cards);
  const compact = byId('market-compact');
  clear(compact);
  data.benchmarks.forEach((item, index) => {
    const card = element('article', 'market-card');
    const top = element('div', 'card-topline');
    top.append(element('span', '', String(index + 1).padStart(2, '0')), element('i', '', '◈'));
    const value = element('strong', '', `$ ${number.format(item.value)}`);
    value.append(element('small', '', '/dia'));
    const trend = element('div', 'mini-trend');
    trend.append(element('span', '', data.history.weeks[0]));
    const bar = element('i');
    bar.style.width = `${Math.max(0, Math.min(100, item.trendWidth))}%`;
    trend.append(bar, element('span', '', data.week));
    const footer = element('footer');
    footer.append(element('span', 'confidence', confidenceLabel(item.confidence)), element('span', '', data.sourceLabel));
    card.append(top, element('h3', '', item.segment), element('p', '', item.route), value, trend, footer);
    cards.append(card);

    const compactCard = element('article');
    compactCard.append(element('small', '', item.segment), element('b', '', `$ ${number.format(item.value)}`));
    compact.append(compactCard);
  });

  const spot = data.spotSignal;
  const highlight = element('article', 'market-card highlight-card');
  const top = element('div', 'card-topline');
  top.append(element('span', '', 'SPOT SIGNAL'), element('i', '', '≈'));
  const spotValue = element('strong', '', spot.valueLabel);
  const footer = element('footer');
  footer.append(element('span', 'confidence', spot.confidenceLabel), element('span', '', spot.sourceLabel));
  highlight.append(top, element('h3', '', spot.segment), element('p', '', spot.label), spotValue, element('p', 'highlight-copy', spot.summary), footer);
  cards.append(highlight);
  const spotCompact = element('article');
  spotCompact.append(element('small', '', 'SPOT VLCC'), element('b', '', spot.valueLabel.replace('US$', '$')));
  compact.append(spotCompact);

  setText('index-week', data.week);
  const indices = byId('market-indices');
  clear(indices);
  data.indices.forEach((item) => {
    const change = item.previous ? ((item.value - item.previous) / item.previous) * 100 : 0;
    const wrap = element('div');
    wrap.append(element('small', '', item.name), element('b', '', number.format(item.value)), element('span', change >= 0 ? 'positive' : 'negative', `${change >= 0 ? '↗' : '↘'} ${money.format(Math.abs(change))}%`));
    indices.append(wrap);
  });
  renderChart(data.history);
}

function renderChart(history) {
  const svg = byId('market-chart');
  const legend = byId('chart-legend');
  clear(svg);
  clear(legend);
  const values = history.series.flatMap((series) => series.values);
  const minValue = Math.floor(Math.min(...values) / 10) * 10;
  const maxValue = Math.ceil(Math.max(...values) / 10) * 10;
  const y = (value) => 220 - ((value - minValue) / Math.max(1, maxValue - minValue)) * 180;
  const x = (index) => 50 + (index * 625) / Math.max(1, history.weeks.length - 1);
  for (let i = 0; i < 4; i += 1) {
    const yPos = 40 + i * 60;
    svg.append(svgElement('line', { class: 'grid', x1: 45, y1: yPos, x2: 680, y2: yPos }));
    const label = svgElement('text', { x: 8, y: yPos + 5 });
    label.textContent = number.format(maxValue - (i * (maxValue - minValue)) / 3);
    svg.append(label);
  }
  history.series.forEach((series) => {
    const points = series.values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
    svg.append(svgElement('polyline', { class: series.className, points }));
    legend.append(element('span', `l-${series.className}`, series.name));
  });
  [0, history.weeks.length - 1].forEach((index) => {
    const label = svgElement('text', { x: index === 0 ? 45 : 650, y: 242 });
    label.textContent = history.weeks[index];
    svg.append(label);
  });
}

function renderAlerts(groups) {
  const labels = { critical: 'Crítico', high: 'Alto', medium: 'Moderado', low: 'Baixo' };
  const dotClasses = { critical: 'dot-red', high: 'dot-orange', medium: 'dot-amber', low: 'dot-green' };
  const list = byId('risk-list');
  const points = byId('risk-map-points');
  const filters = byId('alert-filters');
  const rail = byId('risk-rail');
  const globalSituation = byId('global-situation');
  clear(list);
  clear(points);
  clear(filters);
  clear(rail);
  clear(globalSituation);

  const allButton = element('button', 'active', 'Todos');
  allButton.dataset.alertGroup = 'all';
  filters.append(allButton);
  const orderedGroups = groups.map((group) => ({ ...group, items: [...group.items].sort((a, b) => {
    const aGeo = a.geo || mapToCoordinates(a.map);
    const bGeo = b.geo || mapToCoordinates(b.map);
    return relevanceFor(bGeo, b.level).score - relevanceFor(aGeo, a.level).score;
  }) })).sort((a, b) => relevanceFor(b.items[0]?.geo || mapToCoordinates(b.items[0]?.map), b.items[0]?.level).score - relevanceFor(a.items[0]?.geo || mapToCoordinates(a.items[0]?.map), a.items[0]?.level).score);
  orderedGroups.forEach((group) => {
    const button = element('button', '', `${group.icon} ${group.shortTitle}`);
    button.dataset.alertGroup = group.id;
    filters.append(button);
    const section = element('section', 'alert-group');
    section.dataset.alertGroupPanel = group.id;
    const heading = element('header');
    const titleWrap = element('div');
    titleWrap.append(element('span', 'group-icon', group.icon), element('h3', '', group.title));
    heading.append(titleWrap, element('small', '', `${group.items.length} últimos registros`));
    const description = element('p', 'group-description', group.description);
    section.append(heading, description);

    group.items.forEach((alert, index) => {
      const details = element('details', 'alert-item');
      details.id = `alert-${alert.id}`;
      details.dataset.group = group.id;
      const summary = element('summary');
      const meta = element('span', 'alert-meta');
      const pill = element('span', `risk-pill risk-${alert.level}`);
      pill.append(element('i', dotClasses[alert.level]), document.createTextNode(labels[alert.level] || alert.level));
      const alertGeo = alert.geo || mapToCoordinates(alert.map);
      const relevance = relevanceFor(alertGeo, alert.level);
      meta.append(pill, element('time', '', shortDate.format(new Date(`${alert.date}T00:00:00Z`))), element('small', '', alert.region), element('small', 'distance-label', distanceBand(relevance.distance)));
      const copy = element('span', 'alert-summary-copy');
      copy.append(element('b', '', alert.headline), element('span', '', alert.summary));
      summary.append(meta, copy, element('i', 'expand-mark', '+'));
      const body = element('div', 'alert-detail');
      body.append(element('p', '', alert.details), element('strong', '', `Ação do comandante: ${alert.action}`));
      const source = element('a', '', `${alert.source.name} ↗`);
      source.href = safeUrl(alert.source.url);
      source.target = '_blank';
      source.rel = 'noreferrer';
      body.append(source);
      details.append(summary, body);
      section.append(details);

      const point = element('button', `map-point ${alert.level}`);
      point.type = 'button';
      point.style.left = `${alert.map.x}%`;
      point.style.top = `${alert.map.y}%`;
      point.setAttribute('aria-label', `${group.title}: ${alert.headline}`);
      point.title = `${alert.region} — ${alert.headline}`;
      point.dataset.target = details.id;
      point.dataset.group = group.id;
      point.append(element('i'), element('b', '', index === 0 ? alert.map.label : ''));
      point.addEventListener('click', () => {
        filterGroups(group.id);
        details.open = true;
        details.scrollIntoView({ behavior: 'smooth', block: 'center' });
        details.classList.add('map-selected');
        window.setTimeout(() => details.classList.remove('map-selected'), 1800);
      });
      points.append(point);
    });
    list.append(section);

    const severe = group.items.filter(({ level }) => level === 'critical' || level === 'high').length;
    const railItem = element('a');
    railItem.href = `#alerts-detail`;
    railItem.append(element('small', '', `${group.icon} ${group.shortTitle}`));
    const railValue = element('b', '', `${group.items.length}`);
    if (severe) railValue.append(element('em', '', `${severe} ↑`));
    railItem.append(railValue);
    rail.append(railItem);

    const priority = [...group.items].sort((a, b) => {
      const rank = { critical: 4, high: 3, medium: 2, low: 1 };
      return (rank[b.level] - rank[a.level]) || b.date.localeCompare(a.date);
    })[0];
    if (priority) {
      const globalItem = element('a', `global-alert risk-${priority.level}`);
      globalItem.href = `#alert-${priority.id}`;
      globalItem.append(element('small', '', `${group.icon} ${group.shortTitle}`));
      const copy = element('div');
      copy.append(element('b', '', priority.headline), element('span', '', priority.region));
      globalItem.append(copy, element('time', '', shortDate.format(new Date(`${priority.date}T00:00:00Z`))));
      globalSituation.append(globalItem);
    }
  });
  const filterGroups = (id) => {
    filters.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.alertGroup === id));
    list.querySelectorAll('[data-alert-group-panel]').forEach((panel) => panel.hidden = id !== 'all' && panel.dataset.alertGroupPanel !== id);
    points.querySelectorAll('.map-point').forEach((point) => point.hidden = id !== 'all' && point.dataset.group !== id);
  };
  filters.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => filterGroups(button.dataset.alertGroup)));
  const total = orderedGroups.reduce((sum, group) => sum + group.items.length, 0);
  setText('risk-map-scale', `◎ ${total} registros em ${orderedGroups.length} grupos`);
}

function renderPsc(psc) {
  const start = shortDate.format(new Date(`${psc.start}T00:00:00Z`)).toUpperCase();
  const end = shortDate.format(new Date(`${psc.end}T00:00:00Z`)).toUpperCase();
  setText('psc-window', `${start} — ${end}`);
  setText('psc-window-detail', `${start} — ${end}`);
  setText('psc-status', psc.statusLabel);
  setText('psc-mous', psc.mous.join(' + '));
  setText('psc-campaign', psc.campaign);
  setText('psc-description', psc.description);
  setText('psc-note', psc.note);
  const link = byId('psc-link');
  link.href = safeUrl(psc.questionnaireUrl);
  const readiness = byId('psc-readiness');
  clear(readiness);
  psc.readiness.forEach((item) => readiness.append(element('li', '', `✓ ${item}`)));

  const regimes = byId('psc-regime-grid');
  clear(regimes);
  const statusLabels = { active: 'CIC ATIVA', announced: 'ANUNCIADA', unconfirmed: 'NÃO LOCALIZADA', national: 'REGIME NACIONAL' };
  const counts = psc.regimes.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
  const summary = byId('psc-summary');
  clear(summary);
  [
    ['Cobertura', `${psc.regimes.length} regimes`, '9 MoUs + USCG'],
    ['Confirmadas', `${counts.active || 0} ativas`, 'publicação oficial localizada'],
    ['Anunciadas', `${counts.announced || 0}`, 'aguardando detalhes completos'],
    ['Sem confirmação', `${counts.unconfirmed || 0}`, 'não presumir campanha']
  ].forEach(([label, value, note]) => {
    const card = element('article');
    card.append(element('small', '', label), element('b', '', value), element('span', '', note));
    summary.append(card);
  });
  psc.regimes.forEach((item) => {
    const card = element('article', `psc-regime status-${item.status}`);
    const head = element('header');
    const title = element('div');
    title.append(element('small', '', item.region), element('h3', '', item.name));
    head.append(title, element('b', 'status-badge', statusLabels[item.status] || item.status));
    const tanker = element('div', 'tanker-impact');
    tanker.append(element('small', '', 'IMPACTO NO PETROLEIRO'), element('p', '', item.tankerFocus));
    const source = element('a', '', `${item.source.name} ↗`);
    source.href = safeUrl(item.source.url);
    source.target = '_blank';
    source.rel = 'noreferrer';
    card.append(head, element('strong', '', item.campaign), element('p', 'campaign-window', item.window), tanker, source);
    regimes.append(card);
  });
}

function renderPassages(passages) {
  const grid = byId('passage-grid');
  clear(grid);
  const risks = { critical: 'CRÍTICO', high: 'ALTO', medium: 'ATENÇÃO', low: 'ESTÁVEL' };
  const passageGeo = {
    magellan: { latitude: -52.7, longitude: -70.9 }, 'cape-horn': { latitude: -56.0, longitude: -67.3 },
    sunda: { latitude: -5.9, longitude: 105.9 }, malacca: { latitude: 4.0, longitude: 99.5 }, singapore: { latitude: 1.2, longitude: 103.8 },
    suez: { latitude: 30.3, longitude: 32.5 }, hormuz: { latitude: 26.6, longitude: 56.3 }, gibraltar: { latitude: 35.9, longitude: -5.6 },
    'bab-el-mandeb': { latitude: 12.6, longitude: 43.4 }, panama: { latitude: 9.1, longitude: -79.7 }
  };
  const ordered = [...passages].sort((a, b) => relevanceFor(passageGeo[b.id], b.risk).score - relevanceFor(passageGeo[a.id], a.risk).score);
  ordered.forEach((item, index) => {
    const details = element('details', `passage-card risk-${item.risk}`);
    details.id = `passage-${item.id}`;
    if (index < 2) details.open = true;
    const summary = element('summary');
    const title = element('div', 'passage-title');
    const relevance = relevanceFor(passageGeo[item.id], item.risk);
    title.append(element('small', '', item.region), element('h3', '', item.name), element('span', 'distance-label', distanceBand(relevance.distance)));
    const pulse = element('div', 'passage-pulse');
    pulse.append(element('span', 'status-badge', risks[item.risk]), element('b', '', item.trafficLabel), element('small', '', item.trafficTrend));
    summary.append(title, pulse, element('i', 'expand-mark', '+'));
    const body = element('div', 'passage-body');
    const metric = element('div', 'passage-metric');
    metric.append(element('small', '', 'BASE DO TRÁFEGO'), element('p', '', item.trafficBasis));
    const market = element('div');
    market.append(element('small', '', 'GEOECONOMIA / MERCADO'), element('p', '', item.market));
    const geopolitics = element('div');
    geopolitics.append(element('small', '', 'GEOPOLÍTICA / SEGURANÇA'), element('p', '', item.geopolitics));
    const authority = element('div');
    authority.append(element('small', '', 'AUTORIDADE / REPORTE'), element('p', '', `${item.authority} · ${item.reporting}`));
    const focus = element('ul');
    item.masterFocus.forEach((note) => focus.append(element('li', '', note)));
    const source = element('a', '', `${item.source.name} ↗`);
    source.href = safeUrl(item.source.url);
    source.target = '_blank';
    source.rel = 'noreferrer';
    body.append(metric, market, geopolitics, authority, element('small', 'focus-label', 'MASTER FOCUS'), focus, source);
    details.append(summary, body);
    grid.append(details);
  });
}

function signedPercent(value) {
  const numeric = Number(value) || 0;
  return `${numeric > 0 ? '+' : ''}${money.format(numeric)}%`;
}

function scopeRelevance(item) {
  return relevanceFor({ latitude: item.latitude, longitude: item.longitude }, item.modelRisk);
}

function renderScope(scope, passages) {
  const spotlight = byId('scope-spotlight');
  const grid = byId('scope-scenario-grid');
  clear(spotlight);
  clear(grid);
  const ordered = [...scope.scenarios].sort((a, b) => scopeRelevance(b).score - scopeRelevance(a).score);
  const passageIds = new Set(passages.map(({ id }) => id));
  const primary = ordered[0];
  const riskLabels = { critical: 'IMPACTO EXTREMO', high: 'IMPACTO ALTO', medium: 'IMPACTO MODERADO', low: 'IMPACTO LIMITADO' };

  if (primary) {
    const relevance = scopeRelevance(primary);
    const copy = element('div', 'scope-spotlight-copy');
    copy.append(
      element('small', '', `CENÁRIO PRIORITÁRIO · ${distanceBand(relevance.distance)}`),
      element('h4', '', primary.name),
      element('p', '', `Fechamento simulado: pico de preço no dia ${primary.peakDay}; ${primary.recoveryLabel.toLowerCase()}.`)
    );
    const metrics = element('div', 'scope-metrics');
    [
      ['PREÇO MODELADO', signedPercent(primary.peakPriceChangePercent)],
      ['OFERTA MÍNIMA', signedPercent(primary.minimumSupplyChangePercent)],
      ['PROCESSAMENTO', signedPercent(primary.minimumThroughputChangePercent)]
    ].forEach(([label, value]) => {
      const metric = element('div');
      metric.append(element('small', '', label), element('b', '', value));
      metrics.append(metric);
    });
    spotlight.append(copy, metrics);
  }

  ordered.forEach((item) => {
    const relevance = scopeRelevance(item);
    const card = element('article', `scope-card risk-${item.modelRisk}`);
    const head = element('header');
    const title = element('div');
    title.append(element('small', '', distanceBand(relevance.distance)), element('h4', '', item.name));
    head.append(title, element('span', 'status-badge', riskLabels[item.modelRisk]));
    const metrics = element('dl');
    [['Preço', signedPercent(item.peakPriceChangePercent)], ['Oferta', signedPercent(item.minimumSupplyChangePercent)], ['Refino', signedPercent(item.minimumThroughputChangePercent)]].forEach(([label, value]) => {
      const row = element('div');
      row.append(element('dt', '', label), element('dd', '', value));
      metrics.append(row);
    });
    const hasPassage = passageIds.has(item.passageId);
    const passageLink = element('a', '', hasPassage ? 'Ver passagem ↓' : 'Abrir cenário ↗');
    passageLink.href = hasPassage ? `#passage-${item.passageId}` : safeUrl(scope.sourceUrl);
    if (!hasPassage) {
      passageLink.target = '_blank';
      passageLink.rel = 'noreferrer';
    }
    card.append(head, metrics, element('p', '', item.recoveryLabel), passageLink);
    grid.append(card);
  });

  setText('scope-updated', `SCOPE consultado em ${dateTime.format(new Date(scope.updatedAt))} UTC · ${scope.scenarioWindow}`);
  setText('scope-model-note', scope.modelNote);
  const source = byId('scope-source-link');
  if (source) source.href = safeUrl(scope.sourceUrl);
}

function renderReporting(systems) {
  const grid = byId('reporting-grid');
  const summary = byId('reporting-summary');
  clear(grid);
  clear(summary);
  const labels = { mandatory: 'OBRIGATÓRIO', voluntary: 'VOLUNTÁRIO', conditional: 'CONDICIONAL' };
  const counts = systems.reduce((acc, item) => { acc[item.type] = (acc[item.type] || 0) + 1; return acc; }, {});
  [['mandatory', 'Obrigatórios'], ['voluntary', 'Voluntários'], ['conditional', 'Condicionais']].forEach(([key, label]) => {
    const card = element('article', `type-${key}`);
    card.append(element('b', '', String(counts[key] || 0)), element('span', '', label));
    summary.append(card);
  });
  systems.forEach((item) => {
    const card = element('article', `report-card type-${item.type}`);
    const head = element('header');
    const title = element('div');
    title.append(element('small', '', item.region), element('h3', '', item.name));
    head.append(title, element('b', 'status-badge', labels[item.type]));
    const rows = element('dl');
    [['Aplica-se', item.appliesTo], ['Quando', item.when], ['Reporte', item.report], ['Autoridade', item.authority]].forEach(([term, value]) => {
      rows.append(element('dt', '', term), element('dd', '', value));
    });
    const source = element('a', '', `${item.source.name} ↗`);
    source.href = safeUrl(item.source.url);
    source.target = '_blank';
    source.rel = 'noreferrer';
    card.append(head, rows, source);
    grid.append(card);
  });
}

function renderPetrobras(data) {
  setText('energy-period', data.periodLabel);
  setText('energy-headline', data.headline);
  setText('energy-summary', data.summary);
  const compact = byId('energy-compact');
  clear(compact);
  const compactItems = [
    data.metrics[0],
    data.metrics[1],
    { label: 'Navios cabotagem', value: data.fleetPlan.metrics.find(({ label }) => label.includes('navios'))?.value || '—' },
    { label: 'PETR4', value: `${data.markets.find(({ ticker }) => ticker === 'PETR4')?.currencySymbol || 'R$'} ${money.format(data.markets.find(({ ticker }) => ticker === 'PETR4')?.price || 0)}` },
    { label: 'PBR', value: `${data.markets.find(({ ticker }) => ticker === 'PBR')?.currencySymbol || 'US$'} ${money.format(data.markets.find(({ ticker }) => ticker === 'PBR')?.price || 0)}` }
  ];
  compactItems.forEach((item) => {
    const card = element('article');
    card.append(element('small', '', item.label), element('b', '', item.value));
    compact.append(card);
  });
  const metrics = byId('energy-metrics');
  clear(metrics);
  data.metrics.forEach((item) => { const wrap = element('div'); wrap.append(element('small', '', item.label), element('b', '', item.value)); metrics.append(wrap); });
  setText('fleet-title', data.fleetPlan.title);
  setText('fleet-summary', data.fleetPlan.summary);
  const fleet = byId('fleet-numbers');
  clear(fleet);
  data.fleetPlan.metrics.forEach((item) => { const wrap = element('div'); wrap.append(element('b', '', item.value), element('span', '', item.label)); fleet.append(wrap); });

  const stocks = byId('stock-grid');
  clear(stocks);
  data.markets.forEach((item) => {
    const card = element('a', 'stock-tile');
    card.href = safeUrl(item.sourceUrl);
    card.target = '_blank';
    card.rel = 'noreferrer';
    const top = element('div');
    top.append(element('b', '', item.ticker), element('small', '', item.market));
    const trend = element('span', item.changePercent >= 0 ? 'positive' : 'negative', `${item.changePercent >= 0 ? '↗' : '↘'} ${money.format(Math.abs(item.changePercent))}%`);
    card.append(top, element('strong', '', `${item.currencySymbol} ${money.format(item.price)}`), trend, element('small', '', `${item.trend} · ${item.capturedAtLabel}`));
    stocks.append(card);
  });

  const operations = byId('operations-grid');
  clear(operations);
  data.operations.forEach((item) => {
    const card = element('article');
    card.append(element('small', '', item.label), element('b', '', item.value), element('span', '', item.comparison));
    operations.append(card);
  });

  const routes = byId('energy-routes');
  clear(routes);
  data.routes.forEach((item) => {
    const details = element('details');
    const summary = element('summary');
    summary.append(element('span', '', `${item.origin} → ${item.destination}`), element('b', '', item.cargo), element('i', 'expand-mark', '+'));
    const body = element('div');
    body.append(element('p', '', item.summary), element('strong', '', item.operationalNote));
    details.append(summary, body);
    routes.append(details);
  });

  const basins = byId('basin-grid');
  clear(basins);
  data.basins.forEach((item) => {
    const details = element('details');
    const summary = element('summary');
    summary.append(element('span', '', item.name), element('small', '', item.status), element('i', 'expand-mark', '+'));
    const body = element('div');
    body.append(element('p', '', item.summary), element('strong', '', item.maritimeImpact));
    details.append(summary, body);
    basins.append(details);
  });

  const developments = byId('energy-developments');
  clear(developments);
  data.developments.forEach((item) => {
    const details = element('details');
    const summary = element('summary');
    summary.append(element('time', '', shortDate.format(new Date(`${item.date}T00:00:00Z`))), element('span', '', item.title), element('i', 'expand-mark', '+'));
    const body = element('div');
    body.append(element('p', '', item.summary), element('strong', '', `Impacto marítimo: ${item.maritimeImpact}`));
    const link = element('a', '', `${item.source.name} ↗`);
    link.href = safeUrl(item.source.url);
    link.target = '_blank';
    link.rel = 'noreferrer';
    body.append(link);
    details.append(summary, body);
    developments.append(details);
  });
}

function renderBunker(items) {
  const grid = byId('bunker-grid');
  const compact = byId('bunker-compact');
  clear(grid);
  clear(compact);
  items.forEach((item) => {
    const card = element('article');
    const info = element('div');
    info.append(element('small', '', item.code), element('h3', '', item.port));
    card.append(element('i', 'icon', '◆'), info, element('b', '', `$${money.format(item.vlsfo)}`), element('span', item.change >= 0 ? 'negative' : 'positive', `${item.change >= 0 ? '+' : '−'}${money.format(Math.abs(item.change))}`));
    grid.append(card);
    const price = element('span');
    price.append(document.createTextNode(item.code), element('b', '', `$${number.format(item.vlsfo)}`));
    compact.append(price);
  });
}

function renderBriefing(briefing) {
  setText('brief-date', fullDate.format(new Date(`${briefing.date}T00:00:00Z`)));
  setText('brief-caution', briefing.caution);
  const grid = byId('brief-compact');
  clear(grid);
  briefing.items.forEach((item) => {
    const card = element('article');
    card.append(element('small', '', item.category), element('h3', '', item.title), element('p', '', item.summary));
    grid.append(card);
  });
}

function renderSources(sources) {
  const table = byId('source-table');
  table.querySelectorAll('a').forEach((item) => item.remove());
  sources.forEach((source) => {
    const link = element('a');
    link.href = safeUrl(source.url);
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.append(element('b', '', source.name), element('span', '', source.scope), element('i', '', source.typeLabel), element('b', '', '↗'));
    table.append(link);
  });
}

function render(data) {
  renderHeader(data);
  renderDailyWatch(data.dailyWatch);
  renderMarket(data.market);
  renderAlerts(data.alertGroups);
  renderScope(data.scopeAnalysis, data.strategicPassages);
  renderPassages(data.strategicPassages);
  renderReporting(data.reportingSystems);
  renderPsc(data.psc);
  renderPetrobras(data.petrobras);
  renderBunker(data.bunker);
  renderBriefing(data.briefing);
  renderSources(data.sources);
  setText('update-policy', data.updatePolicy);
}

function renderPositionPriority(data) {
  const grid = byId('local-priority-grid');
  clear(grid);
  if (!positionContext) {
    setText('position-priority-title', 'Posição indisponível');
    setText('local-priority-note', 'O panorama global permanece disponível');
    return;
  }
  const { current, course, speed, projected, sourceStates } = positionContext;
  setText('position-priority-title', data.spotPosition?.vesselName || 'Meu navio');
  setText('position-source-label', `POSIÇÃO MAIS RECENTE · ${current.sourceLabel.toUpperCase()}`);
  setText('spot-position-time', `${dateTime.format(new Date(pointTimestamp(current)))} UTC · ${positionAgeLabel(current.dateTime)}`);
  setText('spot-position-coordinates', coordinatesLabel(current));
  setText('spot-position-projection', projected ? `24 h · ${String(Math.round(course)).padStart(3, '0')}° · ${money.format(speed)} kn` : 'Aguardando 2 posições');
  const mapLink = byId('spot-map-link');
  mapLink.href = safeUrl(sourceStates[current.sourceKey]?.mapUrl || data.spotPosition?.mapUrl || mapLink.href);
  mapLink.textContent = current.sourceKey === 'spot' ? 'Abrir SPOT ↗' : 'Abrir MarineTraffic ↗';
  setText('local-priority-note', `Base: ${current.sourceLabel} · distância, severidade${projected ? ' e derrota estimada' : ''}`);

  const renderSource = (key, state) => {
    const prefix = key === 'spot' ? 'spot' : 'marine';
    const card = byId(`${prefix}-source-card`);
    const isCurrent = current.sourceKey === key;
    card?.classList.toggle('is-current', isCurrent);
    setText(`${prefix}-source-status`, state.current ? (isCurrent ? 'Mais recente' : 'Disponível') : 'Aguardando');
    setText(`${prefix}-source-coordinates`, state.current ? coordinatesLabel(state.current) : 'Nenhuma posição recebida');
    setText(`${prefix}-source-time`, state.current ? `${dateTime.format(new Date(pointTimestamp(state.current)))} UTC · ${positionAgeLabel(state.current.dateTime)}` : 'Aguardando o primeiro registro válido');
  };
  renderSource('spot', sourceStates.spot);
  renderSource('marineTraffic', sourceStates.marineTraffic);
  setText('spot-source-battery', `Bateria: ${batteryLabel(sourceStates.spot.current?.batteryState)}`);
  setText('marine-source-event', sourceStates.marineTraffic.current?.eventType || sourceStates.marineTraffic.current?.messageType || 'Posição / chegada / saída');

  const alertCandidates = data.alertGroups.flatMap((group) => group.items.map((item) => ({
    type: group.shortTitle,
    icon: group.icon,
    id: item.id,
    title: item.headline,
    region: item.region,
    level: item.level,
    href: `#alert-${item.id}`,
    ...relevanceFor(item.geo || mapToCoordinates(item.map), item.level)
  })));
  const scopeCandidates = (data.scopeAnalysis?.scenarios || []).map((item) => ({
    type: 'SCOPE · SIMULAÇÃO', icon: '◈', id: `scope-${item.id}`, title: `Interrupção simulada: ${item.name}`,
    region: `Preço ${signedPercent(item.peakPriceChangePercent)} · oferta ${signedPercent(item.minimumSupplyChangePercent)}`,
    level: item.modelRisk, href: '#scope-analysis',
    ...relevanceFor({ latitude: item.latitude, longitude: item.longitude }, item.modelRisk)
  }));
  const candidates = [...alertCandidates, ...scopeCandidates].sort((a, b) => b.score - a.score).slice(0, 5);
  candidates.forEach((item, index) => {
    const card = element('a', `local-priority-card risk-${item.level}`);
    card.href = item.href;
    card.append(element('span', 'local-rank', String(index + 1).padStart(2, '0')));
    const copy = element('div');
    copy.append(element('small', '', `${item.icon} ${item.type}`), element('b', '', item.title), element('span', '', item.region));
    card.append(copy, element('em', '', distanceBand(item.distance)));
    grid.append(card);
  });
}

async function loadRadar() {
  const message = byId('data-message');
  try {
    const response = await fetch('data/latest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
    const data = await response.json();
    assertData(data);
    positionContext = await resolvePosition(data.spotPosition, data.marineTrafficPosition);
    renderPositionPriority(data);
    render(data);
    message.hidden = true;
    portal.setAttribute('aria-busy', 'false');
  } catch (error) {
    portal.setAttribute('aria-busy', 'false');
    message.classList.add('data-error');
    message.textContent = 'Não foi possível carregar a atualização do radar. Os dados não serão exibidos até que a fonte seja validada.';
    setText('snapshot-status', 'Dados indisponíveis');
    setText('snapshot-time', error.message);
  }
}

loadRadar();
