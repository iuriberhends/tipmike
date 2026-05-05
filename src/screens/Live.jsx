import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search, Bell, Settings, ChevronDown, ChevronUp, Home, Activity, Store, Bot, Table2, BarChart3, Plus,
  Clock, ExternalLink, X, FilterX, Gamepad2, Disc, Snowflake, CircleDot, Zap, Check, Wifi, Flame, AlertCircle,
  RefreshCw
} from 'lucide-react';

// ============================================================
// MOCK DATA - PARTIDAS LIVE
// ============================================================
const MOCK_LIVE = [
  // ======= E-SOCCER =======
  {
    id: 1, esporte: 'e-Soccer', liga: 'GT League', subliga: 'La Liga', timer: '09:29',
    historico: '825 partidas, Última: 02/05/2026',
    jogadorA: 'David', timeA: 'Villarreal',
    jogadorB: 'Jack', timeB: 'Atl. Bilbao',
    placarA: 0, placarB: 0,
    stats: { ataquesA: 23, ataquesB: 33, finalA: 0, finalB: 0, escantA: 0, escantB: 0,
             cartoesA: ['amarelo','vermelho'], cartoesB: ['amarelo','vermelho'] },
    mercados: [
      { nome: 'Handicap Asiático', linhas: [
        { sel: '0 David', odd: 2.10, ult10: 30.0, total: 31.9 },
        { sel: '0 Jack', odd: 1.65, ult10: 60.0, total: 42.2 },
      ]},
      { nome: 'Handicap Asiático 1º Tempo', linhas: [
        { sel: '0 David', odd: 2.20, ult10: 30.0, total: 33.5 },
        { sel: '0 Jack', odd: 1.62, ult10: 60.0, total: 41.0 },
      ]},
      { nome: 'Linhas Asiáticas +/-', linhas: [
        { sel: 'Over 2.5', odd: 1.74, ult10: 70.0, total: 65.4 },
        { sel: 'Under 2.5', odd: 1.95, ult10: 30.0, total: 34.6 },
      ]},
      { nome: 'Linhas Asiáticas +/- 1º Tempo', linhas: [
        { sel: 'Over 1.5', odd: 2.10, ult10: 50.0, total: 48.2 },
        { sel: 'Under 1.5', odd: 1.65, ult10: 50.0, total: 51.8 },
      ]},
      { nome: 'Ambos Marcam', linhas: [
        { sel: 'Sim', odd: 2.50, ult10: 40.0, total: 42.0 },
        { sel: 'Não', odd: 1.45, ult10: 60.0, total: 58.0 },
      ]},
      { nome: 'Ambos Marcam 1º Tempo', linhas: [
        { sel: 'Sim', odd: 4.00, ult10: 20.0, total: 18.5 },
        { sel: 'Não', odd: 1.20, ult10: 80.0, total: 81.5 },
      ]},
      { nome: 'Dupla Hipótese', linhas: [
        { sel: 'David ou Empate', odd: 1.45, ult10: 40.0, total: 57.8 },
        { sel: 'David ou Jack', odd: 1.20, ult10: 90.0, total: 74.1 },
        { sel: 'Empate ou Jack', odd: 1.30, ult10: 70.0, total: 68.1 },
      ]},
      { nome: 'Resultado Final', linhas: [
        { sel: 'David', odd: 4.33, ult10: 30.0, total: 31.9 },
        { sel: 'Empate', odd: 1.73, ult10: 10.0, total: 25.9 },
        { sel: 'Jack', odd: 3.40, ult10: 60.0, total: 42.2 },
      ]},
      { nome: 'Resultado 1º Tempo', linhas: [
        { sel: 'David', odd: 6.00, ult10: 20.0, total: 23.4 },
        { sel: 'Empate', odd: 1.50, ult10: 50.0, total: 48.6 },
        { sel: 'Jack', odd: 4.50, ult10: 30.0, total: 28.0 },
      ]},
      { nome: 'Over/Under', linhas: [
        { sel: 'Over 2.5', odd: 1.74, ult10: 70.0, total: 65.4 },
        { sel: 'Under 2.5', odd: 1.95, ult10: 30.0, total: 34.6 },
      ]},
      { nome: 'Over/Under 1º Tempo', linhas: [
        { sel: 'Over 0.5', odd: 1.50, ult10: 80.0, total: 76.2 },
        { sel: 'Under 0.5', odd: 2.40, ult10: 20.0, total: 23.8 },
      ]},
      { nome: 'Par/Ímpar', linhas: [
        { sel: 'Par', odd: 1.95, ult10: 50.0, total: 50.5 },
        { sel: 'Ímpar', odd: 1.85, ult10: 50.0, total: 49.5 },
      ]},
      { nome: 'Próximo Gol', linhas: [
        { sel: 'David', odd: 3.60, ult10: 39.5, total: 45.7 },
        { sel: 'Jack', odd: 3.00, ult10: 60.5, total: 50.1 },
        { sel: 'Sem Gol', odd: 1.95, ult10: 0.0, total: 4.2 },
      ]},
      { nome: 'Handicap Europeu', linhas: [
        { sel: 'David -1', odd: 5.50, ult10: 20.0, total: 22.4 },
        { sel: 'Empate -1', odd: 3.40, ult10: 30.0, total: 28.8 },
        { sel: 'Jack -1', odd: 1.55, ult10: 50.0, total: 48.8 },
      ]},
      { nome: 'Handicap Europeu 1º Tempo', linhas: [
        { sel: 'David -1', odd: 8.50, ult10: 10.0, total: 12.6 },
        { sel: 'Empate -1', odd: 2.10, ult10: 50.0, total: 47.5 },
        { sel: 'Jack -1', odd: 2.30, ult10: 40.0, total: 39.9 },
      ]},
      { nome: 'Resultado Final/Ambos Marcam', linhas: [
        { sel: 'David / Sim', odd: 8.00, ult10: 10.0, total: 12.5 },
        { sel: 'Empate / Sim', odd: 5.00, ult10: 20.0, total: 18.0 },
        { sel: 'Jack / Sim', odd: 6.50, ult10: 20.0, total: 16.8 },
      ]},
      { nome: 'Resultado 1º Tempo/Ambos Marcam', linhas: [
        { sel: 'David / Sim', odd: 12.00, ult10: 0.0, total: 8.5 },
        { sel: 'Empate / Não', odd: 2.00, ult10: 50.0, total: 47.2 },
        { sel: 'Jack / Sim', odd: 9.00, ult10: 10.0, total: 11.3 },
      ]},
      { nome: 'Jogador - Gols', linhas: [
        { sel: 'Over 1.5', odd: 2.50, ult10: 40.0, total: 38.5 },
        { sel: 'Under 1.5', odd: 1.50, ult10: 60.0, total: 61.5 },
      ]},
      { nome: 'Jogador - Gols 1º Tempo', linhas: [
        { sel: 'Over 0.5', odd: 1.95, ult10: 50.0, total: 47.8 },
        { sel: 'Under 0.5', odd: 1.85, ult10: 50.0, total: 52.2 },
      ]},
      { nome: 'Jogador A - Gols', linhas: [
        { sel: 'Over 0.5', odd: 1.65, ult10: 70.0, total: 68.2 },
        { sel: 'Under 0.5', odd: 2.20, ult10: 30.0, total: 31.8 },
      ]},
      { nome: 'Jogador A - Gols 1º Tempo', linhas: [
        { sel: 'Over 0.5', odd: 2.40, ult10: 40.0, total: 38.5 },
        { sel: 'Under 0.5', odd: 1.55, ult10: 60.0, total: 61.5 },
      ]},
      { nome: 'Jogador B - Gols', linhas: [
        { sel: 'Over 0.5', odd: 1.45, ult10: 70.0, total: 72.4 },
        { sel: 'Under 0.5', odd: 2.60, ult10: 30.0, total: 27.6 },
      ]},
      { nome: 'Jogador B - Gols 1º Tempo', linhas: [
        { sel: 'Over 0.5', odd: 2.20, ult10: 40.0, total: 41.6 },
        { sel: 'Under 0.5', odd: 1.65, ult10: 60.0, total: 58.4 },
      ]},
    ]
  },
  {
    id: 2, esporte: 'e-Soccer', liga: 'ECF (Volta)', subliga: 'Bundesliga', timer: '01:05',
    historico: '1362 partidas, Última: 02/05/2026',
    jogadorA: 'Koss (ECF Volta)', timeA: 'Bor. Dortmund',
    jogadorB: 'Andrew (ECF Volta)', timeB: 'RB Leipzig',
    placarA: 0, placarB: 0,
    stats: { ataquesA: 8, ataquesB: 12, finalA: 0, finalB: 1, escantA: 0, escantB: 0, cartoesA: [], cartoesB: ['amarelo'] },
    mercados: [
      { nome: 'Handicap Asiático', linhas: [
        { sel: '+0.25 Koss (ECF V)', odd: 1.85, ult10: 40.0, total: 54.0 },
        { sel: '-0.25 Andrew (ECF)', odd: 1.85, ult10: 60.0, total: 46.0 },
      ]},
      { nome: 'Partida - Gols 3.75', linhas: [
        { sel: 'Over 3.75', odd: 1.82, ult10: 90.0, total: 77.0 },
        { sel: 'Under 3.75', odd: 1.88, ult10: 10.0, total: 23.0 },
      ]},
      { nome: 'Resultado Final', linhas: [
        { sel: 'Koss (ECF Volta)', odd: 2.75, ult10: 20.0, total: 34.6 },
        { sel: 'Empate', odd: 3.60, ult10: 20.0, total: 19.4 },
        { sel: 'Andrew (ECF V)', odd: 2.10, ult10: 60.0, total: 48.0 },
      ]},
      { nome: 'Próximo Gol', linhas: [
        { sel: 'Koss (ECF Volta)', odd: 2.00, ult10: 33.7, total: 48.0 },
        { sel: 'Andrew (ECF V)', odd: 2.50, ult10: 50.0, total: 45.0 },
        { sel: 'Sem Gol', odd: 6.00, ult10: 16.3, total: 7.0 },
      ]},
    ]
  },
  {
    id: 3, esporte: 'e-Soccer', liga: 'H2H GG League', subliga: null, timer: '02:41',
    historico: '110 partidas, Última: 02/05/2026',
    jogadorA: 'Inferno', timeA: 'Real Madrid', quenteA: true,
    jogadorB: 'Bolt', timeB: 'PSG',
    placarA: 1, placarB: 0,
    stats: { ataquesA: 15, ataquesB: 6, finalA: 1, finalB: 0, escantA: 1, escantB: 0,
             cartoesA: ['amarelo','vermelho'], cartoesB: ['amarelo','vermelho'] },
    mercados: [
      { nome: 'Handicap Asiático', linhas: [
        { sel: '-0.5 Inferno', odd: 1.77, ult10: 40.0, total: 30.9 },
        { sel: '+0.5 Bolt', odd: 1.93, ult10: 60.0, total: 69.1 },
      ]},
      { nome: 'Partida - Gols 3', linhas: [
        { sel: 'Over 3', odd: 1.93, ult10: 55.6, total: 37.4 },
        { sel: 'Under 3', odd: 1.77, ult10: 44.4, total: 62.6 },
      ]},
      { nome: 'Resultado Final', linhas: [
        { sel: 'Inferno', odd: 1.17, ult10: 70.0, total: 60.0 },
        { sel: 'Empate', odd: 6.00, ult10: 20.0, total: 23.6 },
        { sel: 'Bolt', odd: 10.00, ult10: 10.0, total: 16.4 },
      ]},
      { nome: 'Próximo Gol', linhas: [
        { sel: 'Inferno', odd: 1.95, ult10: 50.0, total: 48.0 },
        { sel: 'Bolt', odd: 3.20, ult10: 30.0, total: 35.0 },
        { sel: 'Sem Gol', odd: 5.00, ult10: 20.0, total: 17.0 },
      ]},
    ]
  },
  {
    id: 4, esporte: 'e-Soccer', liga: 'Battle', subliga: 'Premier League', timer: '00:54',
    historico: '24 partidas, Última: 02/05/2026',
    jogadorA: 'Sena', timeA: 'Arsenal', quenteA: true,
    jogadorB: 'Cofi111', timeB: 'Man. City',
    placarA: 1, placarB: 1,
    stats: { ataquesA: 0, ataquesB: 0, finalA: 1, finalB: 0, escantA: 0, escantB: 0, cartoesA: [], cartoesB: [] },
    mercados: [
      { nome: 'Handicap Asiático', linhas: [
        { sel: '-0.25 Sena', odd: 1.80, ult10: 60.0, total: 54.2 },
        { sel: '+0.25 Cofi111', odd: 1.83, ult10: 40.0, total: 45.8 },
      ]},
      { nome: 'Partida - Gols 8.25', linhas: [
        { sel: 'Over 8.25', odd: 1.93, ult10: 30.0, total: 16.7 },
        { sel: 'Under 8.25', odd: 1.77, ult10: 70.0, total: 83.3 },
      ]},
      { nome: 'Resultado Final', linhas: [
        { sel: 'Sena', odd: 1.91, ult10: 60.0, total: 54.2 },
        { sel: 'Empate', odd: 5.50, ult10: 10.0, total: 8.3 },
        { sel: 'Cofi111', odd: 2.40, ult10: 30.0, total: 37.5 },
      ]},
      { nome: 'Próximo Gol', linhas: [
        { sel: 'Sena', odd: 2.00, ult10: 55.0, total: 50.0 },
        { sel: 'Cofi111', odd: 2.50, ult10: 35.0, total: 38.0 },
        { sel: 'Sem Gol', odd: 4.00, ult10: 10.0, total: 12.0 },
      ]},
    ]
  },
  // ======= E-BASKET (NBA2K) =======
  {
    id: 10, esporte: 'e-Basket', liga: 'H2H GG League', subliga: 'Ebasketball 3', timer: '04:40', quarter: 'Q4',
    historico: '5 partidas, Última: 13/03/2026',
    jogadorA: 'Domain', timeA: 'BKN Nets',
    jogadorB: 'Airforce', timeB: 'MIA Heat',
    placarA: 35, placarB: 39,
    stats: null,
    mercados: [
      { nome: 'Handicap Asiático', linhas: [
        { sel: '+4.5 Domain', odd: 1.87, ult10: 40.0, total: 40.0 },
        { sel: '-4.5 Airforce', odd: 1.80, ult10: 60.0, total: 60.0 },
      ]},
      { nome: 'Resultado Final', linhas: [
        { sel: 'Domain', odd: 3.90, ult10: 0.0, total: 0.0 },
        { sel: 'Empate', odd: null, ult10: 0.0, total: 0.0 },
        { sel: 'Airforce', odd: 1.22, ult10: 100.0, total: 100.0 },
      ]},
      { nome: 'Partida - Pontos 100.5', linhas: [
        { sel: 'Over 100.5', odd: 1.83, ult10: 80.0, total: 80.0 },
        { sel: 'Under 100.5', odd: 1.83, ult10: 20.0, total: 20.0 },
      ]},
    ]
  },
  {
    id: 11, esporte: 'e-Basket', liga: 'H2H GG League', subliga: 'Ebasketball 5', timer: '00:51', quarter: 'Q2',
    historico: '21 partidas, Última: 02/05/2026',
    jogadorA: 'Immortal', timeA: 'CHA Hornets',
    jogadorB: 'Arachne', timeB: 'DAL Mavericks',
    placarA: 26, placarB: 25,
    stats: null,
    mercados: [
      { nome: 'Handicap Asiático', linhas: [
        { sel: '+1.5 Immortal', odd: 1.80, ult10: 50.0, total: 28.6 },
        { sel: '-1.5 Arachne', odd: 1.87, ult10: 50.0, total: 71.4 },
      ]},
      { nome: 'Resultado Final', linhas: [
        { sel: 'Immortal', odd: 1.95, ult10: 50.0, total: 23.8 },
        { sel: 'Empate', odd: null, ult10: 0.0, total: 0.0 },
        { sel: 'Arachne', odd: 1.74, ult10: 50.0, total: 76.2 },
      ]},
      { nome: 'Partida - Pontos 113.5', linhas: [
        { sel: 'Over 113.5', odd: 1.87, ult10: 50.0, total: 33.3 },
        { sel: 'Under 113.5', odd: 1.80, ult10: 50.0, total: 66.7 },
      ]},
    ]
  },

  // ======= PRE-JOGO (placar 0-0, sem timer) =======
  {
    id: 12, esporte: 'e-Soccer', liga: 'Battle', subliga: 'Bundesliga', timer: '00:00',
    historico: '410 partidas, Última: 02/05/2026',
    jogadorA: 'Llulle', timeA: 'Bayern München',
    jogadorB: 'Klvu17', timeB: 'Bor. Dortmund',
    placarA: 0, placarB: 0,
    mercados: [
      { nome: 'Resultado Final', linhas: [
        { sel: 'Llulle', odd: 2.10, ult10: 40.0, total: 38.5 },
        { sel: 'Empate', odd: 3.20, ult10: 25.0, total: 24.8 },
        { sel: 'Klvu17', odd: 2.95, ult10: 35.0, total: 36.7 },
      ]},
      { nome: 'Over/Under', linhas: [
        { sel: 'Over 2.5', odd: 1.62, ult10: 70.0, total: 68.2 },
        { sel: 'Under 2.5', odd: 2.15, ult10: 30.0, total: 31.8 },
      ]},
      { nome: 'Ambos Marcam', linhas: [
        { sel: 'Sim', odd: 1.55, ult10: 65.0, total: 62.5 },
        { sel: 'Não', odd: 2.30, ult10: 35.0, total: 37.5 },
      ]},
    ]
  },
  {
    id: 13, esporte: 'e-Basket', liga: 'Battle (NBA2K)', subliga: 'Ebasketball 1', timer: '00:00',
    historico: '95 partidas, Última: 02/05/2026',
    jogadorA: 'Pakapaka', timeA: 'BOS Celtics',
    jogadorB: 'Kotkata', timeB: 'GS Warriors',
    placarA: 0, placarB: 0,
    mercados: [
      { nome: 'Resultado Final', linhas: [
        { sel: 'Pakapaka', odd: 1.85, ult10: 55.0, total: 52.3 },
        { sel: 'Kotkata', odd: 1.92, ult10: 45.0, total: 47.7 },
      ]},
      { nome: 'Pontos Total', linhas: [
        { sel: 'Over 165.5', odd: 1.90, ult10: 50.0, total: 48.0 },
        { sel: 'Under 165.5', odd: 1.85, ult10: 50.0, total: 52.0 },
      ]},
    ]
  },

  // ======= FINALIZADA (historico) =======
  {
    id: 14, esporte: 'e-Soccer', liga: 'GT League', subliga: 'Premier League', timer: '90:00',
    historico: '512 partidas, Última: 02/05/2026',
    jogadorA: 'Sena', timeA: 'Arsenal',
    jogadorB: 'Cofi111', timeB: 'Man. City',
    placarA: 2, placarB: 1, finalizada: true,
    mercados: [
      { nome: 'Resultado Final', linhas: [
        { sel: 'Sena', odd: 2.85, ult10: 35.0, total: 38.0 },
        { sel: 'Empate', odd: 3.40, ult10: 25.0, total: 26.5 },
        { sel: 'Cofi111', odd: 2.30, ult10: 40.0, total: 35.5 },
      ]},
      { nome: 'Over/Under', linhas: [
        { sel: 'Over 2.5', odd: 1.95, ult10: 55.0, total: 56.2 },
        { sel: 'Under 2.5', odd: 1.85, ult10: 45.0, total: 43.8 },
      ]},
    ]
  },
];

