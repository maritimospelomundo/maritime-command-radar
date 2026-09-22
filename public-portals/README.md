# Abdias: acompanhamento e apoio em terra

Interfaces estáticas em GitHub Pages e API com Cloudflare Worker/D1, sem ativação de plano pago.

- Páginas publicadas pelo fluxo Pages em `abdias/tracking/` e `abdias/shore/`.
- Worker e banco: `abdias-public-portals`.
- Fluxo `Deploy Abdias public portals API` cria o D1 quando necessário, aplica as migrações e publica o Worker. Usa os secrets de repositório `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
- `worker/access-hashes.json` contém somente hashes SHA-256 de tokens aleatórios independentes. Os tokens originais nunca entram no repositório. Links usam fragmentos `#chave=` (acompanhamento) e `#acesso=` (apoio).
- A autorização é validada no Worker. CORS não substitui autorização. Visitantes somente leem os dados; quem recebe um link válido pode repassá-lo.
- Nenhum snapshot operacional de apoio, cadastro interno de tripulantes, documento ou segredo é incluído nos arquivos estáticos.

## Sincronização

O Worker consulta a cada hora o Radar (VesselAPI/MarineTraffic já consolidados) e o SPOT. Não realiza consultas adicionais pagas à VesselAPI. Preserva o horário original das observações e mantém até 90 dias de histórico.

O Portal Geral envia somente `collaborationData().publicData` a `/api/import` com uma chave de servidor independente (`PUBLIC_PORTALS_SYNC_KEY`). Oficiais e pintura continuam usando sua integração existente. A primeira publicação e a importação do histórico precisam ser verificadas antes da distribuição dos novos links.

## Testes

```
npm ci
npx esbuild worker/index.ts --bundle --format=esm --platform=browser --outfile=/tmp/portals-worker.mjs
PORTALS_WORKER_BUNDLE=/tmp/portals-worker.mjs npm test
VITE_PORTALS_API=https://abdias-public-portals.maritimospelomundo.workers.dev npm run build
```

Os testes cobrem rejeição de chaves ausentes/incorretas, CORS, validação de coordenadas, ordenação pelo horário original e exclusão dos três testes SPOT: `2493309049`, `2493489592`, `2493511950`, incluindo seus horários originais. Esses registros não podem ser reimportados. O SPOT original já recebeu a limpeza em implantação separada no repositório windy-plugin-spot-vessel.

A implantação exige ainda uma verificação autenticada das duas páginas, dos dados e das datas. Nunca incluir os tokens em logs, commits ou issues.
