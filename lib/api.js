'use strict';
/*
 * lib/api.js — rotas da iptv-api v2.
 *
 * Correcções face à v1:
 *  1) Proxy STATELESS: os URLs de variantes/segmentos/chaves levam o URL
 *     absoluto de destino codificado em base64url no próprio caminho
 *     (/proxy/fetch/<token>). Não há mapa hash->URL em memória, logo não
 *     há 404 intermitentes quando a instância serverless muda.
 *  2) Player com <video> real (template em www/player.html).
 *  3) Sem `updated_at` falso (o campo foi removido das respostas).
 *  4) /playlist/{categoria}.m3u inexistente devolve 404 (não 200 vazia).
 *
 * Novidade: /proxy/stream/{ref}/master.m3u8 aceita o número (id) OU o
 * nome do canal (slug, ex.: /proxy/stream/naturetime/master.m3u8).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { channels, byId, slugify, resolverRef, ficheiro } = require('./data');

const router = express.Router();
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const TIMEOUT_MS = 15000;
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

/* ---------- helpers ---------- */

function base(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function apiError(res, status, code, message, details) {
  const error = { code, message, status };
  if (details) error.details = details;
  return res.status(status).json({ error });
}

function validationError(res, pathName, message) {
  return apiError(res, 400, 'VALIDATION_ERROR', 'Dados de entrada invalidos', [
    { path: pathName, message },
  ]);
}

function notFound(res, message) {
  return apiError(res, 404, 'NOT_FOUND', message || 'Canal não encontrado(a)');
}

function temLogo(c) {
  return Boolean(c.logo_original || (c.logo && /^https?:\/\//.test(c.logo) && !c.logo.includes('/proxy/logo/')));
}

function serialize(req, c) {
  const b = base(req);
  // Nunca expor `upstream`: é o link verdadeiro que o proxy existe para esconder.
  return {
    id: c.id,
    nome: c.nome,
    nome_completo: c.nome_completo,
    tvg_id: c.tvg_id,
    categoria: c.categoria,
    logo: temLogo(c) ? `${b}/proxy/logo/${c.id}` : '',
    logo_original: c.logo_original,
    host: c.host,
    ativo: c.ativo,
    stream_url: `${b}/proxy/stream/${c.id}/master.m3u8`,
    stream_url_nome: `${b}/proxy/stream/${c.slug}/master.m3u8`,
  };
}

function semAcentos(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/* ---------- paginação (compatível com a v1) ---------- */

function parsePaginacao(req, res) {
  let pagina = 1;
  let porPagina = 50;
  const { pagina: p, por_pagina: pp } = req.query;
  if (pp !== undefined) {
    if (!/^\d+$/.test(String(pp))) {
      validationError(res, 'por_pagina', 'Expected a positive integer');
      return null;
    }
    porPagina = parseInt(pp, 10);
    if (porPagina < 1 || porPagina > 100) {
      validationError(res, 'por_pagina', 'Expected an integer between 1 and 100');
      return null;
    }
  }
  if (p !== undefined) {
    if (!/^\d+$/.test(String(p))) {
      validationError(res, 'pagina', 'Expected a positive integer');
      return null;
    }
    pagina = parseInt(p, 10);
    if (pagina < 1) {
      validationError(res, 'pagina', 'Expected an integer >= 1');
      return null;
    }
  }
  return { pagina, porPagina };
}

function paginaDe(req, res, lista) {
  const pg = parsePaginacao(req, res);
  if (!pg) return null;
  const total = lista.length;
  const ini = (pg.pagina - 1) * pg.porPagina;
  return {
    data: lista.slice(ini, ini + pg.porPagina).map((c) => serialize(req, c)),
    meta: {
      total,
      pagina: pg.pagina,
      por_pagina: pg.porPagina,
      total_paginas: Math.max(1, Math.ceil(total / pg.porPagina)),
    },
  };
}

/* ---------- API JSON ---------- */

router.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    versao: '2.0.0',
    total_canais: channels.length,
    base_dados: ficheiro,
  });
});

router.get('/api/channels', (req, res) => {
  const out = paginaDe(req, res, channels);
  if (out) {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(out);
  }
});

router.get('/api/channels/:ref', (req, res) => {
  const { ref } = req.params;
  if (/^\d+$/.test(ref)) {
    const c = byId.get(Number(ref));
    if (!c) return notFound(res);
    return res.json({ data: serialize(req, c) });
  }
  const c = resolverRef(ref);
  if (c) return res.json({ data: serialize(req, c) });
  return validationError(res, 'id', 'Expected a numeric id or a known channel name (slug)');
});

