# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [0.0.5] - 2026-08-25

### ♻️ Reescrito

- **Motor de formatação totalmente reescrito**: em vez de heurísticas por linha/regex, o formatador agora usa um lexer (tokenizer) real, que separa o código em tokens (strings, comentários, diretivas de preprocessador, palavras, operadores) antes de reformatar. Isso elimina bugs em que o formatador antigo alterava conteúdo dentro de strings/comentários e quebrava com variações de sintaxe não previstas.
- **Estilo alvo baseado em código real**: as regras de alinhamento (`find`/`for each` com `where`/`and`, `assign`, `def var`/`def temp-table`, `if`/`and`/`or`) foram calibradas a partir de código de produção já escrito nesse padrão, usado como suíte de testes automatizados do formatador.
- Removido o arquivo `testeExtensionCoimbrox.ts`, uma versão antiga/duplicada do formatador que não estava mais em uso.

## [0.0.4] - 2024-12-XX

### ✨ Adicionado

#### Formatação de Blocos FOR EACH
- **Suporte completo para `FOR EACH` com `WHERE`**: Agora o formatador detecta e formata corretamente blocos `FOR EACH` que possuem cláusulas `WHERE`
- **Detecção inteligente**: Suporta `WHERE` na mesma linha ou em linhas separadas
- **Alinhamento automático**: Alinha condições `WHERE`/`AND`/`OR` de forma consistente
- **Exemplo**:
  ```progress
  // Antes
  FOR EACH tmp-benef WHERE tmp-benef.cd-modalidade = notaserv.cd-modalidade AND tmp-benef.nr-ter-adesao = notaserv.nr-ter-adesao NO-LOCK:
  
  // Depois
  for each tmp-benef where tmp-benef.cd-modalidade = notaserv.cd-modalidade
                       and tmp-benef.nr-ter-adesao = notaserv.nr-ter-adesao
                           no-lock:
  ```

#### Melhorias em Blocos FIND
- **Separação inteligente**: Detecta quando `WHERE` está na mesma linha do `FIND` e separa automaticamente
- **Formatação aprimorada**: Melhor alinhamento de condições em blocos `FIND` complexos
- **Exemplo**:
  ```progress
  // Antes
  FIND FIRST tmp-benef WHERE tmp-benef.cd-modalidade = usuario.cd-modalidade AND tmp-benef.nr-ter-adesao = usuario.nr-ter-adesao NO-LOCK NO-ERROR.
  
  // Depois
  find first tmp-benef 
       where tmp-benef.cd-modalidade = usuario.cd-modalidade
         and tmp-benef.nr-ter-adesao = usuario.nr-ter-adesao
             no-lock no-error.
  ```

#### Formatação de Blocos ASSIGN
- **Alinhamento aprimorado**: Melhor cálculo de alinhamento do operador `=` em blocos `ASSIGN` de múltiplas linhas
- **Suporte para primeira linha**: Trata corretamente a primeira linha do `ASSIGN` que contém a palavra-chave
- **Exemplo**:
  ```progress
  // Antes
  ASSIGN vl-desconto-aux = 0 vl-mensalidade-aux = 0 pc-percentual-aux = 0.
  
  // Depois
  assign vl-desconto-aux    = 0
         vl-mensalidade-aux = 0
         pc-percentual-aux  = 0.
  ```

#### Suporte para Novos Tipos de Definições
- **`def buffer`**: Suporte completo para definições de buffer
- **`def stream`**: Suporte completo para definições de stream
- **Modificadores**: Suporte aprimorado para modificadores como `new`, `global`, `shared`, `input`, `output`
- **Exemplo**:
  ```progress
  // Antes
  DEFINE BUFFER b-previesp FOR previesp.
  DEFINE STREAM s-benefs.
  DEFINE NEW GLOBAL SHARED VARIABLE c-arquivo-log AS CHAR NO-UNDO.
  
  // Depois
  def buffer b-previesp for previesp.
  def stream s-benefs.
  def new global shared var c-arquivo-log as char no-undo.
  ```

#### Formatação de Blocos Condicionais
- **Alinhamento melhorado**: Melhor formatação de blocos `IF`/`FOR`/`REPEAT` com múltiplas condições
- **Padding consistente**: Uso de 3 espaços após palavras-chave para alinhamento consistente
- **Exemplo**:
  ```progress
  // Antes
  IF gra-par.cd-grau-parentesco = 01 OR gra-par.cd-grau-parentesco = 62 THEN DO:
  
  // Depois
  if   gra-par.cd-grau-parentesco = 01
  or   gra-par.cd-grau-parentesco = 62
  then do:
  ```

### 🔧 Melhorado

- **Detecção de blocos**: Melhor detecção e processamento de blocos de código Progress
- **Performance**: Otimizações no processamento de arquivos grandes
- **Consistência**: Padronização de formatação seguindo exemplos de código "clean code" da comunidade Progress

### 🐛 Corrigido

- Correção na formatação de blocos `FIND` quando `WHERE` está na mesma linha
- Correção no alinhamento de condições em blocos `FOR EACH`
- Correção na formatação de primeira linha de blocos `ASSIGN`

## [0.0.3] - 2024-XX-XX

### ✨ Adicionado

- Formatação básica de blocos `IF` com múltiplas condições
- Alinhamento de condições `WHERE`/`AND`/`OR` em blocos `FIND`
- Formatação de definições de variáveis (`def var`)

### 🔧 Melhorado

- Indentação de blocos de código
- Formatação de palavras-chave

## [0.0.2] - 2024-XX-XX

### ✨ Adicionado

- Suporte inicial para formatação de código Progress
- Conversão de palavras-chave para minúsculas
- Indentação básica de blocos

## [0.0.1] - 2024-XX-XX

### ✨ Adicionado

- Versão inicial do formatador
- Suporte básico para arquivos `.p`, `.w`, `.i`, `.cls`

---

## Tipos de Mudanças

- **✨ Adicionado**: Para novas funcionalidades
- **🔧 Melhorado**: Para mudanças em funcionalidades existentes
- **🐛 Corrigido**: Para correções de bugs
- **🗑️ Removido**: Para funcionalidades removidas
- **🔒 Segurança**: Para vulnerabilidades corrigidas

---

**Nota**: As datas são aproximadas e serão atualizadas quando a versão for publicada.

