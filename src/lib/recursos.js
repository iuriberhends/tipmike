// ============================================================
// lib/recursos.js — "a API já tem isto?"
//
// O painel é publicado separado da API. Enquanto a API não for
// reiniciada com as rotas novas, a tela nova não pode aparecer
// quebrada: o item some do menu e as seções ficam fora da tela.
//
// automacaoDisponivel(): Promise<boolean>, perguntada UMA vez por
// carga da página (resposta guardada). 404 = a API ainda não tem a
// rota. Qualquer outro erro (rede, sessão) não fica guardado: a
// próxima chamada pergunta de novo.
// ============================================================

import { useEffect, useState } from 'react';
import { ApiAutomacao } from './api.js';

let promessa = null;
let resposta = null;   // true | false | null (ainda não sei)

export function automacaoDisponivel() {
  if (resposta !== null) return Promise.resolve(resposta);
  if (!promessa) {
    promessa = ApiAutomacao.resumo()
      .then(() => { resposta = true; return true; })
      .catch((e) => {
        if (e && e.status === 404) { resposta = false; return false; }
        promessa = null;          // rede ou sessão: não decide nada, tenta de novo depois
        return false;
      });
  }
  return promessa;
}

/** true quando a API responde às rotas de automação; false enquanto não sabe ou não tem. */
export function useAutomacaoDisponivel() {
  const [ok, setOk] = useState(resposta === true);
  useEffect(() => {
    let vivo = true;
    automacaoDisponivel().then((v) => { if (vivo) setOk(v); });
    return () => { vivo = false; };
  }, []);
  return ok;
}
