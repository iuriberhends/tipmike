// ============================================================
// screens/AdminUsuarios.jsx — Painel de usuários e convites (Fase 5)
//
// Só admins chegam aqui (RequireAdmin na rota + item de menu
// condicionado). O backend valida de novo em toda chamada.
//
// Seções:
//   1. Usuários — listar/buscar, ativar/desativar, promover/rebaixar,
//      resetar senha, excluir (só sem bots)
//   2. Convites — gerar (código exibido UMA vez, com copiar),
//      listar por situação, revogar pendentes
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  Ban, CheckCircle2, Copy, KeyRound, Loader2, Plus, RefreshCw,
  Search, Shield, ShieldOff, Ticket, Trash2, X,
} from 'lucide-react';
import MikeHeader from '../shared/MikeHeader.jsx';
import { ApiAdmin } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

// ───────────────────────── estilos base ─────────────────────────
const CARD = {
  backgroundColor: 'rgba(20, 26, 40, 0.6)',
  border: '0.5px solid rgba(60, 85, 130, 0.4)',
};
const INPUT = {
  backgroundColor: 'rgba(11, 15, 26, 0.8)',
  border: '0.5px solid rgba(60, 85, 130, 0.4)',
  color: '#eaeef7',
};

function BadgeSituacao({ situacao }) {
  const cores = {
    pendente: { bg: 'rgba(34, 211, 238, 0.12)', bd: 'rgba(34, 211, 238, 0.4)', fg: '#67e8f9' },
    usado:    { bg: 'rgba(16, 185, 129, 0.12)', bd: 'rgba(16, 185, 129, 0.4)', fg: '#6ee7b7' },
    expirado: { bg: 'rgba(251, 191, 36, 0.12)', bd: 'rgba(251, 191, 36, 0.4)', fg: '#fcd34d' },
    revogado: { bg: 'rgba(239, 68, 68, 0.12)',  bd: 'rgba(239, 68, 68, 0.4)',  fg: '#fca5a5' },
  };
  const c = cores[situacao] || cores.pendente;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
      style={{ backgroundColor: c.bg, border: `0.5px solid ${c.bd}`, color: c.fg }}
    >
      {situacao}
    </span>
  );
}

