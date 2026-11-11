// ============================================================
// context/PaisContext.jsx — país escolhido no site (nov/2026)
//
// O sistema deixou de ser só Brasil: há casas do Peru e outros países
// virão. Todo usuário vê todos os países e troca pelo seletor do header.
//
// - Guarda a escolha no localStorage (lib/pais.js, padrão 'BR')
// - Carrega GET /paises e GET /casas?pais=XX depois do login (as duas
//   rotas exigem sessão — chamar deslogado dispararia o logout forçado)
// - Se a API falhar, usa a reserva embutida (BR + PE e as casas atuais)
// - Expõe { pais, setPais, paises, casas, infoPais, formatarMoeda,
//   formatarDataHora, buscarCasa, carregando, fonte } via usePais()
//
// O api.js manda X-Pais em todo fetch lendo lib/pais.js. A recarga das
// telas na troca de país é feita no App.jsx com key={pais} nas rotas.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import {
  PAIS_PADRAO,
  PAISES_RESERVA,
  CASAS_RESERVA,
  casasReservaDoPais,
  getPaisAtual,
  salvarPaisAtual,
  bandeiraDoPais,
  criarFormatadores,
} from '../lib/pais.js';

const PaisContext = createContext(null);

function montarInfoPais(pais, paises) {
  const p = (paises || []).find((x) => x.codigo === pais)
    || PAISES_RESERVA.find((x) => x.codigo === pais)
    || PAISES_RESERVA.find((x) => x.codigo === PAIS_PADRAO);
  return {
    codigo: pais,
    nome: p.codigo === pais ? (p.nome || pais) : pais,
    moeda: p.moeda || 'BRL',
    simbolo: p.simbolo_moeda || 'R$',
    simbolo_moeda: p.simbolo_moeda || 'R$',
    fuso: p.fuso || 'America/Sao_Paulo',
    idioma: p.idioma || 'pt-BR',
    bandeira: bandeiraDoPais(pais),
  };
}

// Casa pelo código: primeiro nas casas do país, depois no cadastro embutido
// (bot antigo de outra casa ainda ganha rótulo/cor certos).
function criarBuscarCasa(casas) {
  return (codigo) => {
    const c = String(codigo || '').trim().toLowerCase();
    if (!c) return null;
    return (casas || []).find((x) => x.codigo === c)
      || CASAS_RESERVA.find((x) => x.codigo === c)
      || null;
  };
}

function montarValor({ pais, setPais, paises, casas, carregando, fonte }) {
  const infoPais = montarInfoPais(pais, paises);
  const { formatarMoeda, formatarDataHora } = criarFormatadores(infoPais);
  return {
    pais, setPais, paises, casas, infoPais,
    formatarMoeda, formatarDataHora,
    buscarCasa: criarBuscarCasa(casas),
    carregando, fonte,
  };
}

export function PaisProvider({ children }) {
  const { usuario } = useAuth();
  const logado = !!usuario;

  const [pais, setPaisEstado] = useState(() => getPaisAtual());
  const [paises, setPaises] = useState(PAISES_RESERVA);
  // As casas da API ficam marcadas com o país a que pertencem. No render
  // logo após a troca (antes do fetch voltar) já vale a reserva do país
  // NOVO — nunca as casas do país anterior.
  const [casasApi, setCasasApi] = useState({ pais: null, lista: null });
  const [carregando, setCarregando] = useState(false);

  const daApi = casasApi.pais === pais && Array.isArray(casasApi.lista);
  const casas = useMemo(
    () => (daApi ? casasApi.lista : casasReservaDoPais(pais)),
    [daApi, casasApi, pais],
  );
  const fonte = daApi ? 'api' : 'reserva';

  // Grava ANTES de mudar o estado: as telas remontadas por key={pais}
  // já disparam os fetch com o X-Pais novo.
  const setPais = useCallback((codigo) => {
    const novo = salvarPaisAtual(codigo);
    setPaisEstado(novo);
  }, []);

  // GET /paises — uma vez por login
  useEffect(() => {
    if (!logado) return undefined;
    let ativo = true;
    api.get('/paises')
      .then((r) => {
        if (!ativo) return;
        const lista = Array.isArray(r && r.paises) ? r.paises.filter((p) => p && p.codigo) : [];
        if (!lista.length) return;
        setPaises(lista);
        // país salvo que saiu do cadastro (ou foi desativado) → volta pro padrão
        if (!lista.some((p) => p.codigo === getPaisAtual())) {
          const padrao = lista.some((p) => p.codigo === (r && r.padrao)) ? r.padrao : lista[0].codigo;
          setPais(padrao || PAIS_PADRAO);
        }
      })
      .catch(() => { /* fica na reserva embutida */ });
    return () => { ativo = false; };
  }, [logado, setPais]);

  // GET /casas?pais=XX — a cada troca de país (e no login)
  useEffect(() => {
    if (!logado) return undefined;
    let ativo = true;
    setCarregando(true);
    api.get('/casas', { pais })
      .then((r) => {
        if (!ativo) return;
        const lista = Array.isArray(r && r.casas) ? r.casas.filter((c) => c && c.codigo) : [];
        if (lista.length) setCasasApi({ pais, lista });
      })
      .catch(() => { /* fica na reserva embutida */ })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [pais, logado]);

  const valor = useMemo(
    () => montarValor({ pais, setPais, paises, casas, carregando, fonte }),
    [pais, setPais, paises, casas, carregando, fonte],
  );

  return (
    <PaisContext.Provider value={valor}>
      {children}
    </PaisContext.Provider>
  );
}

// Fora do provider (não deveria acontecer): país salvo + reserva embutida,
// em vez de quebrar a tela.
let _valorReserva = null;
function valorReserva() {
  if (!_valorReserva) {
    const pais = getPaisAtual();
    _valorReserva = montarValor({
      pais,
      setPais: salvarPaisAtual,
      paises: PAISES_RESERVA,
      casas: casasReservaDoPais(pais),
      carregando: false,
      fonte: 'reserva',
    });
  }
  return _valorReserva;
}

export function usePais() {
  const ctx = useContext(PaisContext);
  return ctx || valorReserva();
}
