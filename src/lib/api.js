/**
 * api.js — Cliente HTTP centralizado da TipMike API
 *
 * v2: ApiStats expandida com 8 endpoints novos pra tela Stats.jsx
 * v3: ApiBots ganha exportCsv (URL builder) + downloadCsv (fetch+blob+download)
 * v4: ApiBacktest ganha createAvulso (backtest standalone, sem bot)
 * v6: AUTH (Fase 2) — todo fetch sai com Authorization: Bearer <access>.
 *     Em 401, tenta UM refresh (single-flight em lib/auth.js) e repete a
 *     chamada uma única vez. Refresh morto → logout global via evento.
 *     Vale pros 3 caminhos: request() JSON, _downloadBlob e uploadTicks.
 */
import { BASE_URL, getAccessToken, refreshSession, limparSessao, dispararLogout } from './auth.js';

/**
 * fetch com Authorization + retry único pós-refresh em 401.
 * _podeRepetir evita loop: a repetição nunca repete de novo.
 */
async function fetchComAuth(url, options = {}, _podeRepetir = true) {
  const headers = { ...(options.headers || {}) };
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new Error('Sem conexão com a API. Verifique sua rede.');
  }

  if (res.status === 401 && _podeRepetir) {
    const renovou = await refreshSession();
    if (renovou) return fetchComAuth(url, options, false);
  }

  // Usuário desativado pelo admin no meio da sessão: derruba na hora
  // em vez de deixar a UI inteira falhando silenciosamente.
  if (res.status === 403) {
    try {
      const corpo = await res.clone().json();
      if (corpo && corpo.detail === 'Usuário desativado.') {
        limparSessao();
        dispararLogout('desativado');
      }
    } catch { /* corpo não-JSON: segue o fluxo normal */ }
  }

  return res;
}

/**
 * Extrai uma mensagem de erro legível de qualquer resposta da API.
 * Cobre: detail string, detail em lista (422 de validação do FastAPI),
 * corpo vazio/não-JSON.
 */
