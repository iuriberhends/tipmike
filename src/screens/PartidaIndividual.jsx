import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Home, PlayCircle, Store, Bot, Table2, BarChart3, MoreHorizontal,
  Search, Bell, Settings, User, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Trophy, Filter, ArrowLeftRight, ExternalLink, Users, X,
  TrendingUp, Award, Flame, BarChart, Share2,
  Facebook, Twitter, MessageCircle, Send,
  ArrowUpDown, Plus, Activity,
} from 'lucide-react';

// ============================================================
// THEME (Mike dark)
// ============================================================
const T = {
  bg:        '#0b0f1a',
  bg2:       '#111827',  // card bg
  bg3:       '#1a2332',  // hover/elevated
  border:    'rgba(60,85,130,0.4)',
  borderLight: 'rgba(60,85,130,0.25)',
  fg:        '#e6edf7',
  fgDim:     '#94a3b8',
  fgDimmer:  '#64748b',
  accent:    '#10b981',  // verde Mike (jogador A)
  accent2:   '#0891b2',  // azul ciano (jogador B / oponentes)
  green:     '#10b981',
  red:       '#ef4444',
  yellow:    '#eab308',
  orange:    '#f59e0b',
};

const PERIODS = ['FT', 'HT', '1Q', '2Q', '3Q', '4Q'];
const PERIODS_JOGADOR = ['FT', 'HT'];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619;
    h = h >>> 0;
  }
  return h;
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

const TIMES_NBA2K = [
  'PHI 76ers', 'BOS Celtics', 'CLE Cavaliers', 'SAC Kings', 'MIA Heat',
  'LA Lakers', 'LA Clippers', 'IND Pacers', 'OKC Thunder', 'MEM Grizzlies',
  'MIN Timberwolves', 'GS Warriors', 'DEN Nuggets', 'MIL Bucks', 'NYK Knicks',
  'BKN Nets', 'CHI Bulls', 'TOR Raptors', 'ATL Hawks', 'CHA Hornets',
  'DET Pistons', 'ORL Magic', 'WAS Wizards', 'DAL Mavericks', 'HOU Rockets',
  'NO Pelicans', 'PHX Suns', 'POR Trail Blazers', 'SAS Spurs', 'UTA Jazz',
];

function gerarPerfilJogador(nome) {
  const seed = hashStr(nome);
  const r = seeded(seed);
  const r1 = r(), r2 = r(), r3 = r(), r4 = r(), r5 = r();
  const winRate = 0.42 + r1 * 0.20;
  const mediaFT = 40 + r2 * 15;
  const variancaQ = (r3 - 0.5) * 2;
  const mediaPorPeriodo = {
    FT: mediaFT,
    HT: mediaFT * 0.5 + 1.5 + variancaQ * 0.5,
    '1Q': mediaFT * 0.25 + variancaQ * 0.3,
    '2Q': mediaFT * 0.25 + variancaQ * 0.5 + 0.3,
    '3Q': mediaFT * 0.25 - variancaQ * 0.4,
    '4Q': mediaFT * 0.25 + variancaQ * 0.2,
  };
  const wrPorPeriodo = {
    FT: winRate * 100,
    HT: winRate * 100 - 4 + r4 * 2,
    '1Q': winRate * 100 - 7 + r5 * 2,
    '2Q': winRate * 100 - 6 + r() * 2,
    '3Q': winRate * 100 - 8 + r() * 2,
    '4Q': winRate * 100 - 8 + r() * 2,
  };
  const r2nd = seeded(seed + 999);
  const qtdTimes = 18 + Math.floor(r2nd() * 11);
  const timesEmbaralhados = [...TIMES_NBA2K];
  for (let i = timesEmbaralhados.length - 1; i > 0; i--) {
    const j = Math.floor(r2nd() * (i + 1));
    [timesEmbaralhados[i], timesEmbaralhados[j]] = [timesEmbaralhados[j], timesEmbaralhados[i]];
  }
  const timesUsados = timesEmbaralhados.slice(0, qtdTimes);
  const tabelaTimes = timesUsados.map((time, i) => {
    const partidas = Math.max(8, 95 - i * 4 - Math.floor(r2nd() * 6));
    const v = Math.round(partidas * (winRate - 0.05 + r2nd() * 0.15));
    const d = partidas - v;
    const pp = Math.round(v * 50 + d * 45 + r2nd() * 200);
    const pc = Math.round(v * 45 + d * 50 + r2nd() * 200);
    const dif = pp - pc;
    return {
      team: time, partidas, V: v, D: d, E: 0, pp, pc,
      dif: dif >= 0 ? `+${dif}` : `${dif}`,
      difNum: dif,
      wr: Math.round((v / partidas) * 1000) / 10,
    };
  });
  const teamPref = tabelaTimes[0].team;
  const comeback = 12 + r() * 18;
  const last5Names = ['Janis','Aurik','Dimon','Slava','Mihail','Boris','Igor','Vlad','Pavel','Stefan'];
  const offsetHorasPorJogador = (seed % 96);
  const baseDateLast5 = new Date(2026, 4, 3, 23, 30);
  baseDateLast5.setHours(baseDateLast5.getHours() - offsetHorasPorJogador);
  const last5 = Array.from({ length: 5 }, (_, i) => {
    const ri = seeded(seed + 5000 + i * 17);
    const venceu = ri() < winRate;
    const placarMine = Math.max(35, Math.round(mediaFT + (ri() - 0.4) * 18));
    const placarOpo = Math.max(35, Math.round((75 + ri() * 25) * 0.55 + (ri() - 0.4) * 15));
    let pA = placarMine, pB = placarOpo;
    if (venceu && pA <= pB) pA = pB + 1 + Math.floor(ri() * 5);
    if (!venceu && pB <= pA) pB = pA + 1 + Math.floor(ri() * 5);
    const dt = new Date(baseDateLast5);
    dt.setHours(dt.getHours() - i * 8 - Math.floor(ri() * 4));
    const dateStr = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}, ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    let oponenteTime = TIMES_NBA2K[(seed + i * 7) % TIMES_NBA2K.length];
    if (oponenteTime === teamPref) oponenteTime = TIMES_NBA2K[(seed + i * 7 + 13) % TIMES_NBA2K.length];
    return { resultado: venceu ? 'V' : 'D', placarA: pA, placarB: pB, oponenteNome: last5Names[(seed + i) % last5Names.length], oponenteTime, data: dateStr };
  });
  return { nome, seed, winRate, mediaFT, mediaPorPeriodo, wrPorPeriodo, teamPref, tabelaTimes, comeback: Math.round(comeback * 100) / 100, last5 };
}

const JANELA_MULTI = {
  'Todas': 1.0, 'Última hora': 0.005, 'Últimas 8 horas': 0.04, 'Últimas 24 horas': 0.10,
  'Últimos 7 dias': 0.30, 'Últimas 30 dias': 0.60, 'Últimas 60 dias': 0.85, 'Últimos 90 dias': 0.95,
  '5': 5, '10': 10, '15': 15, '20': 20, '25': 25, '30': 30, '40': 40, '50': 50, '100': 100, '200': 200,
};
const JANELAS_ABSOLUTAS = ['5','10','15','20','25','30','40','50','100','200'];

const FILTROS_DEFAULT = {
  janela: 'Todas', versao: 'Todas as versões', horaInicio: '00:00', horaFim: '24:00',
  campeonatos: ['Adriatic League'], timeA: null, timeB: null,
};

function aplicarFiltros(perfilA, perfilB, filtros, modoSolo) {
  const f = { ...FILTROS_DEFAULT, ...filtros };
  const seedConfronto = (perfilA.seed ^ perfilB.seed) >>> 0;
  const seedFiltro = hashStr(JSON.stringify({ j: f.janela, v: f.versao, hi: f.horaInicio, hf: f.horaFim, c: [...f.campeonatos].sort().join('|'), tA: f.timeA, tB: f.timeB }));
  const seedCtx = (seedConfronto ^ seedFiltro) >>> 0;
  const rng = seeded(seedCtx);
  const totalBase = modoSolo ? 800 + (perfilA.seed % 500) : 40 + (seedConfronto % 80);
  const horasInicio = parseInt(f.horaInicio.split(':')[0], 10);
  const horasFim    = parseInt(f.horaFim.split(':')[0], 10);
  const horasFiltradas = Math.max(1, horasFim - horasInicio);
  if (f.campeonatos.length === 0) return contextoVazio(perfilA, perfilB, f, modoSolo, seedCtx);
  let total, janelaPedida = null;
  if (JANELAS_ABSOLUTAS.includes(f.janela)) {
    janelaPedida = JANELA_MULTI[f.janela];
    total = Math.min(janelaPedida, totalBase);
  } else {
    total = Math.max(1, Math.round(totalBase * JANELA_MULTI[f.janela]));
    if (horasFiltradas < 24) total = Math.max(1, Math.round(total * (horasFiltradas / 24)));
    if (f.versao === 'Última versão') total = Math.max(1, Math.round(total * 0.25));
  }
  let totalAjustadoTime = total;
  if (f.timeA) {
    const timeAObj = perfilA.tabelaTimes.find(t => t.team === f.timeA);
    if (timeAObj) {
      const totalPartidasA = perfilA.tabelaTimes.reduce((s, t) => s + t.partidas, 0);
      totalAjustadoTime = Math.max(1, Math.round(totalAjustadoTime * (timeAObj.partidas / totalPartidasA)));
    }
  }
  if (f.timeB) {
    if (!modoSolo) {
      const timeBObj = perfilB.tabelaTimes.find(t => t.team === f.timeB);
      if (timeBObj) {
        const totalPartidasB = perfilB.tabelaTimes.reduce((s, t) => s + t.partidas, 0);
        totalAjustadoTime = Math.max(1, Math.round(totalAjustadoTime * (timeBObj.partidas / totalPartidasB)));
      }
    } else {
      const seedTimeB = hashStr(f.timeB);
      totalAjustadoTime = Math.max(1, Math.round(totalAjustadoTime * (0.025 + (seedTimeB % 100) / 1000)));
    }
  }
  total = totalAjustadoTime;
  let variancia;
  if (total <= 5) variancia = 4.0;
  else if (total <= 10) variancia = 3.0;
  else if (total <= 20) variancia = 2.0;
  else if (total <= 50) variancia = 1.2;
  else if (total <= 100) variancia = 0.7;
  else variancia = 0.4;
  if (f.versao === 'Última versão') variancia += 1.0;
  const aplicarOffset = (base) => Math.max(base * 0.5, base + (rng() - 0.5) * variancia * 2);
  const aplicarOffsetWr = (base) => Math.max(5, Math.min(95, base + (rng() - 0.5) * variancia * 3));
  const mediaA = {}, mediaB = {}, wrA = {}, wrB = {};
  PERIODS.forEach(per => {
    mediaA[per] = aplicarOffset(perfilA.mediaPorPeriodo[per]);
    mediaB[per] = aplicarOffset(perfilB.mediaPorPeriodo[per]);
    wrA[per] = aplicarOffsetWr(perfilA.wrPorPeriodo[per]);
    wrB[per] = aplicarOffsetWr(perfilB.wrPorPeriodo[per]);
  });
  const ratioA = wrA.FT / (wrA.FT + wrB.FT);
  const winsA = Math.round(total * ratioA);
  const winsB = total - winsA;
  let teamA = f.timeA || perfilA.teamPref;
  let teamB = f.timeB || perfilB.teamPref;
  if (!modoSolo && !f.timeA && !f.timeB && teamA === teamB) {
    const outroTime = perfilB.tabelaTimes.find(t => t.team !== teamA);
    if (outroTime) teamB = outroTime.team;
  }
  return { perfilA, perfilB, modoSolo, filtros: f, seedCtx, rng: seeded(seedCtx), totalBase, total, janelaPedida, horasFiltradas, variancia, mediaA, mediaB, wrA, wrB, ratioA, winsA, winsB, teamA, teamB, vazio: false };
}

function contextoVazio(perfilA, perfilB, filtros, modoSolo, seedCtx) {
  let teamA = perfilA.teamPref, teamB = perfilB.teamPref;
  if (!modoSolo && teamA === teamB) { const o = perfilB.tabelaTimes.find(t => t.team !== teamA); if (o) teamB = o.team; }
  return { perfilA, perfilB, modoSolo, filtros, seedCtx, rng: seeded(seedCtx), totalBase: 0, total: 0, janelaPedida: null, horasFiltradas: 24, variancia: 0, mediaA: Object.fromEntries(PERIODS.map(p => [p, 0])), mediaB: Object.fromEntries(PERIODS.map(p => [p, 0])), wrA: Object.fromEntries(PERIODS.map(p => [p, 50])), wrB: Object.fromEntries(PERIODS.map(p => [p, 50])), ratioA: 0.5, winsA: 0, winsB: 0, teamA, teamB: modoSolo ? null : teamB, vazio: true };
}

function derivarMatchupSummary(ctx) {
  const { total, winsA, winsB, ratioA, rng } = ctx;
  const n = Math.min(10, total);
  const lastN = Array.from({ length: n }, () => rng() < ratioA ? 'a' : 'b');
  return { wins_a: winsA, wins_b: winsB, total, pct_a: total > 0 ? Math.round((winsA / total) * 10000) / 100 : 0, pct_b: total > 0 ? Math.round((winsB / total) * 10000) / 100 : 0, last_n: lastN };
}

