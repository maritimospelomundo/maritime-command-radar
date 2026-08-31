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

O workflow em `.github/workflows/deploy-pages.yml` publica automaticamente no GitHub Pages quando houver um `push` na branch `main`.

## Aviso

Este painel organiza fontes públicas e não substitui sistemas oficiais, NAVAREA, avisos aos navegantes, serviços meteorológicos contratados, instruções do armador/afretador, autoridades, seguradores ou o julgamento profissional do comandante.
