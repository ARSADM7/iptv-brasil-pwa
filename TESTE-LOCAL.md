# TESTE LOCAL — iptv-api v2

*Data: 2026-10-25 · Node v24.22.1 · Express 4 · Sem deploy (só local).*

Duas instâncias testadas com a mesma bateria (27 verificações cada):

| Instância | Porta | Base carregada | Resultado |
|---|---|---|---|
| Amostra (fallback) | 3478 | `data/channels.sample.json` — 3 canais | **27/27 PASS** |
| Completa | 3477 | `data/channels.json` — 687 canais | **27/27 PASS** |

Arranque confirmado nos logs: `base: channels.sample.json | canais: 3` e
`base: channels.json | canais: 687` — o fallback para a amostra funciona.

## Verificações (iguais nas duas instâncias)

- `GET /` → 200, página de documentação.
- `GET /api/health` → 200 `{status:"ok", versao, total_canais, base_dados}`.
- `GET /api/stats` → 200 com exactamente `{total, categorias, servidores, com_logo, sem_logo}`.
- `GET /api/channels?por_pagina=2&pagina=1` → 200, 2 itens, `meta.por_pagina=2`;
  cada canal tem `stream_url` e `stream_url_nome` e **não** tem `upstream` nem `updated_at`.
- `por_pagina=101` → **400** `VALIDATION_ERROR` · `pagina=abc` → **400**.
- `GET /api/channels/29` → 200 NatureTime; `stream_url` termina em
  `/proxy/stream/29/master.m3u8` e `stream_url_nome` em `/proxy/stream/naturetime/master.m3u8`.
- `GET /api/channels/naturetime` → 200 (resolução por slug).
- `GET /api/channels/999999` → **404** `NOT_FOUND` · slug desconhecido → **400** `VALIDATION_ERROR`.
- `GET /api/categories` → 200 (84 categorias na base completa).
- `GET /api/search` sem `q` → **400** · `?q=nature` → 200 com NatureTime.
- `GET /playlist/all.m3u` → 200, nº de `#EXTINF` = nº de canais (687 / 3).
- `GET /playlist/Brasil.m3u` → 200 (106 entradas na base completa).
- `GET /playlist/NAO-EXISTE-XYZ.m3u` → **404** (corrige o 200 vazio da v1).
- `GET /proxy/logo/999999` → 200 `image/png` (1×1 transparente).
- `GET /player/29` → 200 com `<video id="video">` real, `shaka.polyfill.installAll`
  e o STREAM_URL do canal injectado · `/player/naturetime` → 200 · `/player/999999` → 404.
- `GET /proxy/stream/<slug-desconhecido>/master.m3u8` → **404**.

## Cadeia de reprodução (a prova principal)

NatureTime (id 29), cujo upstream é a própria API antiga:

- **Por número:** `GET /proxy/stream/29/master.m3u8` → 200, master reescrito para
  `/proxy/fetch/<token>` → variante/media → 200 (playlist) → **segmento → 200,
  439.552 bytes, `video/mp2t`**.
- **Por nome:** `GET /proxy/stream/naturetime/master.m3u8` → **exactamente o mesmo
  resultado** (master → variante → segmento 200, 439.552 bytes). A funcionalidade
  nova funciona ponta a ponta.
- As linhas `#EXT-X-MEDIA` (legenda PT e áudio EN) do master vêm com `URI="..."`
  reescrito para `/proxy/fetch/<token>` — legendas e chaves AES incluídas.
- Aliases `/proxy/stream/29/variant/<token>` e `/media/<token>` → 200 ·
  token inválido → 400.

TV Brasil Teste (id 9001, upstream directo `45.162.64.114`, só na amostra):

- `GET /proxy/stream/tv-brasil-teste/master.m3u8` → media playlist reescrita →
  **segmento → 200, 7.011.648 bytes, `video/MP2T`** (servidor Xtream directo,
  sem passar pela API antiga).
- `GET /proxy/logo/9002` (com `logo_original`) → **302** para o logo original ·
  `GET /proxy/logo/29` (sem logo) → 200 PNG 1×1.

## Upstreams

- Nenhum upstream falhou a partir deste datacenter durante os testes:
  a API antiga (via proxy, NatureTime) e o servidor directo 45.162.64.114
  responderam a toda a cadeia. (Nota conhecida: os segmentos da API antiga
  são intermitentes por desenho dela — mapa hash em memória; na v2 esse
  problema não existe porque os URLs são stateless.)
- Servidores de teste parados no fim (portas 3477/3478 livres).
