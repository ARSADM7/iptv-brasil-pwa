# PUBLICAR — Como pôr a iptv-api v2 no ar (e ideias de evolução)

*Track C — pesquisa e plano. Nenhuma escrita foi feita em serviços; só este ficheiro.*
*Data: 2026-10-25.*

## 1. Reteste Vercel (2026-10-25, ~10:00 CET)

- `/opt/hatch/bin/vercel status` → **connected / authenticated** (ligação nova, feita pelo Alegre).
- `get_project` do projecto iptv-api
  (`prj_xgEgbePf8zyxjd5lP6aqsZni4Omn`, equipa `team_vK4fNSnSUYrZjkz4x59bA5Po`) →
  **403 outra vez**: *"Not authorized: Trying to access resource under scope
  alegresithole-1245s-projects. You must re-authenticate to this scope"*.
- Conclusão: religar a conta **não** remove o 403. A ferramenta de remédio que o
  próprio erro indica (`authorize_team_access`) **não é suportada por este
  conector** (chamada devolve "unsupported Vercel tool"). Sem acesso ao nível do
  projecto, não consigo ver a ligação Git do projecto nem publicar nele
  directamente — daí o caminho por GitHub abaixo.

## 2. Alvo de publicação no GitHub — avaliação

### ARSADM7/iptv-brasil-pwa — SEGURO, mas com uma nota de nome
- Lido via conector: o repo tem **apenas um ficheiro**, um README de 2 linhas
  ("IPTV Brasil PWA - 1800+ canais ao vivo, design premium"). **Não há código
  nenhum para perder.**
- Ligação à Vercel: **não consigo ver** as ligações Git de nenhum projecto
  (é exactamente o que o 403 bloqueia). Pela lista de 20 projectos, nenhum se
  chama iptv-brasil-pwa nem sugere ser "a PWA" (há iptv-api, arsadm-iptv-api,
  arsadm-iptv-tester, arsadm-iptv-player, api-canais — todos nomes de
  API/player). Mesmo no pior caso (algum projecto ligado a um repo vazio), esse
  projecto não pode estar a servir nada a partir de um README.
- Rede de segurança extra: no fluxo de importação, a própria Vercel avisa se o
  repositório já estiver ligado a um projecto — o Alegre vê isso antes de
  confirmar qualquer coisa.
- Nota honesta: o nome diz "PWA" e o que vamos publicar é uma **API**. Funciona
  na mesma, mas fica um nome trocado para sempre. Se isso incomodar, ver a
  alternativa "repo novo".

