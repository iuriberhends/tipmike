/**
 * MercadoFiltros.jsx
 * Renderiza filtros dinâmicos de acordo com o mercado selecionado.
 * Importado por CriarBot.jsx na seção de Mercados.
 *
 * Uso:
 *   import MercadoFiltros, { getConfigMercado } from './MercadoFiltros';
 *
 *   // No estado do CriarBot:
 *   const [inner, setInner] = useState('Over');
 *   const [linha, setLinha] = useState(null);
 *
 *   // Quando mercado muda, reseta inner e linha:
 *   useEffect(() => {
 *     const cfg = getConfigMercado(mercado);
 *     setInner(cfg.inner ? cfg.inner[0] : null);
 *     setLinha(null);
 *   }, [mercado]);
 *
 *   // Na seção de Mercados:
 *   <MercadoFiltros
 *     mercado={mercado}
 *     inner={inner}
 *     onInnerChange={setInner}
 *     linha={linha}
 *     onLinhaChange={setLinha}
 *   />
 */

import { useState, useEffect } from 'react';
import { Info, ChevronDown, Check } from 'lucide-react';

// ══════════════════════════════════════════════════════════════════
// LINHAS POR TIPO DE MERCADO
// ══════════════════════════════════════════════════════════════════

const LINHAS_OU_GOLS = [0.5,1.5,2.5,3.5,4.5,5.5,6.5,7.5,8.5,9.5,10.5,11.5,12.5,13.5,14.5,15.5,16.5];
const LINHAS_OU_PONTOS_FT = [79.5,84.5,89.5,94.5,99.5,104.5,109.5,114.5,119.5,124.5,129.5,134.5,139.5,144.5,149.5];
const LINHAS_OU_PONTOS_HT = [34.5,39.5,44.5,49.5,54.5,59.5,64.5,69.5,74.5];
const LINHAS_HC_GOLS = [-3.5,-3,-2.5,-2,-1.5,-1,-0.5,0,0.5,1,1.5,2,2.5,3,3.5];
const LINHAS_HC_PONTOS = [-14.5,-12.5,-10.5,-8.5,-6.5,-4.5,-2.5,-0.5,0.5,2.5,4.5,6.5,8.5,10.5,12.5,14.5];
const LINHAS_ASIATICO_GOLS = [0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10];
const LINHAS_JOGADOR_GOLS = [0.5,1.5,2.5,3.5,4.5,5.5,6.5];
const LINHAS_JOGADOR_PONTOS = [9.5,14.5,19.5,24.5,29.5,34.5];

// ══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DE FILTROS POR MERCADO
// ══════════════════════════════════════════════════════════════════

