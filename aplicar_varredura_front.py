# -*- coding: utf-8 -*-
r"""
aplicar_varredura_front.py — liga a tela Varredura no painel.

Faz 4 edicoes pequenas, todas ADITIVAS, em 2 arquivos do repo do front:

  src/App.jsx              import da tela + rota /varredura + entrada no mapa
                           de navegacao (pra onNavegar('varredura') funcionar)
  src/shared/MikeHeader.jsx  icone + item no menu (aparece com selo NOVO)

O arquivo src/screens/Varredura.jsx voce copia na mao (e' novo, nao tem o que
patchar).

Cada edicao e' ancorada num trecho unico. Se alguma ancora nao bater (arquivo
diferente do esperado), ele AVISA e NAO escreve nada — nem parcialmente.
Faz backup .bak-varredura. Rodar 2x nao duplica.

USO — da pasta que contem o repo do front:
    python aplicar_varredura_front.py
    python aplicar_varredura_front.py --app C:\...\tipmike\src\App.jsx ^
                                      --header C:\...\tipmike\src\shared\MikeHeader.jsx
    python aplicar_varredura_front.py --desfazer
"""
import argparse
import os
import shutil

SUFIXO_BAK = ".bak-varredura"

APP_EDICOES = [
    # 1) import da tela, junto dos outros screens
    ("import BacktestAvulso from './screens/BacktestAvulso.jsx';",
     "import BacktestAvulso from './screens/BacktestAvulso.jsx';\n"
     "import Varredura from './screens/Varredura.jsx';"),

    # 2) mapa de navegacao (onNavegar('varredura') -> /varredura)
    ("      backtest:   '/backtest',",
     "      backtest:   '/backtest',\n"
     "      varredura:  '/varredura',"),

    # 3) rota protegida, ao lado do backtest
    ("          <Route path=\"/backtest\" element={<BacktestAvulso onNavegar={navegar} />} />",
     "          <Route path=\"/backtest\" element={<BacktestAvulso onNavegar={navegar} />} />\n"
     "          <Route path=\"/varredura\" element={<Varredura onNavegar={navegar} />} />"),
]

HEADER_EDICOES = [
    # 4a) icone (Radar = varredura; ja vem no lucide-react que o projeto usa)
    ("  Home, Activity, Store, Bot, Table2, BarChart3, Plus, FlaskConical, Users,",
     "  Home, Activity, Store, Bot, Table2, BarChart3, Plus, FlaskConical, Users,\n"
     "  Radar,"),

    # 4b) item no menu, logo depois do Backtest
    ("  { id: 'backtest',    label: 'Backtest',        icon: FlaskConical, novo: true },",
     "  { id: 'backtest',    label: 'Backtest',        icon: FlaskConical, novo: true },\n"
     "  { id: 'varredura',   label: 'Varredura',       icon: Radar, novo: true },"),
]


def achar(caminho, *padroes):
    if caminho and os.path.isfile(caminho):
        return caminho
    for p in padroes:
        for raiz in (".", "..", "tipmike", os.path.join("..", "tipmike"),
                     r"C:\Users\Administrator\PyCharmMiscProject\tipmike",
                     r"C:\Users\Iuri\Downloads\miksksfiles\tipmike_app"):
            alvo = os.path.join(raiz, p)
            if os.path.isfile(alvo):
                return alvo
    return None


def aplicar(caminho, edicoes, rotulo, marca):
    if not caminho:
        print(f"  {rotulo}: NAO ENCONTRADO — passe o caminho na linha de comando")
        return False
    with open(caminho, "r", encoding="utf-8") as f:
        src = f.read()
    if marca in src:
        print(f"  {rotulo}: JA TEM a varredura — nada a fazer")
        return True
    novo, problemas = src, []
    for i, (velho, troca) in enumerate(edicoes, 1):
        n = novo.count(velho)
        if n != 1:
            problemas.append(f"    ediçao {i}: ancora aparece {n}x (esperado 1)")
            problemas.append(f"      procurava: {velho.strip()[:72]}")
            continue
        novo = novo.replace(velho, troca)
    if problemas:
        print(f"  {rotulo}: NAO APLIQUEI — o arquivo difere do esperado:")
        for p in problemas:
            print(p)
        return False
    shutil.copyfile(caminho, caminho + SUFIXO_BAK)
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(novo)
    print(f"  {rotulo}: OK — +{len(novo.splitlines()) - len(src.splitlines())} linhas "
          f"(backup {os.path.basename(caminho)}{SUFIXO_BAK})")
    return True


def desfazer(caminho, rotulo):
    if caminho and os.path.isfile(caminho + SUFIXO_BAK):
        shutil.copyfile(caminho + SUFIXO_BAK, caminho)
        print(f"  {rotulo}: revertido")
    else:
        print(f"  {rotulo}: sem backup pra reverter")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--app", default=None)
    p.add_argument("--header", default=None)
    p.add_argument("--desfazer", action="store_true")
    a = p.parse_args()

    app = achar(a.app, os.path.join("src", "App.jsx"))
    hdr = achar(a.header, os.path.join("src", "shared", "MikeHeader.jsx"))

    print("=" * 70)
    print(" VARREDURA no painel")
    print("=" * 70)
    print(f"  App.jsx      : {app or '(nao achei)'}")
    print(f"  MikeHeader   : {hdr or '(nao achei)'}")
    print()
    if a.desfazer:
        desfazer(app, "App.jsx")
        desfazer(hdr, "MikeHeader.jsx")
        return

    ok1 = aplicar(app, APP_EDICOES, "App.jsx", "screens/Varredura.jsx")
    ok2 = aplicar(hdr, HEADER_EDICOES, "MikeHeader.jsx", "id: 'varredura'")
    print()
    if ok1 and ok2:
        pasta = os.path.dirname(app) if app else "src"
        print(" PRONTO. Falta so' copiar a tela:")
        print(f"   Varredura.jsx  ->  {os.path.join(pasta, 'screens')}")
        print()
        print(" Depois:  npm run build     (ou npm run dev)")
        print(" A aba 'Varredura' aparece no menu, ao lado de Backtest.")
    else:
        print(" Alguma parte nao foi aplicada — veja acima. Nada foi quebrado.")
    print(" Reverter: python aplicar_varredura_front.py --desfazer")


if __name__ == "__main__":
    main()