### Alternativas avaliadas
- **Repo NOVO criado pelo Alegre (nome sugerido: `iptv-api`)** — o mais limpo:
  nome certo, zero risco de colisão. Custo: ~2 minutos dele. **A app GitHub da
  Muse não consegue criar repositórios** (provado: 403 "Resource not
  accessible by integration") — ele cria o repo vazio no github.com e
  selecciona-o na app da Muse; a partir daí eu consigo escrever nele.
- **ARSADM7/api-canais — REJEITADO.** Esse repo alimenta **outra API ao vivo**
  (o projecto api-canais, deploy api-canais-opal, 3.115 canais, endpoints
  diferentes). Publicar a v2 por cima **partia um serviço que está a funcionar**.

## 3. CAMINHO RECOMENDADO (mantém o domínio iptv-api-sepia.vercel.app)

Objectivo: o domínio actual fica, só o código/dados por trás mudam.

1. **(Alegre, 2 min)** Criar no github.com um repo vazio chamado `iptv-api`
   — ou, para zero criação, reutilizar o `iptv-brasil-pwa` vazio.
2. **(Alegre, 1 min)** Seleccionar esse repo na app GitHub da Muse
   (GitHub → Settings → Applications → Muse → Repository access), para eu
   poder escrever nele.
3. **(Muse)** Enviar o código da v2 + a base de canais limpa (725 que
   funcionam) para o repo.
4. **(Alegre, ~3 cliques — só ele consegue; o meu acesso ao projecto está
   403)** Na Vercel: abrir o projecto **iptv-api** → **Settings → Git →
   Connect Git Repository** → escolher esse repo. A Vercel faz deploy
   sozinha a partir daí — **mesmo projecto, mesmo domínio**
   (iptv-api-sepia.vercel.app), agora com a v2.
5. **(Muse)** Verificar em produção: `/api/stats`, `/api/channels`,
   um canal por número e por nome, e o player.

### Fallback (se o passo 4 não aparecer / der erro)
- **Vercel → Add New… → Project → Import Git Repository** → escolher o repo →
  Deploy. Nasce um projecto novo com URL próprio (ex.: iptv-api-v2.vercel.app).
- Testar tudo nesse URL novo **sem tocar no antigo**.
- Só depois da v2 provada: ligar esse repo ao projecto antigo (passo 4 acima)
  **ou** libertar o nome/domínio antigo por último (apagar/renomear o projecto
  antigo tem downtime — fazer só no fim, nunca antes).

## 4. IDEIAS — evolução profissional da API (ordenadas por valor/esforço)

1. **Proxy stateless** — URLs de segmento assinadas (base64url+HMAC) em vez do
   mapa hash→URL em memória de cada instância serverless. Mata a falha
   intermitente de segmentos (404/502) que hoje é o maior defeito. **[já na v2]**
2. **URLs por nome do canal** — `/proxy/stream/{nome-do-canal}/master.m3u8`
   além do número (slug sem acentos; colisões levam -2/-3). É o formato que o
   Alegre pediu; o número continua a funcionar. **[já na v2]**
3. **Base só com canais que funcionam + 404 honestos** — mortos removidos da
   base (não só escondidos), validação e códigos de erro correctos em todas
   as rotas. **[já na v2]**
4. **Player corrigido** — elemento `<video>` real, polyfill do Shaka,
   fallback HLS nativo, retries limitados e erro visível em vez de spinner
   eterno. **[já na v2]**
5. **Reteste automático agendado** — job diário que retesta todos os canais
   (master→variante→segmento), desactiva os mortos e guarda histórico.
   Valor alto (a base apodrece sozinha — 60% morreu sem ninguém tocar);
   esforço médio. Precisa de um sítio para guardar estado (ver ideia 6).
6. **Registo de canais novos por API** — `POST /api/channels` protegido por
   token de admin: registar um canal passa a ser um pedido, não um deploy.
   É o que destrava de vez os "189 para registar". Esforço maior (store
   persistente: Vercel KV/Blob ou o próprio GitHub como base de dados).
7. **Endpoint de saúde** — `/api/health` com versão da base, nº de canais e
   data do último reteste **verdadeira** (o `updated_at` actual é falso:
   muda a cada arranque do servidor). Esforço baixo.
8. **Cache a sério** — ETag + Cache-Control nas rotas JSON e playlists,
   para a Vercel/CDN não recalcular tudo a cada pedido. Esforço baixo.
9. **Documentação OpenAPI** — página `/docs` gerada das rotas reais
   (channels, search, stats, playlists, player, proxy). Dá o ar profissional
   e evita dúvidas sobre parâmetros (por_pagina/pagina). Esforço baixo/médio.
10. **Rate limiting + CORS afinado** — limite por IP nas rotas de proxy
    (são as caras) e CORS só para as origens certas. Esforço médio,
    protecção contra abuso do domínio.

---
*Fim do Track C. Resumo para o agente principal: reteste Vercel = 403 mantém-se;
caminho recomendado = repo GitHub (novo `iptv-api` ou o vazio iptv-brasil-pwa)
ligado ao projecto iptv-api existente via Settings → Git — mesmo domínio,
deploy automático; top ideias = proxy stateless, URLs por nome, reteste
automático agendado.*
