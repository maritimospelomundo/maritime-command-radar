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

function assertData(data) {
  const required = ['schemaVersion', 'generatedAt', 'status', 'dailyWatch', 'market', 'alertGroups', 'strategicPassages', 'reportingSystems', 'psc', 'petrobras', 'bunker', 'briefing', 'sources', 'updatePolicy'];
  const missing = required.filter((key) => data?.[key] === undefined);
  if (missing.length) throw new Error(`Campos ausentes: ${missing.join(', ')}`);
  if (data.schemaVersion !== 5) throw new Error('Versão do esquema de dados incompatível.');
  if (!Array.isArray(data.market.benchmarks) || !Array.isArray(data.alertGroups) || !Array.isArray(data.strategicPassages) || !Array.isArray(data.reportingSystems) || !Array.isArray(data.psc.regimes) || !Array.isArray(data.sources)) throw new Error('Listas de dados inválidas.');
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
  groups.forEach((group) => {
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
      meta.append(pill, element('time', '', shortDate.format(new Date(`${alert.date}T00:00:00Z`))), element('small', '', alert.region));
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
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  setText('risk-map-scale', `◎ ${total} registros em ${groups.length} grupos`);
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
  passages.forEach((item, index) => {
    const details = element('details', `passage-card risk-${item.risk}`);
    if (index < 2) details.open = true;
    const summary = element('summary');
    const title = element('div', 'passage-title');
    title.append(element('small', '', item.region), element('h3', '', item.name));
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
  renderPassages(data.strategicPassages);
  renderReporting(data.reportingSystems);
  renderPsc(data.psc);
  renderPetrobras(data.petrobras);
  renderBunker(data.bunker);
  renderBriefing(data.briefing);
  renderSources(data.sources);
  setText('update-policy', data.updatePolicy);
}

async function loadRadar() {
  const message = byId('data-message');
  try {
    const response = await fetch('data/latest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
    const data = await response.json();
    assertData(data);
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
