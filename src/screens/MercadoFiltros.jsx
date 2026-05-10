/**
 * MercadoFiltros.jsx — v8
 *
 * NOVIDADES v8:
 * - Toggle (switch) no pill SELEÇÃO: quando OFF, ignora filtro de lado
 * - Toggle (switch) no pill LINHA: quando OFF, ignora filtro de linha (qualquer linha aceita)
 * - Visual: quando inativo, conteúdo fica esmaecido e não-interativo
 * - Compatibilidade com versões anteriores: se props selecaoAtivo/linhaAtivo
 *   não forem passadas, assume ATIVO (comportamento antigo).
 *
 * `inner` aceita array (recomendado) ou string (legado, compatibilidade).
 * `inner = []` + selecaoAtivo=true: bot aceita qualquer lado (default ambos).
 * `selecaoAtivo = false`: bot ignora completamente o filtro de seleção.
 */

import { useEffect, useMemo } from 'react';
import { Info } from 'lucide-react';

// ════════════════════════════════════════════════════════════════════
// RANGES
// ════════════════════════════════════════════════════════════════════

const R_OU_GOLS          = { vals: Array.from({length: 31}, (_, i) => 0.5 + i)         };
const R_OU_GOLS_HT       = { vals: Array.from({length: 19}, (_, i) => 0.5 + i)         };
const R_ASIATICO_GOLS    = { vals: Array.from({length: 121}, (_, i) => 0.5 + i * 0.25) };
const R_ASIATICO_GOLS_HT = { vals: Array.from({length: 73}, (_, i) => 0.5 + i * 0.25)  };
const R_OU_PONTOS_FT     = { min: 79.5,  max: 249.5, step: 5.0  };
const R_OU_PONTOS_HT     = { min: 34.5,  max: 124.5, step: 5.0  };
const R_AH_GOLS          = { vals: Array.from({length: 42}, (_, i) => -10.5 + i) };
const R_EH_GOLS          = { vals: Array.from({length: 42}, (_, i) => -10.5 + i) };
const R_AH_PONTOS        = { vals: Array.from({length: 42}, (_, i) => -10.5 + i) };
const R_JOGADOR_GOLS     = { vals: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5] };
const R_JOGADOR_PONTOS   = { min: 9.5,   max: 39.5,  step: 5.0  };

const ESPORTES_BASKET = ['nba2k'];
const isBasket = (e) => ESPORTES_BASKET.includes(e);

