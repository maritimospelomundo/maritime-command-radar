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

Os dados publicados ficam separados da interface em `site/data/latest.json`.

## Atualização local

Edite os dados públicos em `site/data/latest.json`. A versão publicada é estática e não exige compilação.

Todos os números, grupos de alertas, campanhas, notícias, indicadores, fontes, posições e textos do Commander’s Brief são carregados desse arquivo. O esquema atual é a versão 5. Antes de publicar, valide-o com:

```bash
node scripts/validate-data.mjs
```

O workflow em `.github/workflows/deploy-pages.yml` publica automaticamente no GitHub Pages quando houver um `push` na branch `main`.

O bloco `spotPosition` mantém a posição do rastreador e a condição da bateria. O bloco `marineTrafficPosition` recebe os registros de Noon/Midnight Position extraídos das notificações por e-mail. O portal compara o horário efetivo de cada posição, mostra as duas fontes e usa a mais recente no cálculo de proximidade.

## Rotina editorial

- revisão completa toda segunda, quarta e sexta-feira às 07:00 (horário de Brasília);
- atualização extraordinária quando houver evento crítico relevante;
- somente fontes públicas e gratuitas, priorizando fontes oficiais;
- cada atualização deve registrar data, fontes e nível de confiança;
- valores não confirmados devem ser identificados como estimativas ou mantidos com aviso de desatualização.

## Aviso

Este painel organiza fontes públicas e não substitui sistemas oficiais, NAVAREA, avisos aos navegantes, serviços meteorológicos contratados, instruções do armador/afretador, autoridades, seguradores ou o julgamento profissional do comandante.
