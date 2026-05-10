/**
 * MercadoFiltros.jsx — v6
 * Slider com valores mapeados para garantir apenas .5 no Over/Under
 */

import { useEffect, useMemo } from 'react';
import { Info } from 'lucide-react';

// ══════════════════════════════════════════════════════════════════
// RANGES
// ══════════════════════════════════════════════════════════════════

// Over/Under gols: APENAS valores .5 (0.5, 1.5, 2.5...)
const R_OU_GOLS          = { vals: Array.from({length: 31}, (_, i) => 0.5 + i)         }; // 0.5–30.5
const R_OU_GOLS_HT       = { vals: Array.from({length: 19}, (_, i) => 0.5 + i)         }; // 0.5–18.5
// Asiático: valores .25 (0.25, 0.5, 0.75, 1.0, 1.25...)  — inclui inteiros, é correto
const R_ASIATICO_GOLS    = { min: 0.25,  max: 15.75, step: 0.25 };
const R_ASIATICO_GOLS_HT = { min: 0.25,  max: 9.75,  step: 0.25 };
// Basquete
const R_OU_PONTOS_FT     = { min: 79.5,  max: 249.5, step: 5.0  };
const R_OU_PONTOS_HT     = { min: 34.5,  max: 124.5, step: 5.0  };
// HC
const R_AH_GOLS          = { vals: Array.from({length: 42}, (_, i) => -10.5 + i) }; // -10.5 a +10.5, apenas .5
const R_EH_GOLS          = { vals: Array.from({length: 42}, (_, i) => -10.5 + i) }; // -10.5 a +10.5, apenas .5
const R_AH_PONTOS        = { vals: Array.from({length: 42}, (_, i) => -10.5 + i) }; // -10.5 a +10.5, apenas .5
// Jogador
const R_JOGADOR_GOLS     = { vals: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5] };
const R_JOGADOR_PONTOS   = { min: 9.5,   max: 39.5,  step: 5.0  };

const ESPORTES_BASKET = ['nba2k'];
const isBasket = (e) => ESPORTES_BASKET.includes(e);

