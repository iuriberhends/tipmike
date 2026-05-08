/**
 * MercadoFiltros.jsx — v5
 */

import { useEffect } from 'react';
import { Info } from 'lucide-react';

// Gols normais FT: 0.5–15.5, step 0.5 (sempre .5, nunca inteiro)
const R_OU_GOLS          = { min: 0.5,   max: 15.5,  step: 0.5  };
// Gols normais HT: 0.5–9.5, step 0.5
const R_OU_GOLS_HT       = { min: 0.5,   max: 9.5,   step: 0.5  };
// Gols asiáticos FT: 0.5–15.5, step 0.25
const R_ASIATICO_GOLS    = { min: 0.5,   max: 15.5,  step: 0.25 };
// Gols asiáticos HT: 0.5–9.75, step 0.25
const R_ASIATICO_GOLS_HT = { min: 0.5,   max: 9.75,  step: 0.25 };
// Pontos basquete
const R_OU_PONTOS_FT     = { min: 79.5,  max: 149.5, step: 5.0  };
const R_OU_PONTOS_HT     = { min: 34.5,  max: 74.5,  step: 5.0  };
// HC gols
const R_AH_GOLS          = { min: -3.5,  max: 3.5,   step: 0.5  };
const R_EH_GOLS          = { min: -3.5,  max: 3.5,   step: 0.5  };
const R_AH_PONTOS        = { min: -14.5, max: 14.5,  step: 2.0  };
// Jogador
const R_JOGADOR_GOLS     = { min: 0.5,   max: 6.5,   step: 0.5  };
const R_JOGADOR_PONTOS   = { min: 9.5,   max: 39.5,  step: 5.0  };

const ESPORTES_BASKET = ['nba2k'];
const isBasket = (e) => ESPORTES_BASKET.includes(e);

