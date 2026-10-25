# iptv-api v2

API de canais IPTV (JSON completo, playlists M3U, player web e proxy HLS),
evolução da API em produção (iptv-api-sepia.vercel.app).

## Novidades da v2

- **URLs por nome do canal** — `/proxy/stream/naturetime/master.m3u8` funciona
  além de `/proxy/stream/29/master.m3u8` (slug sem acentos; idem em
  `/api/channels/{ref}`, `/player/{ref}` e `/proxy/logo/{ref}`).
- **Proxy stateless** — variantes, segmentos, chaves AES e legendas passam por
  `/proxy/fetch/<token>` com o URL de destino em base64url no próprio caminho.
  Acaba o erro intermitente de segmentos da v1 (mapa hash→URL em memória de
  cada instância serverless).
- **Player corrigido** — `<video>` real, `shaka.polyfill.installAll()` +
  verificação de suporte, fallback HLS nativo, pré-check do master com o erro
  real, retries 8 → 3.
- **Erros honestos** — `/playlist/{categoria}.m3u` inexistente devolve 404;
  sem campo `updated_at` falso nas respostas.
- **`/api/health`** — estado, versão e base em uso.

## Estrutura

```
server.js            Express (arranque + página inicial + 404/500 JSON)
lib/api.js           Todas as rotas (API, playlists, player, proxy, logos)
lib/data.js          Carrega data/channels.json (ou channels.sample.json)
data/channels.json   Base completa (gerada pela pipeline de dados)
data/channels.sample.json  Amostra de 3 canais para teste local
www/index.html       Documentação (tema escuro)
www/player.html      Player (template: {{CHANNEL_ID}}, {{CHANNEL_NAME}}, {{STREAM_URL}})
vercel.json          Deploy Vercel (@vercel/node, includeFiles data/www/lib)
```

## Dados

Cada canal em `data/channels.json`:

```json
{ "id": 29, "nome": "NatureTime", "slug": "naturetime", "nome_completo": "NatureTime",
  "tvg_id": "", "categoria": "Brasil", "logo": "", "logo_original": "",
  "host": "jmp2.uk", "ativo": true,
  "upstream": "https://…/link-verdadeiro-do-stream" }
```

O campo `upstream` é **interno** — nunca aparece nas respostas (é o link que
o proxy esconde). As respostas usam os nomes de campos da v1 (`nome`,
`nome_completo`, `tvg_id`, `categoria`, `logo`, `logo_original`, `host`,
`ativo`, `stream_url`) mais `stream_url_nome` (versão por nome), com
`stream_url` construído a partir do host do pedido.

## Correr localmente

```bash
npm install
npm start          # http://localhost:3000 (ou PORT=xxxx)
```

Ver `TESTE-LOCAL.md` (bateria de 27 verificações ×2 instâncias, tudo PASS) e
`PUBLICAR.md` (plano de publicação mantendo o domínio actual).
