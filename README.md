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
- comparação da última posição recebida pelo SPOT e pelo MarineTraffic, usando automaticamente o registro mais recente para priorizar o radar local;
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

## Posição horária do Abdias · Kpler AIS v2

O workflow de publicação consulta `https://api.kpler.com/v2/maritime/ais-latest`
uma vez por hora, no minuto 17 UTC, exclusivamente para o IMO **9453896**
(Abdias Nascimento). GitHub Actions pode atrasar execuções; não é serviço de
localização em tempo real nem garantia de execução no minuto exato.

### Ativação

1. Em Settings → Secrets and variables → Actions, cadastre o segredo
   `KPLER_API_KEY` com a chave Kpler, sem o prefixo `Basic`.
2. A chave deve ter permissão para AIS Latest v2 e cobertura contratada adequada.
3. Em Actions → Deploy Maritime Master Radar → Run workflow, execute o primeiro
   teste. Confirme as etapas de consulta e publicação antes de considerar ativo.

Nunca coloque a chave no código, JSON público, log ou navegador do portal.
A chave compartilhada em uma captura de tela deve ser substituída antes da ativação.
Sem chave ou permissão, a consulta falha e o último site publicado é preservado.

### Compatibilidade entre portais

O resultado é salvo em `site/data/latest.json`, preservando schemaVersion 5 e
`marineTrafficPosition.lastKnown` (`latitude`, `longitude`, `dateTime`, `unixTime`,
`eventType`). Essa fonte já é consumida pelo Portal Geral, Acompanhamento e pelo
novo portal Colaboração/Apoio em Terra. Nenhum desses clientes recebe a chave Kpler
ou precisa fazer sua própria consulta paga. A atualização chega na próxima leitura
que cada portal faz dessa fonte. O antigo Apoio em Terra permanece desativado.

A consulta horária funciona na nuvem, mesmo com os portais fechados e computador
desligado. São aproximadamente 720 chamadas em 30 dias, mais testes manuais.
Os históricos existentes em outros portais mantêm seu comportamento: este recurso
não garante guardar todos os pontos horários quando aqueles portais estão fechados.

Campos adicionais: `checkedAt`, `refreshIntervalMinutes`, `provider`, telemetria em
`lastKnown` e `voyage` (destino, ETA AIS, calado e `staticDt`). Esses dados de viagem
ficam disponíveis na fonte; os controles manuais e relatórios de viagem dos portais
não são sobrescritos. O ETA AIS é informado pelo navio, não um ETA preditivo.

`dateTime` é o horário da mensagem AIS; `checkedAt` é o horário da consulta.
`generatedAt` continua indicando a publicação editorial do radar. Uma consulta nova
não rejuvenesce a posição nem as notícias. Registros inválidos, futuros, fora de sete
dias ou de outro IMO são rejeitados. Posições anteriores não substituem as mais novas.
Falhas 401/403/429, JSON inválido e timeout preservam o último arquivo publicado.

Validação local sem consumo de API:

```sh
node --test scripts/update-ais.test.mjs scripts/command-summary.test.mjs
node scripts/validate-data.mjs
node scripts/build-command-summary.mjs
```

O agendamento compartilha o workflow de Pages: salva o dado validado e publica o
site na mesma execução. Isso evita depender de outro workflow disparado por um
commit feito com `GITHUB_TOKEN`. Alterações concorrentes são conciliadas por rebase;
em caso de conflito, a execução para sem forçar a branch. Se o GitHub desativar
agendamentos por inatividade do repositório, reative o workflow em Actions.