router.get('/api/categories', (req, res) => {
  const counts = {};
  for (const c of channels) counts[c.categoria] = (counts[c.categoria] || 0) + 1;
  const data = Object.entries(counts)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ data, total: data.length });
});

router.get('/api/search', (req, res) => {
  const q = req.query.q;
  if (q === undefined || String(q).trim() === '') {
    return validationError(res, 'q', 'Query parameter "q" is required');
  }
  const needle = semAcentos(String(q).trim());
  const lista = channels.filter(
    (c) =>
      semAcentos(c.nome).includes(needle) ||
      semAcentos(c.nome_completo).includes(needle) ||
      semAcentos(c.categoria).includes(needle)
  );
  const out = paginaDe(req, res, lista);
  if (out) res.json(out);
});

router.get('/api/stats', (req, res) => {
  const comLogo = channels.filter(temLogo).length;
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    total: channels.length,
    categorias: new Set(channels.map((c) => c.categoria)).size,
    servidores: new Set(channels.map((c) => c.host)).size,
    com_logo: comLogo,
    sem_logo: channels.length - comLogo,
  });
});

/* ---------- playlists M3U ---------- */

function m3uDe(req, lista) {
  const b = base(req);
  const linhas = ['#EXTM3U'];
  for (const c of lista) {
    const logo = temLogo(c) ? `${b}/proxy/logo/${c.id}` : '';
    linhas.push(
      `#EXTINF:-1 tvg-id="${c.tvg_id}" group-title="${c.categoria}" tvg-logo="${logo}",${c.nome_completo}`
    );
    linhas.push(`${b}/proxy/stream/${c.id}/master.m3u8`);
  }
  return linhas.join('\n') + '\n';
}

router.get('/playlist/:ficheiro', (req, res) => {
  const nome = String(req.params.ficheiro).replace(/\.m3u8?$/i, '');
  let lista = null;
  if (nome.toLowerCase() === 'all') {
    lista = channels;
  } else {
    lista = channels.filter(
      (c) =>
        c.categoria.toLowerCase() === nome.toLowerCase() || slugify(c.categoria) === slugify(nome)
    );
    if (lista.length === 0) return notFound(res, 'Categoria não encontrada');
  }
  res.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=60');
  res.send(m3uDe(req, lista));
});

/* ---------- player (template corrigido) ---------- */