// ============================================================
// CONFIG DE TEMA POR ESPORTE
// Cada esporte tem suas cores aplicadas no card + filtro
// ============================================================
const ESPORTE_TEMA = {
  'e-Soccer': {
    icone: Gamepad2,
    cardBorder: 'rgba(16, 185, 129, 0.5)',  // emerald
    headerBg: 'bg-emerald-900/40',
    headerBorder: 'border-emerald-500/30',
    headerText: 'text-emerald-300',
    headerSubText: 'text-emerald-400/60',
    headerDot: 'bg-emerald-400',
    headerTimer: 'text-emerald-300',
    timerIcon: 'text-emerald-400/80',
    btnBg: 'bg-emerald-500/15',
    btnBorder: 'border-emerald-500',
    btnText: 'text-emerald-300',
    bet365Bg: 'bg-emerald-500/90',
    bet365Hover: 'hover:bg-emerald-500',
    bet365Text: 'text-emerald-950',
    bet365Shadow: 'shadow-emerald-500/30',
  },
  'e-Basket': {
    icone: Gamepad2,
    cardBorder: 'rgba(244, 63, 94, 0.5)',  // rose
    headerBg: 'bg-rose-950/50',
    headerBorder: 'border-rose-500/30',
    headerText: 'text-rose-400',
    headerSubText: 'text-rose-400/60',
    headerDot: 'bg-emerald-400',
    headerTimer: 'text-rose-400',
    timerIcon: 'text-rose-400/80',
    btnBg: 'bg-rose-500/15',
    btnBorder: 'border-rose-500',
    btnText: 'text-rose-300',
    bet365Bg: 'bg-emerald-500/90',
    bet365Hover: 'hover:bg-emerald-500',
    bet365Text: 'text-emerald-950',
    bet365Shadow: 'shadow-emerald-500/30',
  },
  'e-Hockey': {
    icone: Snowflake,
    cardBorder: 'rgba(6, 182, 212, 0.5)',  // cyan
    headerBg: 'bg-cyan-950/50',
    headerBorder: 'border-cyan-500/30',
    headerText: 'text-cyan-300',
    headerSubText: 'text-cyan-400/60',
    headerDot: 'bg-emerald-400',
    headerTimer: 'text-cyan-300',
    timerIcon: 'text-cyan-400/80',
    btnBg: 'bg-cyan-500/15',
    btnBorder: 'border-cyan-500',
    btnText: 'text-cyan-300',
    bet365Bg: 'bg-emerald-500/90',
    bet365Hover: 'hover:bg-emerald-500',
    bet365Text: 'text-emerald-950',
    bet365Shadow: 'shadow-emerald-500/30',
  },
  'Table Tennis': {
    icone: Disc,
    cardBorder: 'rgba(245, 158, 11, 0.5)',  // amber
    headerBg: 'bg-amber-950/50',
    headerBorder: 'border-amber-500/30',
    headerText: 'text-amber-300',
    headerSubText: 'text-amber-400/60',
    headerDot: 'bg-emerald-400',
    headerTimer: 'text-amber-300',
    timerIcon: 'text-amber-400/80',
    btnBg: 'bg-amber-500/15',
    btnBorder: 'border-amber-500',
    btnText: 'text-amber-300',
    bet365Bg: 'bg-emerald-500/90',
    bet365Hover: 'hover:bg-emerald-500',
    bet365Text: 'text-emerald-950',
    bet365Shadow: 'shadow-emerald-500/30',
  },
  'Futebol': {
    icone: CircleDot,
    cardBorder: 'rgba(59, 130, 246, 0.5)',  // blue
    headerBg: 'bg-blue-950/50',
    headerBorder: 'border-blue-500/30',
    headerText: 'text-blue-300',
    headerSubText: 'text-blue-400/60',
    headerDot: 'bg-emerald-400',
    headerTimer: 'text-blue-300',
    timerIcon: 'text-blue-400/80',
    btnBg: 'bg-blue-500/15',
    btnBorder: 'border-blue-500',
    btnText: 'text-blue-300',
    bet365Bg: 'bg-emerald-500/90',
    bet365Hover: 'hover:bg-emerald-500',
    bet365Text: 'text-emerald-950',
    bet365Shadow: 'shadow-emerald-500/30',
  },
  'e-NFL': {
    icone: Gamepad2,
    cardBorder: 'rgba(168, 85, 247, 0.5)',  // purple
    headerBg: 'bg-purple-950/50',
    headerBorder: 'border-purple-500/30',
    headerText: 'text-purple-300',
    headerSubText: 'text-purple-400/60',
    headerDot: 'bg-emerald-400',
    headerTimer: 'text-purple-300',
    timerIcon: 'text-purple-400/80',
    btnBg: 'bg-purple-500/15',
    btnBorder: 'border-purple-500',
    btnText: 'text-purple-300',
    bet365Bg: 'bg-emerald-500/90',
    bet365Hover: 'hover:bg-emerald-500',
    bet365Text: 'text-emerald-950',
    bet365Shadow: 'shadow-emerald-500/30',
  },
  'CS2': {
    icone: Zap,
    cardBorder: 'rgba(244, 63, 94, 0.5)',  // rose
    headerBg: 'bg-rose-950/50',
    headerBorder: 'border-rose-500/30',
    headerText: 'text-rose-300',
    headerSubText: 'text-rose-400/60',
    headerDot: 'bg-emerald-400',
    headerTimer: 'text-rose-300',
    timerIcon: 'text-rose-400/80',
    btnBg: 'bg-rose-500/15',
    btnBorder: 'border-rose-500',
    btnText: 'text-rose-300',
    bet365Bg: 'bg-emerald-500/90',
    bet365Hover: 'hover:bg-emerald-500',
    bet365Text: 'text-emerald-950',
    bet365Shadow: 'shadow-emerald-500/30',
  },
  'Tênis': {
    icone: CircleDot,
    cardBorder: 'rgba(234, 179, 8, 0.5)',  // yellow
    headerBg: 'bg-yellow-950/50',
    headerBorder: 'border-yellow-500/30',
    headerText: 'text-yellow-300',
    headerSubText: 'text-yellow-400/60',
    headerDot: 'bg-emerald-400',
    headerTimer: 'text-yellow-300',
    timerIcon: 'text-yellow-400/80',
    btnBg: 'bg-yellow-500/15',
    btnBorder: 'border-yellow-500',
    btnText: 'text-yellow-300',
    bet365Bg: 'bg-emerald-500/90',
    bet365Hover: 'hover:bg-emerald-500',
    bet365Text: 'text-emerald-950',
    bet365Shadow: 'shadow-emerald-500/30',
  },
};

