# -*- coding: utf-8 -*-
"""
patch_front_unidades.py - Cards do backtest avulso em UNIDADES de verdade
(src/screens/BacktestAvulso.jsx do repo tipmike).

O card 'Lucro (u)' mostrava r.pnl, que e em R$ (o formulario pede Stake em
R$) - no job 42 apareceu 'LUCRO (U) 2640' quando o lucro real era +12u.
O 'Drawdown' tinha o sufixo 'u' hardcoded em cima de um valor em R$.

Agora:
  - Lucro  = pnl_unidades do backend (fallback: pnl/stake_valor em job antigo)
  - Drawdown = drawdown_unidades (mesmo fallback; ATENCAO: em job antigo o
    drawdown_max vinha superestimado - o fallback so corrige a ESCALA)
  - linha discreta com os valores em R$ embaixo dos cards
  - tooltip das barras por dia sem o sufixo 'u' indevido (pnl diario e R$)

USO (na pasta do repo tipmike, no PC):
    python patch_front_unidades.py
    git add -A && git commit -m "backtest: cards em unidades (auditoria job 42)" && git push
    (Vercel builda sozinho)

Backup: src/screens/BacktestAvulso.jsx.bak-job42. Match unico obrigatorio;
qualquer falha = nada muda.
"""
import shutil
import sys
from pathlib import Path

ARQUIVO = Path("src/screens/BacktestAvulso.jsx")
BACKUP = Path("src/screens/BacktestAvulso.jsx.bak-job42")

PATCHES = []

# 1) deriva unidades logo apos os nums existentes
PATCHES.append((
'''  const r = resultado || {};
  const roiN = num(r.roi);
  const pnlN = num(r.pnl);
  const ddN = num(r.drawdown_max);
''',
'''  const r = resultado || {};
  const roiN = num(r.roi);
  const pnlN = num(r.pnl);
  const ddN = num(r.drawdown_max);
  // JOB42: unidades vem do backend (migration 016). Fallback pra jobs antigos
  // deriva de pnl/stake - so corrige a ESCALA (o drawdown antigo em si vinha
  // superestimado pelo calculo max-min; reroda o backtest pra ter o DD certo).
  const stakeN = num(r.stake_valor);
  const pnlU = num(r.pnl_unidades) ?? (pnlN != null && stakeN ? pnlN / stakeN : null);
  const ddU = num(r.drawdown_unidades) ?? (ddN != null && stakeN ? ddN / stakeN : null);
''',))

# 2) card Lucro em unidades
PATCHES.append((
'''<StatCard icon={DollarSign} label="Lucro (u)" valor={u(r.pnl)} cor={pnlN == null ? '#eaeef7' : (pnlN >= 0 ? '#10b981' : '#f43f5e')} />''',
'''<StatCard icon={DollarSign} label="Lucro" valor={pnlU != null ? `${u(pnlU)}u` : u(r.pnl)} cor={pnlN == null ? '#eaeef7' : (pnlN >= 0 ? '#10b981' : '#f43f5e')} />''',))

# 3) drawdown em unidades
PATCHES.append((
'''                        ['Drawdown', `${u(r.drawdown_max)}u`, ddN ? '#f43f5e' : '#eaeef7'],''',
'''                        ['Drawdown', ddU != null ? `${u(ddU)}u` : u(r.drawdown_max), ddN ? '#f43f5e' : '#eaeef7'],''',))

# 4) linha discreta com os valores em R$ abaixo do hero
PATCHES.append((
'''                      <StatCard icon={Target} label="ROI" valor={pct(r.roi)} cor={roiN == null ? '#eaeef7' : (roiN >= 0 ? '#10b981' : '#f43f5e')} />
                    </div>
''',
'''                      <StatCard icon={Target} label="ROI" valor={pct(r.roi)} cor={roiN == null ? '#eaeef7' : (roiN >= 0 ? '#10b981' : '#f43f5e')} />
                    </div>
                    {pnlU != null && (
                      <div className="text-[9px] text-[--mike-fg-muted] mt-1.5 text-center font-mono">
                        em R$: lucro {u(r.pnl)} · drawdown {u(r.drawdown_max)} · stake {u(r.stake_valor)}
                      </div>
                    )}
''',))

# 5) tooltip das barras por dia: pnl diario e em R$, tira o 'u' indevido
PATCHES.append((
'''title={`${d.data}: ${d.g}G ${d.r}R${d.v ? ` ${d.v}V` : ''} · PnL ${d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(1)}u`}''',
'''title={`${d.data}: ${d.g}G ${d.r}R${d.v ? ` ${d.v}V` : ''} · PnL R$ ${d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(1)}`}''',))


def main() -> int:
    if not ARQUIVO.exists():
        print(f"ERRO: {ARQUIVO} nao encontrado. Rode na raiz do repo tipmike.")
        return 1

    src = ARQUIVO.read_text(encoding='utf-8')

    if 'pnl_unidades' in src:
        print("Patch JA APLICADO. Nada a fazer.")
        return 0

    erros = []
    for i, (old, _new) in enumerate(PATCHES, 1):
        n = src.count(old)
        if n != 1:
            erros.append(f"  - patch {i}: trecho encontrado {n}x (precisa ser 1)")
    if erros:
        print("ERRO: arquivo diferente do esperado, NADA foi alterado:")
        print('\n'.join(erros))
        return 1

    shutil.copy2(ARQUIVO, BACKUP)
    novo = src
    for i, (old, new) in enumerate(PATCHES, 1):
        novo = novo.replace(old, new, 1)
        print(f"  patch {i}/{len(PATCHES)} aplicado")
    ARQUIVO.write_text(novo, encoding='utf-8')
    print(f"\nOK! {ARQUIVO} atualizado (backup em {BACKUP}). Commita e pusha pro Vercel buildar.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
