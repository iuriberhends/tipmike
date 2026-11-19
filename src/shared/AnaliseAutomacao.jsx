// ============================================================
// shared/AnaliseAutomacao.jsx — análise da automação de UM bot
//
// Por dia (dia no fuso da casa), últimos 7 dias:
//   sinais → enviados (real) ou julgados (papel) → aceitos / "aceitaria"
//   → % de captura → G-R e dinheiro reais ao lado do G-R e ROI simulados
//   dos MESMOS sinais → tempo do tick ao envio.
// E o limite de stake que a casa impôs na conta, se houve.
// Os números vêm de GET /automacao/bots/:id/analise (a mesma conta do
// analise_por_bot.sql). O servidor só entrega bot do próprio usuário.
// ============================================================

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { ApiAutomacao } from '../lib/api.js';

const COR_MODO = { real: '#f43f5e', papel: '#fbbf24', desligado: '#8ba5a6' };

const dinheiro = (v, moeda) => (v === null || v === undefined
  ? '—'
  : `${v < 0 ? '−' : ''}${moeda ? `${moeda} ` : ''}${Math.abs(Number(v)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const pct = (v) => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const seg = (v) => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`);

function diaCurto(iso) {
  const [a, m, d] = String(iso).split('-');
  return a && m && d ? `${d}/${m}` : iso;
}

function ultimosDias(n, fuso) {
  // os n dias (aaaa-mm-dd) terminando hoje, no fuso da casa
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: fuso || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const dias = [];
  const agora = Date.now();
  for (let i = 0; i < n; i += 1) dias.push(fmt.format(new Date(agora - i * 86400000)));
  return dias;
}

