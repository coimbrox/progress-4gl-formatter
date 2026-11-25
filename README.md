# Progress Formatter & OpenEdge ABL for VS Code

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.80.0+-green.svg)

Extensão completa para **Progress 4GL (OpenEdge ABL)** no Visual Studio Code: **Formatação Inteligente**, **Syntax Highlighting**, **Auto-complete** (tabelas, campos, temp-tables, buffers, variáveis, parâmetros, métodos e includes), **Navegação (`Ctrl+Click`)**, **Hover**, **Check Syntax** (compilador oficial Progress + modo offline), **Compile, Run e Deploy** (`.r` e fonte), **Snippets**, **Code Folding** e **Painel Visual de Configuração** compatível com `.openedge-zext.json`.

## 📋 Índice

- [Recursos](#-recursos)
- [Instalação](#-instalação)
- [Configuração Facilitada](#-configuração-facilitada)
- [Check Syntax, Compile, Run e Deploy](#-check-syntax-compile-run-e-deploy)
- [Atalhos e Comandos](#-atalhos-e-comandos)
- [Auto-complete, Hover e Navegação](#-auto-complete-hover-e-navegação)
- [Formatação de Código](#-formatação-de-código)
- [Snippets e Code Folding](#-snippets-e-code-folding)
- [Licença e Autor](#-licença-e-autor)

---

## ✨ Recursos

- **Painel Visual de Configuração (Webview)** com detecção automática do `DLC` (OpenEdge) e de arquivos `.pf` do workspace — além de JSON Schema com auto-complete ao editar `.openedge-zext.json` ou `.openedge-abl.json` manualmente.
- **Check Syntax estilo Progress (`Shift+F2`)**: usa o compilador oficial do Progress (`COMPILE ... SAVE = NO`) destacando erros e warnings direto no editor e no painel **Problems**, com opção de **Check Syntax Offline/Estático** quando o `DLC` ainda não estiver configurado.
- **Compile, Run e Deploy (`Alt+F1`, `Alt+F2`, `Alt+F3`, `F2`)**: gera o `.r` direto nas pastas configuradas (ou em uma pasta escolhida na hora), com suporte a `preserveSubfolder`, opções de compilação (`XREF`, `XREF-XML`, `DEBUG-LIST`, `PREPROCESS`, `LISTING`, `STRING-XREF`) e `postAction` (`URL` ou `COMMAND`).
- **Botões rápidos no topo do editor** (`✓` Check Syntax, `🚀` Compile & Deploy, `▶` Run) e menu de contexto (**botão direito → OpenEdge ABL**).
- **Syntax Highlighting** para `.p`, `.w`, `.i` e `.cls`.
- **Auto-complete inteligente**:
  - Tabelas e campos do banco de dados via comando `ABL: Read Dictionary Structure`.
  - Temp-tables (incluindo herança `LIKE`), buffers, variáveis, parâmetros, procedures, functions, methods e preprocessors.
  - Sugestão automática de arquivos include (`.i`) ao digitar `{`.
- **Hover Information**: passe o mouse sobre tabelas, campos (`tabela.campo`), buffers, variáveis, parâmetros, rotinas ou `{includes.i}` para ver tipo, assinatura e caminho resolvido.
- **Navegação (`Ctrl+Click`)**: abra arquivos `{include.i}` ou vá direto à declaração de variáveis, parâmetros, temp-tables, buffers, procedures, functions e methods (no arquivo atual ou em includes).
- **Formatação Inteligente + Comandos Extras**: mantém o formatador inteligente baseado em lexer como padrão e adiciona `Keywords - Upper Case`, `Keywords - Lower Case` e `Trim Right`.
- **Code Folding**: suporte a `//#region` / `//#endregion`, `/*#region*/` / `/*#endregion*/` e blocos `PROCEDURE`, `FUNCTION`, `METHOD` e `CLASS`.
- **Code Snippets**: atalhos prontos (`defvar`, `defparam`, `deftt`, `defbuf`, `for`, `find`, `ifdo`, `proc`, `func`, `method`, `class`, `try`, `msg`, `region`).

---

## 🚀 Instalação

### Via VS Code Marketplace

1. Abra o VS Code
2. Vá na aba **Extensions** (`Ctrl+Shift+X`)
3. Procure por **"Progress Formatter & OpenEdge ABL"** (`CoimbroxDev.progress-formatter`)
4. Clique em **Install**

### Via VSIX

1. Baixe o arquivo `.vsix` da [página de releases](https://github.com/coimbrox/progress-4gl-formatter/releases)
2. No VS Code: **Extensions** → `...` → **Install from VSIX...**

---

## ⚙️ Configuração Facilitada

Você não precisa escrever o JSON do zero!

### Opção 1 — Painel Visual (Recomendado)
1. Clique em **`OpenEdge ABL`** na **barra de status** (canto inferior esquerdo) ou execute **`ABL: Configure OpenEdge Environment`** (`Ctrl+Shift+P`).
2. Selecione o **DLC** detectado automaticamente (ou clique em **Procurar...**).
3. Adicione pastas no **PROPATH**, selecione seus arquivos **`.pf`** (descobertos automaticamente), informe os nomes lógicos dos bancos em **`dbDictionary`** e configure suas pastas de **Deploy**.
4. Clique em **Salvar Configuração** — a extensão gera/atualiza `.openedge-zext.json` na raiz do workspace.

### Opção 2 — Arquivo `.openedge-zext.json` (com JSON Schema)
A extensão é 100% compatível com `.openedge-zext.json` (e `.openedge-abl.json`), com validação e auto-complete nativo:

```json
{
  "workingDirectory": "${workspaceFolder}\\Temp",
  "proPath": [
    "C:\\src",
    "${workspaceFolder}"
  ],
  "proPathMode": "overwrite",
  "dlcPath": "C:\\Progress\\OpenEdge",
  "parameterFiles": [
    "default.pf"
  ],
  "dbDictionary": [
    "meuBanco"
  ],
  "deployment": [
    {
      "taskType": "current.r-code",
      "path": "C:\\out",
      "preserveSubfolder": false,
      "postAction": [
        {
          "actionType": "URL",
          "command": "http://localhost:8080/postAction"
        }
      ]
    }
  ]
}
```

- `dlcPath` é opcional caso a variável de ambiente `DLC` já esteja definida (ou seja detectada automaticamente).
- `proPathMode` aceita `"overwrite"`, `"append"` ou `"prepend"`.
- `preserveSubfolder`: quando `true`, mantém a estrutura de subpastas relativa ao workspace ao gerar o `.r` ou copiar o fonte.

---

## 🛠️ Check Syntax, Compile, Run e Deploy

Ao abrir qualquer arquivo `.p`, `.w`, `.i` ou `.cls`, você tem 3 formas de acionar os comandos:
- **Botões no topo direito do editor**: `✓` (Check Syntax), `🚀` (Compile & Deploy) e `▶` (Run).
- **Menu de contexto**: clique com o botão direito no editor → **OpenEdge ABL**.
- **Atalhos de teclado** ou **Paleta de Comandos (`Ctrl+Shift+P`)**.

### Check Syntax
- **`Shift+F2` (`ABL: Check Syntax`)**: executa o compilador real do Progress (`COMPILE ... SAVE = NO`). Quando não há erros, exibe **`Syntax is correct`**; quando há erros/warnings, destaca exatamente a linha/coluna no editor e abre o painel **Problems**.
- **Modo Offline**: se o `DLC` ainda não estiver configurado, a extensão oferece rodar o **`ABL: Check Syntax (Offline / Static)`** para validar blocos sem `END.`, strings/comentários não fechados e parênteses desbalanceados.

### Compile & Deploy (gerar arquivo na pasta)
- **`Alt+F1` (`ABL: Compile & Deploy`)**: compila o programa e gera o `.r` em todas as pastas configuradas em `deployment` (`current.r-code`). Se você ainda não configurou nenhuma pasta de deploy, a extensão pergunta a pasta na hora e oferece salvá-la como padrão.
- **`ABL: Compile & Generate .r in Folder...`**: compila e deixa escolher qualquer pasta de destino na hora para gerar o `.r`.
- **`Alt+F3` (`ABL: Compile with Options`)**: compila gerando opções adicionais (`XREF`, `XREF-XML`, `DEBUG-LIST`, `PREPROCESS`, `LISTING`, `STRING-XREF`) + deploy.
- **`Alt+F2` (`ABL: Deploy Source`)**: envia o código-fonte sem compilar para a pasta configurada (`current.source`).

---

## ⌨️ Atalhos e Comandos

| Atalho | Comando | Descrição |
| --- | --- | --- |
| `Shift+F2` | `ABL: Check Syntax` | Verifica sintaxe com o compilador Progress e destaca erros |
| `Alt+F1` | `ABL: Compile & Deploy` | Compila o arquivo atual e gera o `.r` na pasta de deploy |
| `Alt+F2` | `ABL: Deploy Source` | Copia o arquivo fonte para a pasta de deploy (sem compilar) |
| `Alt+F3` | `ABL: Compile with Options` | Compila com opções extras (XREF, DEBUG-LIST, PREPROCESS, etc.) + deploy |
| `F2` | `ABL: Run Program` | Executa o programa atual no Progress (`prowin` / `_progres`) |
| `Shift+Alt+F` | `Format Document` | Executa o formatador inteligente Progress 4GL |
| — | `ABL: Configure OpenEdge Environment` | Abre o painel visual de configuração |
| — | `ABL: Read Dictionary Structure` | Lê tabelas e campos dos bancos configurados para auto-complete |
| — | `ABL: Compile & Generate .r in Folder...` | Compila e gera o `.r` em uma pasta escolhida na hora |
| — | `ABL: Check Syntax (Offline / Static)` | Verificação estrutural rápida sem precisar de DLC |
| — | `ABL: Format - Keywords - Upper Case` | Converte palavras-chave ABL para MAIÚSCULAS |
| — | `ABL: Format - Keywords - Lower Case` | Converte palavras-chave ABL para minúsculas |
| — | `ABL: Format - Trim Right` | Remove espaços/tabs ao final de todas as linhas |

---

## 🧠 Auto-complete, Hover e Navegação

1. Para ativar o auto-complete de **tabelas e campos do banco**, configure seus arquivos `.pf` e `dbDictionary` no painel visual e execute **`ABL: Read Dictionary Structure`** (ou clique em **Ler Dicionário Agora** no painel).
2. Digite `tabela.` ou `buffer.` ou `tt-tabela.` para listar todos os campos com tipo, formato e descrição.
3. Digite `{` para receber sugestões automáticas de arquivos `.i` presentes no seu `PROPATH`.
4. Segure **`Ctrl`** e clique em `{arquivo.i}`, variáveis, parâmetros, temp-tables, buffers, procedures, functions ou methods para navegar diretamente até a definição.

---

## 🎨 Formatação de Código

### Formatação Automática ao Salvar

Adicione ao seu `settings.json` do VS Code:

```json
{
  "[progress]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "CoimbroxDev.progress-formatter",
    "editor.tabSize": 2,
    "editor.insertSpaces": true
  }
}
```

### Exemplo de Formatação Inteligente

**Antes:**
```progress
FIND FIRST tmp-benef WHERE tmp-benef.cd-modalidade = usuario.cd-modalidade AND tmp-benef.nr-ter-adesao = usuario.nr-ter-adesao NO-LOCK NO-ERROR.
ASSIGN vl-desconto-aux = 0 vl-mensalidade-aux = 0 pc-percentual-aux = 0.
```

**Depois:**
```progress
find first tmp-benef
     where tmp-benef.cd-modalidade = usuario.cd-modalidade
       and tmp-benef.nr-ter-adesao = usuario.nr-ter-adesao
           no-lock no-error.
assign vl-desconto-aux    = 0
       vl-mensalidade-aux = 0
       pc-percentual-aux  = 0.
```

---

## 🧩 Snippets e Code Folding

- **Snippets**: digite `defvar`, `defparam`, `deftt`, `defbuf`, `for`, `find`, `ifdo`, `proc`, `func`, `method`, `class`, `try`, `msg` ou `region` e pressione `Tab`.
- **Code Folding**: organize trechos do código com `//#region Nome da Seção` ... `//#endregion` (mesmo padrão do TypeScript).

---

## 📄 Licença e Autor

Código aberto sob licença MIT — consulte [LICENSE](LICENSE).

**Gabriel Coimbra** — GitHub: [@coimbrox](https://github.com/coimbrox)
- [Repositório no GitHub](https://github.com/coimbrox/progress-4gl-formatter)
- [Reportar Bug / Sugerir Melhoria](https://github.com/coimbrox/progress-4gl-formatter/issues)