export function getConfigMercado(mercadoValue, esporte = 'fifa') {
  const b = isBasket(esporte);
  const configs = {
    ml_ft:                       { inner: null,                                                      range: null,                               descricao: b ? 'Vencedor da partida (sem empate).' : 'Resultado final.' },
    ml_ht:                       { inner: null,                                                      range: null,                               descricao: b ? 'Vencedor do 1ºT (Q1+Q2).' : 'Resultado no intervalo (1ºT).' },
    over_under_ft:               { inner: ['Over','Under'],                                          range: b ? R_OU_PONTOS_FT : R_OU_GOLS,     descricao: b ? 'Total de pontos na partida (4 quartos).' : 'Total de gols na partida.' },
    over_under_ht:               { inner: ['Over','Under'],                                          range: b ? R_OU_PONTOS_HT : R_OU_GOLS_HT,  descricao: b ? 'Total de pontos no 1ºT.' : 'Total de gols no 1ºT.' },
    over_under_ft_ht_0x0:        { inner: ['Over','Under'],                                          range: R_OU_GOLS,                           descricao: 'Total de gols — somente quando intervalo termina 0x0.' },
    over_under_ft_player:        { inner: ['Over','Under'],                                          range: b ? R_JOGADOR_PONTOS : R_JOGADOR_GOLS, descricao: b ? 'Pontos marcados pelo jogador alvo.' : 'Gols marcados pelo jogador alvo.' },
    over_under_ht_player:        { inner: ['Over','Under'],                                          range: b ? R_JOGADOR_PONTOS : R_JOGADOR_GOLS, descricao: b ? 'Pontos do jogador alvo no 1ºT.' : 'Gols do jogador alvo no 1ºT.' },
    over_under_ft_player_against:{ inner: ['Over','Under'],                                          range: R_JOGADOR_GOLS,                      descricao: 'Total de gols sofridos pelo jogador alvo.' },
    clean_sheet_ft_player:       { inner: ['Sim','Não'],                                             range: null,                               descricao: 'O jogador alvo não sofre nenhum gol na partida.' },
    ah_ft:                       { inner: null,                                           range: b ? R_AH_PONTOS : R_AH_GOLS,        descricao: b ? 'Handicap asiático de pontos. Sem 0 (empate = void).' : 'Handicap asiático. Sem 0 (empate = void).' },
    ah_ht:                       { inner: null,                                           range: b ? R_AH_PONTOS : R_AH_GOLS,        descricao: b ? 'HC asiático de pontos no 1ºT.' : 'HC asiático no 1ºT.' },
    eh_ft:                       { inner: ['Casa','Empate','Fora'],                                    range: R_EH_GOLS,                           descricao: 'HC europeu. Linha 0 = resultado exato (empate incluso).' },
    eh_ht:                       { inner: ['Casa','Empate','Fora'],                                    range: R_EH_GOLS,                           descricao: 'HC europeu no 1ºT.' },
    btts_ft:                     { inner: ['Sim','Não'],                                             range: null,                               descricao: 'Ambos os jogadores marcam pelo menos um gol na partida.' },
    btts_ht:                     { inner: ['Sim','Não'],                                             range: null,                               descricao: 'Ambos marcam no 1ºT.' },
    ml_btts_ft:                  { inner: ['Casa/Sim','Casa/Não','Empate/Sim','Empate/Não','Fora/Sim','Fora/Não'], range: null,                     descricao: 'Combinação resultado final + ambos marcam.' },
    ml_btts_ht:                  { inner: ['Casa/Sim','Casa/Não','Empate/Sim','Empate/Não','Fora/Sim','Fora/Não'], range: null,                     descricao: 'Combinação resultado 1ºT + ambos marcam.' },
    odd_even_ft:                 { inner: ['Par','Ímpar'],                                           range: null,                               descricao: 'Total de gols da partida é par ou ímpar.' },
    odd_even_ht:                 { inner: ['Par','Ímpar'],                                           range: null,                               descricao: 'Total de gols do 1ºT é par ou ímpar.' },
    asian_over_under_ft:         { inner: ['Over','Under'],                                          range: R_ASIATICO_GOLS,                     descricao: 'Over/Under asiático FT — step 0.25 (inclui 0.75, 1.25, 1.75...).' },
    asian_over_under_ht:         { inner: ['Over','Under'],                                          range: R_ASIATICO_GOLS_HT,                  descricao: 'Over/Under asiático HT — step 0.25.' },
    double_ml_ft:                { inner: ['Casa/Empate','Fora/Empate','Casa/Fora'],                     range: null,                               descricao: 'Duas das três possibilidades de resultado final.' },
    next_goal:                   { inner: ['Casa','Fora','Sem Gol'],                                 range: null,                               descricao: 'Quem marca o próximo gol da partida.' },
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

// ══════════════════════════════════════════════════════════════════
// Slider MAPEADO — usa índice internamente, exibe valor real
// Usado quando range tem { vals: [...] }
// ══════════════════════════════════════════════════════════════════
function MappedRangeSlider({ vals, valueMin, valueMax, onChange, inner }) {
  const idxMin = vals.indexOf(valueMin);
  const idxMax = vals.indexOf(valueMax);
  const safeIdxMin = idxMin >= 0 ? idxMin : 0;
  const safeIdxMax = idxMax >= 0 ? idxMax : vals.length - 1;

  const pctMin = (safeIdxMin / (vals.length - 1)) * 100;
  const pctMax = (safeIdxMax / (vals.length - 1)) * 100;

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
        <input type="range" min={0} max={vals.length - 1} step={1} value={safeIdxMin}
          onChange={(e) => {
            const i = parseInt(e.target.value);
            if (i <= safeIdxMax) onChange(vals[i], valueMax);
          }}
          className="mf-range absolute inset-x-0 w-full" />
        <input type="range" min={0} max={vals.length - 1} step={1} value={safeIdxMax}
          onChange={(e) => {
            const i = parseInt(e.target.value);
            if (i >= safeIdxMin) onChange(valueMin, vals[i]);
          }}
          className="mf-range absolute inset-x-0 w-full" />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono" style={{ color: '#4a5470' }}>
        <span>{fmtLinha(vals[0], inner)}</span>
        <span>apenas .5</span>
        <span>{fmtLinha(vals[vals.length - 1], inner)}</span>
      </div>
    </div>
  );
}

// Slider contínuo normal (para HC, basquete, asiático)
function ContinuousRangeSlider({ min, max, step, valueMin, valueMax, onChange, inner }) {
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
    </div>
  );
}