// Lista completa de mercados disponiveis por esporte (universo possivel)
const MERCADOS_POR_ESPORTE = {
  'e-Soccer': [
    'Handicap Asiático',
    'Handicap Asiático 1º Tempo',
    'Linhas Asiáticas +/-',
    'Linhas Asiáticas +/- 1º Tempo',
    'Ambos Marcam',
    'Ambos Marcam 1º Tempo',
    'Dupla Hipótese',
    'Resultado Final',
    'Resultado 1º Tempo',
    'Over/Under',
    'Over/Under 1º Tempo',
    'Par/Ímpar',
    'Próximo Gol',
    'Handicap Europeu',
    'Handicap Europeu 1º Tempo',
    'Resultado Final/Ambos Marcam',
    'Resultado 1º Tempo/Ambos Marcam',
    'Jogador - Gols',
    'Jogador - Gols 1º Tempo',
    'Jogador A - Gols',
    'Jogador A - Gols 1º Tempo',
    'Jogador B - Gols',
    'Jogador B - Gols 1º Tempo',
  ],
  'e-Basket': [
    'Handicap Asiático',
    'Handicap Asiático 1º Tempo',
    'Resultado Final',
    'Resultado 1º Tempo',
    'Par/Ímpar',
    'Par/Ímpar 1º Tempo',
    'Over/Under',
    'Over/Under 1º Tempo',
    'Jogador - Gols',
    'Jogador - Gols 1º Tempo',
    'Jogador A - Gols',
    'Jogador A - Gols 1º Tempo',
    'Jogador B - Gols',
    'Jogador B - Gols 1º Tempo',
  ],
  'e-Hockey': [
    'Resultado Final',
    'Handicap Asiático',
    'Total de Gols',
    'Ambos Marcam',
    'Próximo Gol',
  ],
  'Table Tennis': [
    'Vencedor da Partida',
    'Handicap Sets',
    'Total de Sets',
    'Vencedor do Set',
    'Par/Ímpar Pontos',
  ],
  'Futebol': [
    'Resultado Final',
    'Handicap Asiático',
    'Over/Under',
    'Ambos Marcam',
    'Dupla Hipótese',
    'Próximo Gol',
    'Cartões',
    'Escanteios',
    'Resultado/Ambos Marcam',
  ],
  'e-NFL': [
    'Resultado Final',
    'Handicap Asiático',
    'Total de Pontos',
    'Próximo Touchdown',
  ],
  'CS2': [
    'Vencedor da Partida',
    'Handicap Mapas',
    'Total de Mapas',
    'Pistol Round',
    'Total de Rounds',
  ],
  'Tênis': [
    'Vencedor da Partida',
    'Handicap Sets',
    'Total de Sets',
    'Total de Games',
    'Vencedor do Set',
  ],
};

const ESPORTES_LIVE = [
  { id: 'e-Soccer',     label: 'e-Soccer' },
  { id: 'e-Basket',     label: 'e-Basket' },
  { id: 'e-Hockey',     label: 'e-Hockey' },
  { id: 'e-NFL',        label: 'e-NFL' },
  { id: 'Table Tennis', label: 'Tênis de Mesa' },
  { id: 'CS2',          label: 'Counter-Strike 2' },
  { id: 'Tênis',        label: 'Tênis' },
  { id: 'Futebol',      label: 'Futebol' },
];

const NAV_ITEMS = [
  { id: 'today',       label: 'Início',          icon: Home },
  { id: 'live',        label: 'Ao Vivo',         icon: Activity },
  { id: 'marketplace', label: 'Mercado de Bots', icon: Store },
  { id: 'bots',        label: 'Bots',            icon: Bot },
  { id: 'tables',      label: 'Tabelas',         icon: Table2 },
  { id: 'stats',       label: 'Estatísticas',    icon: BarChart3, novo: true },
  { id: 'extras',      label: 'Extras',          icon: Plus },
];

// ============================================================
// API CLIENT + HOOKS (plug-and-play)
//
// 🔌 BACKEND: ver lib/BACKEND.md no projeto principal.
//   GET /partidas/live?esporte=&modo=ao_vivo|pre_jogo|historico&busca=
//
// Filtros adicionais (odd, prob, partidasMin, mercados) ficam client-side
// porque dependem de drilling no objeto da partida; backend retorna a base.
// ============================================================

const USE_MOCK = true;
const MOCK_LATENCY = { min: 60, max: 200 };

