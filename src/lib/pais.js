/**
 * lib/pais.js — país escolhido no site (operação BR, PE e os que vierem)
 *
 * Fica FORA do React de propósito: o api.js precisa ler o país em todo
 * fetch (cabeçalho X-Pais) sem depender de hook. O PaisContext usa estas
 * mesmas funções para ler/gravar a escolha.
 *
 * - getPaisAtual(): o país desta aba. Vem do localStorage no load e só muda
 *   por salvarPaisAtual() — assim uma troca feita em OUTRA aba não faz esta
 *   mandar cabeçalho de um país diferente do que a tela mostra.
 * - Reserva embutida (PAISES_RESERVA / CASAS_RESERVA): o mesmo conteúdo do
 *   cadastro do back (casas.py), usada se GET /paises ou /casas falhar.
 * - COR_CASA: mapa ESTÁTICO família → classes. O Tailwind JIT só gera classe
 *   que aparece escrita no código; montar `bg-${cor}-500` em runtime não
 *   funcionaria. Por isso as strings ficam inteiras aqui.
 */

export const PAIS_PADRAO = 'BR';
const K_PAIS = 'tipmike_pais';

function normalizarPais(codigo) {
  const c = String(codigo || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

function lerPaisSalvo() {
  try { return normalizarPais(window.localStorage.getItem(K_PAIS)); } catch { return null; }
}

let _paisAtual = lerPaisSalvo() || PAIS_PADRAO;

/** País desta aba ('BR', 'PE'...). Nunca vazio. */
export function getPaisAtual() {
  return _paisAtual;
}

/** Grava a escolha (memória + localStorage) e devolve o código normalizado. */
export function salvarPaisAtual(codigo) {
  const c = normalizarPais(codigo) || PAIS_PADRAO;
  _paisAtual = c;
  try { window.localStorage.setItem(K_PAIS, c); } catch { /* modo privado / storage cheio */ }
  return c;
}

/** Cabeçalho para os fetch que não passam pelo api.js. */
export function cabecalhoPais() {
  return { 'X-Pais': getPaisAtual() };
}

/** Bandeira em emoji a partir do código ISO (BR → 🇧🇷, PE → 🇵🇪). */
export function bandeiraDoPais(codigo) {
  const c = normalizarPais(codigo);
  if (!c) return '🏳️';
  return String.fromCodePoint(...[...c].map((l) => 0x1F1E6 + l.charCodeAt(0) - 65));
}

// ------------------------------------------------------------ reserva ---
export const PAISES_RESERVA = [
  { codigo: 'BR', nome: 'Brasil', moeda: 'BRL', simbolo_moeda: 'R$', fuso: 'America/Sao_Paulo',
    idioma: 'pt-BR', sufixo: '', ativo: true, ordem: 1 },
  { codigo: 'PE', nome: 'Peru', moeda: 'PEN', simbolo_moeda: 'S/', fuso: 'America/Lima',
    idioma: 'es-PE', sufixo: '_pe', ativo: true, ordem: 2 },
];

function _c(codigo, nome, pais, cor, aoVivo, ordem) {
  return { codigo, nome, pais, cor, ativa: true, ao_vivo: aoVivo, ordem, global: pais === null };
}

// pais null = casa GLOBAL (aparece em todos os países): hoje só a bet365.
export const CASAS_RESERVA = [
  _c('bet365', 'Bet365', null, 'emerald', true, 1),
  _c('superbet', 'Superbet', 'BR', 'amber', true, 2),
  _c('betano', 'Betano', 'BR', 'blue', true, 3),
  _c('estrelabet', 'Estrelabet', 'BR', 'purple', true, 4),
  _c('kto', 'KTO', 'BR', null, true, 5),
  _c('apostaganha', 'ApostaGanha', 'BR', null, true, 6),
  _c('novibet', 'Novibet', 'BR', null, true, 7),
  _c('vupi', 'Vupi', 'BR', null, true, 8),
  _c('meridianbet', 'Meridianbet', 'BR', null, true, 9),
  _c('betnacional', 'Betnacional', 'BR', null, true, 10),
  _c('betmgm', 'BetMGM', 'BR', null, true, 11),
  _c('betboom', 'Betboom', 'BR', null, true, 12),
  _c('starbet', 'Starbet', 'BR', null, true, 13),
  _c('betsson_pe', 'Betsson', 'PE', null, true, 1),
  _c('betsafe_pe', 'Betsafe', 'PE', null, true, 2),
  _c('inkabet_pe', 'Inkabet', 'PE', null, true, 3),
  _c('jokerbet_pe', 'Jokerbet', 'PE', null, true, 4),
  _c('masterbets365_pe', 'Masterbets365', 'PE', null, true, 5),
  _c('rushbet_pe', 'Rushbet', 'PE', null, true, 6),
  _c('olimpo_pe', 'Olimpo', 'PE', null, true, 7),
  _c('betano_pe', 'Betano', 'PE', 'blue', true, 8),
];

/** Casas do país + globais, globais primeiro (mesma ordem do back). */
export function casasReservaDoPais(pais) {
  const p = normalizarPais(pais) || PAIS_PADRAO;
  return CASAS_RESERVA
    .filter((c) => c.pais === null || c.pais === p)
    .sort((a, b) => (Number(a.pais !== null) - Number(b.pais !== null)) || (a.ordem - b.ordem));
}

// ---------------------------------------------------------- cor da casa ---
export const COR_CASA = {
  emerald: { chip: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300', hex: '#2bcdb9' },
  blue:    { chip: 'bg-blue-500/15 border-blue-500/40 text-blue-300',          hex: '#3b82f6' },
  amber:   { chip: 'bg-amber-500/15 border-amber-500/40 text-amber-300',       hex: '#f59e0b' },
  purple:  { chip: 'bg-purple-500/15 border-purple-500/40 text-purple-300',    hex: '#a855f7' },
  slate:   { chip: 'bg-slate-500/15 border-slate-500/40 text-slate-300',       hex: '#6c8689' },
};

/** {chip, hex} da casa pela família em casa.cor; sem cor (ou desconhecida) = slate. */
export function corDaCasa(casa) {
  return (casa && COR_CASA[casa.cor]) || COR_CASA.slate;
}

// --------------------------------------------------------- formatadores ---
// ISO com fuso explícito no fim (Z, +00:00, -0300, -03). Exige a hora antes
// do fuso: senão '2026-07-29' (só data) casaria pelo '-29'.
const RE_ISO_COM_FUSO = /\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?\s*(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;
// ISO "naive" (sem fuso): 'AAAA-MM-DD', 'AAAA-MM-DD HH:MM[:SS]', 'AAAA-MM-DDTHH:MM...'
const RE_ISO_NAIVE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

/** true se a string ISO traz fuso (é um instante real, dá para converter). */
export function temFuso(valor) {
  return typeof valor === 'string' && RE_ISO_COM_FUSO.test(valor.trim());
}

/**
 * formatarMoeda(valor, opcoes?) e, no locale/fuso do país,
 * formatarDataHora(d) 'dd/mm/aa hh:mm', formatarData(d) 'dd/mm/aaaa' e
 * formatarHora(d) 'hh:mm'.
 * null/undefined/inválido → '—' (mesmo comportamento do antigo formatarBRL).
 *
 * Datas: Date, número (epoch ms) ou ISO COM fuso são instantes → saem no
 * fuso do país. ISO SEM fuso (rotas que já mandam BRT "naive") NÃO é
 * convertido: mostra o relógio exatamente como veio.
 */
export function criarFormatadores(info) {
  const idioma = (info && info.idioma) || 'pt-BR';
  const moeda = (info && info.moeda) || 'BRL';
  const simbolo = (info && info.simbolo) || 'R$';
  const fuso = (info && info.fuso) || 'America/Sao_Paulo';

  function formatarMoeda(valor, opcoes) {
    if (valor === null || valor === undefined || valor === '') return '—';
    const n = Number(valor);
    if (Number.isNaN(n)) return '—';
    try {
      return n.toLocaleString(idioma, { style: 'currency', currency: moeda, ...(opcoes || {}) });
    } catch {
      return `${simbolo} ${n.toFixed(2)}`;
    }
  }

  function formatarNoFuso(d, campos) {
    if (d === null || d === undefined || d === '') return '—';
    let dt = null;
    let tz = fuso;
    if (typeof d === 'string' && !temFuso(d)) {
      // sem fuso: monta os mesmos campos em UTC e formata em UTC = relógio intacto
      const m = RE_ISO_NAIVE.exec(d.trim());
      if (m) {
        dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
        tz = 'UTC';
      }
    }
    if (!dt) dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    try {
      return dt.toLocaleString(idioma, { ...campos, timeZone: tz });
    } catch {
      try { return dt.toLocaleString(idioma, campos); } catch { return '—'; }
    }
  }

  // hourCycle h23: o es-PE sairia em 12 h ("01:05 p. m."); 24 h em todo país
  // mantém a largura das colunas e o mesmo jeito de ler do BR.
  const formatarDataHora = (d) => formatarNoFuso(d,
    { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const formatarData = (d) => formatarNoFuso(d, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatarHora = (d) => formatarNoFuso(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  return { formatarMoeda, formatarDataHora, formatarData, formatarHora };
}
