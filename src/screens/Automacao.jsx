// ============================================================
// screens/Automacao.jsx — tela "Automação"
//
// Para todo mundo:
//   • Meu uso: o que o administrador liberou e quanto já está em uso
//   • Contas das casas (por apelido — nunca login nem senha)
//   • Bots com automação ligada (papel ou real), com pausar e análise
//   • Histórico: quem mudou o quê
// Só administrador:
//   • Trava geral: liga/desliga tudo que é real, stake máxima, perda
//     máxima por dia, perdido hoje
//   • vê as contas e os bots de todos; cria conta e define o dono
//
// As regras valem no servidor (routers/automacao.py). Usuário comum
// recebe só o que é dele; a trava geral nem é pedida para ele.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, History, Loader2, Lock, Pause, Pencil, Plus, RefreshCw,
  ShieldAlert, ShieldCheck, Wallet, X, Zap,
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import { EstadoErro, EstadoVazio } from '../shared/Estados.jsx';
import AnaliseAutomacao from '../shared/AnaliseAutomacao.jsx';
import { corDoModo, fmtDinheiro } from '../shared/AutomacaoBot.jsx';
import { ApiAdmin, ApiAutomacao } from '../lib/api.js';
import { usePais } from '../context/PaisContext.jsx';

const CARD = { backgroundColor: 'rgba(11, 21, 25, 0.6)', border: '0.5px solid rgba(50, 100, 104, 0.4)' };
const INPUT = { backgroundColor: 'rgba(6, 11, 15, 0.8)', border: '0.5px solid rgba(50, 100, 104, 0.4)', color: '#eef8f6' };
const LINHA = { borderTop: '0.5px solid rgba(50, 100, 104, 0.25)' };
const ESTADOS_CONTA = [
  { value: 'ativa', label: 'Ativa', cor: '#2bcdb9' },
  { value: 'pausada', label: 'Pausada', cor: '#fbbf24' },
  { value: 'limitada', label: 'Limitada pela casa', cor: '#fb923c' },
  { value: 'encerrada', label: 'Encerrada', cor: '#f43f5e' },
];
const corEstado = (e) => (ESTADOS_CONTA.find((x) => x.value === e) || ESTADOS_CONTA[0]).cor;

function fmtData(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return '—'; }
}

