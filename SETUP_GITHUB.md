# 🚀 Como subir o TipMike no GitHub

Esse guia é pra ti subir o projeto pela primeira vez no GitHub.

---

## Passo 1: Criar repositório no GitHub

1. Vai em https://github.com/new
2. Nome do repo: **`tipmike`** (ou outro de tua escolha)
3. Descrição: `Sistema de gerenciamento de bots de apostas esportivas em e-sports`
4. **Visibilidade**:
   - ✅ **Private** (recomendado pra começar — é teu projeto pessoal)
   - ⚠️ Public se quiser mostrar como portfolio (cuidado com credenciais)
5. **NÃO marca** "Add README", "Add .gitignore" ou "Add license" (já temos)
6. Clica **Create repository**

GitHub vai mostrar uma página com instruções. Pula pra próxima etapa.

---

## Passo 2: Baixar o projeto

O zip do projeto tá aqui: `tipmike_app.zip`

1. Faz download do arquivo
2. Descompacta numa pasta no teu computador (ex: `C:\Users\Administrator\PycharmProjects\tipmike` ou `~/projects/tipmike`)
3. Abre o terminal **dentro da pasta descompactada**

---

## Passo 3: Inicializar git e fazer primeiro commit

No terminal, dentro da pasta `tipmike`:

```bash
# Inicializa repo git local
git init

# Define a branch padrão como main
git branch -M main

# Adiciona todos os arquivos (respeitando .gitignore)
git add .

# Primeiro commit
git commit -m "feat: initial commit - TipMike v0.1 com 7 telas implementadas"
```

---

## Passo 4: Conectar com GitHub e fazer push

Substitui `SEU_USUARIO` pelo teu usuário do GitHub e roda:

```bash
# Conecta repo local com remoto
git remote add origin https://github.com/SEU_USUARIO/tipmike.git

# Envia código
git push -u origin main
```

Se for a primeira vez usando git no GitHub, vai pedir autenticação:
- **Recomendado**: usar **Personal Access Token** (PAT)
- Como gerar: https://github.com/settings/tokens
- Marca scope `repo` (acesso total a repositórios privados)
- Cola o token quando pedir senha

---

## Passo 5: Confirmar que subiu

1. Volta no GitHub
2. Atualiza a página do repo
3. Tu deve ver:
   - 📂 Pasta `src/` com `App.jsx`, `screens/`, etc
   - 📄 `README.md` renderizando bonito
   - 📄 `LICENSE`, `package.json`, `vite.config.js`
   - **Nenhum arquivo `node_modules/`** (correto — `.gitignore` ignora)

---

## Passo 6: Testar localmente

```bash
# Instalar dependências
npm install

# Rodar
npm run dev

# Abre http://localhost:5173 no navegador
```

Se aparecer a tela do TipMike funcionando, **sucesso total**! 🎉

---

## Estrutura subida

```
tipmike/
├── .gitignore
├── LICENSE
├── README.md
├── SETUP_GITHUB.md          ← este arquivo
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── index.css
    └── screens/
        ├── Today.jsx
        ├── Live.jsx
        ├── Bots.jsx
        ├── Stats.jsx
        ├── CriarBot.jsx
        ├── PartidaIndividual.jsx
        └── Historico.jsx
```

---

## Comandos úteis pra dia a dia

```bash
# Ver o que mudou
git status

# Ver diferenças linha a linha
git diff

# Adicionar mudanças
git add .

# Commitar
git commit -m "feat: descrição da mudança"

# Enviar pro GitHub
git push

# Baixar mudanças (se editar pelo navegador)
git pull
```

### Convenção de mensagens de commit

Recomendo usar [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nova funcionalidade
- `fix:` correção de bug
- `style:` mudança visual/CSS
- `refactor:` refatoração sem mudar comportamento
- `docs:` mudança em documentação
- `chore:` manutenção (deps, configs)

Exemplos:
- `feat: adicionar tela de Marketplace`
- `fix: corrigir scroll do dropdown na sidebar Stats`
- `style: ajustar cores das tabs ativas`

---

## Próximos passos depois de subir

1. **Configurar deploy** (Vercel ou Netlify) pra hospedar online de graça
2. **GitHub Actions** pra rodar build automaticamente
3. **GitHub Pages** se quiser hospedar estático
4. **Branches**: criar `dev` pra mudanças antes de mergear na `main`

---

## Problemas comuns

### "remote origin already exists"

```bash
git remote remove origin
git remote add origin https://github.com/SEU_USUARIO/tipmike.git
```

### "Permission denied (publickey)"

Tu tá tentando usar SSH. Usa HTTPS:

```bash
git remote set-url origin https://github.com/SEU_USUARIO/tipmike.git
```

### "Updates were rejected"

Aconteceu se tu criou README/LICENSE no GitHub. Resolve com:

```bash
git pull --rebase origin main
git push origin main
```

---

Boa sorte! Qualquer dúvida, me chama.
