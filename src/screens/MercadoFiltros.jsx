/**
 * MercadoFiltros.jsx — v2
 * Filtros dinâmicos por mercado + esporte.
 *
 * Uso no CriarBot.jsx — adicionar prop esporte:
 *   <MercadoFiltros
 *     mercado={mercado}
 *     esporte={esporte}
 *     inner={inner}
 *     onInnerChange={setInner}
 *     linha={linha}
 *     onLinhaChange={setLinha}
 *   />
 */

import { useEffect } from 'react';
import { Info } from 'lucide-react';

const LINHAS_OU_GOLS          = [0.5,1.5,2.5,3.5,4.5,5.5,6.5,7.5,8.5,9.5,10.5,11.5,12.5,13.5,14.5,15.5,16.5];
const LINHAS_OU_PONTOS_FT     = [79.5,84.5,89.5,94.5,99.5,104.5,109.5,114.5,119.5,124.5,129.5,134.5,139.5,144.5,149.5];
const LINHAS_OU_PONTOS_HT     = [34.5,39.5,44.5,49.5,54.5,59.5,64.5,69.5,74.5];
const LINHAS_AH_GOLS          = [-3.5,-3,-2.5,-2,-1.5,-1,-0.5,0.5,1,1.5,2,2.5,3,3.5];   // sem 0
const LINHAS_EH_GOLS          = [-3.5,-3,-2.5,-2,-1.5,-1,-0.5,0,0.5,1,1.5,2,2.5,3,3.5]; // com 0
const LINHAS_AH_PONTOS        = [-14.5,-12.5,-10.5,-8.5,-6.5,-4.5,-2.5,-0.5,0.5,2.5,4.5,6.5,8.5,10.5,12.5,14.5];
const LINHAS_ASIATICO_GOLS    = [0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10];
const LINHAS_JOGADOR_GOLS     = [0.5,1.5,2.5,3.5,4.5,5.5,6.5];
const LINHAS_JOGADOR_PONTOS   = [9.5,14.5,19.5,24.5,29.5,34.5,39.5];

const ESPORTES_BASKET = ['nba2k'];
const isBasket = (e) => ESPORTES_BASKET.includes(e);

export function getConfigMercado(mercadoValue, esporte = 'fifa') {
  const b = isBasket(esporte);
  const configs = {
    ml_ft:                       { inner: null,                                                      linhas: null,                              descricao: b ? 'Vencedor da partida (sem empate). Use Extras para Favorito/Azarão.' : 'Resultado final. Use Extras para Casa/Visitante/Favorito.' },
    ml_ht:                       { inner: null,                                                      linhas: null,                              descricao: b ? 'Vencedor do primeiro tempo (Q1+Q2).' : 'Resultado no intervalo (1ºT). Use Extras para Casa/Visitante/Favorito.' },
    over_under_ft:               { inner: ['Over','Under'],                                          linhas: b ? LINHAS_OU_PONTOS_FT : LINHAS_OU_GOLS,      descricao: b ? 'Total de pontos na partida (4 quartos).' : 'Total de gols na partida.' },
    over_under_ht:               { inner: ['Over','Under'],                                          linhas: b ? LINHAS_OU_PONTOS_HT : LINHAS_OU_GOLS,      descricao: b ? 'Total de pontos no 1ºT (Q1+Q2).' : 'Total de gols no primeiro tempo.' },
    over_under_ft_ht_0x0:        { inner: ['Over','Under'],                                          linhas: LINHAS_OU_GOLS,                    descricao: 'Total de gols na partida somente quando o intervalo termina 0x0.' },
    over_under_ft_player:        { inner: ['Over','Under'],                                          linhas: b ? LINHAS_JOGADOR_PONTOS : LINHAS_JOGADOR_GOLS, descricao: b ? 'Pontos marcados pelo jogador alvo.' : 'Gols marcados pelo jogador alvo.' },
    over_under_ht_player:        { inner: ['Over','Under'],                                          linhas: b ? LINHAS_JOGADOR_PONTOS : LINHAS_JOGADOR_GOLS, descricao: b ? 'Pontos do jogador alvo no 1ºT.' : 'Gols do jogador alvo no primeiro tempo.' },
    over_under_ft_player_against:{ inner: ['Over','Under'],                                          linhas: LINHAS_JOGADOR_GOLS,               descricao: 'Total de gols sofridos pelo jogador alvo.' },
    clean_sheet_ft_player:       { inner: ['Sim','Não'],                                             linhas: null,                              descricao: 'O jogador alvo não sofre nenhum gol na partida.' },
    ah_ft:                       { inner: ['Home','Away'],                                           linhas: b ? LINHAS_AH_PONTOS : LINHAS_AH_GOLS,          descricao: b ? 'Handicap asiático de pontos — sem 0 (empate = void).' : 'Handicap asiático — sem 0 (empate = void/devolução).' },
    ah_ht:                       { inner: ['Home','Away'],                                           linhas: b ? LINHAS_AH_PONTOS : LINHAS_AH_GOLS,          descricao: b ? 'HC asiático de pontos no 1ºT.' : 'HC asiático no primeiro tempo.' },
    eh_ft:                       { inner: ['Home','Draw','Away'],                                    linhas: LINHAS_EH_GOLS,                    descricao: 'HC europeu — linha 0 = resultado exato (empate incluso).' },
    eh_ht:                       { inner: ['Home','Draw','Away'],                                    linhas: LINHAS_EH_GOLS,                    descricao: 'HC europeu no primeiro tempo.' },
    btts_ft:                     { inner: ['Sim','Não'],                                             linhas: null,                              descricao: 'Ambos marcam pelo menos um gol na partida.' },
    btts_ht:                     { inner: ['Sim','Não'],                                             linhas: null,                              descricao: 'Ambos marcam no primeiro tempo.' },
    ml_btts_ft:                  { inner: ['Home/Sim','Home/Não','Draw/Sim','Draw/Não','Away/Sim','Away/Não'], linhas: null,                    descricao: 'Combinação resultado final + ambos marcam.' },
    ml_btts_ht:                  { inner: ['Home/Sim','Home/Não','Draw/Sim','Draw/Não','Away/Sim','Away/Não'], linhas: null,                    descricao: 'Combinação resultado 1ºT + ambos marcam.' },
    odd_even_ft:                 { inner: ['Par','Ímpar'],                                           linhas: null,                              descricao: 'Total de gols da partida é par ou ímpar.' },
    odd_even_ht:                 { inner: ['Par','Ímpar'],                                           linhas: null,                              descricao: 'Total de gols do 1ºT é par ou ímpar.' },
    asian_over_under_ft:         { inner: ['Over','Under'],                                          linhas: LINHAS_ASIATICO_GOLS,              descricao: 'Over/Under asiático. Linhas inteiras = push/devolução parcial.' },
    asian_over_under_ht:         { inner: ['Over','Under'],                                          linhas: LINHAS_ASIATICO_GOLS,              descricao: 'Over/Under asiático no primeiro tempo.' },
    double_ml_ft:                { inner: ['Home/Draw','Away/Draw','Home/Away'],                     linhas: null,                              descricao: 'Duas das três possibilidades de resultado final.' },
    next_goal:                   { inner: ['Home','Away','Sem Gol'],                                 linhas: null,                              descricao: 'Quem marca o próximo gol da partida.' },
  };
  return configs[mercadoValue] || { inner: null, linhas: null, descricao: '' };
}

