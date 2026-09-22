# Abdias: acompanhamento e apoio em terra

Migração preparada em 22/09/2026. Ainda não ativada no Cloudflare/GitHub Pages.
As interfaces preservam o desenho dos sites atuais. O acesso aos dados é validado
no Worker; nenhum link de acesso, chave, snapshot operacional ou coordenada de
tripulantes é publicado nos arquivos estáticos. A raiz pública não confere acesso
aos dados. Quem possui um link válido pode compartilhá-lo; não é login individual.

## Hospedagem gratuita

- Publicar `dist/` em `site/abdias/` no repositório maritime-command-radar, aproveitando
  o Pages existente, depois de configurar e verificar o Worker.
- Páginas: `abdias/tracking/` e `abdias/shore/`.
- Criar Worker `abdias-public-portals` e D1 `abdias-public-portals` no plano Free.
- Worker consulta o Radar (VesselAPI e MarineTraffic/Gmail já consolidados) e SPOT
  a cada hora. Não faz novas consultas pagas à VesselAPI. Histórico de 90 dias.
- Consultas de visitantes só leem D1; nenhuma gravação por abertura de página.
- Tokens independentes: acompanhamento, apoio e importação. Guardar apenas SHA-256
  nos secrets `TRACK_HASH`, `SHORE_HASH` e `SYNC_HASH` do Worker.
- `PAGES_ORIGIN` restringe CORS; a autorização depende do token, não do CORS.

## Ativação

1. `npm install` neste diretório; `npm test`.
2. `npx wrangler d1 create abdias-public-portals`. Copiar
   `worker/wrangler.toml.example` para `worker/wrangler.toml`; preencher o ID retornado.
3. `npx wrangler d1 migrations apply abdias-public-portals --remote --config worker/wrangler.toml`.
4. Cadastrar os três hashes com `npx wrangler secret put NOME --config worker/wrangler.toml`.
   Manter tokens originais fora do repositório; conservar as chaves dos links atuais
   quando disponíveis. Não copiar segredos para mensagens ou logs.
5. `npx wrangler deploy --config worker/wrangler.toml` (sem ativar plano pago).
6. Importar o histórico completo dos sites atuais e a publicação selecionada de
   apoio via `POST /api/import`, `Authorization: Bearer <token de importação>` e JSON
   `{ "positions": [...], "shore": <publicação schemaVersion 2> }`. A exportação deve
   ocorrer pelos endpoints atuais autenticados. Não transportar o cadastro interno
   de tripulantes, fotos, documentos ou demandas não selecionadas.
7. Adaptar a publicação do Portal Geral para enviar sua cópia de apoio a `/api/import`
   no novo Worker, usando secret de servidor. A integração antiga de oficiais e
   pintura deve continuar intacta; não apontar seu `/api/bridge` para este Worker.
   Este passo e a importação ainda estão pendentes e são necessários para a troca.
8. Compilar com `VITE_PORTALS_API=https://<worker-publicado> npm run build`.
   Copiar `dist/` para `site/abdias/` na etapa de build do workflow Pages existente.
   Verificar os dois links, rejeição sem chave e com chave errada, dados e datas,
   preservação do histórico, acesso de apoio somente às demandas selecionadas.
9. Só após isso distribuir links novos, com `#chave=<token>` no acompanhamento
   e `#acesso=<token>` no apoio. Manter os sites anteriores até concluir a verificação.

## Exclusão dos testes SPOT

Bloqueados IDs `2493309049`, `2493489592` e `2493511950`, ou suas horários originais SPOT quando a origem não traz IDs. Os três registros foram confirmados como testes fora do navio.
A correção do D1 SPOT original está em alteração separada no repositório
windy-plugin-spot-vessel. Até sua implantação, o SPOT original ainda pode fornecê-los,
mas a política deste Worker rejeita os três e impede reintrodução no novo banco.

## Verificação realizada

Build Vite das duas interfaces; testes de exclusão, preservação do terceiro ponto,
ordenação por horário original, deduplicação e validação de coordenadas.
Acesso e limites da conta Cloudflare e implantação remota ainda não verificados.

Fontes: https://developers.cloudflare.com/d1/platform/pricing/
https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
