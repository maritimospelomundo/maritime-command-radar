# Migração dos portais Abdias para GitHub Pages + Cloudflare Free

Estado em 22/09/2026: migração ainda não ativada. O novo aviso já foi publicado no acompanhamento atual (versão 7). Apoio/oficiais atual está na versão 6. Essas versões excluem os DOIS primeiros testes; a confirmação posterior do terceiro exige nova atualização dos sites.

## Arquitetura definida

- GitHub Pages: interfaces de acompanhamento e apoio em terra, preservando os layouts existentes.
- Cloudflare Worker + D1 Free: dados e autorização por tokens separados para acompanhamento, apoio e sincronização.
- Tokens apenas no fragmento do link e cabeçalho Authorization; nunca em repositórios ou dados estáticos. Validar os hashes SHA-256 no Worker. Respostas private/no-store.
- Compartilhar no apoio somente a publicação selecionada pelo Comandante. Não publicar banco interno de tripulantes, documentos, fotos ou demandas não selecionadas.
- Um histórico de 90 dias, ordenado pelo horário original das posições, deduplicado; consulta horária das fontes existentes. Preservar VesselAPI, MarineTraffic/Gmail e futuros registros SPOT válidos. Excluir Kpler.
- Separar a consulta de apoio dos registros de oficiais/pintura; manter os fluxos de gravação atuais.

## Alterações desta proposta

Removido o snapshot SPOT de teste de latest.json; estado sem posição SPOT passa a ser válido. Os três horários de teste são rejeitados pelo Radar e resumo do Comandante, inclusive se reaparecerem em histórico.

## Pendências concretas

1. Implantar a correção dos três IDs no Worker spot-vessel-position e aplicar a migração no D1 spot-vessel-history, no repositório windy-plugin-spot-vessel.
2. Remover também o terceiro teste SPOT dos seeds e bancos persistidos dos sites acompanhamento, apoio e Portal Geral, bloqueando reentrada. Horários de 02/09: 13:25:02, 20:47:56 e 21:45:34 UTC. Todos são testes fora do navio.
3. Recuperar/recriar o pacote de migração a partir das fontes atuais dos Sites. As duas interfaces e o Worker haviam compilado no ambiente local, com testes de autorização e posições; o ambiente falhou antes de esse pacote ser salvo no GitHub. Não tratar essa compilação como uma implantação ou como código disponível neste PR.
4. Criar/configurar o Worker e D1 na conta Cloudflare Free; cadastrar segredos de acesso; exportar histórico e publicação de apoio pelos endpoints autenticados; importar sem incluir dados internos.
5. Adaptar a publicação do Portal Geral para alimentar o novo Worker. Verificar equivalência de histórico, datas e demandas selecionadas antes de trocar links.
6. Compilar páginas em subdiretórios do Pages existente. Testar acessos sem token, token errado, token de outro escopo e token correto. Só então compartilhar os novos links. Conservar os anteriores durante a transição.

Aviso publicado: “Acompanhamento informativo para tripulação e familiares. As posições são recebidas com atraso e não representam a localização do navio em tempo real. Compartilhe este link somente com autorização expressa do Comandante.”

Acesso de implantação à conta Cloudflare não estava disponível nesta sessão. Não houve ativação de plano pago.

Referências: https://developers.cloudflare.com/d1/platform/pricing/ e https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