export const CONFIG_FILTROS_MERCADO = {

  // ── e-Soccer / Futebol ────────────────────────────────────────
  ml_ft: {
    label: 'Resultado Final',
    inner: null,
    linhas: null,
    extras: true,
    limitePlacar: true,
    proporcao: true,
    descricao: 'Resultado ao final dos 90 min. Use Extras para filtrar Casa/Visitante/Favorito.',
  },
  ml_ht: {
    label: 'Resultado Final - 1ºT',
    inner: null,
    linhas: null,
    extras: true,
    limitePlacar: true,
    proporcao: true,
    descricao: 'Resultado ao intervalo (1º tempo). Use Extras para filtrar Casa/Visitante/Favorito.',
  },
  over_under_ft: {
    label: 'Partida - Gols',
    inner: ['Over','Under'],
    linhas: LINHAS_OU_GOLS,
    extras: false,
    limitePlacar: false,
    proporcao: true,
    descricao: 'Total de gols na partida. Selecione Over ou Under e a linha desejada.',
  },
  over_under_ht: {
    label: 'Total de Gols - 1ºT',
    inner: ['Over','Under'],
    linhas: LINHAS_OU_GOLS,
    extras: false,
    limitePlacar: false,
    proporcao: true,
    descricao: 'Total de gols no primeiro tempo.',
  },
  over_under_ft_ht_0x0: {
    label: 'Partida - Gols (HT 0x0)',
    inner: ['Over','Under'],
    linhas: LINHAS_OU_GOLS,
    extras: false,
    limitePlacar: false,
    proporcao: true,
    descricao: 'Total de gols na partida, somente quando o intervalo termina em 0x0.',
  },
  over_under_ft_player: {
    label: 'Jogador - Gols',
    inner: ['Over','Under'],
    linhas: LINHAS_JOGADOR_GOLS,
    extras: true,
    limitePlacar: false,
    proporcao: true,
    descricao: 'Gols marcados pelo jogador alvo da tip.',
  },
  over_under_ht_player: {
    label: 'Jogador - Gols - 1ºT',
    inner: ['Over','Under'],
    linhas: LINHAS_JOGADOR_GOLS,
    extras: true,
    limitePlacar: false,
    proporcao: true,
    descricao: 'Gols do jogador alvo no primeiro tempo.',
  },
  over_under_ft_player_against: {
    label: 'Jogador - Sofrer Gols',
    inner: ['Over','Under'],
    linhas: LINHAS_JOGADOR_GOLS,
    extras: true,
    limitePlacar: false,
    proporcao: true,
    descricao: 'Total de gols sofridos pelo jogador alvo.',
  },
  clean_sheet_ft_player: {
    label: 'Jogador - Não sofre gol',
    inner: ['Sim','Não'],
    linhas: null,
    extras: true,
    limitePlacar: false,
    proporcao: false,
    descricao: 'O jogador alvo não sofre nenhum gol na partida.',
  },
  ah_ft: {
    label: 'HC Asiático',
    inner: ['Home','Away'],
    linhas: LINHAS_HC_GOLS,
    extras: true,
    limitePlacar: true,
    proporcao: true,
    descricao: 'Handicap asiático no resultado final. Selecione o lado e a linha de handicap.',
  },
  ah_ht: {
    label: 'HC Asiático - 1ºT',
    inner: ['Home','Away'],
    linhas: LINHAS_HC_GOLS,
    extras: true,
    limitePlacar: true,
    proporcao: true,
    descricao: 'Handicap asiático no primeiro tempo.',
  },
  eh_ft: {
    label: 'Handicap Europeu',
    inner: ['Home','Draw','Away'],
    linhas: LINHAS_HC_GOLS,
    extras: true,
    limitePlacar: true,
    proporcao: true,
    descricao: 'Handicap europeu no resultado final (inclui opção de empate).',
  },
  eh_ht: {
    label: 'Handicap Europeu - 1ºT',
    inner: ['Home','Draw','Away'],
    linhas: LINHAS_HC_GOLS,
    extras: true,
    limitePlacar: true,
    proporcao: true,
    descricao: 'Handicap europeu no primeiro tempo.',
  },
  btts_ft: {
    label: 'Ambos Marcam',
    inner: ['Sim','Não'],
    linhas: null,
    extras: false,
    limitePlacar: false,
    proporcao: false,
    descricao: 'Ambos os jogadores marcam pelo menos um gol na partida.',
  },
  btts_ht: {
    label: 'Ambos Marcam - 1ºT',
    inner: ['Sim','Não'],
    linhas: null,
    extras: false,
    limitePlacar: false,
    proporcao: false,
    descricao: 'Ambos marcam no primeiro tempo.',
  },
  ml_btts_ft: {
    label: 'Resultado/Ambos Marcam',
    inner: ['Home/Sim','Home/Não','Draw/Sim','Draw/Não','Away/Sim','Away/Não'],
    linhas: null,
    extras: true,
    limitePlacar: false,
    proporcao: false,
    descricao: 'Combinação do resultado final com ambos marcam.',
  },
  ml_btts_ht: {
    label: 'Resultado/Ambos Marcam - 1ºT',
    inner: ['Home/Sim','Home/Não','Draw/Sim','Draw/Não','Away/Sim','Away/Não'],
    linhas: null,
    extras: true,
    limitePlacar: false,
    proporcao: false,
    descricao: 'Combinação do resultado no 1ºT com ambos marcam.',
  },
  odd_even_ft: {
    label: 'Par/Ímpar',
    inner: ['Par','Ímpar'],
    linhas: null,
    extras: false,
    limitePlacar: false,
    proporcao: false,
    descricao: 'Total de gols da partida é par ou ímpar.',
  },
  odd_even_ht: {
    label: 'Par/Ímpar - 1ºT',
    inner: ['Par','Ímpar'],
    linhas: null,
    extras: false,
    limitePlacar: false,
    proporcao: false,
    descricao: 'Total de gols do 1ºT é par ou ímpar.',
  },
  asian_over_under_ft: {
    label: 'Gols +/- (Asiático)',
    inner: ['Over','Under'],
    linhas: LINHAS_ASIATICO_GOLS,
    extras: true,
    limitePlacar: false,
    proporcao: true,
    descricao: 'Over/Under asiático (sem linha de empate). Melhor retorno que o europeu.',
  },
  asian_over_under_ht: {
    label: 'Gols +/- (Asiático) - 1ºT',
    inner: ['Over','Under'],
    linhas: LINHAS_ASIATICO_GOLS,
    extras: false,
    limitePlacar: false,
    proporcao: true,
    descricao: 'Over/Under asiático no primeiro tempo.',
  },
  double_ml_ft: {
    label: 'Dupla Hipótese',
    inner: ['Home/Draw','Away/Draw','Home/Away'],
    linhas: null,
    extras: true,
    limitePlacar: true,
    proporcao: true,
    descricao: 'Duas das três possibilidades de resultado final.',
  },
  next_goal: {
    label: 'Próximo Gol',
    inner: ['Home','Away','Sem Gol'],
    linhas: null,
    extras: true,
    limitePlacar: false,
    proporcao: false,
    descricao: 'Quem marca o próximo gol da partida.',
  },

  // ── e-Basket / NBA2K ─────────────────────────────────────────
  over_under_ft_basket: {
    label: 'Partida - Pontos',
    inner: ['Over','Under'],
    linhas: LINHAS_OU_PONTOS_FT,
    extras: false,
    limitePlacar: false,
    proporcao: true,
    descricao: 'Total de pontos na partida (4 quartos).',
  },
  over_under_ht_basket: {
    label: 'Total de Pontos - 1ºT',
    inner: ['Over','Under'],
    linhas: LINHAS_OU_PONTOS_HT,
    extras: false,
    limitePlacar: false,
    proporcao: true,
    descricao: 'Total de pontos no primeiro tempo (Q1+Q2).',
  },
  over_under_ft_player_basket: {
    label: 'Total de Pontos - Jogador',
    inner: ['Over','Under'],
    linhas: LINHAS_JOGADOR_PONTOS,
    extras: true,
    limitePlacar: false,
    proporcao: true,
    descricao: 'Total de pontos marcados pelo jogador alvo.',
  },
  ah_ft_basket: {
    label: 'Handicap Asiático',
    inner: ['Home','Away'],
    linhas: LINHAS_HC_PONTOS,
    extras: true,
    limitePlacar: true,
    proporcao: true,
    descricao: 'Handicap asiático de pontos no resultado final.',
  },
  ah_ht_basket: {
    label: 'Handicap Asiático - 1ºT',
    inner: ['Home','Away'],
    linhas: LINHAS_HC_PONTOS,
    extras: true,
    limitePlacar: true,
    proporcao: true,
    descricao: 'Handicap asiático de pontos no 1ºT.',
  },
  ml_ft_basket: {
    label: 'Resultado Final',
    inner: null,
    linhas: null,
    extras: true,
    limitePlacar: true,
    proporcao: true,
    descricao: 'Vencedor da partida (sem empate no basquete).',
  },
};