function derivarCards(ctx) {
  const { perfilA, perfilB, modoSolo, mediaA, mediaB, total, seedCtx, ratioA } = ctx;
  if (total === 0) return [
    { label: 'Maior diferença', value: '—', extra: null, extraColor: null, sub: 'Sem partidas', icon: 'diff' },
    { label: 'Maior placar', value: '—', extra: null, extraColor: null, sub: 'Sem partidas', icon: 'plus' },
    { label: 'Sequência de Vitórias', value: '—', extra: null, extraColor: null, sub: 'Sem partidas', icon: 'flame' },
    { label: 'Média de Pontos', value: '—', extra: null, extraColor: null, sub: 'Sem partidas', icon: 'chart' },
  ];
  const qtdSim = Math.min(100, total);
  let maiorDiffNum = 0, maiorDiffStr = '', maiorDiffVencedor = 'a', maiorDiffDias = 1;
  let maiorPlacarNum = 0, maiorPlacarStr = '', maiorPlacarVencedor = 'a', maiorPlacarDias = 1;
  let seqAtual = 0, seqAtualLado = null, seqMax = 0, seqMaxLado = 'a';
  for (let i = 0; i < qtdSim; i++) {
    const r = seeded(seedCtx + i * 53);
    const aScore = Math.max(20, Math.round(mediaA.FT + (r() - 0.5) * 20));
    const bScore = Math.max(20, Math.round(mediaB.FT + (r() - 0.5) * 20));
    const vencedor = r() < ratioA ? 'a' : 'b';
    let aFinal = aScore, bFinal = bScore;
    if (vencedor === 'a' && aScore <= bScore) aFinal = bScore + 1 + Math.floor(r() * 5);
    else if (vencedor === 'b' && bScore <= aScore) bFinal = aScore + 1 + Math.floor(r() * 5);
    const diff = Math.abs(aFinal - bFinal);
    const totalPlacar = aFinal + bFinal;
    if (diff > maiorDiffNum) { maiorDiffNum = diff; maiorDiffStr = `${Math.max(aFinal, bFinal)}-${Math.min(aFinal, bFinal)}`; maiorDiffVencedor = vencedor; maiorDiffDias = Math.floor(i / 48) + 1; }
    if (totalPlacar > maiorPlacarNum) { maiorPlacarNum = totalPlacar; maiorPlacarStr = `${aFinal + bFinal}`; maiorPlacarVencedor = vencedor; maiorPlacarDias = Math.floor(i / 48) + 1; }
    if (vencedor === seqAtualLado) { seqAtual++; } else { seqAtualLado = vencedor; seqAtual = 1; }
    if (seqAtual > seqMax) { seqMax = seqAtual; seqMaxLado = seqAtualLado; }
  }
  const nomeVencedorDiff = maiorDiffVencedor === 'a' ? perfilA.nome : (modoSolo ? 'Oponentes' : perfilB.nome);
  const corVencedorDiff = maiorDiffVencedor === 'a' ? T.accent : T.accent2;
  const nomeVencedorPlacar = maiorPlacarVencedor === 'a' ? perfilA.nome : (modoSolo ? 'Oponentes' : perfilB.nome);
  const corVencedorPlacar = maiorPlacarVencedor === 'a' ? T.accent : T.accent2;
  const nomeVencedorSeq = seqMaxLado === 'a' ? perfilA.nome : (modoSolo ? 'Oponentes' : perfilB.nome);
  const corVencedorSeq = seqMaxLado === 'a' ? T.accent : T.accent2;
  return [
    { label: 'Maior diferença', value: maiorDiffStr, extra: nomeVencedorDiff, extraColor: corVencedorDiff, sub: `${maiorDiffDias} dia${maiorDiffDias > 1 ? 's' : ''} atrás`, icon: 'diff' },
    { label: 'Maior placar', value: maiorPlacarStr, extra: nomeVencedorPlacar, extraColor: corVencedorPlacar, sub: `${maiorPlacarDias} dia${maiorPlacarDias > 1 ? 's' : ''} atrás`, icon: 'plus' },
    { label: 'Sequência de Vitórias', value: `${seqMax} jogo${seqMax > 1 ? 's' : ''}`, extra: nomeVencedorSeq, extraColor: corVencedorSeq, sub: null, icon: 'flame' },
    { label: 'Média de Pontos', value: `${(mediaA.FT + mediaB.FT).toFixed(2)} pontos`, extra: null, extraColor: null, sub: 'Todas as Partidas', icon: 'chart' },
  ];
}

function derivarOverUnderPartida(ctx) {
  const { mediaA, mediaB, total, seedCtx } = ctx;
  if (total === 0) return Object.fromEntries(PERIODS.map(p => [p, { Over: [], Under: [] }]));
  const result = {};
  PERIODS.forEach((per, perIdx) => {
    const r = seeded(seedCtx + perIdx * 17);
    const mediaTotal = mediaA[per] + mediaB[per];
    const linhaMin = Math.floor(mediaTotal * 0.55), linhaMax = Math.floor(mediaTotal * 1.65);
    const linhas = Array.from({ length: Math.max(1, linhaMax - linhaMin + 1) }, (_, i) => {
      const linhaNum = linhaMin + i, linha = linhaNum + 0.5;
      const pctOver = 100 / (1 + Math.exp(-(mediaTotal - linha) * 0.25));
      const finalOver = Math.max(0.5, Math.min(99.5, pctOver + (r() - 0.5) * 1.5));
      return { linhaNum, finalOver };
    });
    result[per] = { Over: linhas.map(l => ({ line: `${l.linhaNum}.5`, pct: l.finalOver })), Under: linhas.map(l => ({ line: `${l.linhaNum}.5`, pct: 100 - l.finalOver })) };
  });
  return result;
}

function derivarHandicap(ctx) {
  const { mediaA, mediaB, wrA, wrB, total, seedCtx } = ctx;
  if (total === 0) return Object.fromEntries(PERIODS.map(p => [p, []]));
  const result = {};
  PERIODS.forEach((per, perIdx) => {
    const r = seeded(seedCtx + perIdx * 23);
    const margemA = Math.abs(mediaA[per] - mediaB[per]) + 3, margemB = Math.abs(mediaB[per] - mediaA[per]) + 3;
    result[per] = Array.from({ length: 12 }, (_, i) => {
      const linhaNum = i + 1, linha = linhaNum + 0.5;
      const aPlusFromHc = 100 / (1 + Math.exp(-(linha - margemA * 0.5) * 0.35));
      const aPlus = Math.max(2, Math.min(98, wrA[per] + aPlusFromHc * 0.5 + (r() - 0.5) * 3));
      const aMinus = Math.max(2, Math.min(98, 100 - aPlus + (r() - 0.5) * 2));
      const bPlusFromHc = 100 / (1 + Math.exp(-(linha - margemB * 0.5) * 0.35));
      const bPlus = Math.max(2, Math.min(98, wrB[per] + bPlusFromHc * 0.5 + (r() - 0.5) * 3));
      const bMinus = Math.max(2, Math.min(98, 100 - bPlus + (r() - 0.5) * 2));
      return { line: `${linha}`, a_plus: aPlus, a_minus: aMinus, b_plus: bPlus, b_minus: bMinus };
    });
  });
  return result;
}

function derivarOverUnderJogador(ctx, lado) {
  const { total, seedCtx } = ctx;
  const media = lado === 'a' ? ctx.mediaA : ctx.mediaB;
  if (total === 0) return Object.fromEntries(PERIODS_JOGADOR.map(p => [p, { Over: [], Under: [] }]));
  const result = {};
  PERIODS_JOGADOR.forEach((per, perIdx) => {
    const r = seeded(seedCtx + perIdx * 41 + (lado === 'a' ? 0 : 100000));
    const mediaJog = media[per], linhaMin = Math.floor(mediaJog * 0.55), linhaMax = Math.floor(mediaJog * 1.65);
    const linhas = Array.from({ length: Math.max(1, linhaMax - linhaMin + 1) }, (_, i) => {
      const linhaNum = linhaMin + i, linha = linhaNum + 0.5;
      const finalOver = Math.max(0.5, Math.min(99.5, 100 / (1 + Math.exp(-(mediaJog - linha) * 0.3)) + (r() - 0.5) * 1.8));
      return { linhaNum, finalOver };
    });
    result[per] = { Over: linhas.map(l => ({ line: `${l.linhaNum}.5`, pct: l.finalOver })), Under: linhas.map(l => ({ line: `${l.linhaNum}.5`, pct: 100 - l.finalOver })) };
  });
  return result;
}

function derivarPontosPeriodo(ctx) {
  const { mediaA, mediaB, total, seedCtx, modoSolo } = ctx;
  if (total === 0) return [];
  const r = seeded(seedCtx + 7777);
  const fR = (base, ruidoMax) => base + (r() - 0.5) * ruidoMax;
  const linhas = [
    ...PERIODS.map(per => ({ period: per, a: mediaA[per], b: mediaB[per] })),
    { period: 'Após vencer HT', a: mediaA.FT * fR(1.06, 0.04), b: mediaB.FT * fR(1.06, 0.04) },
    { period: 'Após perder HT', a: mediaA.FT * fR(0.94, 0.04), b: mediaB.FT * fR(0.94, 0.04) },
    { period: 'Como mandante', a: mediaA.FT * fR(1.03, 0.04), b: mediaB.FT * fR(1.03, 0.04) },
    { period: 'Como visitante', a: mediaA.FT * fR(0.97, 0.04), b: mediaB.FT * fR(0.97, 0.04) },
    { period: 'Últimas 5', a: mediaA.FT + (r() - 0.5) * 5, b: mediaB.FT + (r() - 0.5) * 5 },
    { period: 'Últimas 10', a: mediaA.FT + (r() - 0.5) * 3, b: mediaB.FT + (r() - 0.5) * 3 },
  ];
  if (!modoSolo) linhas.push({ period: 'Confronto direto', a: mediaA.FT + (r() - 0.5) * 4, b: mediaB.FT + (r() - 0.5) * 4 });
  return linhas;
}

function derivarStatsPartida(ctx) {
  const { winsA, winsB, total, seedCtx, wrA, wrB } = ctx;
  if (total === 0) return [];
  const r = seeded(seedCtx + 8888);
  const ftPctA = (winsA / total) * 100, ftPctB = (winsB / total) * 100;
  const empatePeriodo = (i) => i === 0 ? 0 : Math.min(8, 2 + i);
  return [
    ...PERIODS.map((per, i) => ({ period: per, a: wrA[per], b: wrB[per], draw: empatePeriodo(i) })),
    { period: 'Após vencer 1Q', a: Math.min(95, ftPctA + 12 + r() * 4), b: Math.min(95, ftPctB + 12 + r() * 4), draw: 0 },
    { period: 'Após perder 1Q', a: Math.max(5, ftPctA - 15 + r() * 5), b: Math.max(5, ftPctB - 15 + r() * 5), draw: 0 },
    { period: 'Após vencer HT', a: Math.min(95, ftPctA + 18 + r() * 4), b: Math.min(95, ftPctB + 18 + r() * 4), draw: 0 },
    { period: 'Após perder HT', a: Math.max(5, ftPctA - 18 + r() * 5), b: Math.max(5, ftPctB - 18 + r() * 5), draw: 0 },
    { period: 'Últimas 5', a: Math.max(5, Math.min(95, ftPctA + (r() - 0.5) * 25)), b: Math.max(5, Math.min(95, ftPctB + (r() - 0.5) * 25)), draw: 0 },
    { period: 'Últimas 10', a: Math.max(5, Math.min(95, ftPctA + (r() - 0.5) * 15)), b: Math.max(5, Math.min(95, ftPctB + (r() - 0.5) * 15)), draw: 0 },
    { period: 'Como favorito', a: Math.min(95, ftPctA + 8 + r() * 3), b: Math.min(95, ftPctB + 8 + r() * 3), draw: 0 },
    { period: 'Como azarão', a: Math.max(5, ftPctA - 12 + r() * 4), b: Math.max(5, ftPctB - 12 + r() * 4), draw: 0 },
  ];
}

function derivarMediaUltimas(ctx) {
  const { mediaA, mediaB, total, seedCtx } = ctx;
  if (total === 0) return [];
  const ftA = mediaA.FT, ftB = mediaB.FT, htA = mediaA.HT, htB = mediaB.HT;
  const linha = (label, fa, fb, ha, hb) => ({ label, a: fa.toFixed(2), a_ht: ha.toFixed(2), b: fb.toFixed(2), b_ht: hb.toFixed(2), total: (fa + fb).toFixed(2), total_ht: (ha + hb).toFixed(2) });
  const linhas = [linha('Todas as Partidas', ftA, ftB, htA, htB)];
  [5, 10, 15, 20, 25, 30, 40, 50, 100].forEach(n => {
    if (n > total) return;
    const r = seeded(seedCtx + n * 7);
    linhas.push(linha(`${n} últimas`, ftA + (r() - 0.4) * 3, ftB + (r() - 0.4) * 3, htA + (r() - 0.4) * 2, htB + (r() - 0.4) * 2));
  });
  return linhas;
}

function derivarDistribuicao(ctx) {
  const { total, seedCtx, ratioA } = ctx;
  if (total === 0) return [];
  const qtdDias = Math.min(30, Math.max(7, Math.ceil(total / 4)));
  const partidasPorDia = total / qtdDias;
  return Array.from({ length: qtdDias }, (_, i) => {
    const r = seeded(seedCtx + i * 31);
    const totalDia = Math.max(1, Math.round(partidasPorDia + (r() - 0.5) * partidasPorDia));
    const a = Math.round(totalDia * ratioA + (r() - 0.5) * 1.5);
    const drawCount = r() < 0.15 ? 1 : 0;
    const b = Math.max(0, totalDia - a - drawCount);
    const dt = new Date(2026, 4, 3);
    dt.setDate(dt.getDate() - (qtdDias - 1 - i));
    return { day: `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`, dateFull: dt, a: Math.max(0, a), draw: drawCount, b: Math.max(0, b) };
  });
}