function fmtData(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

// ───────────────────────── Modal genérico ─────────────────────────
function Modal({ titulo, onFechar, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(3, 6, 14, 0.75)' }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ ...CARD, backgroundColor: 'rgba(16, 21, 34, 0.98)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black">{titulo}</h3>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-100 transition" title="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ═════════════════════════ Tela principal ═════════════════════════
export default function AdminUsuarios({ onNavegar }) {
  const { usuario: eu } = useAuth();

  // usuários
  const [usuarios, setUsuarios] = useState([]);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true);
  const [erroUsuarios, setErroUsuarios] = useState('');
  const [ocupadoId, setOcupadoId] = useState(null); // trava por linha durante ação

  // convites
  const [convites, setConvites] = useState([]);
  const [carregandoConvites, setCarregandoConvites] = useState(true);
  const [erroConvites, setErroConvites] = useState('');

  // modais
  const [modalReset, setModalReset] = useState(null);      // usuário alvo
  const [senhaNova, setSenhaNova] = useState('');
  const [erroModal, setErroModal] = useState('');
  const [salvandoModal, setSalvandoModal] = useState(false);

  const [modalConvite, setModalConvite] = useState(false);
  const [convNota, setConvNota] = useState('');
  const [convDias, setConvDias] = useState(7);
  const [convRole, setConvRole] = useState('user');
  const [conviteGerado, setConviteGerado] = useState(null); // {codigo, ...} exibido UMA vez
  const [copiado, setCopiado] = useState(false);

  // ─── carregamento ───
  const carregarUsuarios = useCallback(async (q) => {
    setCarregandoUsuarios(true);
    setErroUsuarios('');
    try {
      const r = await ApiAdmin.listarUsuarios({ limit: 200, q: q || undefined });
      setUsuarios(r.items || []);
    } catch (e) {
      setErroUsuarios((e && e.message) || 'Falha ao carregar usuários.');
    } finally {
      setCarregandoUsuarios(false);
    }
  }, []);

  const carregarConvites = useCallback(async () => {
    setCarregandoConvites(true);
    setErroConvites('');
    try {
      const r = await ApiAdmin.listarConvites({ limit: 100 });
      setConvites(r.items || []);
    } catch (e) {
      setErroConvites((e && e.message) || 'Falha ao carregar convites.');
    } finally {
      setCarregandoConvites(false);
    }
  }, []);

  useEffect(() => { carregarUsuarios(); carregarConvites(); }, [carregarUsuarios, carregarConvites]);

  // busca com debounce simples
  useEffect(() => {
    const t = setTimeout(() => carregarUsuarios(buscaUsuario.trim()), 350);
    return () => clearTimeout(t);
  }, [buscaUsuario, carregarUsuarios]);

  // ─── ações de usuário ───
  const executar = async (id, fn, msgErro) => {
    setOcupadoId(id);
    try {
      await fn();
      await carregarUsuarios(buscaUsuario.trim());
    } catch (e) {
      window.alert((e && e.message) || msgErro);
    } finally {
      setOcupadoId(null);
    }
  };

  const alternarAtivo = (u) => {
    const acao = u.ativo ? 'desativar' : 'reativar';
    if (u.ativo && !window.confirm(
      `Desativar ${u.nome}? Todas as sessões dele caem na hora e o login fica bloqueado.`
    )) return;
    executar(u.id, () => ApiAdmin.atualizarUsuario(u.id, { ativo: !u.ativo }), `Falha ao ${acao}.`);
  };

  const alternarRole = (u) => {
    const novaRole = u.role === 'admin' ? 'user' : 'admin';
    const aviso = novaRole === 'admin'
      ? `Promover ${u.nome} a ADMINISTRADOR? Ele passa a ver e gerenciar tudo — inclusive esta tela.`
      : `Rebaixar ${u.nome} para usuário comum?`;
    if (!window.confirm(aviso)) return;
    executar(u.id, () => ApiAdmin.atualizarUsuario(u.id, { role: novaRole }), 'Falha ao mudar o papel.');
  };

  const excluir = (u) => {
    if (!window.confirm(
      `Excluir ${u.nome} (${u.email}) DEFINITIVAMENTE? Essa ação não tem volta.`
    )) return;
    executar(u.id, () => ApiAdmin.deletarUsuario(u.id), 'Falha ao excluir.');
  };

  const confirmarReset = async () => {
    if (salvandoModal) return;
    setErroModal('');
    if (!senhaNova || senhaNova.length < 10) {
      setErroModal('A senha precisa ter pelo menos 10 caracteres.');
      return;
    }
    setSalvandoModal(true);
    try {
      await ApiAdmin.resetarSenha(modalReset.id, senhaNova);
      setModalReset(null);
      setSenhaNova('');
      window.alert('Senha alterada. Todas as sessões do usuário foram derrubadas.');
    } catch (e) {
      setErroModal((e && e.message) || 'Falha ao resetar a senha.');
    } finally {
      setSalvandoModal(false);
    }
  };

  // ─── ações de convite ───
  const gerarConvite = async () => {
    if (salvandoModal) return;
    setErroModal('');
    setSalvandoModal(true);
    try {
      const r = await ApiAdmin.criarConvite({
        role: convRole,
        dias_validade: Number(convDias) || 7,
        nota: convNota.trim() || null,
      });
      setConviteGerado(r);
      setCopiado(false);
      setConvNota('');
      carregarConvites();
    } catch (e) {
      setErroModal((e && e.message) || 'Falha ao gerar convite.');
    } finally {
      setSalvandoModal(false);
    }
  };

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(conviteGerado.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copie o código manualmente:', conviteGerado.codigo);
    }
  };

  const revogarConvite = async (c) => {
    if (!window.confirm(`Revogar o convite #${c.id}${c.nota ? ` (${c.nota})` : ''}? Ele deixa de funcionar.`)) return;
    try {
      await ApiAdmin.revogarConvite(c.id);
      carregarConvites();
    } catch (e) {
      window.alert((e && e.message) || 'Falha ao revogar.');
    }
  };

  const fecharModalConvite = () => {
    setModalConvite(false);
    setConviteGerado(null);
    setErroModal('');
  };

  // ─────────────────────────── render ───────────────────────────
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#0b0f1a', color: '#eaeef7', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <MikeHeader telaAtiva="usuarios" onNavegar={onNavegar} />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-6 flex flex-col gap-6">

        {/* ═══════════ USUÁRIOS ═══════════ */}
        <section className="rounded-2xl p-5" style={CARD}>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-sm font-black tracking-tight">Usuários</h2>
            <span className="text-[11px] text-slate-500">{usuarios.length} conta(s)</span>
            <div className="flex-1" />
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={buscaUsuario}
                onChange={(e) => setBuscaUsuario(e.target.value)}
                placeholder="Buscar nome ou e-mail..."
                className="pl-8 pr-3 py-1.5 rounded-md text-xs outline-none w-56 focus:ring-1 focus:ring-[--mike-accent]/60"
                style={INPUT}
              />
            </div>
            <button
              onClick={() => carregarUsuarios(buscaUsuario.trim())}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 transition"
              title="Recarregar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {erroUsuarios && (
            <div className="px-3 py-2 rounded-md text-xs font-semibold mb-3" style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '0.5px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5',
            }}>
              {erroUsuarios}
            </div>
          )}

          {carregandoUsuarios ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando usuários...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-500">
                    <th className="py-2 pr-3 font-bold">Nome</th>
                    <th className="py-2 pr-3 font-bold">E-mail</th>
                    <th className="py-2 pr-3 font-bold">Papel</th>
                    <th className="py-2 pr-3 font-bold">Status</th>
                    <th className="py-2 pr-3 font-bold">Bots</th>
                    <th className="py-2 pr-3 font-bold">Último login</th>
                    <th className="py-2 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const souEu = eu && u.id === eu.id;
                    const ocupado = ocupadoId === u.id;
                    return (
                      <tr key={u.id} style={{ borderTop: '0.5px solid rgba(60, 85, 130, 0.25)' }}>
                        <td className="py-2.5 pr-3 font-semibold">
                          {u.nome}{souEu && <span className="text-[9px] text-cyan-300 ml-1.5">(você)</span>}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-400">{u.email}</td>
                        <td className="py-2.5 pr-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={u.role === 'admin'
                              ? { backgroundColor: 'rgba(167, 139, 250, 0.12)', border: '0.5px solid rgba(167, 139, 250, 0.4)', color: '#c4b5fd' }
                              : { backgroundColor: 'rgba(100, 116, 139, 0.15)', border: '0.5px solid rgba(100, 116, 139, 0.4)', color: '#cbd5e1' }}
                          >
                            {u.role === 'admin' ? 'ADMIN' : 'USER'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`text-[10px] font-bold ${u.ativo ? 'text-emerald-400' : 'text-red-400'}`}>
                            {u.ativo ? '● Ativo' : '○ Desativado'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-300">{u.qtd_bots}</td>
                        <td className="py-2.5 pr-3 text-slate-500">{fmtData(u.ultimo_login)}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5 justify-end">
                            {ocupado ? (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            ) : (
                              <>
                                <button
                                  onClick={() => alternarRole(u)}
                                  disabled={souEu}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-violet-300 transition disabled:opacity-30"
                                  title={souEu ? 'Você não altera o próprio papel' : (u.role === 'admin' ? 'Rebaixar para usuário' : 'Promover a admin')}
                                >
                                  {u.role === 'admin' ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => setModalReset(u) || setSenhaNova('') || setErroModal('')}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-amber-300 transition"
                                  title="Resetar senha"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => alternarAtivo(u)}
                                  disabled={souEu}
                                  className={`p-1.5 rounded-md transition disabled:opacity-30 ${u.ativo ? 'text-slate-400 hover:text-red-400' : 'text-slate-400 hover:text-emerald-400'}`}
                                  title={souEu ? 'Você não desativa a própria conta' : (u.ativo ? 'Desativar (derruba as sessões)' : 'Reativar')}
                                >
                                  {u.ativo ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => excluir(u)}
                                  disabled={souEu || u.qtd_bots > 0}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-red-400 transition disabled:opacity-30"
                                  title={
                                    souEu ? 'Você não exclui a própria conta'
                                      : u.qtd_bots > 0 ? `Tem ${u.qtd_bots} bot(s) — desative em vez de excluir`
                                        : 'Excluir definitivamente'
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {usuarios.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-slate-500">Nenhum usuário encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ═══════════ CONVITES ═══════════ */}
        <section className="rounded-2xl p-5" style={CARD}>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-sm font-black tracking-tight">Convites</h2>
            <span className="text-[11px] text-slate-500">
              código de uso único — mostrado só na hora de gerar
            </span>
            <div className="flex-1" />
            <button
              onClick={() => carregarConvites()}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 transition"
              title="Recarregar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setModalConvite(true); setConviteGerado(null); setErroModal(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition"
              style={{ backgroundColor: '#10b981', color: '#0b0f1a', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
            >
              <Plus className="w-3.5 h-3.5" /> Gerar convite
            </button>
          </div>

          {erroConvites && (
            <div className="px-3 py-2 rounded-md text-xs font-semibold mb-3" style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '0.5px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5',
            }}>
              {erroConvites}
            </div>
          )}

          {carregandoConvites ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando convites...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-500">
                    <th className="py-2 pr-3 font-bold">#</th>
                    <th className="py-2 pr-3 font-bold">Situação</th>
                    <th className="py-2 pr-3 font-bold">Nota</th>
                    <th className="py-2 pr-3 font-bold">Papel</th>
                    <th className="py-2 pr-3 font-bold">Expira em</th>
                    <th className="py-2 pr-3 font-bold">Usado por</th>
                    <th className="py-2 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {convites.map((c) => (
                    <tr key={c.id} style={{ borderTop: '0.5px solid rgba(60, 85, 130, 0.25)' }}>
                      <td className="py-2.5 pr-3 text-slate-500">{c.id}</td>
                      <td className="py-2.5 pr-3"><BadgeSituacao situacao={c.situacao} /></td>
                      <td className="py-2.5 pr-3 text-slate-300">{c.nota || '—'}</td>
                      <td className="py-2.5 pr-3 text-slate-400 uppercase text-[10px] font-bold">{c.role}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{fmtData(c.expira_em)}</td>
                      <td className="py-2.5 pr-3 text-slate-300">{c.usado_por_nome || '—'}</td>
                      <td className="py-2.5">
                        <div className="flex justify-end">
                          {c.situacao === 'pendente' && (
                            <button
                              onClick={() => revogarConvite(c)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-400 transition"
                              title="Revogar convite"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {convites.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-slate-500">Nenhum convite gerado ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* ═══════════ MODAL: resetar senha ═══════════ */}
      {modalReset && (
        <Modal titulo={`Resetar senha — ${modalReset.nome}`} onFechar={() => !salvandoModal && setModalReset(null)}>
          <p className="text-xs text-slate-400 mb-3">
            Define uma senha nova e derruba todas as sessões do usuário.
            Passe a senha pra ele por um canal seguro.
          </p>
          <input
            type="text"
            value={senhaNova}
            onChange={(e) => setSenhaNova(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmarReset()}
            placeholder="Senha nova (mín. 10 caracteres)"
            autoFocus
            className="w-full px-3 py-2 rounded-md text-sm outline-none focus:ring-1 focus:ring-[--mike-accent]/60"
            style={INPUT}
            disabled={salvandoModal}
          />
          {erroModal && <p className="text-xs font-semibold mt-2" style={{ color: '#fca5a5' }}>{erroModal}</p>}
          <button
            onClick={confirmarReset}
            disabled={salvandoModal}
            className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition disabled:opacity-60"
            style={{ backgroundColor: '#10b981', color: '#0b0f1a' }}
          >
            {salvandoModal ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {salvandoModal ? 'Salvando...' : 'Alterar senha'}
          </button>
        </Modal>
      )}

      {/* ═══════════ MODAL: gerar convite ═══════════ */}
      {modalConvite && (
        <Modal titulo="Gerar convite" onFechar={fecharModalConvite}>
          {!conviteGerado ? (
            <>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nota (pra quem é?)</label>
                  <input
                    value={convNota}
                    onChange={(e) => setConvNota(e.target.value)}
                    placeholder="ex.: cliente João do grupo X"
                    maxLength={200}
                    autoFocus
                    className="w-full px-3 py-2 rounded-md text-sm outline-none focus:ring-1 focus:ring-[--mike-accent]/60"
                    style={INPUT}
                    disabled={salvandoModal}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Validade</label>
                    <select
                      value={convDias}
                      onChange={(e) => setConvDias(e.target.value)}
                      className="w-full px-3 py-2 rounded-md text-sm outline-none"
                      style={INPUT}
                      disabled={salvandoModal}
                    >
                      <option value={1}>1 dia</option>
                      <option value={7}>7 dias</option>
                      <option value={30}>30 dias</option>
                      <option value={90}>90 dias</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Papel da conta</label>
                    <select
                      value={convRole}
                      onChange={(e) => setConvRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-md text-sm outline-none"
                      style={INPUT}
                      disabled={salvandoModal}
                    >
                      <option value="user">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                {convRole === 'admin' && (
                  <p className="text-[11px] font-semibold" style={{ color: '#fcd34d' }}>
                    ⚠ Quem usar este convite nasce ADMIN — vê e gerencia tudo.
                  </p>
                )}
                {erroModal && <p className="text-xs font-semibold" style={{ color: '#fca5a5' }}>{erroModal}</p>}
                <button
                  onClick={gerarConvite}
                  disabled={salvandoModal}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition disabled:opacity-60"
                  style={{ backgroundColor: '#10b981', color: '#0b0f1a' }}
                >
                  {salvandoModal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
                  {salvandoModal ? 'Gerando...' : 'Gerar código'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-3">
                Convite criado. <strong style={{ color: '#fcd34d' }}>Copie agora</strong> — por segurança
                o código não é exibido de novo.
              </p>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-md"
                style={{ backgroundColor: 'rgba(11, 15, 26, 0.9)', border: '0.5px solid rgba(34, 211, 238, 0.4)' }}
              >
                <code className="flex-1 text-sm font-bold break-all" style={{ fontFamily: 'JetBrains Mono, monospace', color: '#67e8f9' }}>
                  {conviteGerado.codigo}
                </code>
                <button
                  onClick={copiarCodigo}
                  className="p-1.5 rounded-md text-slate-300 hover:text-white transition shrink-0"
                  title="Copiar"
                >
                  {copiado ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                Válido até {fmtData(conviteGerado.expira_em)} · papel: {conviteGerado.role}
                {conviteGerado.nota ? ` · ${conviteGerado.nota}` : ''}
              </p>
              <button
                onClick={fecharModalConvite}
                className="w-full mt-4 px-4 py-2 rounded-md text-sm font-bold transition"
                style={{ backgroundColor: 'rgba(60, 85, 130, 0.3)', color: '#eaeef7' }}
              >
                Fechar
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