function Modal({ titulo, onFechar, children, largura = 'max-w-md', perigo = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3, 6, 9, 0.78)' }} onClick={onFechar}>
      <div className={`w-full ${largura} rounded-2xl p-6`} role="dialog" aria-modal="true" aria-label={titulo}
        style={{ ...CARD, backgroundColor: 'rgba(10, 18, 22, 0.98)', ...(perigo ? { border: '0.5px solid rgba(244, 63, 94, 0.5)' } : {}) }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black">{titulo}</h3>
          <button type="button" onClick={onFechar} className="text-slate-400 hover:text-slate-100 transition" title="Fechar"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Campo({ rotulo, children, ajuda }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-400 mb-1">{rotulo}</label>
      {children}
      {ajuda && <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{ajuda}</p>}
    </div>
  );
}

function Numero({ rotulo, valor, destaque }) {
  return (
    <div className="rounded-xl px-4 py-3 min-w-[130px]" style={{ backgroundColor: 'rgba(6, 11, 15, 0.6)', border: '0.5px solid rgba(50, 100, 104, 0.3)' }}>
      <div className="text-[10px] uppercase font-bold text-slate-500">{rotulo}</div>
      <div className="text-base font-black mt-0.5" style={{ color: destaque || '#eef8f6' }}>{valor}</div>
    </div>
  );
}

// ═════════════════════════ Trava geral (só admin) ═════════════════════════
function TravaGeral({ avisar }) {
  const [t, setT] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [ciente, setCiente] = useState(false);
  const [stakeMax, setStakeMax] = useState('');
  const [perdaMax, setPerdaMax] = useState('');

  const aplicar = useCallback((d) => {
    setT(d);
    setStakeMax(d.limites?.stake_max === null || d.limites?.stake_max === undefined ? '' : String(d.limites.stake_max));
    setPerdaMax(d.limites?.perda_max_dia === null || d.limites?.perda_max_dia === undefined ? '' : String(d.limites.perda_max_dia));
  }, []);

  const carregar = useCallback(async () => {
    setErro('');
    try { aplicar(await ApiAutomacao.trava()); } catch (e) { setErro((e && e.message) || 'Não deu para ler a trava geral.'); }
  }, [aplicar]);
  useEffect(() => { carregar(); }, [carregar]);

  const mudar = async (ligada, confirmar = false) => {
    setOcupado(true);
    try {
      aplicar(await ApiAutomacao.mudarTrava({ ligada, confirmar }));
      avisar(ligada ? 'Trava geral LIGADA: nenhuma aposta real sai.' : 'Trava geral desligada: os bots em real voltam a apostar.', ligada ? 'success' : 'warn');
      setConfirmando(false);
      setCiente(false);
    } catch (e) {
      avisar((e && e.message) || 'Não deu para mudar a trava.', 'error');
    } finally { setOcupado(false); }
  };

  const limitesMudaram = t && (String(t.limites?.stake_max ?? '') !== stakeMax.trim() || String(t.limites?.perda_max_dia ?? '') !== perdaMax.trim());
  const limitesValidos = Number(stakeMax) > 0 && Number(perdaMax) > 0;
  const salvarLimites = async () => {
    setOcupado(true);
    try {
      aplicar(await ApiAutomacao.limitesGlobais({ stake_max: Number(stakeMax), perda_max_dia: Number(perdaMax) }));
      avisar('Limites gerais gravados.', 'success');
    } catch (e) {
      avisar((e && e.message) || 'Não deu para gravar os limites.', 'error');
    } finally { setOcupado(false); }
  };

  const perdido = t ? Number(t.perdido_hoje || 0) : 0;

  return (
    <section className="rounded-2xl p-5" style={{ ...CARD, ...(t && !t.ligada ? {} : { border: '0.5px solid rgba(251, 191, 36, 0.45)' }) }} data-secao="trava">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {t && t.ligada ? <ShieldAlert className="w-4 h-4" style={{ color: '#fbbf24' }} /> : <ShieldCheck className="w-4 h-4" style={{ color: '#2bcdb9' }} />}
        <h2 className="text-sm font-black tracking-tight">Trava geral</h2>
        <span className="text-[11px] text-slate-500">só o administrador vê e muda</span>
        <div className="flex-1" />
        <button type="button" onClick={carregar} className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 transition" title="Recarregar">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {erro && <EstadoErro mensagem={erro} onTentar={carregar} />}
      {!t && !erro && <div className="flex items-center gap-2 text-xs text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Lendo a trava...</div>}

      {t && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[240px]">
              <div className="text-lg font-black" style={{ color: t.ligada ? '#fbbf24' : '#2bcdb9' }}>
                {t.ligada ? 'LIGADA — nenhuma aposta real sai' : 'Desligada — os bots em real apostam'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Mudou por último: {t.atualizado_por || '—'}, {fmtData(t.atualizado_em)}{t.motivo ? ` · ${t.motivo}` : ''}
              </div>
              <div className="text-[11px] text-slate-500">A trava não mexe no papel nem na simulação: só segura dinheiro.</div>
            </div>
            {t.ligada ? (
              <button type="button" disabled={ocupado} onClick={() => { setCiente(false); setConfirmando(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-50"
                style={{ backgroundColor: 'rgba(244, 63, 94, 0.15)', border: '0.5px solid rgba(244, 63, 94, 0.5)', color: '#fda4af' }}>
                Desligar a trava
              </button>
            ) : (
              <button type="button" disabled={ocupado} onClick={() => mudar(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-50"
                style={{ backgroundColor: '#fbbf24', color: '#1c1503' }}>
                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Ligar a trava (parar tudo que é real)
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <Numero rotulo="Perdido hoje" valor={fmtDinheiro(Math.max(0, perdido))} destaque={perdido > 0 ? '#f43f5e' : '#2bcdb9'} />
            {perdido < 0 && <Numero rotulo="Ganho hoje" valor={fmtDinheiro(-perdido)} destaque="#2bcdb9" />}
            <Numero rotulo="Bots em real" valor={t.bots_em_real} />
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            Perdido hoje = stake menos retorno dos bilhetes liquidados hoje (a mesma conta que barra os sinais quando chega na perda máxima).
            Soma os valores como estão, sem converter moeda.
          </p>

          <div className="flex flex-wrap items-end gap-3 mt-4 pt-4" style={LINHA}>
            <Campo rotulo="Stake máxima por aposta (todos)">
              <input type="number" min="0" step="0.5" value={stakeMax} onChange={(e) => setStakeMax(e.target.value)}
                className="w-36 px-3 py-2 rounded-md text-sm outline-none" style={INPUT} aria-label="Stake máxima por aposta" />
            </Campo>
            <Campo rotulo="Perda máxima por dia (todos)">
              <input type="number" min="0" step="1" value={perdaMax} onChange={(e) => setPerdaMax(e.target.value)}
                className="w-36 px-3 py-2 rounded-md text-sm outline-none" style={INPUT} aria-label="Perda máxima por dia" />
            </Campo>
            <button type="button" disabled={!limitesMudaram || !limitesValidos || ocupado} onClick={salvarLimites}
              className="px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-40"
              style={{ backgroundColor: '#2bcdb9', color: '#060b0f' }}
              title={!limitesValidos ? 'Os dois valores precisam ser maiores que zero' : ''}>
              Gravar limites
            </button>
          </div>
          {t.bots_acima_do_limite?.length > 0 && (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold mt-2" style={{ color: '#fcd34d' }}>
              <AlertTriangle className="w-3.5 h-3.5" />
              Bots em real com stake acima da máxima (os sinais deles nascem barrados): {t.bots_acima_do_limite.join(', ')}
            </p>
          )}
        </>
      )}

      {confirmando && t && (
        <Modal titulo="Desligar a trava geral?" onFechar={() => !ocupado && setConfirmando(false)} perigo>
          <p className="text-xs text-slate-300 leading-relaxed">
            Com a trava desligada, <b>{t.bots_em_real}</b> bot(s) em real voltam a apostar dinheiro de verdade no próximo sinal,
            com stake de até <b>{fmtDinheiro(t.limites?.stake_max)}</b> por aposta e perda máxima de <b>{fmtDinheiro(t.limites?.perda_max_dia)}</b> por dia.
          </p>
          <label className="flex items-start gap-2 mt-4 cursor-pointer">
            <input type="checkbox" className="mike-checkbox mt-0.5" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />
            <span className="text-[11px] text-slate-300 leading-relaxed">Entendi: isto libera apostas com dinheiro real.</span>
          </label>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" className="mike-btn-ghost" onClick={() => setConfirmando(false)} disabled={ocupado}>Cancelar</button>
            <button type="button" disabled={!ciente || ocupado} onClick={() => mudar(false, true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-40"
              style={{ backgroundColor: '#f43f5e', color: '#fff' }}>
              {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Desligar a trava
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

// ═════════════════════════ Conta: criar / editar ═════════════════════════
function ModalConta({ conta, admin, usuarios, casas, onFechar, onGravou, avisar }) {
  const nova = !conta;
  const [apelido, setApelido] = useState(conta?.apelido || '');
  const [casa, setCasa] = useState(conta?.casa || (casas[0]?.codigo || ''));
  const [dono, setDono] = useState(conta ? String(conta.usuario_id) : '');
  const [moeda, setMoeda] = useState(conta?.moeda || '');
  const [estado, setEstado] = useState(conta?.estado || 'ativa');
  const [obs, setObs] = useState(conta?.observacao || '');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const gravar = async () => {
    setErro('');
    if (admin && apelido.trim().length < 2) { setErro('Dê um apelido de pelo menos 2 letras.'); return; }
    if (nova && (!casa || !dono || !/^[A-Za-z]{3}$/.test(moeda.trim()))) { setErro('Escolha a casa e o dono, e informe a moeda com 3 letras (PEN, BRL...).'); return; }
    setOcupado(true);
    try {
      let r;
      if (nova) {
        r = await ApiAutomacao.criarConta({
          apelido: apelido.trim(), casa, usuario_id: Number(dono), moeda: moeda.trim().toUpperCase(),
          estado, observacao: obs.trim() || null,
        });
      } else {
        const corpo = {};
        if (admin && apelido.trim() !== conta.apelido) corpo.apelido = apelido.trim();
        if (admin && Number(dono) !== conta.usuario_id) corpo.usuario_id = Number(dono);
        if (estado !== conta.estado) corpo.estado = estado;
        if ((obs.trim() || null) !== (conta.observacao || null)) corpo.observacao = obs.trim() || null;
        if (Object.keys(corpo).length === 0) { onFechar(); return; }
        r = await ApiAutomacao.editarConta(conta.id, corpo);
        if (r.bots_desligados?.length) {
          avisar(`A conta deixou de estar ativa: ${r.bots_desligados.length} bot(s) em real foram desligados (${r.bots_desligados.join(', ')}).`, 'warn');
        }
      }
      onGravou(r);
    } catch (e) {
      setErro((e && e.message) || 'Não deu para gravar a conta.');
    } finally { setOcupado(false); }
  };

  const campo = 'w-full px-3 py-2 rounded-md text-sm outline-none focus:ring-1 focus:ring-mike-accent/60';
  return (
    <Modal titulo={nova ? 'Nova conta de casa' : `Conta — ${conta.apelido}`} onFechar={() => !ocupado && onFechar()}>
      <div className="flex flex-col gap-3">
        <Campo rotulo="Apelido" ajuda="Só um nome para reconhecer a conta. Nunca escreva login, senha ou token aqui.">
          <input value={apelido} onChange={(e) => setApelido(e.target.value)} maxLength={60} autoFocus={nova} disabled={!admin || ocupado}
            placeholder="ex.: Jokerbet do João" className={campo} style={{ ...INPUT, opacity: admin ? 1 : 0.6 }} />
        </Campo>
        <div className="flex gap-3">
          <div className="flex-1">
            <Campo rotulo="Casa">
              <select value={casa} onChange={(e) => setCasa(e.target.value)} disabled={!nova || ocupado} className={campo} style={{ ...INPUT, opacity: nova ? 1 : 0.6 }}>
                {!nova && !casas.some((c) => c.codigo === casa) && <option value={casa}>{casa}</option>}
                {casas.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome || c.codigo}</option>)}
              </select>
            </Campo>
          </div>
          <div className="w-28">
            <Campo rotulo="Moeda">
              <input value={moeda} onChange={(e) => setMoeda(e.target.value.toUpperCase())} maxLength={3} disabled={!nova || ocupado}
                placeholder="PEN" className={campo} style={{ ...INPUT, opacity: nova ? 1 : 0.6 }} />
            </Campo>
          </div>
        </div>
        {admin && (
          <Campo rotulo="Dono (usuário)" ajuda={!nova && conta.bots_vinculados > 0 ? `${conta.bots_vinculados} bot(s) usam esta conta: para trocar o dono, tire a conta deles antes.` : undefined}>
            <select value={dono} onChange={(e) => setDono(e.target.value)} disabled={ocupado || (!nova && conta.bots_vinculados > 0)} className={campo} style={INPUT}>
              <option value="">escolha o dono</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>)}
            </select>
          </Campo>
        )}
        <Campo rotulo="Estado" ajuda="Só conta ativa aposta em real. Tirar de ativa desliga na hora os bots em real desta conta.">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} disabled={ocupado} className={campo} style={INPUT}>
            {ESTADOS_CONTA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Observação">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={2} disabled={ocupado} className={campo} style={INPUT} />
        </Campo>
        {erro && <p className="text-xs font-semibold" style={{ color: '#fca5a5' }}>{erro}</p>}
        <button type="button" onClick={gravar} disabled={ocupado}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition disabled:opacity-60"
          style={{ backgroundColor: '#2bcdb9', color: '#060b0f' }}>
          {ocupado && <Loader2 className="w-4 h-4 animate-spin" />}
          {nova ? 'Criar conta' : 'Gravar'}
        </button>
      </div>
    </Modal>
  );
}

// ═════════════════════════ Tela ═════════════════════════
export default function Automacao({ onNavegar }) {
  const { casas: casasPais, buscarCasa } = usePais();
  const [r, setR] = useState(null);
  const [estado, setEstado] = useState('carregando');       // carregando | pronto | erro | ausente
  const [erro, setErro] = useState('');
  const [hist, setHist] = useState([]);
  const [modos, setModos] = useState({});
  const [usuarios, setUsuarios] = useState([]);
  const [modalConta, setModalConta] = useState(null);       // { conta } | { nova: true }
  const [analiseBot, setAnaliseBot] = useState(null);
  const [ocupadoBot, setOcupadoBot] = useState(null);
  const [toasts, setToasts] = useState([]);

  const avisar = useCallback((mensagem, tipo = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, mensagem, tipo }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
  }, []);

  const carregar = useCallback(async () => {
    try {
      const d = await ApiAutomacao.resumo();
      setR(d);
      setEstado('pronto');
      setErro('');
      ApiAutomacao.historico({ limit: 30 }).then((h) => setHist(h.items || [])).catch(() => setHist([]));
      ApiAutomacao.modos().then((m) => setModos(m.itens || {})).catch(() => setModos({}));
      if (d.admin) {
        ApiAdmin.listarUsuarios({ limit: 200 }).then((u) => setUsuarios(u.items || [])).catch(() => setUsuarios([]));
      }
    } catch (e) {
      if (e && e.status === 404) { setEstado('ausente'); return; }
      setErro((e && e.message) || 'Não deu para carregar a automação.');
      setEstado('erro');
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const admin = Boolean(r?.admin);
  const lim = r?.limites || {};
  const uso = r?.uso || { bots: 0, papel: 0, real: 0 };
  const nomeCasa = useCallback((cod) => (buscarCasa?.(cod)?.nome) || cod, [buscarCasa]);
  const casasParaConta = useMemo(() => {
    const comBraco = (r?.casas_com_braco || []).map((c) => ({ codigo: c.codigo, nome: c.nome }));
    const outras = (casasPais || []).filter((c) => !comBraco.some((b) => b.codigo === c.codigo)).map((c) => ({ codigo: c.codigo, nome: c.nome }));
    return [...comBraco, ...outras];
  }, [r, casasPais]);

  const pausarBot = async (b) => {
    setOcupadoBot(b.bot_id);
    try {
      await ApiAutomacao.pausarBot(b.bot_id);
      avisar(`Automação do bot "${b.nome}" pausada.`, 'success');
      await carregar();
    } catch (e) {
      avisar((e && e.message) || 'Não deu para pausar.', 'error');
    } finally { setOcupadoBot(null); }
  };

  const limite = (usado, teto) => (teto === null || teto === undefined ? `${usado} (sem limite)` : `${usado} de ${teto}`);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#060b0f', color: '#eef8f6', fontFamily: 'var(--mike-font)' }}>
      <MikeHeader telaAtiva="automacao" onNavegar={onNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6 flex flex-col gap-6">
        {estado === 'carregando' && (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-16 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando a automação...</div>
        )}
        {estado === 'erro' && <EstadoErro mensagem={erro} onTentar={carregar} />}
        {estado === 'ausente' && (
          <EstadoVazio icone={Zap} titulo="A automação ainda não está no ar"
            descricao="A API precisa ser reiniciada para ligar esta tela. Assim que isso acontecer, ela aparece no menu." />
        )}

        {estado === 'pronto' && r && (
          <>
            {admin && <TravaGeral avisar={avisar} />}

            {/* ═══════════ MEU USO ═══════════ */}
            <section className="rounded-2xl p-5" style={CARD} data-secao="uso">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <Zap className="w-4 h-4" style={{ color: '#2bcdb9' }} />
                <h2 className="text-sm font-black tracking-tight">{admin ? 'Meu uso (administrador)' : 'O que você pode automatizar'}</h2>
              </div>
              {admin ? (
                <p className="text-xs text-slate-400">
                  Administrador não tem limite por usuário. Valem a trava geral e os limites gerais acima. Os limites de cada usuário
                  ficam na tela <button type="button" className="underline" style={{ color: '#2bcdb9' }} onClick={() => onNavegar?.('usuarios')}>Usuários</button>.
                </p>
              ) : !lim.pode_automatizar ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-xs font-semibold"
                  style={{ backgroundColor: 'rgba(251, 191, 36, 0.08)', border: '0.5px solid rgba(251, 191, 36, 0.35)', color: '#fcd34d' }}>
                  <Lock className="w-3.5 h-3.5" /> Você ainda não tem automação liberada. Peça liberação ao administrador.
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3 mt-3">
                <Numero rotulo="Bots" valor={limite(uso.bots, lim.max_bots)} />
                <Numero rotulo="Automações em papel" valor={limite(uso.papel, lim.max_auto_papel)} destaque="#fbbf24" />
                <Numero rotulo="Automações em real" valor={limite(uso.real, lim.max_auto_real)} destaque="#f43f5e" />
                {!admin && <Numero rotulo="Stake máxima por aposta" valor={lim.stake_max === null || lim.stake_max === undefined ? 'não liberada' : fmtDinheiro(lim.stake_max)} />}
              </div>
              {!admin && lim.pode_automatizar && (
                <p className="text-[11px] text-slate-500 mt-3">
                  Casas liberadas para você: {(lim.casas_liberadas || []).length ? lim.casas_liberadas.map(nomeCasa).join(', ') : 'nenhuma'}.
                </p>
              )}
              <p className="text-[11px] text-slate-500 mt-1">
                Casas que já têm automação: {(r.casas_com_braco || []).length ? r.casas_com_braco.map((c) => c.nome).join(', ') : 'nenhuma no momento'}.
                Para ligar um bot, abra o bot e use a seção Automação.
              </p>
            </section>

            {/* ═══════════ CONTAS ═══════════ */}
            <section className="rounded-2xl p-5" style={CARD} data-secao="contas">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Wallet className="w-4 h-4" style={{ color: '#2bcdb9' }} />
                <h2 className="text-sm font-black tracking-tight">Contas das casas</h2>
                <span className="text-[11px] text-slate-500">{admin ? `${r.contas.length} conta(s), de todos os usuários` : 'as suas contas'} · identificadas por apelido</span>
                <div className="flex-1" />
                {admin && (
                  <button type="button" onClick={() => setModalConta({ nova: true })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition"
                    style={{ backgroundColor: '#2bcdb9', color: '#060b0f', boxShadow: '0 4px 12px rgba(43, 205, 185, 0.3)' }}>
                    <Plus className="w-3.5 h-3.5" /> Nova conta
                  </button>
                )}
              </div>
              {r.contas.length === 0 ? (
                <EstadoVazio icone={Wallet} titulo="Nenhuma conta ainda"
                  descricao={admin ? 'Crie a conta e escolha o dono. Só o apelido fica guardado: nada de login ou senha.'
                    : `Quem cadastra a conta e define o dono é o administrador.${lim.pode_automatizar ? ' Para medir em papel você não precisa de conta.' : ''}`} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-slate-500">
                        <th className="py-2 pr-3 font-bold">Apelido</th>
                        <th className="py-2 pr-3 font-bold">Casa</th>
                        {admin && <th className="py-2 pr-3 font-bold">Dono</th>}
                        <th className="py-2 pr-3 font-bold">Estado</th>
                        <th className="py-2 pr-3 font-bold">Moeda</th>
                        <th className="py-2 pr-3 font-bold text-right">Bots</th>
                        <th className="py-2 pr-3 font-bold text-right" title="Maior stake que a casa já aceitou nesta conta">Maior stake aceita</th>
                        <th className="py-2 pr-3 font-bold text-right" title="Menor stake a que a casa já cortou uma aposta nesta conta">Corte da casa</th>
                        <th className="py-2 font-bold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.contas.map((c) => (
                        <tr key={c.id} style={LINHA}>
                          <td className="py-2.5 pr-3 font-semibold">
                            {c.apelido}
                            {!c.tem_braco && <span className="text-[10px] font-normal text-slate-500 ml-1.5" title="Nenhum braço está rodando para esta conta: sinais dela não são enviados nem medidos">sem braço rodando</span>}
                            {c.observacao && <div className="text-[10px] font-normal text-slate-500 max-w-xs truncate" title={c.observacao}>{c.observacao}</div>}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-300">{nomeCasa(c.casa)}</td>
                          {admin && <td className="py-2.5 pr-3 text-slate-300">{c.dono_nome || `#${c.usuario_id}`}</td>}
                          <td className="py-2.5 pr-3"><span className="font-bold" style={{ color: corEstado(c.estado) }}>● {c.estado}</span></td>
                          <td className="py-2.5 pr-3 text-slate-400">{c.moeda}</td>
                          <td className="py-2.5 pr-3 text-right text-slate-300">
                            {c.bots_vinculados}{c.bots_real > 0 && <span style={{ color: '#f43f5e' }}> ({c.bots_real} em real)</span>}
                          </td>
                          <td className="py-2.5 pr-3 text-right text-slate-300"
                            title={c.stake_max_aceita_fonte === 'bilhetes' ? 'Maior bilhete gravado nesta conta' : (c.stake_max_aceita_fonte === 'braco' ? 'Anotado pelo braço' : '')}>
                            {fmtDinheiro(c.stake_max_aceita, c.moeda)}
                          </td>
                          <td className="py-2.5 pr-3 text-right" style={{ color: c.stake_min_cortada === null || c.stake_min_cortada === undefined ? '#6c8689' : '#fda4af' }}>
                            {c.stake_min_cortada === null || c.stake_min_cortada === undefined ? 'sem registro' : fmtDinheiro(c.stake_min_cortada, c.moeda)}
                          </td>
                          <td className="py-2.5">
                            <div className="flex justify-end">
                              <button type="button" onClick={() => setModalConta({ conta: c })}
                                className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 transition"
                                title={admin ? 'Editar apelido, dono, estado e observação' : 'Mudar o estado ou a observação'}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ═══════════ BOTS AUTOMATIZADOS ═══════════ */}
            <section className="rounded-2xl p-5" style={CARD} data-secao="bots">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Zap className="w-4 h-4" style={{ color: '#2bcdb9' }} />
                <h2 className="text-sm font-black tracking-tight">Bots com automação ligada</h2>
                <span className="text-[11px] text-slate-500">{r.bots.length} bot(s){admin ? ', de todos os usuários' : ''}</span>
                <div className="flex-1" />
                <button type="button" onClick={carregar} className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 transition" title="Recarregar">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {r.bots.length === 0 ? (
                <EstadoVazio icone={Zap} titulo="Nenhum bot em papel ou real"
                  descricao="Abra um bot de uma casa com automação e escolha o modo na seção Automação."
                  acao={<button type="button" className="mike-btn-ghost mt-1" onClick={() => onNavegar?.('bots')}>Ir para os bots</button>} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-slate-500">
                        <th className="py-2 pr-3 font-bold">Bot</th>
                        <th className="py-2 pr-3 font-bold">Casa</th>
                        {admin && <th className="py-2 pr-3 font-bold">Dono</th>}
                        <th className="py-2 pr-3 font-bold">Modo</th>
                        <th className="py-2 pr-3 font-bold text-right">Stake</th>
                        <th className="py-2 pr-3 font-bold">Conta</th>
                        <th className="py-2 pr-3 font-bold text-right" title="Real: aceitos / enviados. Papel: aceitaria / julgados. Só hoje.">Captura hoje</th>
                        <th className="py-2 font-bold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.bots.map((b) => {
                        const m = modos[String(b.bot_id)];
                        return (
                          <tr key={b.bot_id} style={LINHA}>
                            <td className="py-2.5 pr-3 font-semibold">
                              <button type="button" className="text-left hover:underline" onClick={() => onNavegar?.('criar_bot', { botId: b.bot_id })} title="Abrir o bot">
                                {b.nome}
                              </button>
                              <span className="text-[10px] font-normal text-slate-500 ml-1.5">#{b.bot_id}{b.status !== 'ativo' ? ' · bot pausado (não simula)' : ''}</span>
                            </td>
                            <td className="py-2.5 pr-3 text-slate-300">{nomeCasa(b.casa)}</td>
                            {admin && <td className="py-2.5 pr-3 text-slate-300">{b.dono_nome}</td>}
                            <td className="py-2.5 pr-3"><span className="font-bold uppercase text-[10px]" style={{ color: corDoModo(b.modo) }}>{b.modo}</span></td>
                            <td className="py-2.5 pr-3 text-right text-slate-300">{b.modo === 'real' ? fmtDinheiro(b.stake, b.moeda) : '—'}</td>
                            <td className="py-2.5 pr-3 text-slate-300">{b.conta_apelido || '—'}</td>
                            <td className="py-2.5 pr-3 text-right">
                              {m && m.base_hoje > 0
                                ? <span><b style={{ color: '#2bcdb9' }}>{m.captura_hoje_pct}%</b> <span className="text-slate-500">({m.pegou_hoje}/{m.base_hoje})</span></span>
                                : <span className="text-slate-500">{m && m.sinais_hoje > 0 ? `${m.sinais_hoje} sinal(is), nenhum julgado` : 'sem sinal hoje'}</span>}
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-1 justify-end">
                                <button type="button" onClick={() => setAnaliseBot(b.bot_id)} className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 transition" title="Análise dos últimos 7 dias">
                                  <BarChart3 className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" disabled={ocupadoBot === b.bot_id} onClick={() => pausarBot(b)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-amber-300 transition disabled:opacity-40" title="Pausar a automação deste bot">
                                  {ocupadoBot === b.bot_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ═══════════ HISTÓRICO ═══════════ */}
            <section className="rounded-2xl p-5" style={CARD} data-secao="historico">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <History className="w-4 h-4" style={{ color: '#2bcdb9' }} />
                <h2 className="text-sm font-black tracking-tight">Histórico</h2>
                <span className="text-[11px] text-slate-500">quem mudou o quê, as 30 mudanças mais recentes{admin ? '' : ' nos seus bots e contas'}</span>
              </div>
              {hist.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Nenhuma mudança registrada ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-slate-500">
                        <th className="py-2 pr-3 font-bold">Quando</th>
                        <th className="py-2 pr-3 font-bold">Quem</th>
                        <th className="py-2 pr-3 font-bold">Onde</th>
                        <th className="py-2 pr-3 font-bold">O que</th>
                        <th className="py-2 pr-3 font-bold">Antes</th>
                        <th className="py-2 pr-3 font-bold">Depois</th>
                        <th className="py-2 font-bold">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hist.map((h) => {
                        const onde = { bot: 'Bot', conta: 'Conta', usuario: 'Usuário', trava: 'Trava geral', limite_global: 'Limite geral' }[h.alvo_tipo] || h.alvo_tipo;
                        return (
                          <tr key={h.id} style={LINHA}>
                            <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{fmtData(h.quando)}</td>
                            <td className="py-2 pr-3 text-slate-300">{h.autor}</td>
                            <td className="py-2 pr-3 text-slate-300">{onde}{h.alvo_nome ? `: ${h.alvo_nome}` : (h.alvo_id ? ` #${h.alvo_id}` : '')}</td>
                            <td className="py-2 pr-3 font-semibold">{h.campo}</td>
                            <td className="py-2 pr-3 text-slate-500">{h.valor_antigo ?? '—'}</td>
                            <td className="py-2 pr-3 text-slate-200">{h.valor_novo ?? '—'}</td>
                            <td className="py-2 text-slate-500">{h.obs || ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {modalConta && (
        <ModalConta conta={modalConta.conta || null} admin={admin} usuarios={usuarios} casas={casasParaConta}
          avisar={avisar}
          onFechar={() => setModalConta(null)}
          onGravou={() => { setModalConta(null); avisar('Conta gravada.', 'success'); carregar(); }} />
      )}
      {analiseBot && <AnaliseAutomacao botId={analiseBot} onFechar={() => setAnaliseBot(null)} />}

      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm" aria-live="polite">
        {toasts.map((t) => {
          const cor = { success: '#2bcdb9', error: '#f43f5e', warn: '#fbbf24', info: '#38bdf8' }[t.tipo] || '#38bdf8';
          return (
            <div key={t.id} className="px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg"
              style={{ backgroundColor: 'rgba(10, 18, 22, 0.98)', border: `0.5px solid ${cor}`, color: '#eef8f6' }}>
              <span style={{ color: cor }}>● </span>{t.mensagem}
            </div>
          );
        })}
      </div>
    </div>
  );
}