async function _erroDaResposta(res) {
  const err = await res.json().catch(() => null);
  const d = err && err.detail;
  if (typeof d === 'string' && d) return d;
  if (Array.isArray(d) && d.length) {
    const primeiro = d[0];
    if (primeiro && typeof primeiro.msg === 'string') return `Dados inválidos: ${primeiro.msg}`;
    return 'Dados inválidos.';
  }
  return res.statusText || `HTTP ${res.status}`;
}

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
  const res = await fetchComAuth(url, options);
  if (!res.ok) {
    throw new Error(await _erroDaResposta(res));
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
// ============================================================
// Helper: download arbitrario via fetch+blob
// (v6: agora autenticado — CSV/planilha continuam funcionando
//  com as rotas trancadas)
// ============================================================
async function _downloadBlob(url, filenameFallback) {
  const res = await fetchComAuth(url);
  if (!res.ok) {
    throw new Error(await _erroDaResposta(res));
  }
  // Tenta extrair filename do Content-Disposition
  let filename = filenameFallback;
  const cd = res.headers.get('Content-Disposition');
  if (cd) {
    const m = cd.match(/filename="?([^";\n]+)"?/i);
    if (m && m[1]) filename = m[1].trim();
  }
  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Pequeno delay antes do revoke pra alguns navegadores (Firefox) nao cancelarem o download
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  return filename;
}
export const ApiBots = {
  list:   (params) => api.get('/bots', params),
  get:    (id)     => api.get(`/bots/${id}`),
  create: (body)   => api.post('/bots', body),
  update: (id, b)  => api.patch(`/bots/${id}`, b),
  delete: (id)     => api.delete(`/bots/${id}`),
  start:  (id)     => api.post(`/bots/${id}/start`),
  stop:   (id)     => api.post(`/bots/${id}/stop`),
  clone:  (id)     => api.post(`/bots/${id}/clone`),
  stats:     (id, modo = 'simulado') => api.get(`/bots/${id}/stats`, { modo }),
  historico: (id, periodo = '30d', modo = 'simulado', limiteTips = 60) =>
    api.get(`/bots/${id}/historico`, { periodo, modo, limite_tips: limiteTips }),
  treinamento: (id, ativo) =>
    api.patch(`/bots/${id}/treinamento`, { em_treinamento: !!ativo }),
  // ----------------------------------------------------------
  // Export CSV
  // ----------------------------------------------------------
  // Monta a URL do CSV. ATENÇÃO (v6): abrir essa URL direto em outra aba
  // NÃO envia o Authorization e vai tomar 401 — use downloadCsv().
  exportCsvUrl: (id, params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== '')
    ).toString();
    return `${BASE_URL}/bots/${id}/export.csv${qs ? `?${qs}` : ''}`;
  },
  // Baixa o CSV via fetch+blob (filename vem do Content-Disposition do backend).
  // params default: { modo: 'simulado', excel: 'true', periodo: 'todas' }
  downloadCsv: async (id, params = {}, filenameFallback) => {
    const merged = {
      modo: 'simulado',
      excel: 'true',
      periodo: 'todas',
      ...params,
    };
    const url = ApiBots.exportCsvUrl(id, merged);
    return _downloadBlob(url, filenameFallback || `bot_${id}_apostas.csv`);
  },
};
export const ApiApostas = {
  list:   (params) => api.get('/apostas', params),
  get:    (id)     => api.get(`/apostas/${id}`),
  create: (body)   => api.post('/apostas', body),
  update: (id, b)  => api.put(`/apostas/${id}`, b),
  delete: (id)     => api.delete(`/apostas/${id}`),
  manual: (body)   => api.post('/apostas/manual', body),
};
// ============================================================
// ApiStats v2 - tela Stats.jsx + dashboard antigo
// ============================================================
export const ApiStats = {
  // Endpoints antigos (sistema/bots)
  dashboard: ()   => api.get('/stats/dashboard'),
  bots:      ()   => api.get('/stats/bots'),
  bot:       (id) => api.get(`/stats/bots/${id}`),
  // v2 - tela Stats.jsx (jogadores/jogos por esporte)
  overview:        (esporte)               => api.get('/stats/overview', { esporte }),
  proximos:        (esporte, params = {})  => api.get('/stats/proximos', { esporte, ...params }),
  ultimos:         (esporte, params = {})  => api.get('/stats/ultimos', { esporte, ...params }),
  heatmap:         (esporte)               => api.get('/stats/heatmap', { esporte }),
  distribuicoes:   (esporte)               => api.get('/stats/distribuicoes', { esporte }),
  jogadores:       (esporte, busca)        => api.get('/stats/jogadores', { esporte, busca }),
  torneios:        (esporte)               => api.get('/stats/torneios', { esporte }),
  previewJogador:  (esporte, nome)         => api.get('/stats/preview-jogador', { esporte, nome }),
};
export const ApiTorneios = {
  disponiveis: (casa, esporte, dias = 7, minTicks = 100) =>
    api.get('/torneios/disponiveis', { casa, esporte, dias, min_ticks: minTicks }),
  grades: (torneioId) =>
    api.get(`/torneios/${encodeURIComponent(torneioId)}/grades`),
  participantes: (torneioId, options = {}) => {
    const params = {};
    if (options.bookmaker) params.bookmaker = options.bookmaker;
    if (options.esporte) params.esporte = options.esporte;
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
export const ApiBacktest = {
  create: (body) => api.post('/backtest/jobs', body),
  get:    (jobId, incluirDetalhe = false) =>
    api.get(`/backtest/jobs/${jobId}`, incluirDetalhe ? { incluir_detalhe: 'true' } : null),
  listByBot: (botId, limit = 10) =>
    api.get(`/backtest/bot/${botId}`, { limit }),
  delete: (jobId) => api.delete(`/backtest/jobs/${jobId}`),
  // v4: backtest por UPLOAD de arquivo parquet (ticks do HD).
  // uploadTicks usa FormData (multipart) - nao passa pelo request() JSON.
  // v6: autenticado via fetchComAuth (sem Content-Type manual: o browser
  //     define o boundary do multipart sozinho).
  uploadTicks: async (file) => {
    const fd = new FormData();
    fd.append('arquivo', file);
    const res = await fetchComAuth(`${BASE_URL}/backtest/upload-ticks`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      throw new Error(await _erroDaResposta(res));
    }
    return res.json();
  },
  validarCruzado: (body) => api.post('/backtest/validar-cruzado', body),
  createFromUpload: (body) => api.post('/backtest/jobs-upload', body),
  // v4: backtest AVULSO (standalone, sem bot - filtros vem da aba BacktestAvulso.jsx)
  createAvulso: (body) => api.post('/backtest/jobs-avulso', body),
  // v5: baixa a planilha .xlsx das apostas do backtest (formato "Tips Enviadas"
  // do bot ao vivo), pra comparar backtest vs vivo lado a lado.
  baixarPlanilha: (jobId) =>
    _downloadBlob(`${BASE_URL}/backtest/jobs/${jobId}/planilha`,
                  `backtest_job_${jobId}_apostas.xlsx`),
};