export function getConfigMercado(mercadoValue, esporte = 'fifa') {
  const b = isBasket(esporte);
  const configs = {
    ml_ft:                       { inner: b ? ['Casa','Fora'] : ['Casa','Empate','Fora'],            range: null,                               descricao: b ? 'Vencedor da partida (sem empate).' : 'Resultado final.' },
    ml_ht:                       { inner: b ? ['Casa','Fora'] : ['Casa','Empate','Fora'],            range: null,                               descricao: b ? 'Vencedor do 1ºT (Q1+Q2).' : 'Resultado no intervalo (1ºT).' },
    over_under_ft:               { inner: ['Over','Under'],                                          range: b ? R_OU_PONTOS_FT : R_OU_GOLS,     descricao: b ? 'Total de pontos na partida (4 quartos).' : 'Total de gols na partida.' },
    over_under_ht:               { inner: ['Over','Under'],                                          range: b ? R_OU_PONTOS_HT : R_OU_GOLS_HT,  descricao: b ? 'Total de pontos no 1ºT.' : 'Total de gols no 1ºT.' },
    over_under_ft_ht_0x0:        { inner: ['Over','Under'],                                          range: R_OU_GOLS,                           descricao: 'Total de gols — somente quando intervalo termina 0x0.' },
    over_under_ft_player:        { inner: ['Over','Under'],                                          range: b ? R_JOGADOR_PONTOS : R_JOGADOR_GOLS, descricao: b ? 'Pontos marcados pelo jogador alvo.' : 'Gols marcados pelo jogador alvo.' },
    over_under_ht_player:        { inner: ['Over','Under'],                                          range: b ? R_JOGADOR_PONTOS : R_JOGADOR_GOLS, descricao: b ? 'Pontos do jogador alvo no 1ºT.' : 'Gols do jogador alvo no 1ºT.' },
    over_under_ft_player_against:{ inner: ['Over','Under'],                                          range: R_JOGADOR_GOLS,                      descricao: 'Total de gols sofridos pelo jogador alvo.' },
    clean_sheet_ft_player:       { inner: ['Sim','Não'],                                             range: null,                               descricao: 'O jogador alvo não sofre nenhum gol na partida.' },
    ah_ft:                       { inner: null,                                                     range: b ? R_AH_PONTOS : R_AH_GOLS,         descricao: b ? 'Handicap asiático de pontos. Sem 0 (empate = void).' : 'Handicap asiático. Sem 0 (empate = void).' },
    ah_ht:                       { inner: null,                                                     range: b ? R_AH_PONTOS : R_AH_GOLS,         descricao: b ? 'HC asiático de pontos no 1ºT.' : 'HC asiático no 1ºT.' },
    eh_ft:                       { inner: null,                                                     range: R_EH_GOLS,                           descricao: 'HC europeu. Linha 0 = resultado exato (empate incluso).' },
    eh_ht:                       { inner: null,                                                     range: R_EH_GOLS,                           descricao: 'HC europeu no 1ºT.' },
    btts_ft:                     { inner: ['Sim','Não'],                                             range: null,                               descricao: 'Ambos os jogadores marcam pelo menos um gol na partida.' },
    btts_ht:                     { inner: ['Sim','Não'],                                             range: null,                               descricao: 'Ambos marcam no 1ºT.' },
    ml_btts_ft:                  { inner: ['Casa/Sim','Casa/Não','Empate/Sim','Empate/Não','Fora/Sim','Fora/Não'], range: null,                     descricao: 'Combinação resultado final + ambos marcam.' },
    ml_btts_ht:                  { inner: ['Casa/Sim','Casa/Não','Empate/Sim','Empate/Não','Fora/Sim','Fora/Não'], range: null,                     descricao: 'Combinação resultado 1ºT + ambos marcam.' },
    odd_even_ft:                 { inner: ['Par','Ímpar'],                                           range: null,                               descricao: 'Total de gols da partida é par ou ímpar.' },
    odd_even_ht:                 { inner: ['Par','Ímpar'],                                           range: null,                               descricao: 'Total de gols do 1ºT é par ou ímpar.' },
    asian_over_under_ft:         { inner: ['Over','Under'],                                          range: R_ASIATICO_GOLS,                     descricao: 'Over/Under asiático FT — começa em 0.5, step 0.25 (0.5, 0.75, 1.0, 1.25...).' },
    asian_over_under_ht:         { inner: ['Over','Under'],                                          range: R_ASIATICO_GOLS_HT,                  descricao: 'Over/Under asiático HT — começa em 0.5, step 0.25 (0.5, 0.75, 1.0, 1.25...).' },
    double_ml_ft:                { inner: ['Casa/Empate','Fora/Empate','Casa/Fora'],                 range: null,                                descricao: 'Duas das três possibilidades de resultado final.' },
    next_goal:                   { inner: ['Casa','Fora','Sem Gol'],                                 range: null,                               descricao: 'Quem marca o próximo gol da partida.' },
  };
  return configs[mercadoValue] || { inner: null, range: null, descricao: '' };
}

function fmtLinha(v, primeiroInner) {
  if (primeiroInner === 'Over' || primeiroInner === 'Under') return `${v}`;
  if (v === 0) return '0';
  return v > 0 ? `+${v}` : `${v}`;
}

function normalizeInner(inner) {
  if (Array.isArray(inner)) return inner;
  if (typeof inner === 'string' && inner.length > 0) return [inner];
  return [];
}

