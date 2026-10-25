'use strict';
/*
 * server.js — iptv-api v2
 * Express: API JSON + playlists + player + proxy HLS stateless.
 * Em produção (Vercel) é servido por @vercel/node (ver vercel.json).
 */
const express = require('express');
const path = require('path');
const api = require('./lib/api');
const { ficheiro, channels } = require('./lib/data');

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use(api);

// Página inicial: documentação (www/index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'www', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'www')));

// 404 JSON para rotas desconhecidas (formato de erro da API)
app.use((req, res) => {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada', status: 404 } });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[erro]', err);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor', status: 500 } });
});

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => {
    console.log(
      `[iptv-api-v2] a ouvir na porta ${port} | base: ${ficheiro} | canais: ${channels.length}`
    );
  });
}

module.exports = app;