function simularLatencia() {
  const ms = MOCK_LATENCY.min + Math.random() * (MOCK_LATENCY.max - MOCK_LATENCY.min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizaTxt(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const mockResponses = {
  '/partidas/live': (params) => {
    const { esporte, busca, modo = 'ao_vivo' } = params;
    let partidas = [...MOCK_LIVE];

    // Modo de conexão
    if (modo === 'ao_vivo') {
      partidas = partidas.filter(p => !p.finalizada);
    } else if (modo === 'pre_jogo') {
      partidas = partidas.filter(p => {
        const placar0x0 = p.placarA === 0 && p.placarB === 0;
        const timerInicial = !p.timer || p.timer === '00:00';
        return placar0x0 && timerInicial && !p.finalizada;
      });
    } else if (modo === 'historico') {
      partidas = partidas.filter(p => p.finalizada);
    }

    // Esporte
    if (esporte) partidas = partidas.filter(p => p.esporte === esporte);

    // Busca textual
    if (busca) {
      const t = normalizaTxt(busca);
      partidas = partidas.filter(p => {
        const campos = [p.jogadorA, p.jogadorB, p.timeA, p.timeB, p.liga, p.subliga];
        return campos.some(c => normalizaTxt(c).includes(t));
      });
    }

    return { partidas, total: partidas.length };
  },
};

async function apiGet(endpoint, params) {
  if (USE_MOCK) {
    await simularLatencia();
    const handler = mockResponses[endpoint];
    if (!handler) throw new Error(`[MOCK] Endpoint não implementado: GET ${endpoint}`);
    return handler(params || {});
  }
  const qs = new URLSearchParams(Object.entries(params || {}).filter(([_, v]) => v !== null && v !== undefined && v !== '')).toString();
  const res = await fetch(`${endpoint}${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function useApiQuery(endpoint, params) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const lastReqRef = useRef(0);
  const paramsKey = JSON.stringify(params);

  const fetchData = useCallback(async () => {
    const reqId = ++lastReqRef.current;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiGet(endpoint, params);
      if (reqId === lastReqRef.current) {
        setState({ data, loading: false, error: null });
      }
    } catch (error) {
      if (reqId === lastReqRef.current) {
        setState({ data: null, loading: false, error });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, paramsKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data: state.data, loading: state.loading, error: state.error, refetch: fetchData };
}

function usePartidasLive(filtros) {
  const { data, loading, error, refetch } = useApiQuery('/partidas/live', filtros);
  return {
    partidas: data?.partidas || [],
    total: data?.total || 0,
    loading, error, refetch,
  };
}

// ============================================================
// HELPERS DE COR
// ============================================================
function corPct(pct, naoTem = false) {
  if (naoTem || pct === 0) return 'text-rose-400';
  if (pct >= 60) return 'text-emerald-400';
  if (pct >= 50) return 'text-emerald-500';
  if (pct < 30) return 'text-rose-400';
  if (pct < 50) return 'text-rose-500';
  return 'text-[--mike-fg]';
}

// ============================================================
// STATS LIVE (so e-Soccer mostra)
// 3 colunas: Ataques | Finalizações | Escanteios
// Embaixo de Finalizações: cartoes A | cartoes B com 'D' embaixo
// ============================================================
function StatsLive({ stats }) {
  if (!stats) return null;

  const StatBlock = ({ label, valA, valB, IconCenter, corBorda }) => (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[8px] font-bold tracking-widest text-[--mike-fg-muted] uppercase">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-bold text-[--mike-fg] w-5 text-right">{valA}</span>
        <div className={`w-6 h-6 rounded-full border-2 ${corBorda} flex items-center justify-center`}>
          <IconCenter className="w-3 h-3 text-rose-400" />
        </div>
        <span className="text-sm font-mono font-bold text-[--mike-fg] w-5 text-left">{valB}</span>
      </div>
    </div>
  );

  // Ícone seta dupla estilizado pra ataques
  const IconAtaque = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}>
      <polyline points="13 17 18 12 13 7" />
      <polyline points="6 17 11 12 6 7" />
    </svg>
  );
  const IconFinal = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
  const IconEscant = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <line x1="4" y1="22" x2="4" y2="15" />
      <path d="M4 15 L20 8 L4 4 Z" />
    </svg>
  );

  return (
    <div className="flex items-start justify-center gap-6 py-1">
      <StatBlock label="Ataques" valA={stats.ataquesA} valB={stats.ataquesB} IconCenter={IconAtaque} corBorda="border-rose-500/70" />

      {/* Finalizações com cartões embaixo */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[8px] font-bold tracking-widest text-[--mike-fg-muted] uppercase">Finalizações</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-bold text-[--mike-fg] w-5 text-right">{stats.finalA}</span>
          <div className="w-6 h-6 rounded-full border-2 border-rose-500/70 flex items-center justify-center">
            <IconFinal className="w-3 h-3 text-rose-400" />
          </div>
          <span className="text-sm font-mono font-bold text-[--mike-fg] w-5 text-left">{stats.finalB}</span>
        </div>
        {/* Cartões A | divisor | Cartões B */}
        {(stats.cartoesA?.length > 0 || stats.cartoesB?.length > 0) && (
          <div className="flex items-start gap-2 mt-0.5">
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex gap-0.5">
                {stats.cartoesA.map((c, i) => (
                  <div key={i} className={`w-1.5 h-2.5 ${c === 'amarelo' ? 'bg-amber-400' : 'bg-rose-500'}`} />
                ))}
              </div>
              <span className="text-[7px] font-bold text-[--mike-fg-muted]">D</span>
            </div>
            <div className="w-px h-4 bg-[--mike-border]" />
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex gap-0.5">
                {stats.cartoesB.map((c, i) => (
                  <div key={i} className={`w-1.5 h-2.5 ${c === 'amarelo' ? 'bg-amber-400' : 'bg-rose-500'}`} />
                ))}
              </div>
              <span className="text-[7px] font-bold text-[--mike-fg-muted]">D</span>
            </div>
          </div>
        )}
      </div>

      <StatBlock label="Escanteios" valA={stats.escantA} valB={stats.escantB} IconCenter={IconEscant} corBorda="border-rose-500/70" />
    </div>
  );
}

// ============================================================
// MINI TABELA DE MERCADO - COMPACTA (cabe 2x2 em altura padrao)
// ============================================================
function TabelaMercado({ mercado, janela = '10' }) {
  // Mapeia janela pra label curto na coluna da tabela
  const labelMap = {
    'todas': 'Total',
    'campeonato': 'Camp.',
    'ultima_hora': '1h',
    '8h': '8h',
    '24h': '24h',
    '7d': '7d',
    '30d': '30d',
    '60d': '60d',
    '90d': '90d',
    'mesmo_dia': 'Hoje',
  };
  const labelJanela = labelMap[janela] || `Últ. ${janela}`;
  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        backgroundColor: '#0d1220',
        border: '0.5px solid rgba(60, 85, 130, 0.4)',
        borderBottom: '1px solid rgba(80, 110, 170, 0.7)',
      }}
    >
      {/* Header da tabela (titulo do mercado) */}
      <div
        className="px-2 py-1 text-center"
        style={{
          backgroundColor: '#1a2540',
          borderBottom: '0.5px solid rgba(60, 85, 130, 0.4)',
        }}
      >
        <span className="text-[10px] font-bold text-[--mike-fg] tracking-wide">{mercado.nome}</span>
      </div>

      <div className="px-2 py-0.5">
        {/* Header das colunas */}
        <div className="flex items-center text-[8px] uppercase tracking-wider font-bold text-[--mike-fg-muted] gap-2">
          <div className="flex-1 min-w-0"></div>
          <div className="w-9 text-right flex-shrink-0">Odd</div>
          <div className="w-11 text-right flex-shrink-0">{labelJanela}</div>
          <div className="w-11 text-right flex-shrink-0">Total</div>
        </div>

        {/* Linhas */}
        {mercado.linhas.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1 min-w-0 text-[10px] text-[--mike-fg-soft] truncate">{l.sel}</div>
            <div className="w-9 text-right text-[10px] font-mono font-semibold text-[--mike-fg] flex-shrink-0">
              {l.odd === null ? <span className="text-[--mike-fg-muted]">N/A</span> : l.odd.toFixed(2)}
            </div>
            <div className={`w-11 text-right text-[10px] font-mono font-bold flex-shrink-0 ${corPct(l.ult10)}`}>
              {l.ult10.toFixed(1)}%
            </div>
            <div className={`w-11 text-right text-[10px] font-mono font-bold flex-shrink-0 ${corPct(l.total)}`}>
              {l.total.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// CARD DE PARTIDA LIVE - compacto
// ============================================================
// ============================================================
// DROPDOWN CUSTOMIZADO - controle total de altura/scroll
// ============================================================
function MikeSelect({ value, onChange, options, placeholder = 'Selecione' }) {
  const [aberto, setAberto] = useState(false);
  const wrapperRef = useRef(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setAberto(false);
      }
    };
    if (aberto) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [aberto]);

  const opcaoSelecionada = options.find((o) => o.value === value);

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Botao do select */}
      <button
        onClick={() => setAberto(!aberto)}
        className="mike-border-thin w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-transparent text-xs text-[--mike-fg] cursor-pointer transition"
      >
        <span className={opcaoSelecionada ? 'text-[--mike-fg]' : 'text-[--mike-fg-muted]'}>
          {opcaoSelecionada ? opcaoSelecionada.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[--mike-fg-muted] flex-shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown aberto */}
      {aberto && (
        <div
          className="mike-mercados-scroll absolute z-40 left-0 right-0 mt-1 rounded-md overflow-y-auto"
          style={{
            backgroundColor: '#0d1220',
            border: '0.5px solid rgba(60, 85, 130, 0.4)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            maxHeight: '220px',
          }}
        >
          {options.map((o) => {
            const ativo = o.value === value;
            return (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setAberto(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition ${
                  ativo
                    ? 'bg-[--mike-accent]/15 text-[--mike-accent] font-semibold'
                    : 'text-[--mike-fg-soft] hover:bg-[--mike-card-2]/50 hover:text-[--mike-fg]'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {ativo && <Check className="w-3 h-3 flex-shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SKELETON LOADER - placeholder enquanto carrega
// ============================================================
function CardSkeleton() {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: 'var(--mike-card)',
        border: '0.5px solid rgba(60, 85, 130, 0.4)',
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: 'rgba(16, 24, 40, 0.6)' }}>
        <div className="mike-skeleton h-3 w-32" />
        <div className="mike-skeleton h-3 w-12" />
      </div>

      <div className="px-3 py-2 space-y-2.5">
        <div className="mike-skeleton h-2.5 w-40" />

        {/* Confronto */}
        <div className="flex items-center justify-center gap-3 py-1">
          <div className="flex flex-col items-end gap-1 max-w-[40%] flex-1">
            <div className="mike-skeleton h-3 w-20" />
            <div className="mike-skeleton h-2 w-16" />
          </div>
          <div className="mike-skeleton h-7 w-14 rounded-md flex-shrink-0" />
          <div className="flex flex-col items-start gap-1 max-w-[40%] flex-1">
            <div className="mike-skeleton h-3 w-20" />
            <div className="mike-skeleton h-2 w-16" />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-around py-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="mike-skeleton h-2 w-12" />
              <div className="mike-skeleton h-5 w-10" />
            </div>
          ))}
        </div>

        {/* Botoes */}
        <div className="flex items-center justify-center gap-1">
          <div className="mike-skeleton h-4 w-10" />
          <div className="mike-skeleton h-4 w-12" />
          <div className="mike-skeleton h-4 w-14" />
        </div>

        {/* Mercados grid */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="mike-skeleton h-[88px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function CardLive({ partida, mostrarStats, casaApostas, dominioBet365, janela, onAbrirPartida, onAbrirH2H, onAbrirH2HTime, onAbrirCasaApostas }) {
  const tema = ESPORTE_TEMA[partida.esporte] || ESPORTE_TEMA['e-Soccer'];
  const mercadosRef = useRef(null);

  // Timer "tickando" (incrementa a cada segundo pra dar sensacao de live)
  // NAO tica se a partida estiver finalizada ou se for pre-jogo (timer 00:00)
  const [timerOffset, setTimerOffset] = useState(0);
  useEffect(() => {
    if (partida.finalizada) return;
    if (!partida.timer || partida.timer === '00:00') return;
    const id = setInterval(() => setTimerOffset((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [partida.finalizada, partida.timer]);

  // Recalcula timer com offset
  const timerLive = useMemo(() => {
    if (!partida.timer) return null;
    const [m, s] = partida.timer.split(':').map(Number);
    if (isNaN(m) || isNaN(s)) return partida.timer;
    const total = m * 60 + s + timerOffset;
    const mm = Math.floor(total / 60).toString().padStart(2, '0');
    const ss = (total % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }, [partida.timer, timerOffset]);

  // Detecta mudanca de placar pra animar
  const [placarPiscou, setPlacarPiscou] = useState(false);
  const placarRef = useRef(`${partida.placarA}-${partida.placarB}`);
  useEffect(() => {
    const novoPlacar = `${partida.placarA}-${partida.placarB}`;
    if (placarRef.current !== novoPlacar) {
      placarRef.current = novoPlacar;
      setPlacarPiscou(true);
      const t = setTimeout(() => setPlacarPiscou(false), 1500);
      return () => clearTimeout(t);
    }
  }, [partida.placarA, partida.placarB]);

  // Reset scroll pra topo quando muda de partida (não em cada render)
  useEffect(() => {
    if (mercadosRef.current) {
      mercadosRef.current.scrollTop = 0;
    }
  }, [partida.id]);

  // Mapa de nomes pra exibicao das casas de apostas
  const casaLabel = {
    bet365: dominioBet365 === '.bet.br' ? 'Bet365.bet.br' : `Bet365${dominioBet365}`,
    betano: 'Betano',
    superbet: 'Superbet',
    estrelabet: 'Estrelabet',
    novibet: 'Novibet',
    vupi: 'Vupi',
  }[casaApostas] || 'Bet365';

  return (
    <div
      className="rounded-lg bg-[--mike-card] overflow-hidden shadow-lg shadow-black/30"
      style={{ border: `0.5px solid ${tema.cardBorder}` }}
    >
      {/* Header colorido por esporte - compacto */}
      <div className={`px-3 py-1.5 ${tema.headerBg} flex items-center justify-between`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full ${tema.headerDot} animate-pulse flex-shrink-0`} />
          <span className={`text-[11px] font-bold ${tema.headerText} truncate`}>
            {partida.liga}
            {partida.subliga && <span className={`${tema.headerSubText} font-medium`}> | {partida.subliga}</span>}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Clock className={`w-2.5 h-2.5 ${tema.timerIcon}`} />
          {partida.quarter && <span className={`text-[9px] font-mono font-bold ${tema.headerTimer} mr-0.5`}>{partida.quarter}</span>}
          <span className={`text-[10px] font-mono font-bold ${tema.headerTimer}`}>{timerLive || partida.timer}</span>
          {/* Badge de tempo ativo (1T/2T pra e-Soccer ou Q1-Q4 pra e-Basket) */}
          {partida.esporte === 'e-Soccer' && timerLive && (
            (() => {
              const [m] = timerLive.split(':').map(Number);
              const tempo = m < 45 ? '1T' : '2T';
              return (
                <span className="text-[8px] font-bold px-1 py-px rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {tempo}
                </span>
              );
            })()
          )}
          {partida.esporte === 'e-Basket' && partida.quarter && (
            <span className="text-[8px] font-bold px-1 py-px rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
              {partida.quarter}
            </span>
          )}
        </div>
      </div>

      <div className="px-3 py-2">
        {/* Histórico */}
        <div className="text-[9px] text-[--mike-fg-muted] mb-2">{partida.historico}</div>

        {/* Confronto: jogador A | placar | jogador B - clicavel pra abrir tela individual */}
        <button
          onClick={() => onAbrirPartida?.(partida)}
          className="w-full flex items-center justify-center gap-3 mb-2 hover:bg-[--mike-card-hover]/40 rounded-md py-1 transition cursor-pointer"
          title="Ver detalhes da partida"
        >
          {/* Lado A */}
          <div className="text-right min-w-0 leading-tight max-w-[40%]">
            <div className="text-[13px] font-bold text-[--mike-fg] truncate flex items-center justify-end gap-1">
              <span className="truncate">{partida.jogadorA}</span>
              {partida.quenteA && <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" fill="currentColor" />}
            </div>
            <div className="text-[10px] text-[--mike-fg-muted] truncate">{partida.timeA}</div>
          </div>

          {/* Placar com badge Q em cima */}
          <div className="flex flex-col items-center flex-shrink-0">
            {partida.quarter && (
              <span className="text-[8px] font-bold text-[--mike-fg-muted] mb-0.5">{partida.quarter}</span>
            )}
            <div
              className={`flex items-center justify-center gap-1.5 min-w-[60px] px-3 py-1 rounded-md bg-[--mike-card-2] font-mono text-sm font-black transition-all ${
                placarPiscou ? 'mike-placar-flash ring-2 ring-emerald-400' : ''
              }`}
            >
              <span className="text-[--mike-fg]">{partida.placarA}</span>
              <span className="text-[--mike-fg-muted]">-</span>
              <span className="text-[--mike-fg]">{partida.placarB}</span>
            </div>
          </div>

          {/* Lado B */}
          <div className="text-left min-w-0 leading-tight max-w-[40%]">
            <div className="text-[13px] font-bold text-[--mike-fg] truncate flex items-center gap-1">
              {partida.quenteB && <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" fill="currentColor" />}
              <span className="truncate">{partida.jogadorB}</span>
            </div>
            <div className="text-[10px] text-[--mike-fg-muted] truncate">{partida.timeB}</div>
          </div>
        </button>

        {/* Stats live (só e-Soccer) */}
        {/* Stats live (só e-Soccer e se mostrarStats=true) */}
        {partida.stats && mostrarStats && <StatsLive stats={partida.stats} />}

        {/* Botões H2H / H2H+T / Bet365 */}
        <div className="flex items-center justify-center gap-1 mt-2 mb-2">
          <button className="flex items-center gap-1 px-2 py-0.5 rounded bg-[--mike-card-2] hover:bg-[--mike-accent]/10 text-[9px] font-bold text-[--mike-fg-soft] hover:text-[--mike-accent] transition">
            H2H <ExternalLink className="w-2 h-2" />
          </button>
          <button className="flex items-center gap-1 px-2 py-0.5 rounded bg-[--mike-card-2] hover:bg-[--mike-accent]/10 text-[9px] font-bold text-[--mike-fg-soft] hover:text-[--mike-accent] transition">
            H2H + T <ExternalLink className="w-2 h-2" />
          </button>
          <button className={`flex items-center gap-1 px-2 py-0.5 rounded ${tema.bet365Bg} ${tema.bet365Hover} text-[9px] font-bold ${tema.bet365Text} transition shadow-sm ${tema.bet365Shadow}`}>
            {casaLabel} <ExternalLink className="w-2 h-2" />
          </button>
        </div>

        {/* Section 2x2 fixo - altura adaptavel: ate 4 mercados sem scroll, depois scroll */}
        <section
          ref={mercadosRef}
          className="mike-mercados-scroll"
          style={{
            maxHeight: '195px',
            minHeight: partida.mercados.length > 0 ? '60px' : '0',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
            {partida.mercados.map((m, i) => (
              <TabelaMercado key={i} mercado={m} janela={janela} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ============================================================
// HEADER (igual Today)
// ============================================================
function Header({ telaAtiva = 'live', onNavegar }) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[--mike-bg]/85 border-b border-[--mike-border]">
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavegar?.('today')}
              className="flex items-center gap-2 hover:opacity-90 transition"
              title="Início"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[--mike-accent] to-[--mike-accent-2] flex items-center justify-center shadow-lg shadow-[--mike-accent]/30">
                <span className="font-black text-[--mike-bg] text-lg leading-none">M</span>
              </div>
              <span className="font-black tracking-tight text-[--mike-fg] text-base hidden sm:block" style={{ fontFamily: 'JetBrains Mono, monospace' }}>TIPMIKE</span>
            </button>
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[--mike-card] border border-[--mike-border] cursor-pointer hover:bg-[--mike-card-hover] transition">
              <Bot className="w-3 h-3 text-[--mike-fg-muted]" />
              <span className="text-xs text-[--mike-fg-soft]">eSports</span>
              <ChevronDown className="w-3 h-3 text-[--mike-fg-muted]" />
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[--mike-card] border border-[--mike-border] w-72">
            <Search className="w-3.5 h-3.5 text-[--mike-fg-muted]" />
            <input placeholder="Buscar..." className="bg-transparent text-xs text-[--mike-fg] placeholder:text-[--mike-fg-muted] outline-none flex-1" />
          </div>

          <div className="flex items-center gap-1">
            <button className="p-2 rounded-md hover:bg-[--mike-card] text-[--mike-fg-muted] hover:text-[--mike-fg] transition relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[--mike-accent]" />
            </button>
            <button className="p-2 rounded-md hover:bg-[--mike-card] text-[--mike-fg-muted] hover:text-[--mike-fg] transition">
              <Settings className="w-4 h-4" />
            </button>
            <div className="ml-2 flex items-center gap-2 pl-2 border-l border-[--mike-border]">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[--mike-accent-2] to-[--mike-accent] flex items-center justify-center text-xs font-bold text-[--mike-bg]">S</div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-medium text-[--mike-fg]">Santos</div>
                <div className="text-[10px] text-[--mike-fg-muted]">BOT (eSports)</div>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const ativa = telaAtiva === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavegar?.(item.id)}
                className={`flex flex-col items-center gap-0.5 px-4 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap relative ${
                  ativa ? 'border-[--mike-accent] text-[--mike-fg]' : 'border-transparent text-[--mike-fg-muted] hover:text-[--mike-fg]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.novo && (
                  <span className="absolute -top-1 -right-1 text-[8px] px-1 py-0 rounded bg-amber-400 text-amber-950 font-black tracking-wide">NOVO</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

// ============================================================
// APP
// ============================================================
export default function App({ onNavegar, onAbrirPartida }) {
  const [esporteAtivo, setEsporteAtivo] = useState('e-Soccer');
  const [busca, setBusca] = useState('');
  const [conexao, setConexao] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [telaAtiva, setTelaAtiva] = useState('live');
  const [modalAcao, setModalAcao] = useState(null); // {tipo, partida} - mock pra mostrar acao

  // Filtros avancados
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [modalMercados, setModalMercados] = useState(false);
  const [status, setStatus] = useState('todos');
  const [oddMin, setOddMin] = useState('');
  const [probMin, setProbMin] = useState('');
  const [partidasMin, setPartidasMin] = useState('');
  const [torneio, setTorneio] = useState('todos');
  const [mercadosSel, setMercadosSel] = useState([]); // ids dos mercados selecionados
  const [stake, setStake] = useState('');
  const [dominioBet365, setDominioBet365] = useState('.com');
  const [mostrarStats, setMostrarStats] = useState(true);

  // Toasts (notificacoes de novo gol/jogo)
  const [toasts, setToasts] = useState([]);

  // Handlers de navegacao/abertura - com fallback se prop nao foi passada
  const handleNavegar = (telaId) => {
    setTelaAtiva(telaId);
    if (onNavegar) {
      onNavegar(telaId);
    } else {
      setModalAcao({ tipo: 'navegar', destino: telaId });
    }
  };

  const handleAbrirPartida = (partida) => {
    if (onAbrirPartida) {
      onAbrirPartida(partida);
    } else {
      setModalAcao({ tipo: 'partida', partida });
    }
  };

  const handleAbrirH2H = (partida) => {
    setModalAcao({ tipo: 'h2h', partida });
  };

  const handleAbrirH2HTime = (partida) => {
    setModalAcao({ tipo: 'h2h_time', partida });
  };

  const handleAbrirCasaApostas = (partida, casa) => {
    setModalAcao({ tipo: 'casa_apostas', partida, casa });
  };

  // Refresh manual (botao do hero)
  // 🔌 BACKEND: aqui chamaria reload das partidas
  const fazerRefresh = () => {
    if (!conexao) {
      adicionarToast({ tipo: 'placar', titulo: 'Sem conexão', mensagem: 'Reconecte antes de atualizar' });
      return;
    }
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      adicionarToast({ tipo: 'novo', titulo: 'Atualizado', mensagem: 'Partidas e odds sincronizadas' });
    }, 600);
  };

  const adicionarToast = (toast) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, saindo: true } : t));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 4000);
  };

  // Simula notificacoes periodicamente (demo)
  // 🔌 BACKEND: substituir por websocket real escutando eventos
  useEffect(() => {
    if (loading || !conexao) return;  // pausa quando desconectado
    const interval = setInterval(() => {
      // Sorteia uma partida aleatoria das visiveis pra notificacao
      const partidasAtivas = MOCK_LIVE.filter(p => !p.finalizada && p.timer && p.timer !== '00:00');
      if (partidasAtivas.length === 0) return;
      const p = partidasAtivas[Math.floor(Math.random() * partidasAtivas.length)];

      // Sorteia tipo de evento
      const tipos = ['gol', 'novo', 'placar'];
      const tipo = tipos[Math.floor(Math.random() * tipos.length)];

      const eventos = {
        gol: {
          tipo: 'gol',
          titulo: `Gol em ${p.jogadorA} vs ${p.jogadorB}!`,
          mensagem: `${Math.random() < 0.5 ? p.jogadorA : p.jogadorB} marcou aos ${p.timer}`,
        },
        novo: {
          tipo: 'novo',
          titulo: 'Nova partida ao vivo',
          mensagem: `${p.liga} · ${p.jogadorA} vs ${p.jogadorB}`,
        },
        placar: {
          tipo: 'placar',
          titulo: 'Placar atualizado',
          mensagem: `${p.jogadorA} ${p.placarA}-${p.placarB} ${p.jogadorB}`,
        },
      };
      adicionarToast(eventos[tipo]);
    }, 30000); // a cada 30s pra nao incomodar
    return () => clearInterval(interval);
  }, [loading, conexao]);

  // Conexao
  const [conexaoAberta, setConexaoAberta] = useState(false);
  const [conexaoModo, setConexaoModo] = useState('ao_vivo');
  const [conexaoCasa, setConexaoCasa] = useState('bet365');
  const [conexaoJanela, setConexaoJanela] = useState('10');
  const [conexaoCanal, setConexaoCanal] = useState('qualquer');
  const [conexaoHistorico, setConexaoHistorico] = useState('nao');
  const [conexaoNovaVersao, setConexaoNovaVersao] = useState('nao');
  const [conexaoDominioBet365, setConexaoDominioBet365] = useState('.com');

  // Lista de torneios extraida dos mocks - filtrada pelo esporte ativo
  const torneiosDisponiveis = useMemo(() => {
    const set = new Set();
    MOCK_LIVE
      .filter((p) => !esporteAtivo || p.esporte === esporteAtivo)
      .forEach((p) => set.add(p.liga));
    return Array.from(set).sort();
  }, [esporteAtivo]);

  // Lista FIXA de mercados disponiveis pelo esporte (universo possivel)
  // Quando uma partida nova vier com mercado, ele JA estara na lista pra filtrar
  const mercadosDisponiveis = useMemo(() => {
    if (!esporteAtivo) return [];
    return MERCADOS_POR_ESPORTE[esporteAtivo] || [];
  }, [esporteAtivo]);

  // Quando trocar de esporte, limpa torneio e mercados que nao existem no novo esporte
  useEffect(() => {
    if (torneio !== 'todos' && !torneiosDisponiveis.includes(torneio)) {
      setTorneio('todos');
    }
    setMercadosSel((prev) => prev.filter((m) => mercadosDisponiveis.includes(m)));
  }, [esporteAtivo]);

  // Stake nao filtra partidas - eh usado APENAS pra calcular retorno potencial
  // (display nos cards futuro: "Aposta R$10 com odd 2.50 = R$25 retorno")
  const algumFiltroAtivo = status !== 'todos' || oddMin || probMin || partidasMin ||
                          torneio !== 'todos' || mercadosSel.length > 0 ||
                          conexaoModo !== 'ao_vivo';

  // Stake nao filtra partidas - eh usado APENAS pra calcular retorno potencial
  // (display nos cards futuro: "Aposta R$10 com odd 2.50 = R$25 retorno")
  const algumFiltroAtivo = status !== 'todos' || oddMin || probMin || partidasMin ||
                          torneio !== 'todos' || mercadosSel.length > 0 ||
                          conexaoModo !== 'ao_vivo';

  const limparFiltros = () => {
    setStatus('todos');
    setOddMin('');
    setProbMin('');
    setPartidasMin('');
    setTorneio('todos');
    setMercadosSel([]);
    setStake('');
    setDominioBet365('.com');
    setMostrarStats(true);
    setConexaoModo('ao_vivo');
    if (algumFiltroAtivo) {
      adicionarToast({ tipo: 'novo', titulo: 'Filtros limpos', mensagem: 'Mostrando todas as partidas ao vivo' });
    }
  };

  // Esc fecha qualquer modal aberto
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (modalAcao) setModalAcao(null);
      else if (modalMercados) setModalMercados(false);
      else if (filtrosAbertos) setFiltrosAbertos(false);
      else if (conexaoAberta) setConexaoAberta(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalAcao, modalMercados, filtrosAbertos, conexaoAberta]);

  const normaliza = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Hook: traz partidas filtradas pelo backend (esporte + modo + busca)
  const filtrosBackend = useMemo(() => ({
    esporte: esporteAtivo,
    modo: conexaoModo,
    busca,
  }), [esporteAtivo, conexaoModo, busca]);

  const { partidas: partidasBackend, loading } = usePartidasLive(filtrosBackend);

  // Filtros finos client-side (drilling no objeto - difícil de paginar no backend)
  const partidasFiltradas = useMemo(() => {
    return partidasBackend.filter((p) => {
      if (torneio !== 'todos' && p.liga !== torneio) return false;

      if (partidasMin) {
        const matchHist = (p.historico || '').match(/^(\d+)/);
        const numPartidas = matchHist ? parseInt(matchHist[1], 10) : 0;
        if (numPartidas < parseInt(partidasMin, 10)) return false;
      }

      if (oddMin) {
        const oddMinNum = parseFloat(oddMin);
        const temOdd = p.mercados.some((m) =>
          m.linhas.some((l) => l.odd !== null && l.odd >= oddMinNum)
        );
        if (!temOdd) return false;
      }

      if (probMin) {
        const probMinNum = parseFloat(probMin);
        const temProb = p.mercados.some((m) =>
          m.linhas.some((l) => l.total >= probMinNum)
        );
        if (!temProb) return false;
      }

      if (mercadosSel.length > 0) {
        const temMercado = p.mercados.some((m) => mercadosSel.includes(m.nome));
        if (!temMercado) return false;
      }

      return true;
    });
  }, [partidasBackend, torneio, partidasMin, oddMin, probMin, mercadosSel]);

  const themeVars = {
    '--mike-bg': '#0b0f1a',
    '--mike-bg-2': '#070a13',
    '--mike-card': '#141a28',
    '--mike-card-2': '#1a2030',
    '--mike-card-hover': '#1d2434',
    '--mike-border': '#222a3d',
    '--mike-border-blue': 'rgba(60, 85, 130, 0.4)',
    '--mike-fg': '#eaeef7',
    '--mike-fg-soft': '#a8b3c9',
    '--mike-fg-muted': '#6b7691',
    '--mike-accent': '#10b981',
    '--mike-accent-2': '#0891b2',
  };

  return (
    <div className="min-h-screen" style={{ ...themeVars, backgroundColor: 'var(--mike-bg)', color: 'var(--mike-fg)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { scrollbar-width: none; }

        .mike-mercados-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .mike-mercados-scroll::-webkit-scrollbar-track {
          background: rgba(80, 110, 170, 0.05);
          border-radius: 10px;
        }
        .mike-mercados-scroll::-webkit-scrollbar-thumb {
          background: rgba(80, 110, 170, 0.5);
          border-radius: 10px;
          transition: background 0.2s;
        }
        .mike-mercados-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(80, 110, 170, 0.7);
        }
        .mike-mercados-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(80, 110, 170, 0.9);
        }
        .mike-mercados-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(80, 110, 170, 0.5) rgba(80, 110, 170, 0.05);
        }

        /* SELECTS COM TEMA ESCURO */
        .mike-select {
          color-scheme: dark;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%3E%3Cpath%20d%3D%22M1%201l4%204%204-4%22%20stroke%3D%22%236b7691%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
          padding-right: 24px !important;
        }
        .mike-select option {
          background-color: #141a28;
          color: #eaeef7;
          padding: 8px;
        }
        .mike-select option:checked,
        .mike-select option:hover {
          background-color: #10b981;
          color: #0b0f1a;
        }

        /* INPUT NUMBER - esconde spinners e força tema escuro */
        input[type="number"].mike-input::-webkit-outer-spin-button,
        input[type="number"].mike-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"].mike-input {
          -moz-appearance: textfield;
          color-scheme: dark;
        }

        /* BORDA FINA AZULADA - mesma das minitabelas */
        .mike-border-thin {
          border: 0.5px solid rgba(60, 85, 130, 0.4) !important;
        }
        .mike-border-thin:hover {
          border-color: rgba(80, 110, 170, 0.7) !important;
        }
        .mike-border-thin:focus {
          border-color: rgba(16, 185, 129, 0.7) !important;
          outline: none;
        }

        /* PULSE DE PLACAR QUANDO MUDA */
        @keyframes mike-placar-pulse {
          0% { transform: scale(1); background-color: rgba(16, 185, 129, 0.5); }
          50% { transform: scale(1.15); background-color: rgba(16, 185, 129, 0.3); }
          100% { transform: scale(1); background-color: var(--mike-card-2); }
        }
        .mike-placar-flash {
          animation: mike-placar-pulse 1.5s ease-out;
        }

        /* SKELETON SHIMMER */
        @keyframes mike-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .mike-skeleton {
          background: linear-gradient(
            90deg,
            rgba(60, 85, 130, 0.1) 0%,
            rgba(60, 85, 130, 0.25) 50%,
            rgba(60, 85, 130, 0.1) 100%
          );
          background-size: 200% 100%;
          animation: mike-shimmer 1.5s infinite linear;
          border-radius: 4px;
        }

        /* TOAST SLIDE-IN */
        @keyframes mike-toast-in {
          0% { transform: translateX(120%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes mike-toast-out {
          0% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        .mike-toast-in { animation: mike-toast-in 0.3s ease-out; }
        .mike-toast-out { animation: mike-toast-out 0.3s ease-in forwards; }

        /* MODAL FADE */
        @keyframes mike-modal-fade {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* SPIN - botao refresh */
        @keyframes mike-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .mike-spin {
          animation: mike-spin 0.8s linear infinite;
        }
      `}</style>

      <Header telaAtiva={telaAtiva} onNavegar={handleNavegar} />

      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-[--mike-fg-muted] mb-4">
          <Home className="w-3.5 h-3.5" />
          <span>Início</span>
          <span>›</span>
          <span className="text-[--mike-fg] font-semibold">Ao Vivo</span>
        </div>

        {/* Filtros de esporte */}
        <div className="mb-4">
          <h3 className="text-xs text-[--mike-fg-muted] mb-2">Escolha o esporte</h3>
          <div className="flex flex-wrap gap-2">
            {ESPORTES_LIVE.map((e) => {
              const ativo = esporteAtivo === e.id;
              const tema = ESPORTE_TEMA[e.id];
              const Icone = tema.icone;
              return (
                <button key={e.id} onClick={() => setEsporteAtivo(ativo ? null : e.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition ${
                    ativo
                      ? `${tema.btnBg} border ${tema.btnBorder} ${tema.btnText}`
                      : 'mike-border-thin bg-transparent text-[--mike-fg-muted] hover:text-[--mike-fg]'
                  }`}>
                  <Icone className="w-3.5 h-3.5" />
                  {e.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Linha: Busca | Filtros | Conexão */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="mike-border-thin flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 rounded-md bg-transparent transition">
            <Search className="w-4 h-4 text-[--mike-fg-muted]" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por jogadores, times ou partidas..."
              className="flex-1 bg-transparent text-xs text-[--mike-fg] placeholder:text-[--mike-fg-muted] outline-none"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="text-[--mike-fg-muted] hover:text-[--mike-fg]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={fazerRefresh}
            disabled={refreshing || loading}
            className="px-3 py-2 rounded-md mike-border-thin bg-transparent text-[--mike-fg-muted] hover:text-[--mike-accent] hover:bg-[--mike-accent]/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={refreshing ? 'Atualizando...' : 'Atualizar partidas'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'mike-spin' : ''}`} />
          </button>
          <button
            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition ${
              filtrosAbertos
                ? 'bg-[--mike-accent]/15 text-[--mike-accent]'
                : algumFiltroAtivo
                  ? 'mike-border-thin bg-transparent text-[--mike-fg]'
                  : 'mike-border-thin bg-transparent text-[--mike-fg-soft] hover:text-[--mike-fg]'
            }`}
            style={filtrosAbertos ? { border: '0.5px solid rgba(16, 185, 129, 0.5)' } : {}}
          >
            {filtrosAbertos ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Filtros
            {algumFiltroAtivo && (
              <span className="ml-0.5 px-1.5 py-0 rounded-full text-[9px] font-black bg-[--mike-accent] text-[--mike-bg]">
                {[
                  status !== 'todos',
                  oddMin,
                  probMin,
                  partidasMin,
                  torneio !== 'todos',
                  mercadosSel.length > 0,
                  conexaoModo !== 'ao_vivo',
                ].filter(Boolean).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setConexaoAberta(!conexaoAberta)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition ${
              conexaoAberta
                ? 'bg-[--mike-accent]/15 text-[--mike-accent]'
                : 'mike-border-thin bg-transparent text-[--mike-fg-soft] hover:text-[--mike-fg]'
            }`}
            style={conexaoAberta ? { border: '0.5px solid rgba(16, 185, 129, 0.5)' } : {}}
          >
            {conexaoAberta ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>Conexão</span>
            <div className={`w-2 h-2 rounded-full ${conexao ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          </button>
        </div>

        {/* PAINEL DE FILTROS EXPANSIVEL */}
        {filtrosAbertos && (
          <div className="mb-5 rounded-lg p-4" style={{ backgroundColor: 'transparent', border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
            {/* Header do painel */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[--mike-fg]">Filtros</h3>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-md mike-border-thin bg-transparent text-[--mike-fg-soft]">
                Mostrando {partidasFiltradas.length} de {MOCK_LIVE.filter((p) => !esporteAtivo || p.esporte === esporteAtivo).length} partidas
              </span>
            </div>

            {/* Linha 1: 5 dropdowns */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
              {/* Status */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[--mike-fg-muted] mb-1">
                  Status
                  {status !== 'todos' && (
                    <span className="px-1.5 py-0 rounded-full bg-[--mike-accent]/20 text-[--mike-accent] text-[9px] font-bold">
                      {status === 'ao_vivo' ? 'Ao vivo' : status === 'intervalo' ? 'Intervalo' : 'Finalizado'}
                    </span>
                  )}
                </label>
                <MikeSelect
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'todos', label: 'Todos os status' },
                    { value: 'ao_vivo', label: 'Ao vivo' },
                    { value: 'intervalo', label: 'Intervalo' },
                    { value: 'finalizado', label: 'Finalizado' },
                  ]}
                />
              </div>

              {/* Odd minima */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[--mike-fg-muted] mb-1">
                  Odd mínima
                  {oddMin && (
                    <span className="px-1.5 py-0 rounded-full bg-[--mike-accent]/20 text-[--mike-accent] text-[9px] font-bold">
                      {parseFloat(oddMin).toFixed(2)}+
                    </span>
                  )}
                </label>
                <MikeSelect
                  value={oddMin}
                  onChange={setOddMin}
                  options={[
                    { value: '', label: 'Todas' },
                    { value: '1.01', label: '1.01+' },
                    { value: '1.10', label: '1.10+' },
                    { value: '1.20', label: '1.20+' },
                    { value: '1.25', label: '1.25+' },
                    { value: '1.30', label: '1.30+' },
                    { value: '1.40', label: '1.40+' },
                    { value: '1.50', label: '1.50+' },
                    { value: '1.60', label: '1.60+' },
                    { value: '1.70', label: '1.70+' },
                    { value: '1.80', label: '1.80+' },
                    { value: '1.90', label: '1.90+' },
                    { value: '2.00', label: '2.00+' },
                    { value: '2.50', label: '2.50+' },
                    { value: '3.00', label: '3.00+' },
                    { value: '5.00', label: '5.00+' },
                    { value: '10.00', label: '10.00+' },
                  ]}
                />
              </div>

              {/* Probabilidade minima */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[--mike-fg-muted] mb-1">
                  Probabilidade mínima
                  {probMin && (
                    <span className="px-1.5 py-0 rounded-full bg-[--mike-accent]/20 text-[--mike-accent] text-[9px] font-bold">
                      {probMin}%+
                    </span>
                  )}
                </label>
                <MikeSelect
                  value={probMin}
                  onChange={setProbMin}
                  options={[
                    { value: '', label: 'Todas' },
                    { value: '10', label: '10%+' },
                    { value: '20', label: '20%+' },
                    { value: '30', label: '30%+' },
                    { value: '40', label: '40%+' },
                    { value: '50', label: '50%+' },
                    { value: '60', label: '60%+' },
                    { value: '70', label: '70%+' },
                    { value: '80', label: '80%+' },
                    { value: '90', label: '90%+' },
                  ]}
                />
              </div>

              {/* Partidas minimas */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[--mike-fg-muted] mb-1">
                  Partidas mínimas
                  {partidasMin && (
                    <span className="px-1.5 py-0 rounded-full bg-[--mike-accent]/20 text-[--mike-accent] text-[9px] font-bold">
                      {partidasMin}+
                    </span>
                  )}
                </label>
                <MikeSelect
                  value={partidasMin}
                  onChange={setPartidasMin}
                  options={[
                    { value: '', label: 'Todas' },
                    { value: '1', label: '1+' },
                    { value: '2', label: '2+' },
                    { value: '3', label: '3+' },
                    { value: '4', label: '4+' },
                    { value: '5', label: '5+' },
                    { value: '10', label: '10+' },
                    { value: '20', label: '20+' },
                    { value: '50', label: '50+' },
                  ]}
                />
              </div>

              {/* Torneio */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] text-[--mike-fg-muted] mb-1">
                  Torneio
                  {torneio !== 'todos' && (
                    <span className="px-1.5 py-0 rounded-full bg-[--mike-accent]/20 text-[--mike-accent] text-[9px] font-bold truncate max-w-[100px]">
                      {torneio}
                    </span>
                  )}
                </label>
                <MikeSelect
                  value={torneio}
                  onChange={setTorneio}
                  options={[
                    { value: 'todos', label: 'Todos os torneios' },
                    ...torneiosDisponiveis.map((t) => ({ value: t, label: t })),
                  ]}
                />
              </div>
            </div>

            {/* Linha 2: Mercados (botao que abre modal) */}
            <div className="mb-3">
              <label className="block text-[10px] text-[--mike-fg-muted] mb-1">
                Mercados
                <span className="ml-2 px-1.5 py-0 rounded-full bg-[--mike-accent]/20 text-[--mike-accent] text-[9px] font-bold">
                  {mercadosSel.length}/{mercadosDisponiveis.length}
                </span>
              </label>
              <button
                onClick={() => setModalMercados(true)}
                className="mike-border-thin w-full flex items-center justify-between px-3 py-2 rounded-md bg-transparent text-xs text-[--mike-fg] transition cursor-pointer"
              >
                <span>
                  {mercadosSel.length === 0
                    ? <span className="text-[--mike-fg-muted]">Nenhum mercado selecionado</span>
                    : `${mercadosSel.length} selecionado${mercadosSel.length > 1 ? 's' : ''}`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[--mike-fg-muted]" />
              </button>
            </div>

            {/* Linha 3: Stake | Dominio Bet365 | Mostrar Stats | Limpar */}
            <div className="flex flex-wrap items-end gap-3">
              {/* Stake */}
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Stake</label>
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  placeholder="Ex: 100"
                  className="mike-input w-24 px-2.5 py-1.5 rounded-md mike-border-thin bg-transparent text-xs text-[--mike-fg] placeholder:text-[--mike-fg-muted] focus:border-[--mike-accent] outline-none"
                />
              </div>

              {/* Dominio Bet365 */}
              <div className="w-24">
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Domínio Bet365</label>
                <MikeSelect
                  value={dominioBet365}
                  onChange={setDominioBet365}
                  options={[
                    { value: '.com', label: '.COM' },
                    { value: '.net', label: '.NET' },
                    { value: '.bet.br', label: '.BET.BR' },
                  ]}
                />
              </div>

              {/* Mostrar estatisticas */}
              <button
                onClick={() => setMostrarStats(!mostrarStats)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md mike-border-thin bg-transparent text-xs text-[--mike-fg-soft] hover:text-[--mike-fg] transition"
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  mostrarStats ? 'bg-emerald-500' : 'bg-[--mike-card-2]'
                }`}>
                  {mostrarStats && <Check className="w-2.5 h-2.5 text-emerald-950" strokeWidth={3} />}
                </div>
                Mostrar estatísticas
              </button>

              {/* Espacador empurra Limpar pra direita */}
              <div className="flex-1" />

              {/* Limpar tudo */}
              <button
                onClick={limparFiltros}
                disabled={!algumFiltroAtivo}
                className={`mike-border-thin px-3 py-1.5 rounded-md text-xs font-semibold transition bg-transparent ${
                  algumFiltroAtivo
                    ? 'text-[--mike-fg] hover:text-rose-400'
                    : 'text-[--mike-fg-muted] cursor-not-allowed opacity-50'
                }`}
              >
                Limpar tudo
              </button>
            </div>
          </div>
        )}

        {/* PAINEL DE CONEXAO EXPANSIVEL */}
        {conexaoAberta && (
          <div className="mb-5 rounded-lg p-4" style={{ backgroundColor: 'transparent', border: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
            {/* Header do painel */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[--mike-fg]">Conexão</h3>
              <div className="flex items-center gap-2">
                <Wifi className={`w-3.5 h-3.5 ${conexao ? 'text-emerald-400' : 'text-rose-500'}`} />
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  conexao ? 'bg-emerald-500 text-emerald-950' : 'bg-rose-500 text-rose-950'
                }`}>
                  {conexao ? 'Conectado' : 'Desconectado'}
                </span>
                <button
                  onClick={() => {
                    setConexao(!conexao);
                    if (conexao) {
                      adicionarToast({ tipo: 'placar', titulo: 'Conexão perdida', mensagem: 'Reconectando...' });
                    } else {
                      adicionarToast({ tipo: 'novo', titulo: 'Reconectado', mensagem: 'Atualizações em tempo real ativas' });
                    }
                  }}
                  className="text-[10px] px-2 py-1 rounded mike-border-thin bg-transparent hover:bg-[--mike-card-hover] text-[--mike-fg-soft] hover:text-[--mike-fg] transition"
                  title="Simular desconexão/reconexão"
                >
                  {conexao ? 'Desconectar' : 'Reconectar'}
                </button>
              </div>
            </div>

            {/* Linha 1: 4 dropdowns */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Modo</label>
                <MikeSelect
                  value={conexaoModo}
                  onChange={setConexaoModo}
                  options={[
                    { value: 'ao_vivo', label: 'Ao Vivo' },
                    { value: 'pre_jogo', label: 'Pré-Jogo' },
                    { value: 'historico', label: 'Histórico' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Casa de Apostas</label>
                <MikeSelect
                  value={conexaoCasa}
                  onChange={setConexaoCasa}
                  options={[
                    { value: 'bet365', label: 'Bet365' },
                    { value: 'betano', label: 'Betano' },
                    { value: 'superbet', label: 'Superbet' },
                    { value: 'estrelabet', label: 'Estrelabet' },
                    { value: 'novibet', label: 'Novibet' },
                    { value: 'vupi', label: 'Vupi' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Janela</label>
                <MikeSelect
                  value={conexaoJanela}
                  onChange={setConexaoJanela}
                  options={[
                    { value: 'todas', label: 'Todas' },
                    { value: '1', label: 'Última partida' },
                    { value: '2', label: 'Últimas 2 partidas' },
                    { value: '3', label: 'Últimas 3 partidas' },
                    { value: '4', label: 'Últimas 4 partidas' },
                    { value: '5', label: 'Últimas 5 partidas' },
                    { value: '10', label: 'Últimas 10 partidas' },
                    { value: '15', label: 'Últimas 15 partidas' },
                    { value: '20', label: 'Últimas 20 partidas' },
                    { value: '25', label: 'Últimas 25 partidas' },
                    { value: '30', label: 'Últimas 30 partidas' },
                    { value: '40', label: 'Últimas 40 partidas' },
                    { value: '50', label: 'Últimas 50 partidas' },
                    { value: '100', label: 'Últimas 100 partidas' },
                    { value: 'campeonato', label: 'Campeonato atual' },
                    { value: 'ultima_hora', label: 'Última hora' },
                    { value: '8h', label: 'Últimas 8 horas' },
                    { value: '24h', label: 'Últimas 24 horas' },
                    { value: '7d', label: 'Últimos 7 dias' },
                    { value: '30d', label: 'Últimos 30 dias' },
                    { value: '60d', label: 'Últimos 60 dias' },
                    { value: '90d', label: 'Últimos 90 dias' },
                    { value: 'mesmo_dia', label: 'Mesmo dia' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Canal</label>
                <MikeSelect
                  value={conexaoCanal}
                  onChange={setConexaoCanal}
                  options={[
                    { value: 'qualquer', label: 'Qualquer partida' },
                    { value: 'mesma_liga', label: 'Mesma liga' },
                    { value: 'mesmos_jogadores', label: 'Mesmos jogadores' },
                    { value: 'mesmo_horario', label: 'Mesmo horário' },
                  ]}
                />
              </div>
            </div>

            {/* Linha 2: 3 dropdowns */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Histórico de Jogadores</label>
                <MikeSelect
                  value={conexaoHistorico}
                  onChange={setConexaoHistorico}
                  options={[
                    { value: 'nao', label: 'Não' },
                    { value: 'sim', label: 'Sim' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Nova Versão</label>
                <MikeSelect
                  value={conexaoNovaVersao}
                  onChange={setConexaoNovaVersao}
                  options={[
                    { value: 'nao', label: 'Não' },
                    { value: 'sim', label: 'Sim' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[--mike-fg-muted] mb-1">Domínio Bet365</label>
                <MikeSelect
                  value={conexaoDominioBet365}
                  onChange={setConexaoDominioBet365}
                  options={[
                    { value: '.com', label: '.COM' },
                    { value: '.net', label: '.NET' },
                    { value: '.bet.br', label: '.BET.BR' },
                  ]}
                />
              </div>
            </div>
          </div>
        )}

        {/* Grid de cards live - 2 colunas a partir de md */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : partidasFiltradas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {partidasFiltradas.map((p) => (
              <CardLive
                key={p.id}
                partida={p}
                mostrarStats={mostrarStats}
                casaApostas={conexaoCasa}
                dominioBet365={conexaoDominioBet365}
                janela={conexaoJanela}
                onAbrirPartida={handleAbrirPartida}
                onAbrirH2H={handleAbrirH2H}
                onAbrirH2HTime={handleAbrirH2HTime}
                onAbrirCasaApostas={handleAbrirCasaApostas}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-[--mike-card] border border-[--mike-border] py-16 px-6 text-center">
            <FilterX className="w-12 h-12 text-[--mike-fg-muted] opacity-40 mx-auto mb-3" />
            <p className="text-sm text-[--mike-fg] font-semibold mb-1">Nenhuma partida encontrada</p>
            <p className="text-xs text-[--mike-fg-muted] mb-4">
              {algumFiltroAtivo ? (
                'Os filtros aplicados não retornaram nenhuma partida. Tente afrouxar ou limpar os filtros.'
              ) : busca ? (
                <>Sua busca por <span className="text-[--mike-fg] font-semibold">"{busca}"</span> não retornou nada.</>
              ) : esporteAtivo ? (
                <>Nenhuma partida ao vivo de <span className="text-[--mike-fg] font-semibold">{esporteAtivo}</span> no momento.</>
              ) : (
                'Nenhuma partida ao vivo no momento.'
              )}
            </p>
            {(algumFiltroAtivo || busca || esporteAtivo) && (
              <button
                onClick={() => {
                  limparFiltros();
                  setBusca('');
                  setEsporteAtivo(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[--mike-accent]/10 border border-[--mike-accent]/40 text-[--mike-accent] hover:bg-[--mike-accent]/15 transition"
              >
                <FilterX className="w-3 h-3" />
                Limpar tudo
              </button>
            )}
          </div>
        )}
      </main>

      {/* MODAL: SELECIONAR MERCADOS */}
      {modalMercados && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(7, 10, 19, 0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => setModalMercados(false)}
        >
          <div
            className="rounded-lg p-5 w-full max-w-md max-h-[80vh] flex flex-col"
            style={{
              backgroundColor: '#0d1220',
              border: '0.5px solid rgba(60, 85, 130, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do modal */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-[--mike-fg]">Selecionar mercados</h3>
                <p className="text-[10px] text-[--mike-fg-muted] mt-0.5">
                  Marque os mercados que deseja exibir nos cards
                </p>
              </div>
              <button
                onClick={() => setModalMercados(false)}
                className="p-1 rounded hover:bg-[--mike-card-2] text-[--mike-fg-muted] hover:text-[--mike-fg] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Botoes Marcar todos / Desmarcar todos */}
            <div className="flex gap-2 mb-3 mt-2">
              <button
                onClick={() => setMercadosSel(mercadosDisponiveis)}
                className="mike-border-thin px-3 py-1.5 rounded-md bg-transparent text-xs font-semibold text-[--mike-fg-soft] hover:text-[--mike-fg] transition"
              >
                Marcar todos
              </button>
              <button
                onClick={() => setMercadosSel([])}
                className="mike-border-thin px-3 py-1.5 rounded-md bg-transparent text-xs font-semibold text-[--mike-fg-soft] hover:text-[--mike-fg] transition"
              >
                Desmarcar todos
              </button>
            </div>

            {/* Lista de mercados em 2 colunas */}
            <div className="overflow-y-auto mike-mercados-scroll flex-1 -mr-2 pr-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                {mercadosDisponiveis.map((m) => {
                  const ativo = mercadosSel.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        setMercadosSel((prev) =>
                          ativo ? prev.filter((x) => x !== m) : [...prev, m]
                        );
                      }}
                      className="flex items-start gap-2 text-left transition"
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition ${
                        ativo
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'bg-transparent border-[--mike-fg-muted]'
                      }`}>
                        {ativo && <Check className="w-2.5 h-2.5 text-emerald-950" strokeWidth={3} />}
                      </div>
                      <span className={`text-[12px] leading-tight ${
                        ativo ? 'text-[--mike-fg] font-medium' : 'text-[--mike-fg-soft]'
                      }`}>
                        {m}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer do modal */}
            <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
              <span className="text-[10px] text-[--mike-fg-muted]">
                {mercadosSel.length} de {mercadosDisponiveis.length} selecionados
              </span>
              <button
                onClick={() => setModalMercados(false)}
                className="px-4 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-bold transition shadow-md shadow-emerald-500/30"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS - notificacoes no canto inferior direito */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const corMap = {
            gol: { bg: 'bg-emerald-500/90', border: 'border-emerald-400', icon: <Zap className="w-4 h-4 text-emerald-950" fill="currentColor" /> },
            novo: { bg: 'bg-cyan-500/90', border: 'border-cyan-400', icon: <Bell className="w-4 h-4 text-cyan-950" /> },
            placar: { bg: 'bg-orange-500/90', border: 'border-orange-400', icon: <AlertCircle className="w-4 h-4 text-orange-950" /> },
          };
          const cor = corMap[t.tipo] || corMap.novo;
          return (
            <div
              key={t.id}
              className={`${cor.bg} ${cor.border} ${t.saindo ? 'mike-toast-out' : 'mike-toast-in'} pointer-events-auto rounded-lg border-2 px-3 py-2 shadow-2xl backdrop-blur-md min-w-[260px] max-w-[320px]`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">{cor.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-black truncate">{t.titulo}</div>
                  <div className="text-[10px] text-black/80 truncate">{t.mensagem}</div>
                </div>
                <button
                  onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                  className="flex-shrink-0 text-black/60 hover:text-black"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="border-t border-[--mike-border] mt-8" style={{ borderColor: 'rgba(60, 85, 130, 0.4)' }}>
        <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-8">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[--mike-accent] to-[--mike-accent-2] flex items-center justify-center shadow-md shadow-[--mike-accent]/30">
                <span className="font-black text-[--mike-bg] text-base leading-none">M</span>
              </div>
              <span className="font-black text-[--mike-fg] tracking-tight" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                TIPMIKE
              </span>
            </div>
            <p className="text-[11px] text-[--mike-fg-muted] text-center max-w-md leading-relaxed">
              TipMike é uma plataforma avançada de análise esportiva que oferece estatísticas detalhadas,
              análises em tempo real e insights profundos para apostadores e entusiastas do esporte.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-4 text-[10px] text-[--mike-fg-muted]">
            <span className="hover:text-[--mike-fg] cursor-pointer transition">Suporte</span>
            <span className="hover:text-[--mike-fg] cursor-pointer transition">Documentação</span>
            <span className="hover:text-[--mike-fg] cursor-pointer transition">Termos de Uso</span>
            <span className="hover:text-[--mike-fg] cursor-pointer transition">Privacidade</span>
            <span className="hover:text-[--mike-fg] cursor-pointer transition">Status</span>
            <span className="hover:text-[--mike-fg] cursor-pointer transition">FAQ</span>
          </div>

          <div className="flex items-center justify-between pt-4 text-[9px] text-[--mike-fg-muted]" style={{ borderTop: '0.5px solid rgba(60, 85, 130, 0.4)' }}>
            <span>© 2026 TipMike. Todos os direitos reservados.</span>
            <span className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${conexao ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              {partidasFiltradas.length} partidas ao vivo
            </span>
          </div>
        </div>
      </footer>

      {/* MODAL DE ACAO - mock pra mostrar onde callbacks levariam
          🔌 BACKEND/INTEGRACAO: substituir por roteamento real */}
      {modalAcao && (
        <div
          onClick={() => setModalAcao(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl bg-[--mike-card] border border-[--mike-border] p-6 max-w-md w-full"
            style={{ animation: 'mike-modal-fade 200ms ease-out' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] tracking-widest text-[--mike-fg-muted] uppercase mb-1">
                  {modalAcao.tipo === 'navegar' && 'Navegação'}
                  {modalAcao.tipo === 'partida' && 'Abrir Partida'}
                  {modalAcao.tipo === 'h2h' && 'H2H'}
                  {modalAcao.tipo === 'h2h_time' && 'H2H + Time'}
                  {modalAcao.tipo === 'casa_apostas' && 'Abrir Casa de Apostas'}
                </div>
                <div className="text-base font-bold text-[--mike-fg] truncate">
                  {modalAcao.tipo === 'navegar' && `Ir para: ${modalAcao.destino}`}
                  {modalAcao.tipo === 'partida' && `${modalAcao.partida.jogadorA} vs ${modalAcao.partida.jogadorB}`}
                  {modalAcao.tipo === 'h2h' && `${modalAcao.partida.jogadorA} vs ${modalAcao.partida.jogadorB}`}
                  {modalAcao.tipo === 'h2h_time' && `${modalAcao.partida.timeA || '?'} vs ${modalAcao.partida.timeB || '?'}`}
                  {modalAcao.tipo === 'casa_apostas' && `${modalAcao.casa} - ${modalAcao.partida.jogadorA} vs ${modalAcao.partida.jogadorB}`}
                </div>
              </div>
              <button
                onClick={() => setModalAcao(null)}
                className="p-1 rounded hover:bg-[--mike-card-hover] text-[--mike-fg-muted] hover:text-[--mike-fg] transition flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[--mike-fg-muted] leading-relaxed">
              {modalAcao.tipo === 'navegar' && 'Em produção, esta ação navegaria para a tela correspondente.'}
              {modalAcao.tipo === 'partida' && 'Em produção, abriria a tela individual da partida com 18 seções de análise.'}
              {(modalAcao.tipo === 'h2h' || modalAcao.tipo === 'h2h_time') && 'Em produção, abriria modal com histórico de confrontos diretos.'}
              {modalAcao.tipo === 'casa_apostas' && 'Em produção, abriria a casa de apostas em uma nova aba (deep link com a partida pré-selecionada).'}
            </p>
            <div className="mt-4 px-3 py-2 rounded-md bg-[--mike-bg-2] border border-[--mike-border]">
              <div className="text-[10px] text-[--mike-fg-muted] mb-1">Dados disponíveis:</div>
              <pre className="text-[10px] text-[--mike-fg-soft] font-mono overflow-x-auto max-h-40">
                {JSON.stringify(modalAcao, null, 2)}
              </pre>
            </div>
            <div className="text-[10px] text-[--mike-fg-muted] mt-3 text-center">
              Pressione <kbd className="px-1.5 py-0.5 rounded bg-[--mike-bg-2] border border-[--mike-border] font-mono">Esc</kbd> ou clique fora pra fechar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}