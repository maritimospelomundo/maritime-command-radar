# Maritime Master Radar

Painel público de inteligência marítima operacional criado por Captain Ponzi e voltado a comandantes, operadores, DPA, vetting e QHSE.

## Conteúdo

- mercado VLCC, Suezmax e Aframax;
- referências de bunker;
- tela de comando compacta para notebooks, com rolagem natural no celular;
- mapa mundial público NautoShark para NAVAREA/METAREA e alertas agrupados (pirataria, meteorologia, costa do Brasil, segurança e navegação eletrônica), com três registros recentes por grupo;
- módulos gratuitos de apoio à decisão: MSI, ECA/MARPOL, GNSS, bunker quality, tanker readiness e próximo porto;
- PSC Intelligence e campanhas CIC;
- Petrobras e Transpetro na seção final, com ações, produção, comércio exterior, rotas, bacias e novas fronteiras;
- Commander’s Brief;
- comparação das posições VesselAPI, Gmail/MarineTraffic e SPOT, usando o timestamp UTC original mais recente para priorizar o radar local;
- fontes, horário e nível de confiança.
- stress tests SCOPE para interrupções em passagens do petróleo, sempre identificados como simulação e comparados ao cenário-base do próprio modelo.

Os dados publicados ficam separados da interface em `site/data/latest.json`.

## Atualização local

Edite os dados públicos em `site/data/latest.json`. A versão publicada é estática e não exige compilação.

Todos os números, grupos de alertas, campanhas, notícias, indicadores, fontes, posições e textos do Commander’s Brief são carregados desse arquivo. O esquema atual é a versão 5. Antes de publicar, valide-o com:

```bash
node scripts/validate-data.mjs
```

Os resumos dos cenários públicos do SCOPE podem ser renovados, sem baixar os arquivos cartográficos completos, com:

```bash
node scripts/update-scope.mjs
```

O workflow em `.github/workflows/deploy-pages.yml` publica automaticamente no GitHub Pages quando houver um `push` na branch `main`.

O bloco `spotPosition` mantém a posição do rastreador e a condição da bateria. O bloco `marineTrafficPosition` recebe os registros de Noon/Midnight Position e demais notificações com coordenadas válidas extraídas dos e-mails. O portal compara o horário efetivo de cada posição, mostra as duas fontes e usa a mais recente no cálculo de proximidade.

## Rotina editorial

- revisão completa toda segunda, quarta e sexta-feira às 07:00 (horário de Brasília);
- atualização extraordinária quando houver evento crítico relevante;
- somente fontes públicas e gratuitas, priorizando fontes oficiais;
- cada atualização deve registrar data, fontes e nível de confiança;
- valores não confirmados devem ser identificados como estimativas ou mantidos com aviso de desatualização.

## Aviso

Este painel organiza fontes públicas e não substitui sistemas oficiais, NAVAREA, avisos aos navegantes, serviços meteorológicos contratados, instruções do armador/afretador, autoridades, seguradores ou o julgamento profissional do comandante.

## Visão Comando e integração com o Gabinete

O modo Comando exibe posição/fonte/idade, três prioridades locais, alertas altos/críticos com ação e acesso aos restantes, até quatro passagens de maior risco, CICs ativas, três itens do Commander Brief, VLCC/Suezmax/Aframax, bunker indicativo e impacto operacional Petrobras/Transpetro. Cotação de petróleo ausente do snapshot é indicada como indisponível.

SCOPE permanece apenas como link discreto ao simulador na home. Resultados e cenários continuam no modo Completo, usando `scopeAnalysis` sem alteração. Horizontes repetidos, catálogo de módulos/checklists, demais alertas, reportes, regimes PSC, gráficos, ações, produção, rotas, bacias e fontes ficam na versão completa.

O adaptador independente `site/command-summary.js` expõe `buildCommandSummary(data, resolvedPosition?)`. A home disponibiliza `window.maritimeCommandSummary` e o evento `maritime-command-summary-ready`. O objeto tem `summaryVersion: 1`, mantém `schemaVersion: 5`, `generatedAt`, posição com fonte e horário, alertas com ações/fontes, mercado, bunker, PSC ativo, passagens, energia, Transpetro e Commander Brief; não contém resultados SCOPE.

O deploy gera **`data/command-summary.json`** a partir de `latest.json` para consumo estático pelo Gabinete, evitando duplicação editorial e mantendo a mesma seleção da home. Essa posição é a do snapshot; a home pode usar uma posição mais nova quando um endpoint configurado responder. Use `dateTime` e `generatedAt` para mostrar a idade. Sem destino/viagem configurados, PSC e passagens representam cobertura mundial, não uma recomendação de rota.

```bash
node scripts/validate-data.mjs
node --test scripts/command-summary.test.mjs
node scripts/build-command-summary.mjs
```

O JSON resumido é gerado pelo workflow a cada publicação; não edite esse arquivo manualmente.

## Posição do Abdias · três fontes autorizadas

A posição consolidada usa somente VesselAPI, Gmail/MarineTraffic e SPOT. A ordem
operacional de consulta é VesselAPI → Gmail/MarineTraffic → SPOT; a posição
publicada, porém, é sempre a válida com o timestamp UTC original mais recente.
Horários de consulta, importação ou publicação nunca rejuvenescem um ponto antigo.

A VesselAPI é consultada pelo GitHub Actions quatro vezes ao dia, aproximadamente
a cada seis horas, usando exclusivamente o segredo `VESSELAPI_API_KEY`. O endpoint
é terrestre e não solicita `filter.sat=true`. Uma resposta 404 significa apenas que
não há posição costeira nas últimas 80 horas e preserva todos os dados existentes.
O plano de 150 chamadas mensais comporta 120 consultas programadas em 30 dias.

Cada fonte possui campo próprio em `site/data/latest.json`:
`vesselApiPosition`, `marineTrafficPosition` e `spotPosition`. O histórico
mantém até 90 dias, usa a data original da posição, elimina duplicatas exatas e
nunca substitui um ponto mais novo por outro mais antigo. Em timestamps iguais,
vence a melhor precisão declarada; persistindo o empate, VesselAPI,
Gmail/MarineTraffic e SPOT são usados apenas como desempate.

A Kpler, HiFleet, AISStream e outras fontes regionais/comerciais não fazem parte
desta integração. Chaves e identificadores do navio não são enviados ao frontend.
No portal público, o navio continua identificado somente como “Meu navio”.

### Ativação e validação

1. Cadastre `VESSELAPI_API_KEY` em Settings → Secrets and variables → Actions.
2. Execute Deploy Maritime Master Radar manualmente uma vez.
3. Confirme os testes, a validação do JSON e a publicação de Pages.

```sh
node --test scripts/update-ais.test.mjs scripts/command-summary.test.mjs
node scripts/validate-data.mjs
node scripts/build-command-summary.mjs
```

O workflow salva a nova posição somente quando recebe um ponto válido. Falhas de
credencial, limite, timeout ou resposta inválida preservam a última versão publicada.