export function getConfigMercado(mercadoValue, esporte = 'fifa') {
  const b = isBasket(esporte);
  const configs = {
    ml_ft:                       { inner: null,                                                      range: null,                               descricao: b ? 'Vencedor da partida (sem empate).' : 'Resultado final. Use Extras para Casa/Visitante/Favorito.' },
    ml_ht:                       { inner: null,                                                      range: null,                               descricao: b ? 'Vencedor do 1ºT (Q1+Q2).' : 'Resultado no intervalo (1ºT).' },
    over_under_ft:               { inner: ['Over','Under'],                                          range: b ? R_OU_PONTOS_FT : R_OU_GOLS,     descricao: b ? 'Total de pontos na partida (4 quartos).' : 'Total de gols na partida.' },
    over_under_ht:               { inner: ['Over','Under'],                                          range: b ? R_OU_PONTOS_HT : R_OU_GOLS_HT,  descricao: b ? 'Total de pontos no 1ºT.' : 'Total de gols no 1ºT.' },
    over_under_ft_ht_0x0:        { inner: ['Over','Under'],                                          range: R_OU_GOLS,                           descricao: 'Total de gols na partida somente quando o intervalo termina 0x0.' },
    over_under_ft_player:        { inner: ['Over','Under'],                                          range: b ? R_JOGADOR_PONTOS : R_JOGADOR_GOLS, descricao: b ? 'Pontos marcados pelo jogador alvo.' : 'Gols marcados pelo jogador alvo.' },
    over_under_ht_player:        { inner: ['Over','Under'],                                          range: b ? R_JOGADOR_PONTOS : R_JOGADOR_GOLS, descricao: b ? 'Pontos do jogador alvo no 1ºT.' : 'Gols do jogador alvo no 1ºT.' },
    over_under_ft_player_against:{ inner: ['Over','Under'],                                          range: R_JOGADOR_GOLS,                      descricao: 'Total de gols sofridos pelo jogador alvo.' },
    clean_sheet_ft_player:       { inner: ['Sim','Não'],                                             range: null,                               descricao: 'O jogador alvo não sofre nenhum gol na partida.' },
    ah_ft:                       { inner: ['Home','Away'],                                           range: b ? R_AH_PONTOS : R_AH_GOLS,        descricao: b ? 'Handicap asiático de pontos. Sem 0 (empate = void).' : 'Handicap asiático. Sem 0 (empate = void/devolução).' },
    ah_ht:                       { inner: ['Home','Away'],                                           range: b ? R_AH_PONTOS : R_AH_GOLS,        descricao: b ? 'HC asiático de pontos no 1ºT.' : 'HC asiático no 1ºT.' },
    eh_ft:                       { inner: ['Home','Draw','Away'],                                    range: R_EH_GOLS,                           descricao: 'HC europeu. Linha 0 = resultado exato (empate incluso).' },
    eh_ht:                       { inner: ['Home','Draw','Away'],                                    range: R_EH_GOLS,                           descricao: 'HC europeu no 1ºT.' },
    btts_ft:                     { inner: ['Sim','Não'],                                             range: null,                               descricao: 'Ambos os jogadores marcam pelo menos um gol na partida.' },
    btts_ht:                     { inner: ['Sim','Não'],                                             range: null,                               descricao: 'Ambos marcam no 1ºT.' },
    ml_btts_ft:                  { inner: ['Home/Sim','Home/Não','Draw/Sim','Draw/Não','Away/Sim','Away/Não'], range: null,                     descricao: 'Combinação resultado final + ambos marcam.' },
    ml_btts_ht:                  { inner: ['Home/Sim','Home/Não','Draw/Sim','Draw/Não','Away/Sim','Away/Não'], range: null,                     descricao: 'Combinação resultado 1ºT + ambos marcam.' },
    odd_even_ft:                 { inner: ['Par','Ímpar'],                                           range: null,                               descricao: 'Total de gols da partida é par ou ímpar.' },
    odd_even_ht:                 { inner: ['Par','Ímpar'],                                           range: null,                               descricao: 'Total de gols do 1ºT é par ou ímpar.' },
    asian_over_under_ft:         { inner: ['Over','Under'],                                          range: R_ASIATICO_GOLS,                     descricao: 'Over/Under asiático FT — step 0.25 (inclui 0.75, 1.25, 1.75...).' },
    asian_over_under_ht:         { inner: ['Over','Under'],                                          range: R_ASIATICO_GOLS_HT,                  descricao: 'Over/Under asiático HT — step 0.25.' },
    double_ml_ft:                { inner: ['Home/Draw','Away/Draw','Home/Away'],                     range: null,                               descricao: 'Duas das três possibilidades de resultado final.' },
    next_goal:                   { inner: ['Home','Away','Sem Gol'],                                 range: null,                               descricao: 'Quem marca o próximo gol da partida.' },
  };
  return configs[mercadoValue] || { inner: null, range: null, descricao: '' };
}

// Formata valor da linha:
//   Over/Under → sem sinal (1.5, 2.5, 0.5...)
//   HC e outros → com sinal (-1.5, +1.5, 0)
function fmtLinha(v, inner) {
  if (inner === 'Over' || inner === 'Under') return `${v}`;
  if (v === 0) return '0';
  return v > 0 ? `+${v}` : `${v}`;
}

