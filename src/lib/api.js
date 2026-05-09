/**
 * api.js — Cliente HTTP centralizado da TipMike API
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://138.255.160.158:8000';

async function request(method, path, body, params) {
  let url = `${BASE_URL}${path}`;

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
  patch:  (path, body)   => request('PATCH', path, body),
  delete: (path)         => request('DELETE', path),
};

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
  update: (id, b)  => api.patch(`/bots/${id}`, b),
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
  grades: (torneioId) =>
    api.get(`/torneios/${encodeURIComponent(torneioId)}/grades`),

  participantes: (torneioId, options = {}) => {
    const params = {};
    if (options.bookmaker) params.bookmaker = options.bookmaker;
    if (options.grades && options.grades.length > 0) {
      params.grades = options.grades.join('|');
      if (options.gradesModo) params.grades_modo = options.gradesModo;
    }
    return api.get(
      `/torneios/${encodeURIComponent(torneioId)}/participantes`,
      Object.keys(params).length > 0 ? params : undefined
    );
  },
};

// ============================================================
// ApiBacktest — Entrega 4
// ============================================================
//
// POST /backtest/jobs        cria + dispara worker (BackgroundTasks)
// GET  /backtest/jobs/:id    polling (incluir_detalhe=true qdo concluido)
// GET  /backtest/bot/:botId  histórico
// DELETE /backtest/jobs/:id
//
// Fluxo na UI:
//   1. const { job_id } = await ApiBacktest.create({ bot_id, data_inicio, data_fim, stake_modo, stake_valor })
//   2. Loop polling: setInterval(() => ApiBacktest.get(job_id), 1000)
//   3. Quando status === 'concluido': re-fetch com incluir_detalhe=true
//   4. Renderiza chart + métricas
// ============================================================

export const ApiBacktest = {
  create: (body) => api.post('/backtest/jobs', body),
  get:    (jobId, incluirDetalhe = false) =>
    api.get(`/backtest/jobs/${jobId}`, incluirDetalhe ? { incluir_detalhe: 'true' } : null),
  listByBot: (botId, limit = 10) =>
    api.get(`/backtest/bot/${botId}`, { limit }),
  delete: (jobId) => api.delete(`/backtest/jobs/${jobId}`),
};