const sliderStyle = `
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
  .mf-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #10b981; cursor: pointer; pointer-events: auto; border: 2px solid #0b0f1a; }
`;

// Helper: verifica se valor está dentro do range (vals[] ou min/max/step)
function valorValidoParaRange(v, range) {
  if (v === null || v === undefined || isNaN(v)) return false;
  if (range.vals) {
    // Tolerância de ponto flutuante: aceita match com qualquer val em ±0.01
    return range.vals.some(rv => Math.abs(rv - v) < 0.01);
  }
  if (range.min !== undefined && range.max !== undefined) {
    return v >= range.min && v <= range.max;
  }
  return false;
}

export default function MercadoFiltros({ mercado, esporte = 'fifa', inner, onInnerChange, linhaMin, linhaMax, onLinhaChange, mostrarDescricao = true }) {
  const cfg = getConfigMercado(mercado, esporte);

  // Primeiro valor válido de um range
  const primeiroValor = (r) => r.vals ? r.vals[0] : r.min;
  const ultimoValor   = (r) => r.vals ? r.vals[r.vals.length - 1] : r.max;

  // Reset inteligente: só sobrescreve linha/inner quando os valores atuais
  // são INCOMPATÍVEIS com o mercado/esporte selecionado.
  // Em modo edição, os valores vêm do banco e devem ser preservados.
  useEffect(() => {
    // Inner: se o mercado tem opções, garante que `inner` é uma delas
    if (cfg.inner) {
      if (!inner || !cfg.inner.includes(inner)) onInnerChange(cfg.inner[0]);
    } else {
      if (inner) onInnerChange(null);
    }

    // Linha: só faz reset quando precisa
    if (cfg.range) {
      // Tem range — verifica se linha atual é compatível
      const minOk = valorValidoParaRange(linhaMin, cfg.range);
      const maxOk = valorValidoParaRange(linhaMax, cfg.range);
      if (!minOk || !maxOk) {
        // Linha atual incompatível com o range deste mercado: reseta pros extremos
        onLinhaChange(primeiroValor(cfg.range), ultimoValor(cfg.range));
      }
      // Senão: linha do banco/usuário é válida, preserva (não chama onLinhaChange)
    } else {
      // Mercado sem linha (ex: ml_ft) — limpa
      if (linhaMin !== null || linhaMax !== null) {
        onLinhaChange(null, null);
      }
    }
  }, [mercado, esporte]); // eslint-disable-line

  const pill = (t) => (
    <span className="text-[10px] font-bold px-2 py-1 rounded flex-shrink-0" style={{ backgroundColor: '#10b981', color: '#fff' }}>{t}</span>
  );

  const renderSlider = () => {
    if (!cfg.range || linhaMin === null || linhaMin === undefined || linhaMax === null || linhaMax === undefined) return null;
    const r = cfg.range;
    if (r.vals) {
      return (
        <MappedRangeSlider vals={r.vals} valueMin={linhaMin} valueMax={linhaMax} onChange={onLinhaChange} inner={inner} />
      );
    }
    return (
      <ContinuousRangeSlider min={r.min} max={r.max} step={r.step} valueMin={linhaMin} valueMax={linhaMax} onChange={onLinhaChange} inner={inner} />
    );
  };

  return (
    <div className="space-y-3 pt-2">
      <style>{sliderStyle}</style>

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

      {cfg.range && linhaMin !== null && linhaMin !== undefined && (
        <div className="flex items-start gap-3">
          {pill('LINHA')}
          <div className="flex-1">{renderSlider()}</div>
        </div>
      )}

      {!cfg.inner && !cfg.range && (
        <p className="text-[11px] italic" style={{ color: '#6b7691' }}>Nenhuma linha ou seleção necessária para este mercado.</p>
      )}
    </div>
  );
}