function RangeSlider({ min, max, step, valueMin, valueMax, onChange, inner }) {
  const pctMin = ((valueMin - min) / (max - min)) * 100;
  const pctMax = ((valueMax - min) / (max - min)) * 100;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-[11px] font-mono font-bold" style={{ color: '#10b981' }}>
        <span>{fmtLinha(valueMin, inner)}</span>
        <span style={{ color: '#6b7691', fontSize: '10px' }}>até</span>
        <span>{fmtLinha(valueMax, inner)}</span>
      </div>

      <div className="relative h-6 flex items-center w-full">
        <div className="absolute inset-x-0 h-1 rounded-full" style={{ backgroundColor: 'rgba(60,85,130,0.4)' }} />
        <div className="absolute h-1 rounded-full" style={{ left: `${pctMin}%`, right: `${100 - pctMax}%`, backgroundColor: '#10b981' }} />
        <input type="range" min={min} max={max} step={step} value={valueMin}
          onChange={(e) => { const v = parseFloat(e.target.value); if (v <= valueMax) onChange(v, valueMax); }}
          className="mf-range absolute inset-x-0 w-full" />
        <input type="range" min={min} max={max} step={step} value={valueMax}
          onChange={(e) => { const v = parseFloat(e.target.value); if (v >= valueMin) onChange(valueMin, v); }}
          className="mf-range absolute inset-x-0 w-full" />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono" style={{ color: '#4a5470' }}>
        <span>{fmtLinha(min, inner)}</span>
        <span>step {step}</span>
        <span>{fmtLinha(max, inner)}</span>
      </div>

      <style>{`
        .mf-range { -webkit-appearance: none; appearance: none; background: transparent; height: 24px; pointer-events: none; }
        .mf-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 16px; height: 16px; border-radius: 50%;
          background: #10b981; cursor: pointer; pointer-events: auto;
          border: 2px solid #0b0f1a;
          box-shadow: 0 0 0 1px rgba(16,185,129,0.5), 0 2px 6px rgba(0,0,0,0.3);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .mf-range::-webkit-slider-thumb:hover { transform: scale(1.2); box-shadow: 0 0 0 3px rgba(16,185,129,0.25), 0 2px 8px rgba(0,0,0,0.4); }
        .mf-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #10b981; cursor: pointer; pointer-events: auto; border: 2px solid #0b0f1a; box-shadow: 0 0 0 1px rgba(16,185,129,0.5); }
      `}</style>
    </div>
  );
}

export default function MercadoFiltros({ mercado, esporte = 'fifa', inner, onInnerChange, linhaMin, linhaMax, onLinhaChange, mostrarDescricao = true }) {
  const cfg = getConfigMercado(mercado, esporte);

  useEffect(() => {
    if (cfg.inner) {
      if (!inner || !cfg.inner.includes(inner)) onInnerChange(cfg.inner[0]);
    } else {
      if (inner) onInnerChange(null);
    }
    if (cfg.range) {
      onLinhaChange(cfg.range.min, cfg.range.max);
    } else {
      onLinhaChange(null, null);
    }
  }, [mercado, esporte]); // eslint-disable-line

  const pill = (t) => (
    <span className="text-[10px] font-bold px-2 py-1 rounded flex-shrink-0" style={{ backgroundColor: '#10b981', color: '#fff' }}>{t}</span>
  );

  return (
    <div className="space-y-3 pt-2">
      {mostrarDescricao && cfg.descricao && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md text-[11px] leading-relaxed"
          style={{ backgroundColor: 'rgba(16,185,129,0.05)', border: '0.5px solid rgba(16,185,129,0.25)', color: '#6b7691' }}>
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} />
          <span>{cfg.descricao}</span>
        </div>
      )}

      {cfg.inner && cfg.inner.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {pill('SELEÇÃO')}
          <div className="flex flex-wrap gap-1.5">
            {cfg.inner.map(op => {
              const ativo = inner === op;
              return (
                <button key={op} onClick={() => onInnerChange(op)}
                  className="px-3 py-1 rounded text-[11px] font-semibold transition-all"
                  style={{
                    backgroundColor: ativo ? '#10b981' : 'rgba(60,85,130,0.2)',
                    color: ativo ? '#fff' : '#b8c0d4',
                    border: `0.5px solid ${ativo ? '#10b981' : 'rgba(60,85,130,0.5)'}`,
                    boxShadow: ativo ? '0 2px 8px rgba(16,185,129,0.3)' : 'none',
                    transform: ativo ? 'scale(1.04)' : 'scale(1)',
                  }}>
                  {op}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {cfg.range && linhaMin !== null && linhaMin !== undefined && linhaMax !== null && linhaMax !== undefined && (
        <div className="flex items-start gap-3">
          {pill('LINHA')}
          <div className="flex-1">
            <RangeSlider
              min={cfg.range.min} max={cfg.range.max} step={cfg.range.step}
              valueMin={linhaMin} valueMax={linhaMax} onChange={onLinhaChange}
              inner={inner}
            />
          </div>
        </div>
      )}

      {!cfg.inner && !cfg.range && (
        <p className="text-[11px] italic" style={{ color: '#6b7691' }}>Nenhuma linha ou seleção necessária para este mercado.</p>
      )}
    </div>
  );
}