function derivarMediaMovel(ctx) {
  const { mediaA, mediaB, total, seedCtx } = ctx;
  if (total === 0) return [];
  const ftA = mediaA.FT, ftB = mediaB.FT, qtd = Math.min(60, Math.max(10, total));
  const ampA = Math.max(2, ftA * 0.15), ampB = Math.max(2, ftB * 0.15), ampTotal = Math.max(4, (ftA + ftB) * 0.12);
  return Array.from({ length: qtd }, (_, i) => {
    const r = seeded(seedCtx + i * 41);
    return { x: i, a: Math.max(1, ftA + Math.sin(i * 0.2) * ampA + (r() - 0.5) * 3), b: Math.max(1, ftB + Math.cos(i * 0.18) * ampB + (r() - 0.5) * 3), total: Math.max(2, ftA + ftB + Math.sin(i * 0.2) * ampTotal + (r() - 0.5) * 4) };
  });
}

function derivarHistorico(ctx) {
  const { perfilA, perfilB, modoSolo, total, seedCtx, mediaA, mediaB, ratioA, teamA, teamB, filtros } = ctx;
  if (total === 0) return [];
  const qtd = Math.min(100, total);
  const opponents = ['Belgrade','Mumbai','Moscow','Athens','Dublin','Tokyo','Paris','Madrid','Rome','Lisbon'];
  const baseDate = new Date(2026, 4, 3, 23, 30);
  return Array.from({ length: qtd }, (_, i) => {
    const r = seeded(seedCtx + i * 53);
    const aScore = Math.max(20, Math.round(mediaA.FT + (r() - 0.5) * 20));
    const bScore = Math.max(20, Math.round(mediaB.FT + (r() - 0.5) * 20));
    const vencedor = r() < ratioA ? 'a' : 'b';
    let aFinal = aScore, bFinal = bScore;
    if (vencedor === 'a' && aScore <= bScore) aFinal = bScore + 1 + Math.floor(r() * 5);
    else if (vencedor === 'b' && bScore <= aScore) bFinal = aScore + 1 + Math.floor(r() * 5);
    const dt = new Date(baseDate);
    dt.setMinutes(dt.getMinutes() - i * 30);
    const dateStr = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}, ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    let bTeamPartida;
    if (filtros.timeB) bTeamPartida = filtros.timeB;
    else if (modoSolo) bTeamPartida = TIMES_NBA2K[(perfilA.seed + i * 11) % TIMES_NBA2K.length];
    else bTeamPartida = teamB;
    return { date: dateStr, a_team: teamA, b_team: bTeamPartida, a_score: aFinal, b_score: bFinal, a_name: perfilA.nome, b_name: modoSolo ? opponents[i % opponents.length] : perfilB.nome, a_ht: Math.floor(aFinal * 0.5), b_ht: Math.floor(bFinal * 0.5), vencedor };
  });
}

function derivarTimes(ctx, lado) {
  const { perfilA, perfilB, total } = ctx;
  if (total === 0) return [];
  return lado === 'a' ? perfilA.tabelaTimes : perfilB.tabelaTimes;
}

function derivarTimesAdversarios(ctx) {
  const { modoSolo, perfilA, perfilB, total } = ctx;
  if (total === 0) return [];
  if (!modoSolo) return perfilB.tabelaTimes;
  const r = seeded(perfilA.seed + 7777);
  return TIMES_NBA2K.map((time) => {
    const seedTime = hashStr(time);
    const proporcao = 0.025 + (seedTime % 100) / 1000;
    const partidas = Math.max(5, Math.round(total * proporcao));
    const wr = perfilA.winRate + (r() - 0.5) * 0.15;
    return { team: time, partidas, wr: Math.round(Math.max(20, Math.min(80, wr * 100)) * 10) / 10 };
  }).sort((a, b) => b.partidas - a.partidas);
}

function gerarDados(nomeA, nomeB, filtros = {}) {
  const modoSolo = !nomeB;
  const perfilA = gerarPerfilJogador(nomeA);
  const perfilB = gerarPerfilJogador(modoSolo ? `${nomeA}_oponentes` : nomeB);
  const ctx = aplicarFiltros(perfilA, perfilB, filtros, modoSolo);
  return {
    modoSolo, vazio: ctx.vazio, total: ctx.total, janelaPedida: ctx.janelaPedida,
    player_a: { name: perfilA.nome, team: ctx.teamA, color: T.accent, last5: perfilA.last5 },
    player_b: { name: modoSolo ? 'Oponentes' : perfilB.nome, team: modoSolo ? null : ctx.teamB, color: T.accent2, last5: modoSolo ? null : perfilB.last5 },
    matchup_summary: derivarMatchupSummary(ctx),
    cards: derivarCards(ctx),
    over_under_match: derivarOverUnderPartida(ctx),
    hc_asian: derivarHandicap(ctx),
    ou_jogador_a: derivarOverUnderJogador(ctx, 'a'),
    ou_jogador_b: derivarOverUnderJogador(ctx, 'b'),
    pontos_periodo: derivarPontosPeriodo(ctx),
    stats_partida: derivarStatsPartida(ctx),
    comeback_a: perfilA.comeback,
    comeback_b: perfilB.comeback,
    times_a: derivarTimes(ctx, 'a'),
    times_b: derivarTimes(ctx, 'b'),
    times_b_disponiveis: derivarTimesAdversarios(ctx),
    media_ultimas: derivarMediaUltimas(ctx),
    distribuicao: derivarDistribuicao(ctx),
    media_movel: derivarMediaMovel(ctx),
    historico: derivarHistorico(ctx),
  };
}

// ============================================================
// API CLIENT + HOOK
// ============================================================
const USE_MOCK_PARTIDA = true;
const MOCK_LATENCY_PARTIDA = { min: 100, max: 300 };

