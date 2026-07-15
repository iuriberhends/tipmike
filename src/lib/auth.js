/**
 * lib/auth.js — Sessão, tokens e refresh do TipMike (Fase 2)
 *
 * Responsabilidades:
 * - Guardar/ler access token, refresh token e usuário (localStorage)
 * - login / logout contra a API
 * - refreshSession() com "single-flight": várias chamadas 401 simultâneas
 *   disparam UM refresh só, as demais aguardam o mesmo resultado
 * - Evento global de logout forçado (sessão expirada/revogada) para o
 *   AuthContext reagir e mandar o usuário pro /login
 *
 * Nota de segurança: tokens em localStorage são legíveis por JS da própria
 * página (risco em caso de XSS). Aceitável para este painel; o access token
 * dura só 30 min e o refresh é rotacionado a cada uso pelo backend.
 */

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://138.255.160.158:8000';
export const EVENTO_LOGOUT = 'tipmike:logout';

const K_ACCESS = 'tipmike_access';
const K_REFRESH = 'tipmike_refresh';
const K_USUARIO = 'tipmike_usuario';

// localStorage pode falhar (modo privado, storage cheio) — nunca deixa quebrar a UI.
function lsGet(k) { try { return window.localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch { /* ignora */ } }
function lsDel(k) { try { window.localStorage.removeItem(k); } catch { /* ignora */ } }

export function getAccessToken() { return lsGet(K_ACCESS); }
export function getRefreshToken() { return lsGet(K_REFRESH); }

export function getUsuarioSalvo() {
  const bruto = lsGet(K_USUARIO);
  if (!bruto) return null;
  try { return JSON.parse(bruto); } catch { return null; }
}

export function salvarSessao({ access_token, refresh_token, usuario } = {}) {
  if (access_token) lsSet(K_ACCESS, access_token);
  if (refresh_token) lsSet(K_REFRESH, refresh_token);
  if (usuario) lsSet(K_USUARIO, JSON.stringify(usuario));
}

export function limparSessao() {
  lsDel(K_ACCESS);
  lsDel(K_REFRESH);
  lsDel(K_USUARIO);
}

export function dispararLogout(motivo = 'sessao_expirada') {
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_LOGOUT, { detail: { motivo } }));
  } catch { /* ambientes sem CustomEvent */ }
}

async function postJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let dados = null;
  try { dados = await res.json(); } catch { /* corpo vazio/não-JSON */ }
  return { res, dados };
}

/** Faz login e persiste a sessão. Lança Error com mensagem amigável se falhar. */
export async function loginApi(email, senha) {
  let resultado;
  try {
    resultado = await postJson('/auth/login', { email, senha });
  } catch {
    throw new Error('Sem conexão com a API. Verifique sua rede.');
  }
  const { res, dados } = resultado;
  if (!res.ok) {
    const msg =
      (dados && dados.detail) ||
      (res.status === 429 ? 'Muitas tentativas. Aguarde um pouco.' : 'Falha no login.');
    throw new Error(typeof msg === 'string' ? msg : 'Falha no login.');
  }
  salvarSessao(dados);
  return dados.usuario;
}

/**
 * Registro público com código de convite (Fase 5).
 * NÃO autentica nem persiste sessão — o chamador decide fazer login depois.
 * Lança Error com a mensagem da API se falhar.
 */
export async function registroApi({ nome, email, senha, convite }) {
  let resultado;
  try {
    resultado = await postJson('/auth/registro', { nome, email, senha, convite });
  } catch {
    throw new Error('Sem conexão com a API. Verifique sua rede.');
  }
  const { res, dados } = resultado;
  if (!res.ok) {
    let msg = (dados && dados.detail) ||
      (res.status === 429 ? 'Muitas tentativas. Aguarde um pouco.' : 'Falha no cadastro.');
    if (Array.isArray(msg)) {
      msg = msg.map((e) => e && e.msg).filter(Boolean).join(' • ') || 'Dados inválidos.';
    }
    throw new Error(typeof msg === 'string' ? msg : 'Falha no cadastro.');
  }
  return dados; // { id, email, nome, role, ... }
}

let _refreshEmAndamento = null;

/**
 * Tenta renovar a sessão com o refresh token.
 * Retorna true (renovou) ou false (sessão morta ou rede fora).
 * Sessão morta (401 do /auth/refresh) → limpa tudo e dispara logout global.
 * Erro de rede → NÃO derruba a sessão local (pode ser queda transitória).
 */
export function refreshSession() {
  if (_refreshEmAndamento) return _refreshEmAndamento;
  _refreshEmAndamento = (async () => {
    try {
      const rt = getRefreshToken();
      if (!rt) {
        limparSessao();
        dispararLogout('sem_sessao');
        return false;
      }
      let resultado;
      try {
        resultado = await postJson('/auth/refresh', { refresh_token: rt });
      } catch {
        return false; // rede fora — mantém sessão local
      }
      const { res, dados } = resultado;
      if (!res.ok) {
        limparSessao();
        dispararLogout('sessao_expirada');
        return false;
      }
      salvarSessao(dados);
      return true;
    } finally {
      _refreshEmAndamento = null;
    }
  })();
  return _refreshEmAndamento;
}

/** Revoga o refresh token no servidor (best-effort) e limpa a sessão local. */
export async function logoutApi() {
  const rt = getRefreshToken();
  if (rt) {
    try { await postJson('/auth/logout', { refresh_token: rt }); } catch { /* best-effort */ }
  }
  limparSessao();
}
