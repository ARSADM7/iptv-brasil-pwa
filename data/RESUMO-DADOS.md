# RESUMO DOS DADOS — iptv-api v2 (base de canais)

Gerado a 2026-10-25 a partir apenas de ficheiros em disco. **Total final: 687 canais.**

## Contagens

| Fonte | Canais | Upstream |
|---|---|---|
| `api-ponte` | 482 | Ponte: `https://iptv-api-sepia.vercel.app/proxy/stream/{id}/master.m3u8` (a API antiga busca o original; o URL original destes é desconhecido, só se conhece o `host`) |
| `livetv` | 189 | Directo (URL original testado a funcionar hoje) |
| `tribunal` | 16 | Directo (URL original provado por ffprobe / playlist viva) |
| **Total** | **687** | **205 directos / 482 em ponte** |

- IDs: os da API antiga mantêm-se (1–1542, com lacunas dos mortos/removidos); os canais novos receberam IDs sequenciais a partir de **1835** (último usado: 2036).
- Verificado no ficheiro final: JSON válido, **IDs únicos, slugs únicos, upstreams únicos**, todos com `ativo: true` e os 12 campos completos.

## Como se chegou aos 687 (deduplicação por nome normalizado)

Nome normalizado = minúsculas, sem acentos, sem os tokens hd/sd/fhd/uhd/4k/720p/1080p/480p/360p/tv/channel/brazil/brasil/br/ronin/pluto. Dentro do mesmo nome fica **uma** entrada; directo ganha a ponte; ao ganhar um directo, mantém-se o ID antigo da API.

1. **API antiga (725 funcionais)** → 485 nomes únicos: **240 entradas colapsadas** (a API tinha várias fontes do mesmo canal; ficou a de menor ID como representante em ponte).
2. **LiveTV Brazil (254 que funcionam)**:
   - 64 já estavam cobertos por IDs da API que passaram nos testes do proxy (`proxy_ok`) → ignorados, sem duplicar.
   - **3 substituíram a ponte por directo, mantendo o ID da API**: TV Brasil (264), Jovem Pan News (285), TV A Folha (450).
   - **186 entraram como canais novos** com URL directo — inclui 6 que na API antiga estavam mortos e aqui funcionam directos (Telecine Action, SBT News, Globo Brasília, TVE Bahia, Trace Brazuca, Retro Cartoon) e a **Rede Brasil** (ver excepção abaixo).
   - 1 ignorado por duplicado de nome/URL: "Azteca Uno (-1h)" (variante do "Azteca Uno - 1H" já incluído).
3. **Tribunal (40 = 26 aprovados + 14 playlist viva)** → **16 adicionados**, 24 ignorados por o nome já existir no dataset. Adicionados, entre eles os 9 que nunca tiveram proxy: **BTV, Food Network, Italia 2, Motorvision, Porto Canal, Real Time, RTP África, SIC, Tooncast** — mais Deutsche Welle, Deutsche Welle Español, RAI 1/2/3, Real Madrid TV e Trace Urban (da playlist viva).
4. **Gist/CanaisPlay: nada incluído** (regra: servidor bloqueia IPs de datacenter, não verificável).

## Excepções e problemas de dados encontrados

- **Rede Brasil incluída à força (ID 1946)**: pela normalização, "Rede Brasil" colide com "Rede TV!" (ambos → `rede`), mas **são canais diferentes** — foi mantida como canal novo, como indicado. O "Rede Brasil" do Tribunal ficou de fora por essa mesma colisão (e o da LiveTV, testado hoje, é o que conta).
- **"Canal Sony HD" do Tribunal excluído à mão**: é o mesmo canal que o "Sony Channel" (ID 339, já no dataset via API) — mesmo servidor de origem (170.83.16.50) — só muda o nome ("canal" em vez de "channel" escapava à normalização). Manter seria um duplicado.
- **Colisões da normalização que custaram canais distintos (ficaram de fora, pela regra "um nome = um canal")**:
  - **CNN (Internacional)** do Tribunal → colide com **CNN Brasil** (ambos → `cnn`).
  - **Bloomberg** (internacional) do Tribunal → colide com **Bloomberg TV Brasil** (→ `bloomberg`).
  - **Discovery Channel** do Tribunal (feed italiano, directo) → o nome `discovery` já está ocupado pela ponte do Discovery Channel 4K (ID 857 da API). Se um dia se quiser o feed directo, é trocar o `upstream` do 857.
- **Logos da LiveTV**: a maioria dos 189 traz o logo genérico da fonte (bugsfreeweb/LiveTVCollector) porque era o que a fonte trazia; os nomes/categorias também vêm da fonte (muitos em inglês/espanhol — esta colecção "Brazil" tem muitos canais mexicanos/internacionais).
- **Risco conhecido dos 482 em ponte**: dependem da API antiga estar viva. Os 205 directos não. Se a API antiga morrer, os em ponte são os primeiros a migrar quando aparecerem URLs directos para eles.