export default function MercadoFiltros({ mercado, esporte = 'fifa', inner, onInnerChange, linha, onLinhaChange, mostrarDescricao = true }) {
  const cfg = getConfigMercado(mercado, esporte);

  useEffect(() => {
    if (cfg.inner) {
      if (!inner || !cfg.inner.includes(inner)) onInnerChange(cfg.inner[0]);
    } else {
      if (inner) onInnerChange(null);
    }
    if (!cfg.linhas) {
      if (linha !== null && linha !== undefined) onLinhaChange(null);
    } else if (linha !== null && linha !== undefined && !cfg.linhas.includes(linha)) {
      onLinhaChange(null);
    }
  }, [mercado, esporte]); // eslint-disable-line

  const pill = (t) => (
    <span className="text-[10px] font-bold px-2 py-1 rounded flex-shrink-0" style={{ backgroundColor: '#10b981', color: '#fff' }}>{t}</span>
  );

  const fmt = (l) => l === 0 ? '0' : l > 0 ? `+${l}` : `${l}`;

  return (
    <div className="space-y-3 pt-2">
      {mostrarDescricao && cfg.descricao && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md text-[11px] leading-relaxed" style={{ backgroundColor: 'rgba(16,185,129,0.05)', border: '0.5px solid rgba(16,185,129,0.25)', color: '#6b7691' }}>
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
                <button key={op} onClick={() => onInnerChange(op)} className="px-3 py-1 rounded text-[11px] font-semibold transition-all"
                  style={{ backgroundColor: ativo ? '#10b981' : 'rgba(60,85,130,0.2)', color: ativo ? '#fff' : '#b8c0d4', border: `0.5px solid ${ativo ? '#10b981' : 'rgba(60,85,130,0.5)'}`, boxShadow: ativo ? '0 2px 8px rgba(16,185,129,0.3)' : 'none', transform: ativo ? 'scale(1.04)' : 'scale(1)' }}>
                  {op}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {cfg.linhas && cfg.linhas.length > 0 && (
        <div className="flex items-start gap-3 flex-wrap">
          {pill('LINHA')}
          <div className="flex flex-wrap gap-1.5">
            {cfg.linhas.map(l => {
              const ativo = linha === l;
              return (
                <button key={l} onClick={() => onLinhaChange(ativo ? null : l)} className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all"
                  style={{ backgroundColor: ativo ? '#10b981' : 'rgba(60,85,130,0.15)', color: ativo ? '#fff' : '#b8c0d4', border: `0.5px solid ${ativo ? '#10b981' : 'rgba(60,85,130,0.35)'}`, boxShadow: ativo ? '0 2px 6px rgba(16,185,129,0.25)' : 'none' }}>
                  {fmt(l)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!cfg.inner && !cfg.linhas && (
        <p className="text-[11px] italic" style={{ color: '#6b7691' }}>Nenhuma linha ou seleção necessária para este mercado.</p>
      )}
    </div>
  );
}
