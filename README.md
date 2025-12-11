# Progress 4GL/ABL Formatter for VS Code

![Version](https://img.shields.io/badge/version-0.0.4-blue.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.80.0+-green.svg)

Um formatador profissional e completo para a linguagem **Progress 4GL (OpenEdge ABL)** no Visual Studio Code. Este formatador aplica padrões de código consistentes e legíveis, seguindo as melhores práticas da comunidade Progress.

## 📋 Índice

- [Características](#-características)
- [Instalação](#-instalação)
- [Como Usar](#-como-usar)
- [Funcionalidades Detalhadas](#-funcionalidades-detalhadas)
- [Exemplos](#-exemplos)
- [Configuração](#-configuração)
- [Contribuindo](#-contribuindo)

## ✨ Características

<!-- 
TODO: Adicionar screenshot mostrando antes/depois da formatação
![Antes e Depois da Formatação](images/screenshot-before-after.png)
-->

### 🎯 Formatação Inteligente

- **Padronização de Palavras-chave**: Converte automaticamente palavras-chave para suas formas abreviadas padrão (`DEFINE` → `def`, `VARIABLE` → `var`, etc.)
- **Indentação Automática**: Indenta corretamente todos os blocos de código Progress
- **Alinhamento Inteligente**: Alinha condições, atribuições e declarações para melhor legibilidade
- **Suporte Completo**: Funciona com todos os tipos de arquivos Progress (`.p`, `.w`, `.i`, `.cls`)

### 🔧 Funcionalidades Principais

#### 1. Formatação de Blocos Condicionais
- Formata blocos `IF`, `FOR`, `REPEAT` com múltiplas condições
- Alinha condições `AND`/`OR` de forma consistente
- Mantém indentação correta em blocos aninhados

#### 2. Formatação de Consultas (FIND/FOR EACH)
- Detecta e formata blocos `FIND` com cláusulas `WHERE`
- Suporta `FOR EACH` com `WHERE` na mesma linha ou em linhas separadas
- Alinha condições `WHERE`/`AND`/`OR` automaticamente

#### 3. Formatação de Atribuições (ASSIGN)
- Alinha o operador `=` em blocos `ASSIGN` de múltiplas linhas
- Mantém consistência visual em atribuições complexas

#### 4. Formatação de Definições
- Formata `def var`, `def param`, `def temp-table`, `def buffer`, `def stream`
- Suporta modificadores (`new`, `global`, `shared`, `input`, `output`)
- Alinha nomes de variáveis e tipos

## 🚀 Instalação

### Via VS Code Marketplace

1. Abra o VS Code
2. Vá para a aba **Extensions** (Ctrl+Shift+X)
3. Procure por **"Progress 4GL Formatter"**
4. Clique em **Install**

### Via VSIX

1. Baixe o arquivo `.vsix` da [página de releases](https://github.com/coimbrox/progress-4gl-formatter/releases)
2. No VS Code, vá em **Extensions** → **...** → **Install from VSIX...**
3. Selecione o arquivo baixado

## 💻 Como Usar

### Formatação Manual

1. Abra um arquivo Progress (`.p`, `.w`, `.i`, `.cls`)
2. Use uma das seguintes opções:
   - **Atalho**: `Shift+Alt+F` (Windows/Linux) ou `Shift+Option+F` (Mac)
   - **Menu**: Clique com botão direito → **Format Document**
   - **Paleta de Comandos**: `Ctrl+Shift+P` → Digite "Format Document"

<!-- TODO: Adicionar screenshot do menu de formatação -->
<!-- ![Menu de Formatação](images/screenshot-format-menu.png) -->

### Formatação Automática ao Salvar

Adicione ao seu `settings.json` do VS Code:

```json
{
    "[progress]": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "GabrielCoimbra.progress-4gl-formatter"
    },
    "[abl]": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "GabrielCoimbra.progress-4gl-formatter"
    }
}
```

## 📖 Funcionalidades Detalhadas

### 1. Formatação de Blocos IF/FOR/REPEAT

**Antes:**
```progress
IF gra-par.cd-grau-parentesco = 01 OR gra-par.cd-grau-parentesco = 62 THEN DO:
```

**Depois:**
```progress
if   gra-par.cd-grau-parentesco = 01
or   gra-par.cd-grau-parentesco = 62
then do:
```

### 2. Formatação de FIND com WHERE

**Antes:**
```progress
FIND FIRST tmp-benef WHERE tmp-benef.cd-modalidade = usuario.cd-modalidade AND tmp-benef.nr-ter-adesao = usuario.nr-ter-adesao NO-LOCK NO-ERROR.
```

**Depois:**
```progress
find first tmp-benef 
     where tmp-benef.cd-modalidade = usuario.cd-modalidade
       and tmp-benef.nr-ter-adesao = usuario.nr-ter-adesao
           no-lock no-error.
```

### 3. Formatação de FOR EACH com WHERE

**Antes:**
```progress
FOR EACH tmp-benef WHERE tmp-benef.cd-modalidade = notaserv.cd-modalidade AND tmp-benef.nr-ter-adesao = notaserv.nr-ter-adesao NO-LOCK:
```

**Depois:**
```progress
for each tmp-benef where tmp-benef.cd-modalidade = notaserv.cd-modalidade
                     and tmp-benef.nr-ter-adesao = notaserv.nr-ter-adesao
                         no-lock:
```

### 4. Formatação de ASSIGN

**Antes:**
```progress
ASSIGN vl-desconto-aux = 0 vl-mensalidade-aux = 0 pc-percentual-aux = 0.
```

**Depois:**
```progress
assign vl-desconto-aux    = 0
       vl-mensalidade-aux = 0
       pc-percentual-aux  = 0.
```

### 5. Formatação de Definições

**Antes:**
```progress
DEFINE VARIABLE c-prog-gerado AS CHARACTER NO-UNDO INITIAL "dees045r".
DEFINE NEW GLOBAL SHARED VARIABLE c-arquivo-log AS CHAR FORMAT "x(60)" NO-UNDO.
```

**Depois:**
```progress
def var c-prog-gerado as character no-undo initial "dees045r".

def new global shared var c-arquivo-log as char format "x(60)" no-undo.
```

### 6. Formatação de Temp-Tables

**Antes:**
```progress
DEFINE TEMP-TABLE tmp-benef NO-UNDO
    FIELD cd-modalidade LIKE modalid.cd-modalidade
    FIELD nr-ter-adesao LIKE ter-ade.nr-ter-adesao.
```

**Depois:**
```progress
def temp-table tmp-benef no-undo
    field cd-modalidade like modalid.cd-modalidade
    field nr-ter-adesao  like ter-ade.nr-ter-adesao.
```

## 🎨 Exemplos Visuais

<!-- 
TODO: Adicionar screenshots para cada exemplo abaixo
- screenshot-if-block.png
- screenshot-find-query.png  
- screenshot-assign-block.png
-->

### Exemplo 1: Bloco IF Complexo

<!-- ![Bloco IF Formatado](images/screenshot-if-block.png) -->

**Antes da formatação:**
```progress
IF gra-par.cd-grau-parentesco = 01 OR gra-par.cd-grau-parentesco = 62 OR gra-par.cd-grau-parentesco = 63 THEN DO:
    ASSIGN ds-grau-parentesco-aux = "TITULAR".
END.
```

**Depois da formatação:**
```progress
if   gra-par.cd-grau-parentesco = 01
or   gra-par.cd-grau-parentesco = 62
or   gra-par.cd-grau-parentesco = 63
then do:
    assign ds-grau-parentesco-aux = "TITULAR".
end.
```

### Exemplo 2: Consulta com Múltiplas Condições

**Antes da formatação:**
```progress
FIND FIRST vlbenef WHERE vlbenef.cd-modalidade = notaserv.cd-modalidade AND vlbenef.cd-contratante = notaserv.cd-contratante AND vlbenef.nr-ter-adesao = notaserv.nr-ter-adesao NO-LOCK NO-ERROR.
```

**Depois da formatação:**
```progress
find first vlbenef 
     where vlbenef.cd-modalidade         = notaserv.cd-modalidade
       and vlbenef.cd-contratante        = notaserv.cd-contratante
       and vlbenef.nr-ter-adesao         = notaserv.nr-ter-adesao
           no-lock no-error.
```

### Exemplo 3: Bloco ASSIGN com Múltiplas Atribuições

**Antes da formatação:**
```progress
ASSIGN vl-desconto-aux = 0 vl-mensalidade-aux = 0 pc-percentual-aux = 0 vl-total-aux = 0 vl-calculo-aux = 0.
```

**Depois da formatação:**
```progress
assign vl-desconto-aux    = 0
       vl-mensalidade-aux = 0
       pc-percentual-aux  = 0
       vl-total-aux       = 0
       vl-calculo-aux     = 0.
```

> 💡 **Dica**: Para ver exemplos mais detalhados, consulte a seção [Exemplos](#-exemplos) acima.

## ⚙️ Configuração

### Configurações Recomendadas

<!-- TODO: Adicionar screenshot das configurações do VS Code -->
<!-- ![Configurações do VS Code](images/screenshot-settings.png) -->

```json
{
    "[progress]": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "GabrielCoimbra.progress-4gl-formatter",
        "editor.tabSize": 2,
        "editor.insertSpaces": true
    }
}
```

### Configurações Avançadas

Atualmente, o formatador segue padrões estabelecidos pela comunidade Progress. Se você tiver necessidades específicas de formatação, abra uma [Issue](https://github.com/coimbrox/progress-4gl-formatter/issues) descrevendo seu caso de uso.

## 🤝 Contribuindo

Contribuições são muito bem-vindas! Este projeto está em desenvolvimento ativo e toda ajuda é apreciada.

### Como Contribuir

1. **Reportar Bugs**: Encontrou um bug? [Abra uma Issue](https://github.com/coimbrox/progress-4gl-formatter/issues) descrevendo o problema
2. **Sugerir Melhorias**: Tem uma ideia? [Abra uma Issue](https://github.com/coimbrox/progress-4gl-formatter/issues) com sua sugestão
3. **Enviar Pull Requests**: Implementou uma melhoria? Envie um PR!

### Exemplos Úteis

Ao reportar problemas ou sugerir melhorias, inclua:
- Código **antes** da formatação
- Código **depois** da formatação (como você espera que fique)
- Contexto adicional se necessário

## 📝 Notas de Versão

Consulte o [CHANGELOG.md](CHANGELOG.md) para ver todas as mudanças e melhorias em cada versão.

### Versão Atual: 0.0.4

**Principais melhorias:**
- ✅ Suporte completo para `FOR EACH` com `WHERE`
- ✅ Melhorias na formatação de blocos `FIND`
- ✅ Formatação aprimorada de blocos `ASSIGN`
- ✅ Suporte para `def buffer` e `def stream`
- ✅ Formatação de blocos condicionais (`IF`/`FOR`/`REPEAT`)

## 📄 Licença

Este projeto está disponível como código aberto. Consulte o arquivo LICENSE para mais detalhes.

## 🔗 Links Úteis

- [Repositório no GitHub](https://github.com/coimbrox/progress-4gl-formatter)
- [Reportar um Bug](https://github.com/coimbrox/progress-4gl-formatter/issues)
- [Sugerir uma Funcionalidade](https://github.com/coimbrox/progress-4gl-formatter/issues)

## 👤 Autor

**Gabriel Coimbra**

- GitHub: [@coimbrox](https://github.com/coimbrox)

---

⭐ **Gostou do projeto?** Considere dar uma estrela no repositório!