function simularLatenciaPartida() {
  const ms = MOCK_LATENCY_PARTIDA.min + Math.random() * (MOCK_LATENCY_PARTIDA.max - MOCK_LATENCY_PARTIDA.min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

const mockResponsesPartida = {
  '/partidas/individual': ({ jogA, jogB, filtros }) => {
    if (!jogA) throw new Error('jogA é obrigatório');
    return gerarDados(jogA, jogB || null, filtros || {});
  },
};

async function apiGetPartida(endpoint, params) {
  if (USE_MOCK_PARTIDA) {
    await simularLatenciaPartida();
    const handler = mockResponsesPartida[endpoint];
    if (!handler) throw new Error(`[MOCK] Endpoint não implementado: GET ${endpoint}`);
    return handler(params || {});
  }
  const qs = new URLSearchParams({ jogA: params.jogA, jogB: params.jogB || '', filtros: JSON.stringify(params.filtros || {}) }).toString();
  const res = await fetch(`${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function useDadosPartida(jogA, jogB, filtros) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const lastReqRef = useRef(0);
  const filtrosKey = JSON.stringify(filtros);
  const fetchData = useCallback(async () => {
    if (!jogA) { setState({ data: null, loading: false, error: null }); return; }
    const reqId = ++lastReqRef.current;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiGetPartida('/partidas/individual', { jogA, jogB, filtros });
      if (reqId === lastReqRef.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (reqId === lastReqRef.current) setState({ data: null, loading: false, error });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogA, jogB, filtrosKey]);
  useEffect(() => { fetchData(); }, [fetchData]);
  return { data: state.data, loading: state.loading, error: state.error, refetch: fetchData };
}

// ============================================================
// COMPONENTES PRIMITIVOS
// ============================================================

function Pill({ children, active = false, onClick, size = 'md' }) {
  const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-3 py-1.5 text-sm' };
  return (
    <button onClick={onClick} className={`${sizes[size]} rounded-full font-medium border transition-colors whitespace-nowrap`}
      style={{ background: active ? T.accent : 'rgba(255,255,255,0.04)', color: active ? '#04130c' : T.fg, borderColor: active ? T.accent : T.borderLight }}>
      {children}
    </button>
  );
}

function MikeButton({ children, onClick, variant = 'outline', icon: Icon, fullWidth = false, className = '' }) {
  const variants = { primary: { bg: T.accent, color: '#04130c', border: T.accent }, outline: { bg: 'transparent', color: T.fg, border: T.border }, ghost: { bg: 'rgba(255,255,255,0.03)', color: T.fg, border: T.borderLight } };
  const v = variants[variant];
  return (
    <button onClick={onClick} className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90 ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{ background: v.bg, color: v.color, border: `1px solid ${v.border}` }}>
      {Icon && <Icon size={15} />}{children}
    </button>
  );
}

function Card({ children, className = '', style = {} }) {
  return <div className={`rounded-lg ${className}`} style={{ background: T.bg2, border: `1px solid ${T.border}`, ...style }}>{children}</div>;
}

function SectionHeader({ children, right }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: T.border, background: 'rgba(255,255,255,0.015)' }}>
      <h3 className="text-[13px] font-semibold tracking-wide" style={{ color: T.fg }}>{children}</h3>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

function PlayerLegend({ name, color }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderLight}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span style={{ color: T.fg }}>{name}</span>
    </div>
  );
}

function TabGroup({ tabs, value, onChange, size = 'md' }) {
  const sizes = { sm: 'h-8 text-xs px-3', md: 'h-9 text-sm px-3.5' };
  return (
    <div className="flex gap-1.5">
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} className={`${sizes[size]} rounded-md font-semibold transition-colors`}
          style={{ background: value === t ? T.accent : 'rgba(255,255,255,0.04)', color: value === t ? '#04130c' : T.fgDim }}>
          {t}
        </button>
      ))}
    </div>
  );
}

function ToggleOverUnder({ value, onChange }) {
  return (
    <div className="inline-flex rounded-md overflow-hidden" style={{ border: `1px solid ${T.borderLight}` }}>
      {['Over', 'Under'].map(v => (
        <button key={v} onClick={() => onChange(v)} className="px-3.5 h-7 text-xs font-semibold transition-colors"
          style={{ background: value === v ? 'rgba(16,185,129,0.15)' : 'transparent', color: value === v ? T.accent : T.fgDim }}>
          {v}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// HEADER + NAV
// ============================================================

function Header({ onNavegar } = {}) {
  return (
    <header className="sticky top-0 z-20" style={{ background: 'rgba(11,15,26,0.92)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between px-6 py-2.5">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavegar?.('today')} className="flex items-center gap-2 hover:opacity-80 transition" title="Voltar pro início">
            <div className="w-7 h-7 rounded grid place-items-center font-bold text-base" style={{ background: T.accent, color: '#04130c' }}>M</div>
            <span className="font-bold tracking-wider text-sm" style={{ color: T.fg }}>TIPMIKE</span>
          </button>
          <button className="inline-flex items-center gap-2 px-3 h-9 rounded-md text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderLight}`, color: T.fg }}>
            <Activity size={14} />eSports<ChevronDown size={14} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.fgDim }} />
            <input placeholder="Buscar..." className="h-9 pl-9 pr-3 rounded-md text-sm outline-none w-64" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderLight}`, color: T.fg }} />
          </div>
          <button className="relative w-9 h-9 rounded-md grid place-items-center" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderLight}` }}>
            <Bell size={16} style={{ color: T.fgDim }} />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold grid place-items-center" style={{ background: T.accent, color: '#04130c' }}>1</span>
          </button>
          <button className="w-9 h-9 rounded-md grid place-items-center" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderLight}` }}>
            <Settings size={16} style={{ color: T.fgDim }} />
          </button>
          <div className="flex items-center gap-2 pl-2">
            <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderLight}` }}>
              <User size={14} style={{ color: T.fgDim }} />
            </div>
            <div className="text-xs leading-tight">
              <div style={{ color: T.fg }}>santos@mike</div>
              <div style={{ color: T.fgDim }}>BOT (eSports)</div>
            </div>
          </div>
        </div>
      </div>
      <nav className="flex items-center gap-1 px-6 pb-2">
        {[
          { id: 'today', icon: Home, label: 'Início' },
          { id: 'live', icon: PlayCircle, label: 'Ao Vivo' },
          { id: 'marketplace', icon: Store, label: 'Mercado de Bots' },
          { id: 'bots', icon: Bot, label: 'Bots' },
          { id: 'tables', icon: Table2, label: 'Tabelas' },
          { id: 'stats', icon: BarChart3, label: 'Estatísticas', badge: 'NOVO' },
          { id: 'extras', icon: MoreHorizontal, label: 'Extras' },
        ].map(({ id, icon: Icon, label, badge }, i) => {
          const active = !onNavegar && label === 'Estatísticas';
          return (
            <button key={i} onClick={() => onNavegar?.(id)}
              className="relative inline-flex items-center gap-2 px-3 h-9 rounded-md text-[13px] font-medium transition-colors hover:bg-white/5"
              style={{ color: active ? T.accent : T.fgDim, background: active ? 'rgba(16,185,129,0.10)' : 'transparent' }}>
              <Icon size={15} />{label}
              {badge && <span className="absolute -top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: T.orange, color: '#0b0f1a' }}>{badge}</span>}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

// ============================================================
// HERO CARD
// ============================================================

function Donut({ value, total, color, size = 130, strokeWidth = 11 }) {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const safeTotal = total > 0 ? total : 1;
  const offset = circ - (value / safeTotal) * circ;
  const pct = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00';
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-3xl font-bold tracking-tight" style={{ color: T.fg }}>{value}</div>
          <div className="text-xs font-medium" style={{ color }}>{pct}%</div>
        </div>
      </div>
    </div>
  );
}

function TeamDropdown({ value, options, onChange, color, placeholderLabel, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);
  const sorted = [...(options || [])].sort((a, b) => b.partidas - a.partidas);
  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs transition-colors"
        style={{ background: open ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${open ? T.accent : T.borderLight}`, color: T.fg }}>
        <Users size={12} />
        {placeholderLabel && <span style={{ color: T.fgDim }}>{placeholderLabel}</span>}
        {value}
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }} />
      </button>
      {open && (
        <div className={`absolute top-full mt-1 rounded-md overflow-hidden z-20 ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ background: T.bg2, border: `1px solid ${T.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', animation: 'fadeIn 180ms cubic-bezier(0.22, 1, 0.36, 1)', minWidth: 220, maxHeight: 300, overflowY: 'auto' }}>
          <button onClick={() => { onChange(null); setOpen(false); }}
            className="w-full px-3 py-2 text-xs text-left transition-colors hover:bg-white/5 flex items-center justify-between gap-3"
            style={{ color: !value || value === 'Todos' ? color : T.fg, background: !value ? 'rgba(16,185,129,0.06)' : 'transparent', borderBottom: `1px solid ${T.borderLight}` }}>
            <span className="font-medium">Todos os times</span>
            <span className="text-[10px]" style={{ color: T.fgDim }}>{sorted.reduce((s, t) => s + t.partidas, 0)} partidas</span>
          </button>
          {sorted.map(t => (
            <button key={t.team} onClick={() => { onChange(t.team); setOpen(false); }}
              className="w-full px-3 py-2 text-xs text-left transition-colors hover:bg-white/5 flex items-center justify-between gap-3"
              style={{ color: t.team === value ? color : T.fg, background: t.team === value ? 'rgba(16,185,129,0.06)' : 'transparent' }}>
              <span className="inline-flex items-center gap-1.5">
                {t.team === value && <span className="w-1 h-1 rounded-full" style={{ background: color }} />}
                {t.team}
              </span>
              <span className="text-[10px]" style={{ color: T.fgDim }}>{t.partidas}j • {t.wr}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Last5Badges({ last5, align = 'left', playerColor }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  if (!last5 || last5.length === 0) return null;
  const isObjeto = typeof last5[0] === 'object';
  return (
    <div className={`flex gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
      {last5.map((r, i) => {
        const resultado = isObjeto ? r.resultado : r;
        return (
          <div key={i} className="relative">
            <span className="w-5 h-5 grid place-items-center rounded-sm text-[10px] font-bold cursor-default transition-transform"
              style={{ background: resultado === 'V' ? T.accent : T.red, color: '#04130c', transform: hoverIdx === i ? 'scale(1.15)' : 'scale(1)' }}
              onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
              {resultado}
            </span>
            {isObjeto && hoverIdx === i && (
              <div className="absolute pointer-events-none z-30 rounded-md px-3 py-2.5"
                style={{ bottom: 'calc(100% + 8px)', [align === 'right' ? 'right' : 'left']: 0, background: 'rgba(11,15,26,0.98)', border: `1px solid ${T.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 180, animation: 'fadeIn 120ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
                <div className="text-base font-bold mb-1" style={{ color: T.fg }}>{r.placarA} x {r.placarB}</div>
                <div className="text-xs mb-0.5" style={{ color: T.fgDim }}>vs {r.oponenteNome} ({r.oponenteTime})</div>
                <div className="text-[11px]" style={{ color: T.fgDimmer }}>{r.data}</div>
                <div className="absolute" style={{ top: '100%', [align === 'right' ? 'right' : 'left']: 8, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `5px solid ${T.border}` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HeroCard({ data, onAlterar, onFiltros, filtrosAtivos = 0, timeASelecionado, timeBSelecionado, onChangeTimeA, onChangeTimeB }) {
  const a = data.player_a, b = data.player_b, m = data.matchup_summary;
  return (
    <Card className="overflow-hidden">
      <div className="relative px-7 pt-6 pb-4" style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.04) 0%, transparent 60%)' }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: a.color }}>{a.name}</h2>
              <ExternalLink size={14} style={{ color: a.color, opacity: 0.6 }} />
            </div>
            <div className="mt-2"><TeamDropdown value={a.team} options={data.times_a} onChange={onChangeTimeA} color={a.color} /></div>
            <div className="mt-2"><Last5Badges last5={a.last5} align="left" playerColor={a.color} /></div>
          </div>
          <div className="text-center pt-2">
            <div className="text-lg font-light tracking-[0.3em]" style={{ color: T.fgDimmer }}>VS</div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <ExternalLink size={14} style={{ color: b.color, opacity: 0.6 }} />
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: b.color }}>{b.name}</h2>
            </div>
            <div className="mt-2 flex justify-end">
              {data.modoSolo ? (
                <TeamDropdown value={timeBSelecionado || 'Todos os times'} options={data.times_b_disponiveis} onChange={onChangeTimeB} color={b.color} placeholderLabel="vs" align="right" />
              ) : b.team ? (
                <TeamDropdown value={b.team} options={data.times_b} onChange={onChangeTimeB} color={b.color} align="right" />
              ) : null}
            </div>
            {b.last5 && <div className="mt-2 flex justify-end"><Last5Badges last5={b.last5} align="right" playerColor={b.color} /></div>}
          </div>
        </div>
        {m.last_n.length > 0 && (
          <div className="mt-6 flex flex-col items-center">
            <div className="text-[10px] tracking-[0.3em] font-semibold mb-2" style={{ color: T.fgDimmer }}>ÚLTIMAS {m.last_n.length} PARTIDA{m.last_n.length !== 1 ? 'S' : ''}</div>
            <div className="flex gap-2">
              {m.last_n.map((r, i) => <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: r === 'a' ? a.color : b.color, boxShadow: `0 0 8px ${r === 'a' ? a.color : b.color}40` }} />)}
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center justify-center gap-10">
          <Donut value={m.wins_a} total={m.total} color={a.color} size={140} />
          <div className="text-center">
            <div className="text-[10px] tracking-[0.3em] font-semibold mb-1" style={{ color: T.fgDimmer }}>PARTIDAS</div>
            <div className="text-4xl font-bold" style={{ color: T.fg }}>{m.total}</div>
          </div>
          <Donut value={m.wins_b} total={m.total} color={b.color} size={140} />
        </div>
      </div>
      <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: T.border, background: 'rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs" style={{ color: T.fg }}>
            <Trophy size={13} style={{ color: T.yellow }} />Adriatic League
          </div>
          {data.janelaPedida && data.janelaPedida > data.total && (
            <div className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded" style={{ color: T.yellow, background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.2)` }}>
              Pedidas: {data.janelaPedida} • Disponíveis: {data.total}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onFiltros} className="relative inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-all hover:opacity-90"
            style={{ background: filtrosAtivos > 0 ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.03)', color: T.fg, border: `1px solid ${filtrosAtivos > 0 ? T.accent : T.borderLight}` }}>
            <Filter size={15} />Filtros
            {filtrosAtivos > 0 && <span className="ml-1 inline-flex items-center justify-center text-[10px] font-bold rounded-full" style={{ background: T.accent, color: '#04130c', minWidth: 18, height: 18, padding: '0 5px' }}>{filtrosAtivos}</span>}
          </button>
          <MikeButton variant="ghost" icon={ArrowLeftRight} onClick={onAlterar}>Alterar Jogadores</MikeButton>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// 4 STATS CARDS
// ============================================================

function StatsCardRow({ data }) {
  const icons = { diff: ArrowUpDown, plus: Plus, flame: Flame, chart: BarChart };
  return (
    <div className="grid grid-cols-4 gap-3">
      {data.cards.map((c, i) => {
        const Icon = icons[c.icon];
        return (
          <Card key={i} className="px-4 py-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-md grid place-items-center" style={{ background: 'rgba(255,255,255,0.04)' }}><Icon size={14} style={{ color: T.fgDim }} /></div>
              <div className="text-[11px]" style={{ color: T.fgDim }}>{c.label}</div>
              {c.sub && <div className="text-[10px] ml-auto" style={{ color: T.fgDimmer }}>{c.sub}</div>}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold tracking-tight" style={{ color: T.fg }}>{c.value}</div>
              {c.extra && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.extraColor }} />
                  <span style={{ color: T.fg }}>{c.extra}</span>
                </span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// OVER/UNDER PARTIDA
// ============================================================

function OverUnderPartida({ data }) {
  const [tab, setTab] = useState('FT');
  const [mode, setMode] = useState('Over');
  const linhas = (data.over_under_match[tab] && data.over_under_match[tab][mode]) || [];
  if (data.total === 0) return <Card><SectionHeader>Over/Under (Partida)</SectionHeader><div className="px-5 py-12 text-center text-sm" style={{ color: T.fgDim }}>Sem partidas para os filtros aplicados</div></Card>;
  return (
    <Card>
      <SectionHeader right={<ToggleOverUnder value={mode} onChange={setMode} />}>Over/Under (Partida)</SectionHeader>
      <div className="px-5 py-3 border-b" style={{ borderColor: T.border }}><TabGroup tabs={['FT','HT','1Q','2Q','3Q','4Q']} value={tab} onChange={setTab} size="sm" /></div>
      <div className="p-5">
        <div className="overflow-y-auto pr-2 mike-scroll" style={{ maxHeight: 280 }}>
          {linhas.map((row, i) => (
            <div key={`${tab}-${mode}-${i}`} className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded mike-row-hover">
              <div className="w-12 text-sm font-semibold flex-shrink-0" style={{ color: T.fg }}>{row.line}</div>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${row.pct}%`, background: T.accent, boxShadow: `0 0 10px ${T.accent}40` }} />
              </div>
              <div className="w-14 text-right text-xs font-mono flex-shrink-0" style={{ color: T.fgDim }}>{row.pct.toFixed(2)}%</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// HANDICAP ASIATICO
// ============================================================

function HCCell({ value }) {
  const color = value >= 60 ? T.accent : value >= 50 ? T.yellow : value >= 40 ? T.orange : T.red;
  return <div className="text-center text-[13px] font-mono font-semibold" style={{ color }}>{value.toFixed(2)}%</div>;
}

function HandicapAsiatico({ data }) {
  const [tab, setTab] = useState('FT');
  const a = data.player_a, b = data.player_b;
  const linhas = (data.hc_asian && data.hc_asian[tab]) || [];
  if (data.total === 0) return <Card><SectionHeader>Handicap Asiático</SectionHeader><div className="px-5 py-12 text-center text-sm" style={{ color: T.fgDim }}>Sem partidas para os filtros aplicados</div></Card>;
  return (
    <Card>
      <SectionHeader>Handicap Asiático</SectionHeader>
      <div className="px-5 py-3 border-b" style={{ borderColor: T.border }}><TabGroup tabs={['FT','HT','1Q','2Q','3Q','4Q']} value={tab} onChange={setTab} size="sm" /></div>
      <div className="p-5">
        <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: '60px 1fr 1fr' }}>
          <div className="text-[11px]" style={{ color: T.fgDim }}>Linhas</div>
          <div className="text-center"><PlayerLegend name={a.name} color={a.color} /></div>
          <div className="text-center"><PlayerLegend name={b.name} color={b.color} /></div>
        </div>
        <div className="grid gap-1.5 mb-2" style={{ gridTemplateColumns: '60px 1fr 1fr 1fr 1fr' }}>
          <div />{['+ ','− ','+ ','− '].map((s, i) => <div key={i} className="text-center text-[10px] font-semibold" style={{ color: T.fgDimmer }}>{s}</div>)}
        </div>
        <div className="overflow-y-auto pr-1 mike-scroll" style={{ maxHeight: 240 }}>
          {linhas.map((row, i) => (
            <div key={`${tab}-${i}`} className="grid gap-1.5 py-1.5 items-center mike-row-hover rounded px-2 -mx-2"
              style={{ gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', borderTop: i > 0 ? `1px solid ${T.borderLight}` : 'none' }}>
              <div className="text-sm font-semibold" style={{ color: T.fg }}>{row.line}</div>
              <HCCell value={row.a_plus} /><HCCell value={row.a_minus} /><HCCell value={row.b_plus} /><HCCell value={row.b_minus} />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// OVER/UNDER JOGADOR
// ============================================================

function OverUnderJogador({ player, data }) {
  const [tab, setTab] = useState('FT');
  const [mode, setMode] = useState('Over');
  const linhas = (data && data[tab] && data[tab][mode]) || [];
  if (!linhas || linhas.length === 0) return (
    <Card>
      <SectionHeader><span>Over/Under (Jogador)</span><span className="ml-2"><PlayerLegend name={player.name} color={player.color} /></span></SectionHeader>
      <div className="px-5 py-12 text-center text-sm" style={{ color: T.fgDim }}>Sem partidas para os filtros aplicados</div>
    </Card>
  );
  return (
    <Card>
      <SectionHeader right={<ToggleOverUnder value={mode} onChange={setMode} />}>
        <span>Over/Under (Jogador)</span><span className="ml-2"><PlayerLegend name={player.name} color={player.color} /></span>
      </SectionHeader>
      <div className="px-5 py-3 border-b" style={{ borderColor: T.border }}><TabGroup tabs={['FT','HT']} value={tab} onChange={setTab} size="sm" /></div>
      <div className="p-5">
        <div className="overflow-y-auto pr-2 mike-scroll" style={{ maxHeight: 240 }}>
          {linhas.map((row, i) => (
            <div key={`${tab}-${mode}-${i}`} className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded mike-row-hover">
              <div className="w-12 text-sm font-semibold flex-shrink-0" style={{ color: T.fg }}>{row.line}</div>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${row.pct}%`, background: row.pct >= 60 ? T.accent : row.pct >= 45 ? T.yellow : T.orange }} />
              </div>
              <div className="w-14 text-right text-xs font-mono flex-shrink-0" style={{ color: T.fgDim }}>{row.pct.toFixed(2)}%</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// MEDIA PONTOS POR PERIODO
// ============================================================

function MediaPontos({ data }) {
  const a = data.player_a, b = data.player_b;
  if (!data.pontos_periodo || data.pontos_periodo.length === 0) return <Card><SectionHeader>Média de pontos por período</SectionHeader><div className="px-5 py-12 text-center text-sm" style={{ color: T.fgDim }}>Sem partidas para os filtros aplicados</div></Card>;
  return (
    <Card>
      <SectionHeader>Média de pontos por período</SectionHeader>
      <div className="p-5 pb-2">
        <div className="flex items-center justify-between mb-2">
          <PlayerLegend name={a.name} color={a.color} />
          <div className="text-[10px] tracking-widest" style={{ color: T.fgDim }}>QUARTO</div>
          <PlayerLegend name={b.name} color={b.color} />
        </div>
        <div className="overflow-y-auto mike-scroll pr-1" style={{ maxHeight: 280 }}>
          {data.pontos_periodo.map((row, i) => (
            <div key={i} className="grid grid-cols-3 items-center py-2.5 px-2 -mx-2 rounded border-t mike-row-hover" style={{ borderColor: T.borderLight }}>
              <div className="text-base font-bold" style={{ color: a.color }}>{row.a.toFixed(2)}</div>
              <div className="text-center text-xs font-medium" style={{ color: T.fgDim }}>{row.period}</div>
              <div className="text-right text-base font-bold" style={{ color: b.color }}>{row.b.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// ESTATISTICAS DA PARTIDA
// ============================================================

function EstatisticasPartida({ data }) {
  const a = data.player_a, b = data.player_b;
  if (!data.stats_partida || data.stats_partida.length === 0) return <Card><SectionHeader>Estatísticas da Partida</SectionHeader><div className="px-5 py-12 text-center text-sm" style={{ color: T.fgDim }}>Sem partidas para os filtros aplicados</div></Card>;
  return (
    <Card>
      <SectionHeader>Estatísticas da Partida</SectionHeader>
      <div className="p-5 pb-2">
        <div className="flex items-center justify-between mb-2">
          <PlayerLegend name={a.name} color={a.color} />
          <div className="text-[10px] tracking-widest" style={{ color: T.fgDim }}>QUARTO / EMPATE</div>
          <PlayerLegend name={b.name} color={b.color} />
        </div>
        <div className="overflow-y-auto mike-scroll pr-1" style={{ maxHeight: 220 }}>
          {data.stats_partida.map((row, i) => (
            <div key={i} className="py-2.5 px-2 -mx-2 rounded border-t mike-row-hover" style={{ borderColor: T.borderLight }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold" style={{ color: a.color }}>{row.a.toFixed(2)}%</span>
                <span className="text-[11px] font-medium" style={{ color: T.fgDim }}>{row.period}{row.draw > 0 && <span style={{ color: T.fgDimmer, marginLeft: 6 }}>{row.draw.toFixed(2)}%</span>}</span>
                <span className="text-sm font-bold" style={{ color: b.color }}>{row.b.toFixed(2)}%</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ width: `${row.a}%`, background: a.color }} />
                {row.draw > 0 && <div style={{ width: `${row.draw}%`, background: T.fgDimmer }} />}
                <div style={{ width: `${row.b}%`, background: b.color, marginLeft: 'auto' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-5 mt-2 pt-4 grid grid-cols-2 gap-4 border-t" style={{ borderColor: T.border }}>
        <div>
          <div className="text-[11px] mb-1" style={{ color: T.fgDim }}>Viradas após perder o HT</div>
          <div className="text-sm font-semibold pb-5" style={{ color: a.color }}>{data.comeback_a}% das partidas</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] mb-1" style={{ color: T.fgDim }}>Viradas após perder o HT</div>
          <div className="text-sm font-semibold pb-5" style={{ color: b.color }}>{data.comeback_b}% das partidas</div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// ANALISE DE TIMES
// ============================================================

function AnaliseTimes({ player, data }) {
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(0);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const [sortBy, setSortBy] = useState('partidas');
  const [sortDir, setSortDir] = useState('desc');
  const pageSizeRef = useRef(null);
  useEffect(() => { setPage(0); }, [data]);
  useEffect(() => {
    function handle(e) { if (pageSizeRef.current && !pageSizeRef.current.contains(e.target)) setPageSizeOpen(false); }
    if (pageSizeOpen) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [pageSizeOpen]);
  if (!data || data.length === 0) return <Card><SectionHeader right={<PlayerLegend name={player.name} color={player.color} />}>Análise de Times</SectionHeader><div className="px-5 py-12 text-center text-sm" style={{ color: T.fgDim }}>Sem partidas para os filtros aplicados</div></Card>;
  const colunas = [
    { label: 'Time', key: 'team', sortable: true, type: 'string' },
    { label: 'Partidas', key: 'partidas', sortable: true, type: 'number' },
    { label: 'Vitórias', key: 'V', sortable: true, type: 'number' },
    { label: 'Derrotas', key: 'D', sortable: true, type: 'number' },
    { label: 'Empates', key: 'E', sortable: true, type: 'number' },
    { label: 'Pontos Pró', key: 'pp', sortable: true, type: 'number' },
    { label: 'Pontos Contra', key: 'pc', sortable: true, type: 'number' },
    { label: 'Dif. Pontos', key: 'difNum', sortable: true, type: 'number' },
    { label: 'Taxa de Vitória', key: 'wr', sortable: true, type: 'number' },
  ];
  const sorted = [...data].sort((a, b) => {
    const va = a[sortBy], vb = b[sortBy];
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return sortDir === 'asc' ? cmp : -cmp;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageAtual = Math.max(0, Math.min(page, totalPages - 1));
  const inicio = pageAtual * pageSize, fim = Math.min(inicio + pageSize, sorted.length);
  const pageData = sorted.slice(inicio, fim);
  const handleSort = (key) => {
    if (sortBy === key) { setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }
    else { const col = colunas.find(c => c.key === key); setSortBy(key); setSortDir(col?.type === 'string' ? 'asc' : 'desc'); }
    setPage(0);
  };
  const changePageSize = (n) => { setPageSize(n); setPage(0); setPageSizeOpen(false); };
  return (
    <Card>
      <SectionHeader right={<PlayerLegend name={player.name} color={player.color} />}>Análise de Times</SectionHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: T.fgDim, background: 'rgba(255,255,255,0.02)' }}>
              {colunas.map((col) => {
                const ativo = sortBy === col.key;
                return (
                  <th key={col.key} className="px-2 py-2.5 text-left font-medium select-none" onClick={() => col.sortable && handleSort(col.key)} style={{ cursor: col.sortable ? 'pointer' : 'default' }}>
                    <span className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: ativo ? T.fg : T.fgDim }}>
                      {col.label}
                      {col.sortable && <span className="inline-flex flex-col" style={{ lineHeight: 0.6 }}>
                        <ChevronUp size={9} style={{ color: ativo && sortDir === 'asc' ? T.accent : T.fgDimmer, opacity: ativo && sortDir === 'asc' ? 1 : 0.5 }} />
                        <ChevronDown size={9} style={{ color: ativo && sortDir === 'desc' ? T.accent : T.fgDimmer, opacity: ativo && sortDir === 'desc' ? 1 : 0.5, marginTop: -2 }} />
                      </span>}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageData.map((r, i) => (
              <tr key={`${r.team}-${i}`} className="border-t mike-row-hover" style={{ borderColor: T.borderLight }}>
                <td className="px-2 py-2.5"><span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: player.color }} /><span style={{ color: T.fg }}>{r.team}</span></span></td>
                <td className="px-2 py-2.5 font-mono" style={{ color: T.fg }}>{r.partidas}</td>
                <td className="px-2 py-2.5 font-mono font-semibold" style={{ color: T.green }}>{r.V}</td>
                <td className="px-2 py-2.5 font-mono font-semibold" style={{ color: T.red }}>{r.D}</td>
                <td className="px-2 py-2.5 font-mono" style={{ color: T.fgDim }}>{r.E}</td>
                <td className="px-2 py-2.5 font-mono" style={{ color: T.fg }}>{r.pp}</td>
                <td className="px-2 py-2.5 font-mono" style={{ color: T.fg }}>{r.pc}</td>
                <td className="px-2 py-2.5 font-mono" style={{ color: r.difNum >= 0 ? T.green : T.red }}>{r.dif}</td>
                <td className="px-2 py-2.5 font-mono font-semibold" style={{ color: T.fg }}>{r.wr}%</td>
              </tr>
            ))}
            {pageData.length < pageSize && Array.from({ length: pageSize - pageData.length }).map((_, i) => (
              <tr key={`empty-${i}`} className="border-t" style={{ borderColor: T.borderLight }}>{colunas.map((_, j) => <td key={j} className="px-2 py-2.5">&nbsp;</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: T.border }}>
        <div className="relative" ref={pageSizeRef}>
          <button onClick={() => setPageSizeOpen(o => !o)} className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs transition-colors"
            style={{ background: pageSizeOpen ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${pageSizeOpen ? T.accent : T.borderLight}`, color: T.fg }}>
            {pageSize} Linhas<ChevronDown size={12} style={{ color: T.fgDim, transform: pageSizeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }} />
          </button>
          {pageSizeOpen && (
            <div className="absolute left-0 bottom-full mb-1 rounded-md overflow-hidden" style={{ background: T.bg2, border: `1px solid ${T.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', animation: 'fadeIn 180ms cubic-bezier(0.22, 1, 0.36, 1)', minWidth: 100 }}>
              {[5, 10, 20].map(n => <button key={n} onClick={() => changePageSize(n)} className="w-full px-3 py-1.5 text-xs text-left transition-colors hover:bg-white/5" style={{ color: pageSize === n ? T.accent : T.fg, background: pageSize === n ? 'rgba(16,185,129,0.08)' : 'transparent' }}>{n} Linhas</button>)}
            </div>
          )}
        </div>
        <div className="text-xs" style={{ color: T.fgDim }}>Exibindo <span style={{ color: T.fg, fontWeight: 600 }}>{inicio + 1} - {fim}</span> ({sorted.length})</div>
        <div className="flex gap-1">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageAtual === 0} className="w-7 h-7 rounded grid place-items-center transition-colors" style={{ border: `1px solid ${T.borderLight}`, background: pageAtual === 0 ? 'transparent' : 'rgba(255,255,255,0.04)', cursor: pageAtual === 0 ? 'not-allowed' : 'pointer', opacity: pageAtual === 0 ? 0.4 : 1 }}><ChevronLeft size={12} style={{ color: T.fgDim }} /></button>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={pageAtual >= totalPages - 1} className="w-7 h-7 rounded grid place-items-center transition-colors" style={{ background: pageAtual >= totalPages - 1 ? 'rgba(255,255,255,0.04)' : T.accent, border: pageAtual >= totalPages - 1 ? `1px solid ${T.borderLight}` : 'none', cursor: pageAtual >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: pageAtual >= totalPages - 1 ? 0.4 : 1 }}><ChevronRight size={12} style={{ color: pageAtual >= totalPages - 1 ? T.fgDim : '#04130c' }} /></button>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// MEDIA NAS ULTIMAS PARTIDAS
// ============================================================

function MediaUltimas({ data }) {
  const a = data.player_a, b = data.player_b;
  if (!data.media_ultimas || data.media_ultimas.length === 0) return <Card><SectionHeader>Média de pontos nas últimas partidas</SectionHeader><div className="px-5 py-12 text-center text-sm" style={{ color: T.fgDim }}>Sem partidas para os filtros aplicados</div></Card>;
  return (
    <Card>
      <SectionHeader>Média de pontos nas últimas partidas</SectionHeader>
      <div className="overflow-y-auto mike-scroll" style={{ maxHeight: 360 }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10" style={{ background: T.bg2 }}>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              <th className="px-5 py-3 text-left text-[11px] font-medium" style={{ color: T.fgDim }}>PARTIDAS</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold" style={{ color: a.color }}>{a.name.toUpperCase()}</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold" style={{ color: b.color }}>{b.name.toUpperCase()}</th>
              <th className="px-5 py-3 text-center text-[11px] font-bold" style={{ color: T.fg }}>TOTAL</th>
            </tr>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              <th></th>
              <th className="pb-2 text-center text-[10px] font-medium" style={{ color: T.fgDimmer }}>FT (HT)</th>
              <th className="pb-2 text-center text-[10px] font-medium" style={{ color: T.fgDimmer }}>FT (HT)</th>
              <th className="pb-2 text-center text-[10px] font-medium" style={{ color: T.fgDimmer }}>FT (HT)</th>
            </tr>
          </thead>
          <tbody>
            {data.media_ultimas.map((row, i) => (
              <tr key={i} className="border-t mike-row-hover" style={{ borderColor: T.borderLight, background: i === 0 ? 'rgba(16,185,129,0.04)' : 'transparent' }}>
                <td className="px-5 py-3" style={{ color: i === 0 ? T.accent : T.fg, fontWeight: i === 0 ? 600 : 400 }}>{row.label}</td>
                <td className="px-5 py-3 text-center font-mono" style={{ color: a.color }}><span className="font-bold">{row.a}</span><span className="ml-1 text-xs" style={{ color: T.fgDim }}>({row.a_ht})</span></td>
                <td className="px-5 py-3 text-center font-mono" style={{ color: b.color }}><span className="font-bold">{row.b}</span><span className="ml-1 text-xs" style={{ color: T.fgDim }}>({row.b_ht})</span></td>
                <td className="px-5 py-3 text-center font-mono" style={{ color: T.fg }}><span className="font-bold">{row.total}</span><span className="ml-1 text-xs" style={{ color: T.fgDim }}>({row.total_ht})</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// DISTRIBUICAO DIARIA
// ============================================================

const MESES_PT = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

function DistribuicaoDiaria({ data }) {
  const a = data.player_a, b = data.player_b;
  const [hoverIdx, setHoverIdx] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  if (!data.distribuicao || data.distribuicao.length === 0) return <Card><SectionHeader>Distribuição Diária de Partidas</SectionHeader><div className="px-5 py-12 text-center text-sm" style={{ color: T.fgDim }}>Sem partidas para os filtros aplicados</div></Card>;
  const max = Math.max(...data.distribuicao.map(d => d.a + d.b + (d.draw || 0)), 1);
  const W = 980, H = 220, padX = 30, padBottom = 28;
  const barW = (W - padX * 2) / data.distribuicao.length;
  const formatDate = (dt) => dt ? `${String(dt.getDate()).padStart(2, '0')} ${MESES_PT[dt.getMonth()]} ${dt.getFullYear()}` : '';
  const handleMouseMove = (e, idx) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left + containerRef.current.scrollLeft, y: e.clientY - rect.top + containerRef.current.scrollTop });
    }
    setHoverIdx(idx);
  };
  const dHover = hoverIdx !== null ? data.distribuicao[hoverIdx] : null;
  const totalHover = dHover ? dHover.a + (dHover.draw || 0) + dHover.b : 0;
  return (
    <Card>
      <SectionHeader right={<div className="flex items-center gap-2"><PlayerLegend name={a.name} color={a.color} /><PlayerLegend name={b.name} color={b.color} /></div>}>Distribuição Diária de Partidas</SectionHeader>
      <div className="p-5 overflow-x-auto relative" ref={containerRef}>
        <svg width={W} height={H + padBottom} style={{ display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
          {data.distribuicao.map((d, i) => {
            const x = padX + i * barW + 1, w = barW - 2;
            const drawCount = d.draw || 0;
            const aH = (d.a / max) * H, drawH = (drawCount / max) * H, bH = (d.b / max) * H;
            const isHover = hoverIdx === i;
            const opacity = hoverIdx === null || isHover ? 1 : 0.4;
            return (
              <g key={i} style={{ transition: 'opacity 200ms', opacity }}>
                <rect x={x - 1} y={0} width={w + 2} height={H} fill="transparent" style={{ cursor: 'pointer' }} onMouseMove={(e) => handleMouseMove(e, i)} />
                <rect x={x} y={H - bH} width={w} height={bH} fill={b.color} style={{ pointerEvents: 'none' }} />
                {drawH > 0 && <rect x={x} y={H - bH - drawH} width={w} height={drawH} fill={T.fgDimmer} style={{ pointerEvents: 'none' }} />}
                <rect x={x} y={H - bH - drawH - aH} width={w} height={aH} fill={a.color} style={{ pointerEvents: 'none' }} />
                <text x={x + barW / 2 - 1} y={H + 18} fontSize="9" fill={isHover ? T.fg : T.fgDimmer} fontWeight={isHover ? 600 : 400} textAnchor="middle" style={{ pointerEvents: 'none', transition: 'fill 200ms' }}>{d.day}</text>
              </g>
            );
          })}
        </svg>
        {dHover && (
          <div className="absolute pointer-events-none rounded-md p-3" style={{ left: Math.min(tooltipPos.x + 14, W - 200), top: Math.max(tooltipPos.y - 10, 10), background: 'rgba(11,15,26,0.96)', border: `1px solid ${T.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 180, zIndex: 20, animation: 'fadeIn 120ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
            <div className="text-[10px] font-semibold tracking-wider mb-2 pb-2 border-b" style={{ color: T.fgDim, borderColor: T.borderLight }}>{formatDate(dHover.dateFull)}</div>
            <div className="space-y-1.5">
              {[{ name: a.name, color: a.color, val: dHover.a }, { name: 'Empate', color: T.fgDimmer, val: dHover.draw || 0 }, { name: b.name, color: b.color, val: dHover.b }].map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5" style={{ color: T.fgDim }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} /><span className="uppercase tracking-wider text-[10px] font-semibold">{item.name}</span></span>
                  <span className="font-mono"><span className="font-bold" style={{ color: item.color }}>{item.val}</span><span className="ml-1 text-[10px]" style={{ color: T.fgDim }}>({totalHover > 0 ? ((item.val / totalHover) * 100).toFixed(1) : '0.0'}%)</span></span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs" style={{ borderColor: T.borderLight }}>
              <span className="uppercase tracking-wider text-[10px] font-semibold" style={{ color: T.fg }}>Total</span>
              <span className="font-bold font-mono" style={{ color: T.fg }}>{totalHover}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// MEDIA MOVEL
// ============================================================

function MediaMovel({ data }) {
  const a = data.player_a, b = data.player_b;
  const serie = data.media_movel;
  const [hoverIdx, setHoverIdx] = useState(null);
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  if (!serie || serie.length === 0) return <Card><SectionHeader>Média de pontos (Média Móvel)</SectionHeader><div className="px-5 py-12 text-center text-sm" style={{ color: T.fgDim }}>Sem partidas para os filtros aplicados</div></Card>;
  const W = 980, H = 220, padX = 40, padY = 20;
  const innerW = W - padX * 2, innerH = H - padY * 2;
  const allValues = serie.flatMap(d => [d.a, d.b, d.total]);
  const yMax = Math.max(...allValues) * 1.1, yMin = 0;
  const totalColor = '#166534', totalDotColor = T.accent;
  const yToScreen = (v) => padY + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const xToScreen = (i) => padX + (i / Math.max(1, serie.length - 1)) * innerW;
  const path = (key) => serie.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xToScreen(i)} ${yToScreen(d[key])}`).join(' ');
  const gridY = [30, 60, 90, 120].filter(v => v <= yMax);
  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left - padX) / innerW;
    const idx = Math.round(ratio * (serie.length - 1));
    if (idx >= 0 && idx < serie.length) setHoverIdx(idx); else setHoverIdx(null);
  };
  const dHover = hoverIdx !== null ? serie[hoverIdx] : null;
  const xHover = hoverIdx !== null ? xToScreen(hoverIdx) : 0;
  const tooltipOnRight = xHover < W / 2;
  return (
    <Card>
      <SectionHeader>Média de pontos (Média Móvel)</SectionHeader>
      <div className="p-5 overflow-x-auto relative" ref={containerRef}>
        <svg ref={svgRef} width={W} height={H} style={{ display: 'block', cursor: 'crosshair' }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
          {gridY.map((g, i) => {
            const y = yToScreen(g);
            return <g key={i}><line x1={padX} y1={y} x2={W - padX} y2={y} stroke={T.borderLight} strokeDasharray="2 4" /><text x={padX - 8} y={y + 3} fontSize="10" fill={T.fgDimmer} textAnchor="end">{g}</text></g>;
          })}
          <path d={path('total')} stroke={totalColor} strokeWidth="2" fill="none" />
          <path d={path('a')} stroke={a.color} strokeWidth="1.5" fill="none" />
          <path d={path('b')} stroke={b.color} strokeWidth="1.5" fill="none" />
          {dHover && (
            <g style={{ pointerEvents: 'none' }}>
              <line x1={xHover} y1={padY} x2={xHover} y2={padY + innerH} stroke={T.fgDim} strokeWidth="1" opacity="0.5" />
              <circle cx={xHover} cy={yToScreen(dHover.total)} r="4" fill={totalDotColor} stroke={T.bg2} strokeWidth="2" />
              <circle cx={xHover} cy={yToScreen(dHover.a)} r="4" fill={a.color} stroke={T.bg2} strokeWidth="2" />
              <circle cx={xHover} cy={yToScreen(dHover.b)} r="4" fill={b.color} stroke={T.bg2} strokeWidth="2" />
            </g>
          )}
        </svg>
        {dHover && (() => {
          const yTotal = yToScreen(dHover.total);
          const yMid = (yTotal + yToScreen(dHover.a) + yToScreen(dHover.b)) / 3;
          const tooltipH = 110;
          const topClamped = Math.max(8, Math.min(H - tooltipH - 8, yMid - tooltipH / 2));
          return (
            <div className="absolute pointer-events-none rounded-md p-2.5" style={{ left: tooltipOnRight ? xHover + 16 : xHover - 180, top: topClamped, background: 'rgba(11,15,26,0.96)', border: `1px solid ${T.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 170, zIndex: 20, animation: 'fadeIn 100ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
              <div className="text-[11px] mb-1.5" style={{ color: T.fgDim }}>Janela de {hoverIdx + 5} partidas</div>
              <div className="space-y-1">
                {[{ label: 'Total', color: totalDotColor, val: dHover.total }, { label: a.name, color: a.color, val: dHover.a }, { label: b.name, color: b.color, val: dHover.b }].map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: item.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />{item.label}</span>
                    <span className="font-mono font-bold" style={{ color: item.color }}>{item.val.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
      <div className="flex items-center justify-center gap-2 px-5 pb-4">
        <PlayerLegend name={a.name} color={a.color} /><PlayerLegend name={b.name} color={b.color} /><PlayerLegend name="Total" color={totalDotColor} />
      </div>
    </Card>
  );
}

// ============================================================
// HISTORICO DE PARTIDAS
// ============================================================

function HistoricoPartidas({ data }) {
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(0);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const pageSizeRef = useRef(null);
  useEffect(() => { setPage(0); }, [data.historico]);
  useEffect(() => {
    function handle(e) { if (pageSizeRef.current && !pageSizeRef.current.contains(e.target)) setPageSizeOpen(false); }
    if (pageSizeOpen) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [pageSizeOpen]);
  if (!data.historico || data.historico.length === 0) return <Card><SectionHeader>Histórico de Partidas</SectionHeader><div className="px-5 py-12 text-center text-sm" style={{ color: T.fgDim }}>Sem partidas para os filtros aplicados</div></Card>;
  const totalPages = Math.max(1, Math.ceil(data.historico.length / pageSize));
  const pageAtual = Math.max(0, Math.min(page, totalPages - 1));
  const inicio = pageAtual * pageSize, fim = Math.min(inicio + pageSize, data.historico.length);
  const pageData = data.historico.slice(inicio, fim);
  const changePageSize = (n) => { setPageSize(n); setPage(0); setPageSizeOpen(false); };
  return (
    <Card>
      <SectionHeader>Histórico de Partidas</SectionHeader>
      <div className={pageSize > 5 ? 'overflow-y-auto mike-scroll' : ''} style={pageSize > 5 ? { maxHeight: 5 * 73 } : {}}>
        {pageData.map((m, i) => {
          const venceuA = m.vencedor === 'a';
          return (
            <div key={`${inicio + i}`} className="grid items-center px-5 py-3.5 border-t mike-row-hover" style={{ gridTemplateColumns: '40px 1fr 160px 1fr 40px', borderColor: T.borderLight }}>
              <div className="grid place-items-center w-7 h-7 rounded text-xs font-bold" style={{ background: venceuA ? T.green : T.red, color: '#fff' }}>{venceuA ? 'V' : 'D'}</div>
              <div className="text-right pr-4"><div className="text-sm font-semibold leading-tight" style={{ color: T.fg }}>{m.a_name}</div><div className="text-[11px] leading-tight" style={{ color: T.fgDim }}>{m.a_team}</div></div>
              <div className="text-center">
                <div className="text-[11px] mb-1" style={{ color: T.fgDimmer }}>{m.date}</div>
                <div className="inline-flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-base font-bold min-w-[28px] text-center" style={{ background: venceuA ? `${T.accent}30` : `${T.red}30`, color: venceuA ? T.accent : T.red }}>{m.a_score}</span>
                  <span className="text-xs" style={{ color: T.fgDimmer }}>:</span>
                  <span className="px-2 py-0.5 rounded text-base font-bold min-w-[28px] text-center" style={{ background: !venceuA ? `${T.accent}30` : `${T.red}30`, color: !venceuA ? T.accent : T.red }}>{m.b_score}</span>
                </div>
                <div className="text-[11px] font-mono" style={{ color: T.fgDim }}>HT {m.a_ht} : {m.b_ht}</div>
              </div>
              <div className="text-left pl-4"><div className="text-sm font-semibold leading-tight" style={{ color: T.fg }}>{m.b_name}</div><div className="text-[11px] leading-tight" style={{ color: T.fgDim }}>{m.b_team}</div></div>
              <div className="grid place-items-center w-7 h-7 rounded text-xs font-bold ml-auto" style={{ background: !venceuA ? T.green : T.red, color: '#fff' }}>{!venceuA ? 'V' : 'D'}</div>
            </div>
          );
        })}
        {pageSize === 5 && pageData.length < pageSize && Array.from({ length: pageSize - pageData.length }).map((_, i) => (
          <div key={`empty-${i}`} className="px-5 py-3.5 border-t" style={{ borderColor: T.borderLight, height: 73 }}>&nbsp;</div>
        ))}
      </div>
      <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: T.border }}>
        <div className="relative" ref={pageSizeRef}>
          <button onClick={() => setPageSizeOpen(o => !o)} className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs transition-colors"
            style={{ background: pageSizeOpen ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${pageSizeOpen ? T.accent : T.borderLight}`, color: T.fg }}>
            {pageSize} Linhas<ChevronDown size={12} style={{ color: T.fgDim, transform: pageSizeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }} />
          </button>
          {pageSizeOpen && (
            <div className="absolute left-0 bottom-full mb-1 rounded-md overflow-hidden" style={{ background: T.bg2, border: `1px solid ${T.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', animation: 'fadeIn 180ms cubic-bezier(0.22, 1, 0.36, 1)', minWidth: 100 }}>
              {[5, 10, 20].map(n => <button key={n} onClick={() => changePageSize(n)} className="w-full px-3 py-1.5 text-xs text-left transition-colors hover:bg-white/5" style={{ color: pageSize === n ? T.accent : T.fg, background: pageSize === n ? 'rgba(16,185,129,0.08)' : 'transparent' }}>{n} Linhas</button>)}
            </div>
          )}
        </div>
        <div className="text-xs" style={{ color: T.fgDim }}>Exibindo <span style={{ color: T.fg, fontWeight: 600 }}>{inicio + 1} - {fim}</span> ({data.historico.length})</div>
        <div className="flex gap-1">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageAtual === 0} className="w-7 h-7 rounded grid place-items-center transition-colors" style={{ border: `1px solid ${T.borderLight}`, background: pageAtual === 0 ? 'transparent' : 'rgba(255,255,255,0.04)', cursor: pageAtual === 0 ? 'not-allowed' : 'pointer', opacity: pageAtual === 0 ? 0.4 : 1 }}><ChevronLeft size={12} style={{ color: T.fgDim }} /></button>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={pageAtual >= totalPages - 1} className="w-7 h-7 rounded grid place-items-center transition-colors" style={{ background: pageAtual >= totalPages - 1 ? 'rgba(255,255,255,0.04)' : T.accent, border: pageAtual >= totalPages - 1 ? `1px solid ${T.borderLight}` : 'none', cursor: pageAtual >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: pageAtual >= totalPages - 1 ? 0.4 : 1 }}><ChevronRight size={12} style={{ color: pageAtual >= totalPages - 1 ? T.fgDim : '#04130c' }} /></button>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// HISTORICO DE CONFRONTOS
// ============================================================

function HistoricoConfrontos({ data }) {
  const a = data.player_a, b = data.player_b, m = data.matchup_summary;
  if (data.total === 0) return (
    <Card>
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: T.border, background: 'rgba(255,255,255,0.015)' }}>
        <div className="inline-flex items-center gap-2"><Trophy size={14} style={{ color: T.yellow }} /><span className="text-[13px] font-semibold" style={{ color: T.fg }}>Histórico de Confrontos {a.name} vs {b.name}</span></div>
      </div>
      <div className="px-5 py-12 text-center text-sm" style={{ color: T.fgDim }}>Sem partidas para os filtros aplicados</div>
    </Card>
  );
  return (
    <Card>
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: T.border, background: 'rgba(255,255,255,0.015)' }}>
        <div className="inline-flex items-center gap-2"><Trophy size={14} style={{ color: T.yellow }} /><span className="text-[13px] font-semibold" style={{ color: T.fg }}>Histórico de Confrontos {a.name} vs {b.name}</span></div>
        <div className="inline-flex items-center gap-1.5 text-xs" style={{ color: T.fgDim }}><Activity size={12} />3 de maio de 2026</div>
      </div>
      <div className="grid grid-cols-2 gap-6 p-6">
        <div>
          <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold mb-2" style={{ color: T.accent }}><Activity size={13} />Visão Geral</h4>
          <p className="text-sm leading-relaxed" style={{ color: T.fgDim }}>Análise histórica dos confrontos entre <strong style={{ color: a.color }}>{a.name}</strong> e <strong style={{ color: b.color }}>{b.name}</strong>. A rivalidade inclui <strong style={{ color: T.fg }}>{m.total}</strong> partidas em diversos torneios, com o encontro mais recente em 3 de maio de 2026.</p>
          <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold mt-4 mb-2" style={{ color: T.accent }}><TrendingUp size={13} />Performance</h4>
          <p className="text-sm leading-relaxed" style={{ color: T.fgDim }}>No histórico de confrontos diretos, <strong style={{ color: a.color }}>{a.name}</strong> conquistou <strong style={{ color: T.fg }}>{m.pct_a}%</strong> das vitórias, enquanto <strong style={{ color: b.color }}>{b.name}</strong> mantém <strong style={{ color: T.fg }}>{m.pct_b}%</strong> de aproveitamento nos duelos.</p>
        </div>
        <div>
          <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold mb-2" style={{ color: T.accent }}><BarChart size={13} />Estatísticas Detalhadas</h4>
          <p className="text-sm leading-relaxed" style={{ color: T.fgDim }}>Na análise do primeiro quarto, <strong style={{ color: a.color }}>{a.name}</strong> vence <strong style={{ color: T.fg }}>48.69%</strong> dos quartos iniciais, enquanto conquista <strong style={{ color: T.fg }}>43.73%</strong> dos primeiros quartos.</p>
          <p className="text-sm leading-relaxed mt-3" style={{ color: T.fgDim }}>Quando perde o primeiro quarto, <strong style={{ color: a.color }}>{a.name}</strong> demonstrou <strong style={{ color: T.fg }}>{data.comeback_a}%</strong> de sucesso em recuperação, comparado aos <strong style={{ color: T.fg }}>{data.comeback_b}%</strong> de performance de recuperação de <strong style={{ color: b.color }}>{b.name}</strong>.</p>
          <div className="mt-4 flex items-center gap-2 justify-end">
            {[Share2, Facebook, MessageCircle, Send, Twitter].map((Icon, i) => (
              <button key={i} className="w-8 h-8 rounded grid place-items-center" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderLight}` }}><Icon size={13} style={{ color: T.fgDim }} /></button>
            ))}
          </div>
        </div>
      </div>
      <div className="px-6 pb-5">
        <div className="px-3 py-2 rounded text-xs italic" style={{ color: T.fgDimmer, background: 'rgba(255,255,255,0.02)' }}>* Estatísticas baseadas em dados abrangentes de partidas de NBA 2K incluindo placares, períodos e métricas de performance.</div>
      </div>
    </Card>
  );
}

// ============================================================
// FOOTER
// ============================================================

function Footer() {
  const cols = [
    { titulo: 'Ferramentas', icon: '🔧', items: ['Partidas de hoje','Ao Vivo','Mercado de Bots','Bots'] },
    { titulo: 'Estatísticas', icon: '📊', items: ['e-Soccer','e-Basket','e-Hockey','e-NFL','Tênis de Mesa','Counter-Strike 2 (CS2)','Tênis'] },
    { titulo: 'Tabelas', icon: '🏆', items: ['e-Soccer','e-Basket','e-Hockey','e-NFL','Tênis de Mesa'] },
    { titulo: 'Extras', icon: '✨', items: ['Ver Planos','Blog','Políticas e Termos','Status'] },
    { titulo: 'Contato', icon: '✉', items: ['FAQ','contato@tipmike.net','Instagram'] },
  ];
  return (
    <footer className="mt-12 pt-10 pb-6 border-t" style={{ borderColor: T.border }}>
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded grid place-items-center font-bold" style={{ background: T.accent, color: '#04130c' }}>M</div>
          <span className="font-bold tracking-wider" style={{ color: T.fg }}>TIPMIKE</span>
        </div>
        <p className="text-xs max-w-md mx-auto" style={{ color: T.fgDim }}>O TipMike é uma plataforma avançada de análise esportiva que oferece estatísticas detalhadas, análises em tempo real e insights profundos para apostadores e entusiastas do esporte.</p>
      </div>
      <div className="grid grid-cols-5 gap-6 px-6">
        {cols.map((c, i) => (
          <div key={i}>
            <div className="text-xs font-semibold mb-3" style={{ color: T.fg }}>{c.icon} {c.titulo}</div>
            <ul className="space-y-1.5">{c.items.map((item, j) => <li key={j} className="text-xs cursor-pointer hover:opacity-80" style={{ color: T.fgDim }}>{item}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="mt-8 pt-5 text-center text-xs border-t" style={{ borderColor: T.border, color: T.fgDimmer }}>© 2026 TipMike. Todos os direitos reservados.</div>
    </footer>
  );
}

// ============================================================
// DRAWERS
// ============================================================

function Drawer({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)', animation: 'fadeIn 220ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
      <div className="fixed top-0 right-0 bottom-0 z-50 flex flex-col" style={{ width: 380, background: T.bg2, borderLeft: `1px solid ${T.border}`, animation: 'slideInRight 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: T.border }}>
          <h2 className="text-base font-bold" style={{ color: T.fg }}>{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded grid place-items-center hover:opacity-70" style={{ color: T.fgDim }}><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">{children}</div>
        {footer && <div className="border-t p-6" style={{ borderColor: T.border }}>{footer}</div>}
      </div>
    </>
  );
}

function SimpleDropdown({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="w-full inline-flex items-center justify-between px-3 h-9 rounded-md text-sm transition-colors"
        style={{ background: open ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${open ? T.accent : T.borderLight}`, color: value ? T.fg : T.fgDim }}>
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={14} style={{ color: T.fgDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 rounded-md overflow-hidden z-10" style={{ background: T.bg2, border: `1px solid ${T.border}`, boxShadow: '0 12px 32px rgba(0,0,0,0.5)', animation: 'fadeIn 180ms cubic-bezier(0.22, 1, 0.36, 1)', maxHeight: 240, overflowY: 'auto' }}>
          {options.map(opt => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} className="w-full px-3 py-2 text-sm text-left transition-colors hover:bg-white/5"
              style={{ color: opt === value ? T.accent : T.fg, background: opt === value ? 'rgba(16,185,129,0.08)' : 'transparent' }}>
              <span className="inline-flex items-center gap-2">{opt === value && <span className="w-1 h-1 rounded-full" style={{ background: T.accent }} />}{opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const HORAS = Array.from({ length: 25 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const VERSOES_JOGO = ['Todas as versões', 'Última versão'];

function DrawerFiltros({ open, onClose, onAplicar, filtrosAtuais }) {
  const [janela, setJanela] = useState('Todas');
  const [campeonatos, setCampeonatos] = useState(['Adriatic League']);
  const [versao, setVersao] = useState('Todas as versões');
  const [horaInicio, setHoraInicio] = useState('00:00');
  const [horaFim, setHoraFim] = useState('24:00');
  useEffect(() => {
    if (open && filtrosAtuais) {
      setJanela(filtrosAtuais.janela || 'Todas');
      setCampeonatos(filtrosAtuais.campeonatos || ['Adriatic League']);
      setVersao(filtrosAtuais.versao || 'Todas as versões');
      setHoraInicio(filtrosAtuais.horaInicio || '00:00');
      setHoraFim(filtrosAtuais.horaFim || '24:00');
    }
  }, [open, filtrosAtuais]);
  const toggleCamp = (c) => setCampeonatos(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const reset = () => { setJanela('Todas'); setCampeonatos([]); setVersao('Todas as versões'); setHoraInicio('00:00'); setHoraFim('24:00'); };
  const aplicar = () => { if (onAplicar) onAplicar({ janela, campeonatos, versao, horaInicio, horaFim }); onClose(); };
  const horaInvalida = HORAS.indexOf(horaFim) <= HORAS.indexOf(horaInicio);
  return (
    <Drawer open={open} onClose={onClose} title="Filtros" footer={
      <div className="grid grid-cols-2 gap-3">
        <MikeButton variant="outline" onClick={reset}>Resetar</MikeButton>
        <button onClick={aplicar} disabled={horaInvalida} className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-all"
          style={{ background: horaInvalida ? 'rgba(16,185,129,0.25)' : T.accent, color: horaInvalida ? 'rgba(4,19,12,0.5)' : '#04130c', border: `1px solid ${horaInvalida ? 'rgba(16,185,129,0.25)' : T.accent}`, cursor: horaInvalida ? 'not-allowed' : 'pointer' }}>
          Aplicar
        </button>
      </div>
    }>
      <div className="space-y-2"><label className="text-sm font-medium" style={{ color: T.fg }}>Versão do jogo</label><SimpleDropdown value={versao} options={VERSOES_JOGO} onChange={setVersao} /></div>
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: T.fg }}>Partidas analisadas</label>
        <div className="flex flex-wrap gap-2">{['Todas', 'Última hora'].map(v => <Pill key={v} active={janela === v} onClick={() => setJanela(v)}>{v}</Pill>)}</div>
        <div className="flex flex-wrap gap-2 pt-1">{['Últimas 8 horas', 'Últimas 24 horas', 'Últimos 7 dias', 'Últimas 30 dias', 'Últimas 60 dias', 'Últimos 90 dias'].map(v => <Pill key={v} active={janela === v} onClick={() => setJanela(v)}>{v}</Pill>)}</div>
        <div className="pt-1"><div className="text-[10px] mb-1.5" style={{ color: T.fgDimmer }}>Quantidade fixa de partidas</div><div className="flex flex-wrap gap-2">{['5','10','15','20','25','30','40','50','100','200'].map(v => <Pill key={v} active={janela === v} onClick={() => setJanela(v)}>{v}</Pill>)}</div></div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: T.fg }}>Campeonatos</label>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 mike-scroll">{['Adriatic League','East','East-West','East-West Conf.','West'].map(c => <Pill key={c} active={campeonatos.includes(c)} onClick={() => toggleCamp(c)}>{c}</Pill>)}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: T.fg }}>Hora da partida</label>
        <div className="grid grid-cols-2 gap-2"><SimpleDropdown value={horaInicio} options={HORAS.slice(0, -1)} onChange={setHoraInicio} /><SimpleDropdown value={horaFim} options={HORAS.slice(1)} onChange={setHoraFim} /></div>
        {horaInvalida && <div className="text-[11px] mt-1" style={{ color: T.red }}>Hora final deve ser maior que a inicial</div>}
        <div className="text-[11px]" style={{ color: T.fgDim }}>Janela: {horaInicio} até {horaFim}</div>
      </div>
    </Drawer>
  );
}

const TORNEIOS_NBA2K = [
  { id: 43, nome: 'Adriatic - NextGen' },
  { id: 5,  nome: 'Battle (NBA2K)' },
  { id: 7,  nome: 'H2H GG League' },
  { id: 50, nome: 'Live NBA' },
];

const JOGADORES_POR_TORNEIO = {
  43: ['Valencia','Bangkok','Belgrade','Mumbai','Moscow','Athens','Sevilla','Dublin','Krakow','Amsterdam','Tokyo','Berlin','Paris','Madrid','Rome','Lisbon','Vienna','Prague','Warsaw','Budapest','Helsinki','Oslo','Stockholm','Copenhagen','Dubai','Cairo','Lagos','Nairobi','Mexico','Lima','Bogota','Caracas','Santiago','Buenos Aires','Sao Paulo','Rio','Brasilia','Salvador','Recife','Manaus','Belem','Fortaleza','Curitiba','Porto Alegre','Florianopolis','Goiania','Brasilia','Campinas','Vitoria','Natal','Maceio','Joao Pessoa','Teresina','Aracaju','Cuiaba','Campo Grande','Macapa','Boa Vista','Palmas','Rio Branco','Porto Velho'],
  5:  ['Player A','Player B','Player C','Player D'],
  7:  ['Mike','Steve','John','Dave','Carl','Bob'],
  50: ['LeBron','Curry','Durant','Giannis','Embiid','Jokic'],
};

function ComboboxDrawer({ label, value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);
  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-2" ref={ref}>
      <label className="text-sm font-medium" style={{ color: T.fg }}>{label}</label>
      <div className="relative">
        <div className="flex gap-2">
          <button onClick={() => setOpen(o => !o)} className="flex-1 inline-flex items-center justify-between px-3 h-9 rounded-md text-sm text-left transition-colors"
            style={{ background: open ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${open ? T.accent : T.borderLight}`, color: value ? T.fg : T.fgDim }}>
            <span className="truncate">{value || placeholder}</span>
            <ChevronDown size={14} style={{ color: T.fgDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }} />
          </button>
          {value && !open && (
            <button onClick={(e) => { e.stopPropagation(); onChange(''); }} className="w-9 h-9 rounded-md grid place-items-center hover:opacity-70" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderLight}` }}>
              <X size={14} style={{ color: T.fgDim }} />
            </button>
          )}
        </div>
        {open && (
          <div className="absolute left-0 right-0 top-full mt-1.5 rounded-md overflow-hidden z-10" style={{ background: T.bg2, border: `1px solid ${T.border}`, boxShadow: '0 12px 32px rgba(0,0,0,0.5)', animation: 'fadeIn 180ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
            {options.length > 5 && (
              <div className="relative border-b" style={{ borderColor: T.borderLight }}>
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.fgDim }} />
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar..." className="w-full h-9 pl-9 pr-3 text-sm outline-none bg-transparent" style={{ color: T.fg }} />
              </div>
            )}
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-xs text-center" style={{ color: T.fgDim }}>Nenhum resultado</div>
              ) : filtered.map(opt => (
                <button key={opt} onClick={() => { onChange(opt); setOpen(false); setQuery(''); }} className="w-full px-3 py-2 text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: opt === value ? T.accent : T.fg, background: opt === value ? 'rgba(16,185,129,0.08)' : 'transparent' }}>
                  <span className="inline-flex items-center gap-2">{opt === value && <span className="w-1 h-1 rounded-full" style={{ background: T.accent }} />}{opt}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DrawerAlterarJogadores({ open, onClose, onAplicar, torneioInicial, jog1Inicial, jog2Inicial }) {
  const [torneio, setTorneio] = useState(torneioInicial || 'Adriatic - NextGen');
  const [jog1, setJog1] = useState(jog1Inicial || 'Valencia');
  const [jog2, setJog2] = useState(jog2Inicial || 'Bangkok');
  useEffect(() => {
    if (open) { setTorneio(torneioInicial || 'Adriatic - NextGen'); setJog1(jog1Inicial || ''); setJog2(jog2Inicial || ''); }
  }, [open, torneioInicial, jog1Inicial, jog2Inicial]);
  const torneioObj = TORNEIOS_NBA2K.find(t => t.nome === torneio);
  const jogadoresDisponiveis = torneioObj ? JOGADORES_POR_TORNEIO[torneioObj.id] || [] : [];
  useEffect(() => {
    if (torneio && jog1 && !jogadoresDisponiveis.includes(jog1)) setJog1('');
    if (torneio && jog2 && !jogadoresDisponiveis.includes(jog2)) setJog2('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneio]);
  const podeAnalisar = torneio && jog1 && (jog2 === '' || jog1 !== jog2);
  const aplicar = () => { if (!podeAnalisar) return; if (onAplicar) onAplicar({ torneio, jog1, jog2 }); onClose(); };
  const modoSoloPreview = !jog2;
  return (
    <Drawer open={open} onClose={onClose} title="Alterar Jogadores" footer={
      <div className="grid grid-cols-2 gap-3">
        <MikeButton variant="outline" onClick={onClose}>Cancelar</MikeButton>
        <button onClick={aplicar} disabled={!podeAnalisar} className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-all"
          style={{ background: podeAnalisar ? T.accent : 'rgba(16,185,129,0.25)', color: podeAnalisar ? '#04130c' : 'rgba(4,19,12,0.5)', border: `1px solid ${podeAnalisar ? T.accent : 'rgba(16,185,129,0.25)'}`, cursor: podeAnalisar ? 'pointer' : 'not-allowed' }}>
          Analisar
        </button>
      </div>
    }>
      <ComboboxDrawer label="Torneios" value={torneio} options={TORNEIOS_NBA2K.map(t => t.nome)} onChange={setTorneio} placeholder="Selecione um torneio" />
      <ComboboxDrawer label="Jogador 1" value={jog1} options={jogadoresDisponiveis.filter(j => j !== jog2)} onChange={setJog1} placeholder={torneio ? 'Selecione jogador 1' : 'Selecione um torneio primeiro'} />
      <ComboboxDrawer label="Jogador 2" value={jog2} options={jogadoresDisponiveis.filter(j => j !== jog1)} onChange={setJog2} placeholder="Selecione jogador 2 (opcional - vazio = vs Oponentes)" />
      {jog1 && (
        <div className="mt-2 p-3 rounded-md" style={{ background: 'rgba(16,185,129,0.05)', border: `1px solid ${T.borderLight}` }}>
          <div className="text-[11px] mb-2" style={{ color: T.fgDim }}>{modoSoloPreview ? 'Análise solo:' : 'Confronto a analisar:'}</div>
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="font-bold" style={{ color: T.accent }}>{jog1}</span>
            <span className="text-xs tracking-widest" style={{ color: T.fgDimmer }}>VS</span>
            <span className="font-bold" style={{ color: T.accent2 }}>{modoSoloPreview ? 'Oponentes' : jog2}</span>
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function TipMikePartidaIndividual({ partida, onNavegar } = {}) {
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [alterarOpen, setAlterarOpen] = useState(false);

  // Estado dos jogadores — inicializa com a partida recebida do Live.jsx
  const [torneio, setTorneio] = useState('Adriatic - NextGen');
  const [jog1, setJog1] = useState(partida?.jogadorA || 'Valencia');
  const [jog2, setJog2] = useState(partida?.jogadorB || 'Bangkok');

  // Atualiza quando a prop partida mudar (navegação entre partidas sem remontar)
  useEffect(() => {
    if (partida?.jogadorA) setJog1(partida.jogadorA);
    if (partida?.jogadorB) setJog2(partida.jogadorB);
  }, [partida?.jogadorA, partida?.jogadorB]);

  const [filtros, setFiltros] = useState({
    janela: 'Todas', campeonatos: ['Adriatic League'], versao: 'Todas as versões',
    horaInicio: '00:00', horaFim: '24:00', timeA: null, timeB: null,
  });

  useEffect(() => { setFiltros(f => ({ ...f, timeA: null, timeB: null })); }, [jog1, jog2]);

  const { data, loading: loadingData } = useDadosPartida(jog1 || 'Valencia', jog2, filtros);

  const aplicarJogadores = ({ torneio: t, jog1: j1, jog2: j2 }) => { setTorneio(t); setJog1(j1); setJog2(j2); };
  const aplicarFiltrosHandler = (novosFiltros) => { setFiltros(novosFiltros); };

  const filtrosAtivos = (
    (filtros.janela !== 'Todas' ? 1 : 0) +
    (filtros.versao !== 'Todas as versões' ? 1 : 0) +
    (filtros.horaInicio !== '00:00' || filtros.horaFim !== '24:00' ? 1 : 0) +
    (filtros.campeonatos.length !== 1 || filtros.campeonatos[0] !== 'Adriatic League' ? 1 : 0) +
    (filtros.timeA ? 1 : 0) + (filtros.timeB ? 1 : 0)
  );

  return (
    <div style={{ background: T.bg, color: T.fg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        body { background: ${T.bg}; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${T.bg2}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.fgDimmer}; }
        .mike-scroll::-webkit-scrollbar { width: 4px; }
        .mike-scroll::-webkit-scrollbar-track { background: transparent; }
        .mike-scroll::-webkit-scrollbar-thumb { background: rgba(60,85,130,0.35); border-radius: 2px; }
        .mike-scroll::-webkit-scrollbar-thumb:hover { background: rgba(60,85,130,0.6); }
        .mike-scroll { scrollbar-width: thin; scrollbar-color: rgba(60,85,130,0.35) transparent; }
        .mike-row-hover { transition: background-color 140ms cubic-bezier(0.22, 1, 0.36, 1); }
        .mike-row-hover:hover { background-color: rgba(80, 110, 160, 0.10) !important; }
      `}</style>

      <Header onNavegar={onNavegar} />

      {(loadingData || !data) && (
        <main className="max-w-[1280px] mx-auto px-6 py-12 flex flex-col items-center justify-center gap-3" style={{ minHeight: '60vh' }}>
          <svg className="w-8 h-8 animate-spin" style={{ color: T.accent }} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <p className="text-sm" style={{ color: T.fgDim }}>Carregando análise...</p>
        </main>
      )}

      {!loadingData && data && (
        <main className="max-w-[1280px] mx-auto px-6 py-5 space-y-4">
          <nav className="flex items-center gap-2 text-xs" style={{ color: T.fgDim }}>
            <Home size={12} /><span>Início</span><ChevronRight size={12} /><span>NBA 2K</span><ChevronRight size={12} />
            <span style={{ color: T.fg, fontWeight: 600 }}>{data.modoSolo ? data.player_a.name : `${data.player_a.name} vs ${data.player_b.name}`}</span>
          </nav>

          <HeroCard data={data} onAlterar={() => setAlterarOpen(true)} onFiltros={() => setFiltrosOpen(true)} filtrosAtivos={filtrosAtivos}
            timeASelecionado={filtros.timeA} timeBSelecionado={filtros.timeB}
            onChangeTimeA={(time) => setFiltros(f => ({ ...f, timeA: time }))}
            onChangeTimeB={(time) => setFiltros(f => ({ ...f, timeB: time }))} />

          <StatsCardRow data={data} />

          <div className="grid grid-cols-2 gap-4">
            <OverUnderPartida data={data} />
            <HandicapAsiatico data={data} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <OverUnderJogador player={data.player_a} data={data.ou_jogador_a} />
            <OverUnderJogador player={data.player_b} data={data.ou_jogador_b} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <MediaPontos data={data} />
            <EstatisticasPartida data={data} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <AnaliseTimes player={data.player_a} data={data.times_a} />
            <AnaliseTimes player={data.player_b} data={data.times_b} />
          </div>

          <MediaUltimas data={data} />
          <DistribuicaoDiaria data={data} />
          <MediaMovel data={data} />
          <HistoricoPartidas data={data} />
          <HistoricoConfrontos data={data} />
          <Footer />
        </main>
      )}

      <DrawerFiltros open={filtrosOpen} onClose={() => setFiltrosOpen(false)} filtrosAtuais={filtros} onAplicar={aplicarFiltrosHandler} />
      <DrawerAlterarJogadores open={alterarOpen} onClose={() => setAlterarOpen(false)} torneioInicial={torneio} jog1Inicial={jog1} jog2Inicial={jog2} onAplicar={aplicarJogadores} />
    </div>
  );
}