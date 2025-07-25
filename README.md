# Progress 4GL/ABL Formatter for VS Code

Este é um formatador de código simples para a linguagem Progress 4GL (ABL) para o Visual Studio Code. O objetivo é aplicar um estilo de código consistente e legível automaticamente.

## Funcionalidades

*   **Padronização de Caixa:** Converte palavras-chave do Progress (como `DEFINE`, `FOR`, `IF`, `DISPLAY`) para letras minúsculas.
*   **Indentação Automática:** Indenta corretamente blocos de código como:
    *   `DO: ... END.`
    *   `FOR ...:`
    *   `IF ... THEN ... ELSE ...`
    *   `PROCEDURE ...:`
    *   `FUNCTION ...:`
*   **Alinhamento de Declarações:**
    *   Alinha as cláusulas `AS` e `LIKE` em declarações `DEFINE VARIABLE`.
    *   Indenta a cláusula `VIEW-AS` quando está em uma linha separada.
    *   Alinha atribuições em blocos `ASSIGN` de múltiplas linhas.
*   **Indentação de Cláusulas:** Indenta cláusulas contínuas como `AND` e `OR` em declarações `FIND`.

## Como Usar

1.  Instale a extensão.
2.  Abra um arquivo `.p` ou `.w` (ou qualquer arquivo identificado como `progress` ou `abl`).
3.  Abra a paleta de comandos (`Ctrl+Shift+P` ou `Cmd+Shift+P`) e execute **"Formatar Documento"**.

### Formatar ao Salvar

Para formatar automaticamente seus arquivos sempre que salvar, adicione a seguinte configuração ao seu arquivo `settings.json` do VS Code:

```json
{
    "[progress]": {
        "editor.formatOnSave": true
    },
    "[abl]": {
        "editor.formatOnSave": true
    }
}
```

## Contribuições e Melhorias

Este projeto está em desenvolvimento e toda ajuda é bem-vinda!

Se você tiver sugestões para novas regras de formatação, encontrar um bug ou quiser contribuir com o código, sinta-se à vontade para **abrir uma Issue** no repositório do GitHub.

Exemplos de código "antes" e "depois" são extremamente úteis para entendermos a melhoria desejada.