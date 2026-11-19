// ============================================================
// shared/ContaCasa.jsx — cadastro e edição da conta de casa
//
// Usado pela tela Automação (lista de contas) e pelo painel de
// automação do bot (atalho "adicionar conta"), para ser UM cadastro só.
//
// Conta = apelido + casa + dono + moeda + estado. O acesso (login e
// senha da conta na casa) é à parte e SÓ DE ESCRITA: vai direto para o
// cofre da máquina do braço. A tela nunca recebe nem mostra o valor;
// mostra apenas "acesso cadastrado em <data> por <quem>".
//
// Quem pode:
//   administrador → cria conta para qualquer dono, edita tudo;
//   usuário com automação liberada → cria conta própria, só em casa
//     liberada para ele; muda estado, observação e o acesso das suas.
// As regras valem no servidor (routers/automacao.py).
// ============================================================

import { useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, Trash2, X } from 'lucide-react';
import { ApiAutomacao } from '../lib/api.js';

export const CARD = { backgroundColor: 'rgba(11, 21, 25, 0.6)', border: '0.5px solid rgba(50, 100, 104, 0.4)' };
export const INPUT = { backgroundColor: 'rgba(6, 11, 15, 0.8)', border: '0.5px solid rgba(50, 100, 104, 0.4)', color: '#eef8f6' };
export const ESTADOS_CONTA = [
  { value: 'ativa', label: 'Ativa', cor: '#2bcdb9' },
  { value: 'pausada', label: 'Pausada', cor: '#fbbf24' },
  { value: 'limitada', label: 'Limitada pela casa', cor: '#fb923c' },
  { value: 'encerrada', label: 'Encerrada', cor: '#f43f5e' },
];
export const corEstado = (e) => (ESTADOS_CONTA.find((x) => x.value === e) || ESTADOS_CONTA[0]).cor;
export const ACESSO_MAX = 200;

export function fmtData(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return '—'; }
}

// texto curto do acesso da conta, para listas e seletores
export function textoAcesso(conta) {
  if (!conta || conta.tem_acesso === undefined) return '';
  if (conta.tem_acesso) return 'com acesso';
  return conta.acesso_estado === 'ilegivel' ? 'acesso ilegível' : 'sem acesso';
}