// ════════════════════════════════════════════════════════════════════
// SLIDERS (inalterados de v7)
// ════════════════════════════════════════════════════════════════════
function MappedRangeSlider({ vals, valueMin, valueMax, onChange, primeiroInner }) {
  const idxMin = vals.indexOf(valueMin);
  const idxMax = vals.indexOf(valueMax);
  const safeIdxMin = idxMin >= 0 ? idxMin : 0;
  const safeIdxMax = idxMax >= 0 ? idxMax : vals.length - 1;
  const pctMin = (safeIdxMin / (vals.length - 1)) * 100;
  const pctMax = (safeIdxMax / (vals.length - 1)) * 100;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-[11px] font-mono font-bold" style={{ color: '#10b981' }}>
        <span>{fmtLinha(valueMin, primeiroInner)}</span>
        <span style={{ color: '#6b7691', fontSize: '10px' }}>até</span>
        <span>{fmtLinha(valueMax, primeiroInner)}</span>
      </div>
      <div className="relative h-6 flex items-center w-full">
        <div className="absolute inset-x-0 h-1 rounded-full" style={{ backgroundColor: 'rgba(60,85,130,0.4)' }} />
        <div className="absolute h-1 rounded-full" style={{ left: `${pctMin}%`, right: `${100 - pctMax}%`, backgroundColor: '#10b981' }} />
        <input type="range" min={0} max={vals.length - 1} step={1} value={safeIdxMin}
          onChange={(e) => { const i = parseInt(e.target.value); if (i <= safeIdxMax) onChange(vals[i], valueMax); }}
          className="mf-range absolute inset-x-0 w-full" />
        <input type="range" min={0} max={vals.length - 1} step={1} value={safeIdxMax}
          onChange={(e) => { const i = parseInt(e.target.value); if (i >= safeIdxMin) onChange(valueMin, vals[i]); }}
          className="mf-range absolute inset-x-0 w-full" />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono" style={{ color: '#4a5470' }}>
        <span>{fmtLinha(vals[0], primeiroInner)}</span>
        <span>apenas .5</span>
        <span>{fmtLinha(vals[vals.length - 1], primeiroInner)}</span>
      </div>
    </div>
  );
}