let playerTpl = null;
function templatePlayer() {
  if (!playerTpl) {
    playerTpl = fs.readFileSync(path.join(__dirname, '..', 'www', 'player.html'), 'utf8');
  }
  return playerTpl;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

router.get('/player/:ref', (req, res) => {
  const c = resolverRef(req.params.ref);
  if (!c) return notFound(res);
  const streamUrl = `${base(req)}/proxy/stream/${c.id}/master.m3u8`;
  const html = templatePlayer()
    .split('{{CHANNEL_ID}}').join(String(c.id))
    .split('{{CHANNEL_NAME}}').join(escHtml(c.nome_completo))
    .split('{{STREAM_URL}}').join(streamUrl);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/* ---------- proxy HLS stateless ---------- */

function tokenDe(url) {
  return Buffer.from(String(url), 'utf8').toString('base64url');
}

function urlDeToken(token) {
  try {
    const u = Buffer.from(String(token), 'base64url').toString('utf8');
    const parsed = new URL(u);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

function fetchUpstream(url, req) {
  const headers = { 'User-Agent': UA, Accept: '*/*' };
  if (req && req.headers.range) headers.Range = req.headers.range;
  return fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

// Reescreve TODAS as referências de uma playlist para /proxy/fetch/<token>:
// linhas de URI (variantes/segmentos) e atributos URI="..." (#EXT-X-KEY,
// #EXT-X-MEDIA legendas/áudio, #EXT-X-MAP). Sem estado: o destino vai no URL.
function reescreverPlaylist(texto, urlPlaylist, req) {
  const origem = base(req);
  const paraFetch = (alvo) => `${origem}/proxy/fetch/${tokenDe(alvo)}`;
  const absolutizar = (u) => {
    try {
      return new URL(u, urlPlaylist).href;
    } catch {
      return null;
    }
  };
  return texto
    .split(/\r?\n/)
    .map((linha) => {
      const t = linha.trim();
      if (!t) return linha;
      if (t.startsWith('#')) {
        return linha.replace(/URI="([^"]+)"/g, (m, uri) => {
          const abs = absolutizar(uri);
          return abs ? `URI="${paraFetch(abs)}"` : m;
        });
      }
      const abs = absolutizar(t);
      return abs ? paraFetch(abs) : linha;
    })
    .join('\n');
}

function parecePlaylist(url, contentType) {
  return /\.m3u8?($|\?)/i.test(url) || /mpegurl/i.test(contentType || '');
}

async function servirAtravesDeProxy(req, res, urlAlvo) {
  let upstream;
  try {
    upstream = await fetchUpstream(urlAlvo, req);
  } catch (e) {
    return apiError(res, 502, 'UPSTREAM_ERROR', `Upstream não respondeu: ${e.message}`);
  }
  if (!upstream.ok && upstream.status !== 206) {
    return apiError(
      res,
      502,
      'UPSTREAM_ERROR',
      `Upstream respondeu HTTP ${upstream.status} para o destino pedido`
    );
  }
  const ct = upstream.headers.get('content-type') || '';
  if (parecePlaylist(urlAlvo, ct)) {
    const texto = await upstream.text();
    if (texto.trimStart().startsWith('#EXTM3U')) {
      res.status(200);
      res.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.set('Cache-Control', 'no-cache');
      return res.send(reescreverPlaylist(texto, urlAlvo, req));
    }
    res.status(upstream.status);
    res.set('Content-Type', ct || 'application/octet-stream');
    return res.send(Buffer.from(texto, 'utf8'));
  }
  // Segmento/ficheiro: stream directo com o content-type da origem.
  res.status(upstream.status);
  res.set('Content-Type', ct || 'video/MP2T');
  const len = upstream.headers.get('content-length');
  if (len) res.set('Content-Length', len);
  const cr = upstream.headers.get('content-range');
  if (cr) res.set('Content-Range', cr);
  res.set('Cache-Control', 'public, max-age=300');
  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body).pipe(res);
}

router.get('/proxy/stream/:ref/master.m3u8', async (req, res) => {
  const c = resolverRef(req.params.ref);
  if (!c) return notFound(res);
  let upstream;
  try {
    upstream = await fetchUpstream(c.upstream, req);
  } catch (e) {
    return apiError(
      res,
      502,
      'UPSTREAM_ERROR',
      `Todas as fontes falharam para o canal ${c.id}: ${e.message}`
    );
  }
  if (!upstream.ok) {
    return apiError(
      res,
      502,
      'UPSTREAM_ERROR',
      `Todas as fontes falharam para o canal ${c.id}: Upstream HTTP ${upstream.status}`
    );
  }
  const ct = upstream.headers.get('content-type') || '';
  if (parecePlaylist(c.upstream, ct)) {
    const texto = await upstream.text();
    if (texto.trimStart().startsWith('#EXTM3U')) {
      res.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.set('Cache-Control', 'no-cache');
      return res.send(reescreverPlaylist(texto, c.upstream, req));
    }
  }
  // Upstream não é playlist (stream directo): passa o conteúdo tal e qual.
  res.status(upstream.status);
  res.set('Content-Type', ct || 'application/octet-stream');
  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body).pipe(res);
});

// Rota stateless genérica: variantes, playlists de media, segmentos, chaves AES.
router.get('/proxy/fetch/:token', (req, res) => {
  const url = urlDeToken(req.params.token);
  if (!url) return validationError(res, 'token', 'Invalid proxy token');
  return servirAtravesDeProxy(req, res, url);
});

// Aliases com a forma /proxy/stream/{ref}/variant|media/<token> (mesmo handler stateless).
router.get('/proxy/stream/:ref/variant/:token', (req, res) => {
  const url = urlDeToken(req.params.token);
  if (!url) return validationError(res, 'token', 'Invalid proxy token');
  return servirAtravesDeProxy(req, res, url);
});
router.get('/proxy/stream/:ref/media/:token', (req, res) => {
  const url = urlDeToken(req.params.token);
  if (!url) return validationError(res, 'token', 'Invalid proxy token');
  return servirAtravesDeProxy(req, res, url);
});

/* ---------- logos ---------- */

router.get('/proxy/logo/:ref', (req, res) => {
  const c = resolverRef(req.params.ref);
  const destino = c ? c.logo_original || (temLogo(c) ? c.logo : '') : '';
  if (destino) return res.redirect(302, destino);
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(PNG_1X1);
});

module.exports = router;