export function getConfigMercado(mercadoValue) {
  return CONFIG_FILTROS_MERCADO[mercadoValue] || {
    inner: null, linhas: null, extras: false,
    limitePlacar: false, proporcao: false, descricao: '',
  };
}

// ══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════

export default function MercadoFiltros({
  mercado,
  inner,
  onInnerChange,
  linha,
  onLinhaChange,
  mostrarDescricao = true,
}) {
  const cfg = getConfigMercado(mercado);

  // Reseta inner se não existir no novo mercado
  useEffect(() => {
    if (cfg.inner && inner && !cfg.inner.includes(inner)) {
      onInnerChange(cfg.inner[0]);
    }
    if (!cfg.inner && inner) {
      onInnerChange(null);
    }
    // Reseta linha se o mercado não tem linhas ou a linha atual não está na lista
    if (!cfg.linhas) {
      onLinhaChange(null);
    } else if (linha && !cfg.linhas.includes(linha)) {
      onLinhaChange(null);
    }
  }, [mercado]); // eslint-disable-line

  return (
    <div className="space-y-3 pt-1">

      {/* DESCRIÇÃO DO MERCADO */}
      {mostrarDescricao && cfg.descricao && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-md text-[11px] leading-relaxed"
          style={{
            backgroundColor: 'rgba(16,185,129,0.04)',
            border: '0.5px solid rgba(16,185,129,0.2)',
            color: '#6b7691',
          }}
        >
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} />
          <span>{cfg.descricao}</span>
        </div>
      )}

      {/* INNER — Over/Under / Home/Away / Sim/Não / etc */}
      {cfg.inner && cfg.inner.length > 0 && (
        <div className="flex items-center gap-3">
          <span
            className="text-[11px] font-bold px-2 py-1 rounded flex-shrink-0"
            style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '10px' }}
          >
            SELEÇÃO
          </span>
          <div className="flex flex-wrap gap-1.5">
            {cfg.inner.map(op => {
              const ativo = inner === op;
              return (
                <button
                  key={op}
                  onClick={() => onInnerChange(op)}
                  className="px-3 py-1 rounded text-[11px] font-semibold transition-all"
                  style={{
                    backgroundColor: ativo ? '#10b981' : 'rgba(60,85,130,0.2)',
                    color: ativo ? '#fff' : '#b8c0d4',
                    border: `0.5px solid ${ativo ? '#10b981' : 'rgba(60,85,130,0.5)'}`,
                    boxShadow: ativo ? '0 2px 8px rgba(16,185,129,0.3)' : 'none',
                    transform: ativo ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  {op}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LINHAS */}
      {cfg.linhas && cfg.linhas.length > 0 && (
        <div className="flex items-start gap-3">
          <span
            className="text-[11px] font-bold px-2 py-1 rounded flex-shrink-0 mt-0.5"
            style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '10px' }}
          >
            LINHA
          </span>
          <div className="flex flex-wrap gap-1.5">
            {cfg.linhas.map(l => {
              const ativo = linha === l;
              return (
                <button
                  key={l}
                  onClick={() => onLinhaChange(ativo ? null : l)}
                  className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all"
                  style={{
                    backgroundColor: ativo ? '#10b981' : 'rgba(60,85,130,0.15)',
                    color: ativo ? '#fff' : '#b8c0d4',
                    border: `0.5px solid ${ativo ? '#10b981' : 'rgba(60,85,130,0.35)'}`,
                    boxShadow: ativo ? '0 2px 6px rgba(16,185,129,0.25)' : 'none',
                  }}
                >
                  {l > 0 && l !== 0 ? `+${l}` : l}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sem seleção necessária */}
      {!cfg.inner && !cfg.linhas && (
        <p className="text-[11px] italic" style={{ color: '#6b7691' }}>
          Nenhuma linha ou seleção necessária para este mercado.
        </p>
      )}
    </div>
  );
}