function ContinuousRangeSlider({ min, max, step, valueMin, valueMax, onChange, primeiroInner }) {
  const pctMin = ((valueMin - min) / (max - min)) * 100;
  const pctMax = ((valueMax - min) / (max - min)) * 100;
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-[11px] font-mono font-bold" style={{ color: '#10b981' }}>
        <span>{fmtLinha(valueMin, primeiroInner)}</span>
        <span style={{ color: '#6b7691', fontSize: '10px' }}>até</span>
        <span>{fmtLinha(valueMax, primeiroInner)}</span>
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
        <span>{fmtLinha(min, primeiroInner)}</span>
        <span>step {step}</span>
        <span>{fmtLinha(max, primeiroInner)}</span>
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

  .mf-check {
    appearance: none;
    width: 16px; height: 16px;
    border-radius: 4px;
    border: 1.5px solid rgba(80, 110, 170, 0.7);
    background: transparent;
    cursor: pointer;
    position: relative;
    transition: all 0.18s cubic-bezier(0.22, 1, 0.36, 1);
    flex-shrink: 0;
  }
  .mf-check:hover { border-color: rgba(16, 185, 129, 0.7); background: rgba(16, 185, 129, 0.05); }
  .mf-check:checked { background: #10b981; border-color: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); }
  .mf-check:checked::after {
    content: '';
    position: absolute;
    left: 5px; top: 1.5px;
    width: 4px; height: 9px;
    border: solid #0b0f1a;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  /* Switch pequeno pra ativar/desativar filtros */
  .mf-switch {
    position: relative;
    width: 32px;
    height: 18px;
    border-radius: 9999px;
    cursor: pointer;
    transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    border: none;
    padding: 0;
  }
  .mf-switch.off { background-color: #4a5470; }
  .mf-switch.on  { background-color: #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.35); }
  .mf-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: white;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  .mf-switch.on::after {
    transform: translateX(14px);
    box-shadow: 0 2px 5px rgba(16, 185, 129, 0.45);
  }
`;

function valorValidoParaRange(v, range) {
  if (v === null || v === undefined || isNaN(v)) return false;
  if (range.vals) return range.vals.some(rv => Math.abs(rv - v) < 0.01);
  if (range.min !== undefined && range.max !== undefined) return v >= range.min && v <= range.max;
  return false;
}

// ════════════════════════════════════════════════════════════════════
// Switch (toggle on/off pequeno)
// ════════════════════════════════════════════════════════════════════
function Switch({ ativo, onChange, title }) {
  return (
    <button
      type="button"
      className={`mf-switch ${ativo ? 'on' : 'off'}`}
      onClick={() => onChange(!ativo)}
      title={title || (ativo ? 'Filtro ativo (clique pra desativar)' : 'Filtro desativado (clique pra ativar)')}
      aria-label={title}
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════════════════
export default function MercadoFiltros({
  mercado,
  esporte = 'fifa',
  inner,
  onInnerChange,
  linhaMin,
  linhaMax,
  onLinhaChange,
  mostrarDescricao = true,

  // NOVAS props (v8) - opcionais pra retro-compatibilidade
  selecaoAtivo,           // bool: filtro de seleção (lado) ativo
  onSelecaoAtivoChange,   // fn(bool)
  linhaAtivo,             // bool: filtro de linha ativo
  onLinhaAtivoChange,     // fn(bool)
}) {
  const cfg = getConfigMercado(mercado, esporte);
  const innerArr = useMemo(() => normalizeInner(inner), [inner]);

  // Se a prop não veio (componente usado em outro lugar sem upgrade), assume ATIVO
  const selecaoAtivoEff = selecaoAtivo === undefined ? true : !!selecaoAtivo;
  const linhaAtivoEff = linhaAtivo === undefined ? true : !!linhaAtivo;

  const temToggleSelecao = onSelecaoAtivoChange !== undefined;
  const temToggleLinha = onLinhaAtivoChange !== undefined;

  const primeiroValor = (r) => r.vals ? r.vals[0] : r.min;
  const ultimoValor   = (r) => r.vals ? r.vals[r.vals.length - 1] : r.max;

  // Reset inteligente quando muda mercado/esporte
  useEffect(() => {
    if (cfg.inner) {
      const validas = innerArr.filter(op => cfg.inner.includes(op));
      if (validas.length !== innerArr.length) {
        onInnerChange(validas);
      }
    } else {
      if (innerArr.length > 0) onInnerChange([]);
    }

    if (cfg.range) {
      const minOk = valorValidoParaRange(linhaMin, cfg.range);
      const maxOk = valorValidoParaRange(linhaMax, cfg.range);
      if (!minOk || !maxOk) {
        onLinhaChange(primeiroValor(cfg.range), ultimoValor(cfg.range));
      }
    } else {
      if (linhaMin !== null || linhaMax !== null) {
        onLinhaChange(null, null);
      }
    }
    // eslint-disable-next-line
  }, [mercado, esporte]);

  const toggleOpcao = (opcao) => {
    if (innerArr.includes(opcao)) {
      onInnerChange(innerArr.filter(o => o !== opcao));
    } else {
      onInnerChange([...innerArr, opcao]);
    }
  };

  const pill = (texto, ativo = true) => (
    <span
      className="text-[10px] font-bold px-2 py-1 rounded flex-shrink-0 transition"
      style={{
        backgroundColor: ativo ? '#10b981' : '#4a5470',
        color: '#fff',
        opacity: ativo ? 1 : 0.7,
      }}
    >
      {texto}
    </span>
  );

  const primeiroInner = innerArr[0] || (cfg.inner ? cfg.inner[0] : null);

  const renderSlider = () => {
    if (!cfg.range || linhaMin === null || linhaMin === undefined || linhaMax === null || linhaMax === undefined) return null;
    const r = cfg.range;
    if (r.vals) {
      return <MappedRangeSlider vals={r.vals} valueMin={linhaMin} valueMax={linhaMax} onChange={onLinhaChange} primeiroInner={primeiroInner} />;
    }
    return <ContinuousRangeSlider min={r.min} max={r.max} step={r.step} valueMin={linhaMin} valueMax={linhaMax} onChange={onLinhaChange} primeiroInner={primeiroInner} />;
  };

  // Hint da seleção
  const hintLado = !selecaoAtivoEff
    ? 'Filtro de seleção desativado: o bot aceita qualquer lado'
    : innerArr.length === 0
    ? 'Nenhum lado marcado: o bot aceita qualquer lado (padrão: ambos)'
    : innerArr.length === 1
    ? `O bot só vai apostar em ${innerArr[0]}`
    : `O bot vai apostar em: ${innerArr.join(', ')}`;

  // Hint da linha
  const hintLinha = !linhaAtivoEff
    ? 'Filtro de linha desativado: o bot aceita qualquer linha'
    : null;

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

      {/* SELEÇÃO (checkbox múltiplo, com toggle on/off opcional) */}
      {cfg.inner && cfg.inner.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Toggle opcional (só aparece se a prop foi passada) */}
            {temToggleSelecao && (
              <Switch
                ativo={selecaoAtivoEff}
                onChange={onSelecaoAtivoChange}
                title={selecaoAtivoEff ? 'Filtro de seleção ATIVO — clique pra desativar (aceita qualquer lado)' : 'Filtro de seleção DESATIVADO — clique pra ativar'}
              />
            )}
            {pill('SELEÇÃO', selecaoAtivoEff)}
            <div
              className="flex flex-wrap gap-x-4 gap-y-1.5 transition"
              style={{
                opacity: selecaoAtivoEff ? 1 : 0.35,
                pointerEvents: selecaoAtivoEff ? 'auto' : 'none',
              }}
            >
              {cfg.inner.map(op => {
                const ativo = innerArr.includes(op);
                return (
                  <label key={op} className="flex items-center gap-1.5 cursor-pointer select-none transition"
                    style={{ opacity: ativo ? 1 : 0.85 }}>
                    <input
                      type="checkbox"
                      className="mf-check"
                      checked={ativo}
                      onChange={() => toggleOpcao(op)}
                      disabled={!selecaoAtivoEff}
                    />
                    <span className="text-[11px] font-semibold" style={{ color: ativo ? '#10b981' : '#b8c0d4' }}>
                      {op}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div
            className="text-[10px] italic ml-[78px] transition"
            style={{
              color: !selecaoAtivoEff
                ? '#6b7691'
                : (innerArr.length === 0 ? '#6b7691' : '#10b981'),
              opacity: 0.85,
            }}
          >
            {hintLado}
          </div>
        </div>
      )}

      {/* LINHA (slider, com toggle on/off opcional) */}
      {cfg.range && linhaMin !== null && linhaMin !== undefined && (
        <div className="space-y-1.5">
          <div className="flex items-start gap-3">
            {temToggleLinha && (
              <div className="pt-1">
                <Switch
                  ativo={linhaAtivoEff}
                  onChange={onLinhaAtivoChange}
                  title={linhaAtivoEff ? 'Filtro de linha ATIVO — clique pra desativar (aceita qualquer linha)' : 'Filtro de linha DESATIVADO — clique pra ativar'}
                />
              </div>
            )}
            <div className="pt-1">{pill('LINHA', linhaAtivoEff)}</div>
            <div
              className="flex-1 transition"
              style={{
                opacity: linhaAtivoEff ? 1 : 0.35,
                pointerEvents: linhaAtivoEff ? 'auto' : 'none',
              }}
            >
              {renderSlider()}
            </div>
          </div>
          {hintLinha && (
            <div className="text-[10px] italic ml-[78px]" style={{ color: '#6b7691', opacity: 0.85 }}>
              {hintLinha}
            </div>
          )}
        </div>
      )}

      {!cfg.inner && !cfg.range && (
        <p className="text-[11px] italic" style={{ color: '#6b7691' }}>Nenhuma linha ou seleção necessária para este mercado.</p>
      )}
    </div>
  );
}
