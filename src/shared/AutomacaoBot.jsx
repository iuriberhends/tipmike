// ============================================================
// shared/AutomacaoBot.jsx — seção "Automação" da tela de bot
//
// O bot simula sempre. A automação decide o que acontece com cada
// aposta simulada:
//   desligado → nada;
//   papel     → o braço acompanha a casa e mede se a aposta seria aceita (sem dinheiro);
//   real      → o braço envia a aposta pela conta escolhida, com a stake definida.
//
// Quem manda são as regras do servidor (limites do usuário, contas dele,
// casas liberadas). Esta seção só espelha: mostra o que dá para fazer e
// por que não dá quando não dá.
//
// Uso (CriarBot.jsx):
//   const automacao = useRef(null);
//   <AutomacaoBot ref={automacao} botId={botId} casa={casa} avisar={adicionarToast} />
//   automacao.current.pendente()  → { corpo, precisaConfirmar } ou null (nada a gravar)
//   automacao.current.confirmar() → Promise<boolean> (abre a confirmação do real)
//   automacao.current.gravar(id)  → grava no bot `id` (o próprio ou o recém-criado)
// Se a API ainda não tem as rotas (404), a seção não aparece.
// ============================================================

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, Info, Loader2, Lock, Pause, Save, ShieldAlert, X } from 'lucide-react';
import { ApiAutomacao } from '../lib/api.js';
import { automacaoDisponivel } from '../lib/recursos.js';
import AnaliseAutomacao from './AnaliseAutomacao.jsx';

export const MODOS = [
  { value: 'desligado', label: 'Desligado', dica: 'O bot só simula. Nenhum sinal é gerado.', cor: '#8ba5a6' },
  { value: 'papel',     label: 'Papel',     dica: 'Mede se a casa aceitaria cada aposta, sem dinheiro.', cor: '#fbbf24' },
  { value: 'real',      label: 'Real',      dica: 'Envia a aposta pela conta, com dinheiro de verdade.', cor: '#f43f5e' },
];