export default function AnaliseAutomacao({ botId, onFechar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    setDados(null);
    setErro('');
    ApiAutomacao.analise(botId, 7)
      .then((d) => { if (vivo) setDados(d); })
      .catch((e) => { if (vivo) setErro((e && e.message) || 'Não deu para montar a análise.'); });
    return () => { vivo = false; };
  }, [botId]);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar?.(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const linhas = dados?.linhas || [];
  const porDia = {};
  linhas.forEach((l) => { (porDia[l.dia] = porDia[l.dia] || []).push(l); });
  const dias = dados ? ultimosDias(dados.dias || 7, dados.fuso) : [];
  const moeda = dados?.moeda || dados?.conta?.moeda || '';
  const th = 'py-2 px-2 font-bold whitespace-nowrap';
  const td = 'py-2 px-2 whitespace-nowrap';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'rgba(3, 6, 9, 0.8)' }} onClick={onFechar}>
      <div className="w-full max-w-5xl rounded-2xl p-5 my-6" role="dialog" aria-modal="true" aria-label="Análise da automação do bot"
        style={{ backgroundColor: 'rgba(10, 18, 22, 0.98)', border: '0.5px solid rgba(50, 100, 104, 0.5)', color: '#eef8f6' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-black truncate">Análise da automação{dados ? ` — ${dados.bot_nome}` : ''}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: '#6c8689' }}>
              Últimos 7 dias, por dia{dados ? ` (fuso ${dados.fuso})` : ''}. O simulado ao lado é o dos mesmos sinais que a casa aceitou
              (ou aceitaria, no papel).
            </p>
          </div>
          <div className="flex-1" />
          <button type="button" onClick={onFechar} className="text-slate-400 hover:text-slate-100 transition" title="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!dados && !erro && (
          <div className="flex items-center justify-center gap-2 text-xs py-10" style={{ color: '#6c8689' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Montando a análise...
          </div>
        )}
        {erro && <p className="text-xs py-6 text-center" style={{ color: '#fca5a5' }}>{erro}</p>}

        {dados && (
          <>
            <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
              <span className="px-2 py-1 rounded" style={{ border: `0.5px solid ${COR_MODO[dados.modo_atual] || '#8ba5a6'}`, color: COR_MODO[dados.modo_atual] || '#8ba5a6' }}>
                modo agora: <b>{dados.modo_atual}</b>
              </span>
              {dados.stake_atual !== null && dados.stake_atual !== undefined && (
                <span className="px-2 py-1 rounded" style={{ border: '0.5px solid rgba(50, 100, 104, 0.5)', color: '#b5c9c8' }}>
                  stake: <b>{dinheiro(dados.stake_atual, moeda)}</b>
                </span>
              )}
              {dados.conta ? (
                <>
                  <span className="px-2 py-1 rounded" style={{ border: '0.5px solid rgba(50, 100, 104, 0.5)', color: '#b5c9c8' }}>
                    conta: <b>{dados.conta.apelido}</b> ({dados.conta.estado})
                  </span>
                  <span className="px-2 py-1 rounded" style={{ border: '0.5px solid rgba(50, 100, 104, 0.5)', color: '#b5c9c8' }}
                    title={dados.conta.stake_max_aceita_fonte === 'bilhetes' ? 'Maior bilhete gravado nesta conta' : 'Anotado pelo braço'}>
                    maior stake que a casa já aceitou: <b>{dinheiro(dados.conta.stake_max_aceita, dados.conta.moeda)}</b>
                  </span>
                  <span className="px-2 py-1 rounded"
                    style={dados.conta.stake_min_cortada === null || dados.conta.stake_min_cortada === undefined
                      ? { border: '0.5px solid rgba(50, 100, 104, 0.5)', color: '#b5c9c8' }
                      : { border: '0.5px solid rgba(244, 63, 94, 0.5)', color: '#fda4af' }}>
                    limite de stake imposto pela casa:{' '}
                    <b>{dados.conta.stake_min_cortada === null || dados.conta.stake_min_cortada === undefined
                      ? 'nenhum registrado'
                      : dinheiro(dados.conta.stake_min_cortada, dados.conta.moeda)}</b>
                  </span>
                </>
              ) : (
                <span className="px-2 py-1 rounded" style={{ border: '0.5px solid rgba(50, 100, 104, 0.5)', color: '#6c8689' }}>sem conta</span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase" style={{ color: '#6c8689' }}>
                    <th className={th}>Dia</th>
                    <th className={th}>Modo</th>
                    <th className={`${th} text-right`}>Sinais</th>
                    <th className={`${th} text-right`} title="Real: enviados à casa. Papel: sinais que deu para julgar.">Enviados / julgados</th>
                    <th className={`${th} text-right`} title="Real: aceitos pela casa. Papel: a casa aceitaria.">Aceitos / aceitaria</th>
                    <th className={`${th} text-right`}>Captura</th>
                    <th className={`${th} text-right`} title="Greens e reds dos bilhetes de verdade">G-R real</th>
                    <th className={`${th} text-right`}>Dinheiro real</th>
                    <th className={`${th} text-right`} title="Greens e reds da simulação, só nos sinais aceitos (ou que seriam aceitos)">G-R simulado</th>
                    <th className={`${th} text-right`}>ROI simulado</th>
                    <th className={`${th} text-right`} title="Do tick lido pelo coletor até o envio (mediana)">Tick → envio</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((dia) => {
                    const doDia = porDia[dia];
                    if (!doDia) {
                      return (
                        <tr key={dia} style={{ borderTop: '0.5px solid rgba(50, 100, 104, 0.25)', color: '#3f5a60' }}>
                          <td className={td}>{diaCurto(dia)}</td>
                          <td className={td} colSpan={10}>sem sinal neste dia</td>
                        </tr>
                      );
                    }
                    return doDia.map((l) => {
                      const real = l.modo === 'real';
                      return (
                        <tr key={`${dia}-${l.modo}`} style={{ borderTop: '0.5px solid rgba(50, 100, 104, 0.25)' }}>
                          <td className={`${td} font-semibold`}>{diaCurto(dia)}</td>
                          <td className={td}><span className="font-bold" style={{ color: COR_MODO[l.modo] }}>{l.modo}</span></td>
                          <td className={`${td} text-right`}>
                            {l.sinais}
                            {l.barrados_risco > 0 && <span style={{ color: '#fcd34d' }} title="Barrados pela trava ou por limite de risco"> ({l.barrados_risco} barrados)</span>}
                          </td>
                          <td className={`${td} text-right`}>{l.enviados}</td>
                          <td className={`${td} text-right font-semibold`}>{l.aceitos}</td>
                          <td className={`${td} text-right font-bold`} style={{ color: '#2bcdb9' }}>{pct(l.captura_pct)}</td>
                          <td className={`${td} text-right`}>
                            {real ? `${l.g_real}-${l.r_real}` : '—'}
                            {real && l.abertos > 0 && <span style={{ color: '#6c8689' }}> ({l.abertos} em aberto)</span>}
                          </td>
                          <td className={`${td} text-right font-bold`}
                            style={{ color: !real || l.lucro_real === null ? '#6c8689' : (l.lucro_real >= 0 ? '#2bcdb9' : '#f43f5e') }}>
                            {real ? dinheiro(l.lucro_real, moeda) : '—'}
                            {real && l.roi_real_pct !== null && <span className="font-normal" style={{ color: '#6c8689' }}> ({pct(l.roi_real_pct)})</span>}
                          </td>
                          <td className={`${td} text-right`}>{l.g_sim}-{l.r_sim}</td>
                          <td className={`${td} text-right`}
                            style={{ color: l.roi_sim_pct === null ? '#6c8689' : (l.roi_sim_pct >= 0 ? '#2bcdb9' : '#f43f5e') }}
                            title={`Todos os sinais do dia, aceitos ou não: ${l.g_sim_todos}-${l.r_sim_todos}, ROI ${pct(l.roi_sim_todos_pct)}`}>
                            {pct(l.roi_sim_pct)}
                          </td>
                          <td className={`${td} text-right`}>{seg(l.tick_envio_mediana_s)}</td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
            {linhas.length === 0 && (
              <p className="text-[11px] text-center mt-3" style={{ color: '#6c8689' }}>
                Este bot não gerou sinal nos últimos 7 dias. Sinal só nasce com a automação em papel ou real.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