export function Modal({ titulo, onFechar, children, largura = 'max-w-md', perigo = false, camada = 'z-50' }) {
  return (
    <div className={`fixed inset-0 ${camada} flex items-center justify-center p-4`} style={{ backgroundColor: 'rgba(3, 6, 9, 0.78)' }} onClick={onFechar}>
      <div className={`w-full ${largura} rounded-2xl p-6 max-h-[92vh] overflow-y-auto`} role="dialog" aria-modal="true" aria-label={titulo}
        style={{ ...CARD, backgroundColor: 'rgba(10, 18, 22, 0.98)', color: '#eef8f6', ...(perigo ? { border: '0.5px solid rgba(244, 63, 94, 0.5)' } : {}) }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="text-sm font-black">{titulo}</h3>
          <button type="button" onClick={onFechar} className="text-slate-400 hover:text-slate-100 transition" title="Fechar"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Campo({ rotulo, children, ajuda }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-400 mb-1">{rotulo}</label>
      {children}
      {ajuda && <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{ajuda}</p>}
    </div>
  );
}

// ═════════════════════════ Conta: criar / editar ═════════════════════════
// props:
//   conta        conta existente (edição) ou null (nova)
//   admin        quem está usando é administrador?
//   usuarios     lista para o seletor de dono (só admin)
//   casas        [{codigo, nome}] que podem receber conta nova
//   casaFixa     código da casa quando o cadastro abre de dentro de um bot (não deixa trocar)
//   donoFixo     id do dono quando o cadastro abre de dentro de um bot de outro usuário (só admin)
//   onGravou(conta, {criada})   onFechar()   avisar(msg, tipo)
export function ModalConta({ conta, admin, usuarios = [], casas = [], casaFixa = null, donoFixo = null, onFechar, onGravou, avisar, camada }) {
  const nova = !conta;
  const [apelido, setApelido] = useState(conta?.apelido || '');
  const [casa, setCasa] = useState(conta?.casa || casaFixa || (casas[0]?.codigo || ''));
  const [dono, setDono] = useState(conta ? String(conta.usuario_id) : (donoFixo ? String(donoFixo) : ''));
  const [moeda, setMoeda] = useState(conta?.moeda || '');
  const [estado, setEstado] = useState(conta?.estado || 'ativa');
  const [obs, setObs] = useState(conta?.observacao || '');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');           // '' | 'gravar' | 'remover'
  // acesso: os campos nascem SEMPRE vazios e nunca são preenchidos pela tela
  const temAcesso = Boolean(conta?.tem_acesso);
  const [abrirAcesso, setAbrirAcesso] = useState(nova || !temAcesso);
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarRemover, setConfirmarRemover] = useState(false);
  const podeApelido = admin || nova;
  const acessoPreenchido = login.trim() !== '' || senha !== '';

  const gravar = async () => {
    setErro('');
    if (podeApelido && apelido.trim().length < 2) { setErro('Dê um apelido de pelo menos 2 letras.'); return; }
    if (nova && (!casa || !/^[A-Za-z]{3}$/.test(moeda.trim()))) { setErro('Escolha a casa e informe a moeda com 3 letras (PEN, BRL...).'); return; }
    if (nova && admin && !dono) { setErro('Escolha o dono da conta.'); return; }
    if (acessoPreenchido && (login.trim() === '' || senha === '')) { setErro('Para cadastrar o acesso, informe o login e a senha (ou deixe os dois vazios).'); return; }
    if (login.trim().length > ACESSO_MAX || senha.length > ACESSO_MAX) { setErro(`Login e senha: no máximo ${ACESSO_MAX} caracteres.`); return; }
    setOcupado('gravar');
    try {
      let r = conta;
      let criada = false;
      if (nova) {
        const corpo = { apelido: apelido.trim(), casa, moeda: moeda.trim().toUpperCase(), estado, observacao: obs.trim() || null };
        if (admin) corpo.usuario_id = Number(dono);
        r = await ApiAutomacao.criarConta(corpo);
        criada = true;
      } else {
        const corpo = {};
        if (admin && apelido.trim() !== conta.apelido) corpo.apelido = apelido.trim();
        if (admin && Number(dono) !== conta.usuario_id) corpo.usuario_id = Number(dono);
        if (estado !== conta.estado) corpo.estado = estado;
        if ((obs.trim() || null) !== (conta.observacao || null)) corpo.observacao = obs.trim() || null;
        if (Object.keys(corpo).length > 0) {
          r = await ApiAutomacao.editarConta(conta.id, corpo);
          if (r.bots_desligados?.length) {
            avisar?.(`A conta deixou de estar ativa: ${r.bots_desligados.length} bot(s) em real foram desligados (${r.bots_desligados.join(', ')}).`, 'warn');
          }
        } else if (!acessoPreenchido) { onFechar(); return; }
      }
      if (acessoPreenchido) {
        try {
          r = await ApiAutomacao.gravarAcesso(r.id, login.trim(), senha);
        } catch (e) {
          // a conta já foi gravada; só o acesso falhou: avisa e devolve a conta como ficou
          setLogin(''); setSenha('');
          avisar?.(`${criada ? 'Conta criada, mas o' : 'O'} acesso não foi gravado: ${(e && e.message) || 'erro'}`, 'error');
          onGravou(r, { criada });
          return;
        }
      }
      setLogin(''); setSenha('');
      onGravou(r, { criada });
    } catch (e) {
      setErro((e && e.message) || 'Não deu para gravar a conta.');
    } finally { setOcupado(''); }
  };

  const remover = async () => {
    setErro('');
    setOcupado('remover');
    try {
      const r = await ApiAutomacao.removerAcesso(conta.id);
      avisar?.('Acesso removido do cofre.', 'success');
      onGravou(r, { criada: false });
    } catch (e) {
      setErro((e && e.message) || 'Não deu para remover o acesso.');
      setConfirmarRemover(false);
    } finally { setOcupado(''); }
  };

  const campo = 'w-full px-3 py-2 rounded-md text-sm outline-none focus:ring-1 focus:ring-mike-accent/60';
  const casaNome = (cod) => (casas.find((c) => c.codigo === cod)?.nome) || cod;
  return (
    <Modal titulo={nova ? 'Nova conta de casa' : `Conta — ${conta.apelido}`} onFechar={() => !ocupado && onFechar()} camada={camada}>
      <div className="flex flex-col gap-3">
        <Campo rotulo="Apelido" ajuda="Só um nome para reconhecer a conta. Login e senha vão no bloco de acesso, mais abaixo.">
          <input value={apelido} onChange={(e) => setApelido(e.target.value)} maxLength={60} autoFocus={nova} disabled={!podeApelido || Boolean(ocupado)}
            placeholder="ex.: Jokerbet do João" className={campo} style={{ ...INPUT, opacity: podeApelido ? 1 : 0.6 }} />
        </Campo>
        <div className="flex gap-3">
          <div className="flex-1">
            <Campo rotulo="Casa">
              {(!nova || casaFixa) ? (
                <input value={casaNome(casa)} disabled className={campo} style={{ ...INPUT, opacity: 0.6 }} aria-label="Casa" />
              ) : (
                <select value={casa} onChange={(e) => setCasa(e.target.value)} disabled={Boolean(ocupado)} className={campo} style={INPUT} aria-label="Casa">
                  {casas.length === 0 && <option value="">nenhuma casa liberada</option>}
                  {casas.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome || c.codigo}</option>)}
                </select>
              )}
            </Campo>
          </div>
          <div className="w-28">
            <Campo rotulo="Moeda">
              <input value={moeda} onChange={(e) => setMoeda(e.target.value.toUpperCase())} maxLength={3} disabled={!nova || Boolean(ocupado)}
                placeholder="PEN" className={campo} style={{ ...INPUT, opacity: nova ? 1 : 0.6 }} aria-label="Moeda" />
            </Campo>
          </div>
        </div>
        {admin && (
          <Campo rotulo="Dono (usuário)" ajuda={!nova && conta.bots_vinculados > 0 ? `${conta.bots_vinculados} bot(s) usam esta conta: para trocar o dono, tire a conta deles antes.` : undefined}>
            <select value={dono} onChange={(e) => setDono(e.target.value)} className={campo} style={{ ...INPUT, opacity: donoFixo ? 0.6 : 1 }}
              disabled={Boolean(ocupado) || Boolean(donoFixo) || (!nova && conta.bots_vinculados > 0)} aria-label="Dono da conta">
              <option value="">escolha o dono</option>
              {donoFixo && !usuarios.some((u) => String(u.id) === String(donoFixo)) && <option value={donoFixo}>dono do bot (#{donoFixo})</option>}
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>)}
            </select>
          </Campo>
        )}
        <Campo rotulo="Estado" ajuda="Só conta ativa aposta em real. Tirar de ativa desliga na hora os bots em real desta conta.">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} disabled={Boolean(ocupado)} className={campo} style={INPUT} aria-label="Estado da conta">
            {ESTADOS_CONTA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Observação">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={2} disabled={Boolean(ocupado)} className={campo} style={INPUT} />
        </Campo>

        {/* ═══════════ acesso (login e senha), só de escrita ═══════════ */}
        <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(6, 11, 15, 0.6)', border: '0.5px solid rgba(50, 100, 104, 0.35)' }} data-bloco="acesso">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-3.5 h-3.5" style={{ color: '#2bcdb9' }} />
            <span className="text-[11px] font-bold text-slate-200">Acesso da conta na casa</span>
          </div>
          {!nova && temAcesso && (
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#5eead4' }}>
                <ShieldCheck className="w-3.5 h-3.5" />
                Acesso cadastrado em {fmtData(conta.acesso_em)}{conta.acesso_por ? ` por ${conta.acesso_por}` : ''}
              </span>
              <div className="flex-1" />
              {!abrirAcesso && (
                <button type="button" onClick={() => setAbrirAcesso(true)} disabled={Boolean(ocupado)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold transition" style={{ border: '0.5px solid rgba(43, 205, 185, 0.5)', color: '#2bcdb9' }}>
                  Trocar
                </button>
              )}
              {!confirmarRemover ? (
                <button type="button" onClick={() => setConfirmarRemover(true)} disabled={Boolean(ocupado)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition" style={{ border: '0.5px solid rgba(244, 63, 94, 0.5)', color: '#fb7185' }}>
                  <Trash2 className="w-3 h-3" /> Remover
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <button type="button" onClick={remover} disabled={Boolean(ocupado)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition" style={{ backgroundColor: '#f43f5e', color: '#fff' }}>
                    {ocupado === 'remover' && <Loader2 className="w-3 h-3 animate-spin" />} Remover mesmo
                  </button>
                  <button type="button" onClick={() => setConfirmarRemover(false)} disabled={Boolean(ocupado)} className="text-[11px] text-slate-400 hover:text-slate-100">cancelar</button>
                </span>
              )}
            </div>
          )}
          {!nova && !temAcesso && (
            <p className="text-[11px] mb-2" style={{ color: conta.acesso_estado === 'ilegivel' ? '#fcd34d' : '#94a3b8' }}>
              {conta.acesso_estado === 'ilegivel'
                ? 'Havia um acesso cadastrado, mas o cofre não abriu. Cadastre de novo.'
                : 'Sem acesso cadastrado. Sem ele a conta não aposta em real.'}
            </p>
          )}
          {abrirAcesso && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <input value={login} onChange={(e) => setLogin(e.target.value)} maxLength={ACESSO_MAX} disabled={Boolean(ocupado)}
                    placeholder={temAcesso ? 'novo login' : 'login na casa'} autoComplete="off" spellCheck={false} name="conta-casa-login"
                    className={campo} style={INPUT} aria-label="Login da conta na casa" />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} maxLength={ACESSO_MAX} disabled={Boolean(ocupado)}
                    placeholder={temAcesso ? 'nova senha' : 'senha na casa'} autoComplete="new-password" name="conta-casa-senha"
                    className={campo} style={INPUT} aria-label="Senha da conta na casa" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Só de escrita: depois de gravar, ninguém vê a senha por aqui, nem o administrador. Ela fica num cofre criptografado
                na máquina do robô; o painel guarda apenas quando e por quem foi cadastrada.{nova ? ' Pode deixar em branco e cadastrar depois.' : ''}
              </p>
            </div>
          )}
        </div>

        {erro && <p className="text-xs font-semibold" style={{ color: '#fca5a5' }} role="alert">{erro}</p>}
        <button type="button" onClick={gravar} disabled={Boolean(ocupado)}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition disabled:opacity-60"
          style={{ backgroundColor: '#2bcdb9', color: '#060b0f' }}>
          {ocupado === 'gravar' && <Loader2 className="w-4 h-4 animate-spin" />}
          {nova ? 'Criar conta' : 'Gravar'}
        </button>
      </div>
    </Modal>
  );
}