export function corDoModo(modo) {
  return (MODOS.find((m) => m.value === modo) || MODOS[0]).cor;
}

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const txt = (v) => (v === null || v === undefined ? '' : String(v));
export const fmtDinheiro = (v, moeda) => (v === null || v === undefined
  ? '—'
  : `${moeda ? `${moeda} ` : ''}${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

function Rotulo({ children, largura = 'w-44' }) {
  return (
    <div className={`${largura} flex-shrink-0`}>
      <span className="inline-block text-[10px] font-bold px-2 py-1 rounded" style={{ backgroundColor: '#2bcdb9', color: '#fff' }}>
        {children}
      </span>
    </div>
  );
}

function Linha({ rotulo, children, ajuda }) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <div className="w-9 flex-shrink-0" />
      <div className="pt-0.5"><Rotulo>{rotulo}</Rotulo></div>
      <div className="flex-1 min-w-0">
        {children}
        {ajuda && <p className="text-[10px] text-[--mike-fg-muted] mt-1 leading-relaxed">{ajuda}</p>}
      </div>
    </div>
  );
}

function linhaUso(rotulo, usado, teto) {
  if (teto === null || teto === undefined) return `${usado} ${rotulo} (sem limite)`;
  return `${usado} de ${teto} ${rotulo}`;
}

// ───────────────────────── confirmação do modo real ─────────────────────────
function ConfirmarReal({ dados, onCancelar, onConfirmar }) {
  const [ciente, setCiente] = useState(false);
  const { bot, casa, conta, stake, moeda, limites, uso, global: geral, admin } = dados;
  const linha = (rot, val) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5" style={{ borderBottom: '0.5px solid rgba(50, 100, 104, 0.25)' }}>
      <span className="text-[11px] text-[--mike-fg-muted]">{rot}</span>
      <span className="text-xs font-bold text-right text-[--mike-fg]">{val}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3, 6, 9, 0.8)' }} onClick={onCancelar}>
      <div className="w-full max-w-md rounded-2xl p-6" role="dialog" aria-modal="true" aria-label="Confirmar aposta com dinheiro real"
        style={{ backgroundColor: 'rgba(10, 18, 22, 0.98)', border: '0.5px solid rgba(244, 63, 94, 0.5)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-5 h-5" style={{ color: '#fb7185' }} />
          <h3 className="text-sm font-black text-[--mike-fg]">Apostar com dinheiro de verdade?</h3>
          <div className="flex-1" />
          <button type="button" onClick={onCancelar} className="text-[--mike-fg-muted] hover:text-[--mike-fg] transition" title="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-[--mike-fg-muted] mb-3 leading-relaxed">
          A partir do próximo sinal, cada aposta deste bot sai da conta abaixo. Confira antes de confirmar.
        </p>
        {linha('Bot', bot || '(bot novo)')}
        {linha('Casa', casa)}
        {linha('Conta', conta)}
        {linha('Stake por aposta', fmtDinheiro(stake, moeda))}
        {admin
          ? linha('Seu limite', 'administrador: sem limite por usuário')
          : linha('Seu limite de stake', fmtDinheiro(limites?.stake_max, moeda))}
        {!admin && linha('Automações em real', `${uso?.real ?? 0} de ${limites?.max_auto_real ?? 0} em uso`)}
        {admin && geral && linha('Limite geral de stake', geral.stake_max === null ? 'sem limite' : fmtDinheiro(geral.stake_max, moeda))}
        {admin && geral && linha('Perda máxima por dia (geral)', geral.perda_max_dia === null ? 'sem limite' : fmtDinheiro(geral.perda_max_dia, moeda))}

        <label className="flex items-start gap-2 mt-4 cursor-pointer">
          <input type="checkbox" className="mike-checkbox mt-0.5" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />
          <span className="text-[11px] text-[--mike-fg-soft] leading-relaxed">
            Entendi: este bot vai apostar {fmtDinheiro(stake, moeda)} de verdade a cada sinal aceito.
          </span>
        </label>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button type="button" onClick={onCancelar} className="mike-btn-ghost">Cancelar</button>
          <button type="button" disabled={!ciente} onClick={onConfirmar}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#f43f5e', color: '#fff' }}>
            Passar para real
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════ seção ═════════════════════════
const AutomacaoBot = forwardRef(function AutomacaoBot({ botId = null, botNome = '', casa, avisar }, ref) {
  const [ctx, setCtx] = useState(null);
  const [estado, setEstado] = useState('carregando');     // carregando | pronto | erro | ausente
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');             // '' | 'salvar' | 'pausar'
  const [analise, setAnalise] = useState(false);
  const [pedido, setPedido] = useState(null);             // confirmação do real aberta: { resolver }

  // campos
  const [modo, setModo] = useState('desligado');
  const [contaId, setContaId] = useState('');
  const [stake, setStake] = useState('');
  const [queda, setQueda] = useState('5');
  const [reenvios, setReenvios] = useState('1');
  const [umaPorSelecao, setUmaPorSelecao] = useState(true);
  const [teto, setTeto] = useState('');

  const preencher = useCallback((c) => {
    const a = c.automacao || {};
    setModo(a.modo || 'desligado');
    setContaId(txt(a.conta_id));
    setStake(txt(a.stake));
    setQueda(txt(a.queda_max_odd_pct ?? 5));
    setReenvios(txt(a.reenvios ?? 1));
    setUmaPorSelecao(a.uma_por_selecao !== false);
    setTeto(txt(a.teto_por_jogo));
  }, []);

  // sem bot (criação): a casa escolhida na tela decide o contexto
  const pedidoSeq = useRef(0);
  const carregar = useCallback(async (manterCampos = false) => {
    if (!botId && !casa) return;
    const meu = ++pedidoSeq.current;
    if (!manterCampos) setEstado('carregando');
    try {
      // API ainda sem as rotas da automação: a seção nem aparece (e não fica perguntando de novo)
      if (!(await automacaoDisponivel())) {
        if (meu === pedidoSeq.current) setEstado('ausente');
        return;
      }
      const c = await ApiAutomacao.contexto(botId ? { botId } : { casa });
      if (meu !== pedidoSeq.current) return;
      setCtx(c);
      if (!manterCampos) preencher(c);
      setEstado('pronto');
      setErro('');
    } catch (e) {
      if (meu !== pedidoSeq.current) return;
      setErro((e && e.message) || 'Não deu para ler a automação.');
      setEstado('erro');
    }
  }, [botId, casa, preencher]);

  useEffect(() => { carregar(false); }, [carregar]);

  const salvo = ctx?.automacao || {};
  const contas = ctx?.contas || [];
  const conta = contas.find((c) => String(c.id) === String(contaId)) || null;
  const moeda = conta?.moeda || salvo.moeda || '';
  const bloqueado = Boolean(ctx && !ctx.pode_editar);
  const lim = ctx?.limites || {};
  const uso = ctx?.uso || { papel: 0, real: 0, bots: 0 };

  const corpo = useMemo(() => ({
    modo,
    conta_id: num(contaId),
    stake: num(stake),
    queda_max_odd_pct: num(queda) ?? 5,
    reenvios: num(reenvios) ?? 1,
    uma_por_selecao: umaPorSelecao,
    teto_por_jogo: num(teto),
  }), [modo, contaId, stake, queda, reenvios, umaPorSelecao, teto]);

  const mudou = useMemo(() => {
    if (!ctx) return false;
    const a = ctx.automacao || {};
    return corpo.modo !== (a.modo || 'desligado')
      || corpo.conta_id !== (a.conta_id ?? null)
      || corpo.stake !== (a.stake ?? null)
      || Number(corpo.queda_max_odd_pct) !== Number(a.queda_max_odd_pct ?? 5)
      || Number(corpo.reenvios) !== Number(a.reenvios ?? 1)
      || corpo.uma_por_selecao !== (a.uma_por_selecao !== false)
      || corpo.teto_por_jogo !== (a.teto_por_jogo ?? null);
  }, [ctx, corpo]);

  // o servidor pede confirmação quando o resultado é 'real' e muda modo, stake ou conta
  const precisaConfirmar = corpo.modo === 'real'
    && ((salvo.modo || 'desligado') !== 'real' || corpo.stake !== (salvo.stake ?? null) || corpo.conta_id !== (salvo.conta_id ?? null));

  // o que impede gravar agora (mostrado ao lado do botão; o servidor confere de novo)
  const falta = useMemo(() => {
    if (corpo.modo === 'desligado') return '';
    if (corpo.stake !== null && !(corpo.stake > 0)) return 'A stake precisa ser maior que zero.';
    if (!(corpo.queda_max_odd_pct >= 0 && corpo.queda_max_odd_pct < 100)) return 'Queda de odd: de 0 a 99,9%.';
    if (!(Number.isInteger(corpo.reenvios) && corpo.reenvios >= 0 && corpo.reenvios <= 10)) return 'Reenvios: de 0 a 10.';
    if (corpo.teto_por_jogo !== null && !(Number.isInteger(corpo.teto_por_jogo) && corpo.teto_por_jogo >= 1)) return 'Teto por jogo: 1 ou mais (ou vazio).';
    if (corpo.modo === 'real') {
      if (!conta) return 'Escolha a conta para apostar em real.';
      if (conta.estado !== 'ativa') return `A conta ${conta.apelido} está ${conta.estado}: só conta ativa aposta em real.`;
      if (corpo.stake === null) return 'Informe a stake para apostar em real.';
      if (!lim.admin && (lim.stake_max === null || lim.stake_max === undefined)) return 'Você ainda não tem stake liberada para apostas reais.';
      if (!lim.admin && corpo.stake > lim.stake_max) return `Stake acima do seu limite (${fmtDinheiro(lim.stake_max, moeda)} por aposta).`;
    }
    return '';
  }, [corpo, conta, lim, moeda]);

  const confirmar = useCallback(() => new Promise((resolver) => setPedido({ resolver })), []);
  const responder = (ok) => { pedido?.resolver(ok); setPedido(null); };

  const gravar = useCallback(async (idAlvo, confirmado = false) => {
    const alvo = idAlvo || botId;
    const r = await ApiAutomacao.salvarBot(alvo, { ...corpo, confirmar_real: Boolean(confirmado) });
    if (alvo === botId) { setCtx(r); preencher(r); }
    return r;
  }, [botId, corpo, preencher]);

  useImperativeHandle(ref, () => ({
    // null = nada a gravar (seção ausente, bloqueada, ou sem mudança)
    pendente: () => {
      if (estado !== 'pronto' || bloqueado) return null;
      if (botId ? !mudou : corpo.modo === 'desligado') return null;
      return { corpo, precisaConfirmar, falta };
    },
    confirmar,
    gravar,
  }), [estado, bloqueado, botId, mudou, corpo, precisaConfirmar, falta, confirmar, gravar]);

  const salvarAqui = async () => {
    if (falta) { avisar?.(falta, 'error'); return; }
    if (precisaConfirmar && !(await confirmar())) return;
    setOcupado('salvar');
    try {
      const r = await gravar(botId, precisaConfirmar);
      avisar?.(r.automacao.modo === 'desligado' ? 'Automação desligada' : `Automação gravada: ${r.automacao.modo}`, 'success');
      (r.avisos || []).forEach((a) => avisar?.(a, 'warn'));
    } catch (e) {
      avisar?.((e && e.message) || 'Não deu para gravar a automação.', 'error');
      carregar(true);                       // limites e uso podem ter mudado: relê sem apagar o que a pessoa digitou
    } finally {
      setOcupado('');
    }
  };

  const pausar = async () => {
    setOcupado('pausar');
    try {
      const r = await ApiAutomacao.pausarBot(botId);
      setCtx(r);
      preencher(r);
      avisar?.('Automação pausada. As regras ficaram guardadas.', 'success');
    } catch (e) {
      avisar?.((e && e.message) || 'Não deu para pausar.', 'error');
    } finally {
      setOcupado('');
    }
  };

  if (estado === 'ausente') return null;

  const titulo = (
    <div className="text-center mb-4">
      <h2 className="text-base font-bold text-[--mike-fg] mb-1">Automação</h2>
      <p className="text-[11px] text-[--mike-fg-muted] max-w-3xl mx-auto leading-relaxed">
        O bot simula sempre. Aqui você decide o que fazer com cada aposta simulada: nada, medir se a casa aceitaria
        (papel) ou enviar de verdade pela sua conta (real).
      </p>
    </div>
  );

  const moldura = (filho) => (
    <section className="mb-6 pb-6" style={{ borderBottom: '0.5px solid rgba(50, 100, 104, 0.2)' }} data-secao="automacao">
      {titulo}
      {filho}
    </section>
  );

  if (estado === 'carregando') {
    return moldura(
      <div className="flex items-center justify-center gap-2 text-xs text-[--mike-fg-muted] py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Lendo a automação...
      </div>,
    );
  }
  if (estado === 'erro') {
    return moldura(
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="text-xs" style={{ color: '#fca5a5' }}>{erro}</p>
        <button type="button" className="mike-btn-ghost" onClick={() => carregar(false)}>Tentar de novo</button>
      </div>,
    );
  }

  const input = 'mike-input text-xs px-2 py-1.5 rounded-md';
  const usoTexto = lim.admin
    ? 'Administrador: sem limite por usuário.'
    : `${linhaUso('automações em papel', uso.papel, lim.max_auto_papel)} · ${linhaUso('em real', uso.real, lim.max_auto_real)}`
      + ` · stake máxima ${lim.stake_max === null || lim.stake_max === undefined ? 'não liberada' : fmtDinheiro(lim.stake_max, moeda)}`;

  return moldura(
    <>
      {bloqueado && (
        <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-xs font-semibold mb-3 max-w-xl mx-auto"
          style={{ backgroundColor: 'rgba(251, 191, 36, 0.08)', border: '0.5px solid rgba(251, 191, 36, 0.35)', color: '#fcd34d' }}
          role="status">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          {ctx.bloqueio?.mensagem || 'Automação indisponível.'}
        </div>
      )}

      <div className={bloqueado ? 'opacity-40 pointer-events-none select-none' : ''} aria-disabled={bloqueado}>
        <Linha rotulo="Modo" ajuda={(MODOS.find((m) => m.value === modo) || MODOS[0]).dica}>
          <div className="inline-flex rounded-md overflow-hidden" style={{ border: '0.5px solid rgba(50, 100, 104, 0.5)' }} role="radiogroup" aria-label="Modo da automação">
            {MODOS.map((m) => {
              const ativo = modo === m.value;
              return (
                <button key={m.value} type="button" role="radio" aria-checked={ativo} disabled={bloqueado}
                  onClick={() => setModo(m.value)}
                  className="px-4 py-1.5 text-xs font-bold transition"
                  style={{
                    backgroundColor: ativo ? m.cor : 'transparent',
                    color: ativo ? (m.value === 'papel' ? '#1c1503' : '#fff') : '#b5c9c8',
                  }}>
                  {m.label}
                </button>
              );
            })}
          </div>
        </Linha>

        <Linha rotulo="Conta"
          ajuda={contas.length === 0
            ? 'Você não tem conta nesta casa. Quem cadastra a conta e define o dono é o administrador. Para medir em papel não precisa de conta.'
            : 'A conta que envia as apostas em real. A moeda vem da conta.'}>
          <select value={contaId} onChange={(e) => setContaId(e.target.value)} disabled={bloqueado || contas.length === 0}
            className={`${input} w-72 max-w-full`} aria-label="Conta">
            <option value="">{contas.length === 0 ? 'nenhuma conta nesta casa' : 'sem conta'}</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.apelido} · {c.moeda}{c.estado !== 'ativa' ? ` · ${c.estado}` : ''}{c.tem_braco ? '' : ' · sem braço rodando'}
              </option>
            ))}
          </select>
        </Linha>

        <Linha rotulo="Stake por aposta" ajuda="Valor de cada aposta em real. Em papel não é usada.">
          <div className="flex items-center gap-2">
            <input type="number" min="0" step="0.5" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)}
              disabled={bloqueado} placeholder="ex.: 5" className={`${input} w-28 mike-no-spin`} aria-label="Stake por aposta" />
            <span className="text-xs text-[--mike-fg-soft]">{moeda || 'moeda da conta'}</span>
          </div>
        </Linha>

        <Linha rotulo="Queda máxima de odd" ajuda="Se a odd da casa cair mais que isso em relação à do sinal, a aposta não é enviada.">
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="99.9" step="0.5" value={queda} onChange={(e) => setQueda(e.target.value)}
              disabled={bloqueado} className={`${input} w-28 mike-no-spin`} aria-label="Queda máxima de odd em porcento" />
            <span className="text-xs text-[--mike-fg-soft]">%</span>
          </div>
        </Linha>

        <Linha rotulo="Reenvios" ajuda="Quantas vezes tentar de novo quando a casa devolve a odd mudada (dentro da queda permitida).">
          <input type="number" min="0" max="10" step="1" value={reenvios} onChange={(e) => setReenvios(e.target.value)}
            disabled={bloqueado} className={`${input} w-28 mike-no-spin`} aria-label="Reenvios" />
        </Linha>

        <Linha rotulo="Teto por jogo" ajuda="Máximo de apostas deste bot no mesmo jogo. Vazio = sem teto.">
          <div className="flex items-center gap-4 flex-wrap">
            <input type="number" min="1" step="1" value={teto} onChange={(e) => setTeto(e.target.value)}
              disabled={bloqueado} placeholder="sem teto" className={`${input} w-28 mike-no-spin`} aria-label="Teto de apostas por jogo" />
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="mike-checkbox" checked={umaPorSelecao} disabled={bloqueado}
                onChange={(e) => setUmaPorSelecao(e.target.checked)} />
              <span className="text-xs text-[--mike-fg-soft]">Uma aposta por seleção (não repete a mesma linha no mesmo jogo)</span>
            </label>
          </div>
        </Linha>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3 pl-11">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[--mike-fg-muted]">
          <Info className="w-3.5 h-3.5" style={{ color: '#2bcdb9' }} /> {usoTexto}
        </span>
      </div>

      {!bloqueado && falta && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold mt-2 pl-11" style={{ color: '#fcd34d' }}>
          <AlertTriangle className="w-3.5 h-3.5" /> {falta}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-3 pl-11">
        {botId ? (
          <>
            <button type="button" onClick={salvarAqui} disabled={bloqueado || !mudou || Boolean(ocupado)}
              className="mike-btn-primary" title={mudou ? 'Grava só a automação (o resto do bot não muda)' : 'Nada mudou na automação'}>
              {ocupado === 'salvar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar automação
            </button>
            <button type="button" onClick={pausar} disabled={(salvo.modo || 'desligado') === 'desligado' || Boolean(ocupado)}
              className="mike-btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
              title={(salvo.modo || 'desligado') === 'desligado' ? 'A automação deste bot já está desligada' : 'Desliga a automação agora e guarda as regras'}>
              {ocupado === 'pausar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
              Pausar
            </button>
            <button type="button" onClick={() => setAnalise(true)} className="mike-btn-ghost" title="Sinais, captura e resultado dos últimos 7 dias">
              <BarChart3 className="w-3.5 h-3.5" />
              Análise (7 dias)
            </button>
            <span className="text-[11px] text-[--mike-fg-muted]">
              Gravado hoje: <b style={{ color: corDoModo(salvo.modo || 'desligado') }}>{salvo.modo || 'desligado'}</b>
            </span>
          </>
        ) : (
          <span className="text-[11px] text-[--mike-fg-muted]">
            {bloqueado ? '' : 'A automação é gravada junto, quando você salvar o bot.'}
          </span>
        )}
      </div>

      {pedido && (
        <ConfirmarReal
          dados={{
            bot: botNome || ctx.bot_nome, casa: ctx.casa_nome, conta: conta ? `${conta.apelido} (${conta.moeda})` : '—',
            stake: corpo.stake, moeda, limites: lim, uso, global: ctx.global, admin: Boolean(lim.admin),
          }}
          onCancelar={() => responder(false)}
          onConfirmar={() => responder(true)}
        />
      )}
      {analise && botId && <AnaliseAutomacao botId={botId} onFechar={() => setAnalise(false)} />}
    </>,
  );
});

export default AutomacaoBot;
