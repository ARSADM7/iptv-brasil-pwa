'use strict';
/*
 * lib/data.js — carrega a base de canais.
 * Fonte: data/channels.json se existir; senão data/channels.sample.json
 * (amostra de teste com 3 canais). O campo `upstream` é INTERNO:
 * nunca é exposto nas respostas da API (é o link verdadeiro que o proxy esconde).
 */
const fs = require('fs');
const path = require('path');

function slugify(name) {
  const s = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'canal';
}

function normalizar(raw) {
  const nome = String(raw.nome || raw.nome_completo || `Canal ${raw.id}`);
  return {
    id: Number(raw.id),
    nome,
    nome_completo: String(raw.nome_completo || nome),
    slug: String(raw.slug || slugify(nome)),
    tvg_id: String(raw.tvg_id || ''),
    categoria: String(raw.categoria || 'Geral'),
    logo: String(raw.logo || ''),
    logo_original: String(raw.logo_original || ''),
    host: String(raw.host || ''),
    ativo:
      typeof raw.ativo === 'string'
        ? raw.ativo.toLowerCase() === 'true'
        : raw.ativo === undefined
          ? true
          : Boolean(raw.ativo),
    upstream: String(raw.upstream || ''),
  };
}

function carregar() {
  const dir = path.join(__dirname, '..', 'data');
  const completo = path.join(dir, 'channels.json');
  const amostra = path.join(dir, 'channels.sample.json');
  const ficheiro = fs.existsSync(completo) ? completo : amostra;
  const bruto = JSON.parse(fs.readFileSync(ficheiro, 'utf8'));
  const lista = Array.isArray(bruto) ? bruto : bruto.channels || bruto.data || [];
  const channels = lista.map(normalizar).filter((c) => Number.isFinite(c.id) && c.upstream);
  const byId = new Map();
  const bySlug = new Map();
  for (const c of channels) {
    if (!byId.has(c.id)) byId.set(c.id, c);
    if (!bySlug.has(c.slug)) bySlug.set(c.slug, c); // em colisão de slug, ganha o primeiro
  }
  return { channels, byId, bySlug, ficheiro: path.basename(ficheiro) };
}

const db = carregar();

function resolverRef(ref) {
  if (ref === undefined || ref === null) return null;
  const s = String(ref);
  if (/^\d+$/.test(s)) return db.byId.get(Number(s)) || null;
  return db.bySlug.get(s) || db.bySlug.get(slugify(s)) || null;
}

module.exports = { ...db, slugify, resolverRef };
