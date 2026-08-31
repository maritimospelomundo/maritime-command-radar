# Maritime Command Radar

Painel público de inteligência marítima operacional voltado a comandantes, operadores, DPA, vetting e QHSE.

## Conteúdo

- mercado VLCC, Suezmax e Aframax;
- referências de bunker;
- riscos de rota e meteorologia;
- PSC Intelligence e campanhas CIC;
- Petrobras e Transpetro;
- Commander’s Brief;
- fontes, horário e nível de confiança.

Os dados publicados ficam separados da interface em `site/data/latest.json`.

## Atualização local

Edite os dados públicos em `site/data/latest.json`. A versão publicada é estática e não exige compilação.

Todos os números, alertas, campanhas, notícias, indicadores, fontes e textos do Commander’s Brief são carregados desse arquivo. Antes de publicar, valide-o com:

```bash
node scripts/validate-data.mjs
```

O workflow em `.github/workflows/deploy-pages.yml` publica automaticamente no GitHub Pages quando houver um `push` na branch `main`.

## Rotina editorial

- revisão completa toda segunda-feira às 07:00 (horário de Brasília);
- atualização extraordinária quando houver evento crítico relevante;
- somente fontes públicas e gratuitas, priorizando fontes oficiais;
- cada atualização deve registrar data, fontes e nível de confiança;
- valores não confirmados devem ser identificados como estimativas ou mantidos com aviso de desatualização.

## Aviso

Este painel organiza fontes públicas e não substitui sistemas oficiais, NAVAREA, avisos aos navegantes, serviços meteorológicos contratados, instruções do armador/afretador, autoridades, seguradores ou o julgamento profissional do comandante.
