/**
 * api.js — Cliente HTTP centralizado da TipMike API
 *
 * Todos os screens importam daqui. Quando o IP mudar,
 * só precisa alterar o .env (VITE_API_URL).
 *
 * Uso:
 *   import { api } from '../lib/api'
 *   const data = await api.get('/eventos/live')
 *   const bot  = await api.post('/bots', { nome: 'Meu Bot', ... })
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://138.255.160.158:8000';

async function request(method, path, body, params) {
  let url = `${BASE_URL}${path}`;

  // Query string
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== '')
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get:    (path, params) => request('GET', path, null, params),
  post:   (path, body)   => request('POST', path, body),
  put:    (path, body)   => request('PUT', path, body),
  delete: (path)         => request('DELETE', path),
};

// ─── Endpoints prontos ───────────────────────────────────────────

export const ApiSistema = {
  health:  () => api.get('/health'),
  version: () => api.get('/version'),
};

export const ApiEventos = {
  live:     (params) => api.get('/eventos/live', params),
  finished: (params) => api.get('/eventos/finished', params),
  get:      (id)     => api.get(`/eventos/${id}`),
  odds:     (id)     => api.get(`/eventos/${id}/odds`),
  timeline: (id)     => api.get(`/eventos/${id}/timeline`),
};

export const ApiTicks = {
  list:  (params) => api.get('/ticks', params),
  count: (params) => api.get('/ticks/count', params),
};

export const ApiH2H = {
  stats: (ja, jb, params) => api.get(`/h2h/${ja}/${jb}`, params),
  jogos: (ja, jb, params) => api.get(`/h2h/${ja}/${jb}/jogos`, params),
  busca: (params)         => api.get('/h2h', params),
};

export const ApiBots = {
  list:   (params) => api.get('/bots', params),
  get:    (id)     => api.get(`/bots/${id}`),
  create: (body)   => api.post('/bots', body),
  update: (id, b)  => api.put(`/bots/${id}`, b),
  delete: (id)     => api.delete(`/bots/${id}`),
  start:  (id)     => api.post(`/bots/${id}/start`),
  stop:   (id)     => api.post(`/bots/${id}/stop`),
  clone:  (id)     => api.post(`/bots/${id}/clone`),
};

export const ApiApostas = {
  list:   (params) => api.get('/apostas', params),
  get:    (id)     => api.get(`/apostas/${id}`),
  create: (body)   => api.post('/apostas', body),
  update: (id, b)  => api.put(`/apostas/${id}`, b),
  delete: (id)     => api.delete(`/apostas/${id}`),
  manual: (body)   => api.post('/apostas/manual', body),
};

export const ApiStats = {
  dashboard: ()   => api.get('/stats/dashboard'),
  bots:      ()   => api.get('/stats/bots'),
  bot:       (id) => api.get(`/stats/bots/${id}`),
};

export const ApiTorneios = {
  participantes: (torneioId, bookmaker) =>
    api.get(
      `/torneios/${encodeURIComponent(torneioId)}/participantes`,
      bookmaker ? { bookmaker } : undefined
    ),
};
