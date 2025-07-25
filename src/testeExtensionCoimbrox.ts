import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(['progress', 'abl','OpenEdge ABL','Progress 4GL'], {
      provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        const fullText = document.getText();
        const formattedText = formatDocument(fullText);
        
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(fullText.length)
        );

        return [vscode.TextEdit.replace(fullRange, formattedText)];
      }
    })
  );
}

function formatDocument(text: string): string {
  const lines = text.split('\n');   //divide o texto em um array de linhas individuais 
  let formattedLines: string[] = [];  // armazenar as linhas formatadas
  let indentLevel = 0;  // mantem o nível de indentação atual
  const indentSize = 2; // define o número de espaços para cada nível de indentação
  /******* lista de palavras que indicam o inicio e fim de blocos de código */
  const blockStartKeywords = [
    'DO:', 'FOR', 'REPEAT', 'FUNCTION', 'PROCEDURE', 'IF', 'FORM', 'THEN DO:'
  ];
  const blockEndKeywords = ['END.', 'END', 'ELSE'];
/******* fim da lista de palavras que indicam o inicio e fim de blocos de código */

/** Variáveis de estado - controlam o estado atual do analisador, permitindo que a lógica de formatação se ajuste a diferentes contextos */
  let inMultiLineStatement = false;
  let inAssignBlock = false;
  let assignAlignmentColumn = 0;
  let inDefineBlock = false;
  let inFindBlock = false; // Novo estado para blocos FIND/CAN-FIND
  let currentFindBlockLines: { originalLine: string, lineIndex: number, indent: string }[] = [];
  let processingFindBlock = false;
/* fim variáveis de estado */

/*loop para iterar sobre cada linha do texto */
  for (const line of lines) {
    let trimmed = line.trim();  // remove espaços em branco no início e no final da linha
    if (trimmed === '') {
      if (processingFindBlock && currentFindBlockLines.length > 0) {
        // Se estamos em um bloco FIND e encontramos uma linha vazia, processa o bloco
        formattedLines.push(...processFindBlockLines(currentFindBlockLines, indentSize));
        currentFindBlockLines = [];
        processingFindBlock = false;
    }
    formattedLines.push('');
      continue;
    }
    const upperTrimmed = trimmed.toUpperCase();
    let currentIndentLevel = indentLevel;

    // Lógica para blocos FIND/CAN-FIND
    if (inFindBlock) {
        if (upperTrimmed.startsWith('WHERE') || upperTrimmed.startsWith('AND') || upperTrimmed.startsWith('OR')) {
            currentIndentLevel++;
        } else {
            // Qualquer outra coisa encerra o bloco FIND
            inFindBlock = false;
        }
    }

    // Se estiver em um bloco define, indenta o VIEW-AS
    if (inDefineBlock) {
        if (upperTrimmed.startsWith('VIEW-AS')) {
            currentIndentLevel++;
        } else {
            // Outra linha qualquer encerra o bloco define
            inDefineBlock = false;
        }
    }

    // Lógica para diminuir a indentação se começar com palavras-chave de fim de bloco ou Se a linha terminar com : ou começar com uma blockStartKeywords aumenta a indentação
    if (blockEndKeywords.some(kw => upperTrimmed.startsWith(kw))) {
      indentLevel = Math.max(0, indentLevel - 1);
      currentIndentLevel = indentLevel;
      inMultiLineStatement = false;
      inFindBlock = false; // Encerra o bloco FIND também


    } else if (inMultiLineStatement && (upperTrimmed.startsWith('AND ') || upperTrimmed.startsWith('OR '))) {
      if (!inFindBlock) { // A indentação do AND/OR do FIND é tratada acima
          // Não indenta extra para OR/AND em um IF
      }
    } else if (upperTrimmed.startsWith('THEN DO:')) {
        inMultiLineStatement = false;
        inFindBlock = false; // THEN DO: encerra o bloco FIND
    }

    // Lógica para o bloco ASSIGN
    if (inAssignBlock) {
        // Se a linha não for uma continuação do assign, termina o bloco
        if (!/^\w/.test(trimmed) || upperTrimmed.includes('=')) {
             // Heurística: se a linha começa com algo que não é um campo ou tem seu próprio '=', pode não ser uma continuação
        }
        if (trimmed.endsWith('.')) {
            inAssignBlock = false;
        }
    }
    if (upperTrimmed.startsWith('ASSIGN ')) {
        inAssignBlock = true;
        const assignKeywordMatch = trimmed.match(/^assign\s+/i);
        if (assignKeywordMatch) {
            const firstFieldMatch = trimmed.substring(assignKeywordMatch[0].length).match(/^\S+/);
            if (firstFieldMatch) {
                assignAlignmentColumn = assignKeywordMatch[0].length;
            }
        }
    }

    let formattedLine = formatLineContent(trimmed, inAssignBlock, ' '.repeat(currentIndentLevel * indentSize), assignAlignmentColumn, inFindBlock);
    formattedLines.push(' '.repeat(currentIndentLevel * indentSize) + formattedLine);

    // Lógica para aumentar a indentação para a próxima linha
    if (trimmed.endsWith(':') || blockStartKeywords.some(kw => upperTrimmed.startsWith(kw))) {
      if (!blockEndKeywords.some(kw => upperTrimmed.startsWith(kw))) {
        indentLevel++;
      }
    }

    // Verifica o início de um bloco DEFINE que continua na próxima linha
    if (upperTrimmed.startsWith('DEFINE VARIABLE') || upperTrimmed.startsWith('DEF VAR')) {
        inDefineBlock = !trimmed.endsWith('.');
    } else if (inDefineBlock && trimmed.endsWith('.')) {
        // Encerra o bloco se a linha terminar com ponto
        inDefineBlock = false;
    }

    // Ativa o modo multi-linha para IF e FIND
    if (upperTrimmed.startsWith('IF ') || upperTrimmed.startsWith('FIND ') || upperTrimmed.startsWith('FOR ') || upperTrimmed.includes('CAN-FIND')) {
        inMultiLineStatement = true;
        if (upperTrimmed.includes('CAN-FIND') || upperTrimmed.startsWith('FIND')) {
            inFindBlock = true;
        }
    }
  }

  return formattedLines.join('\n');
}

/*nova ffuncão para formatar o conteúdo de cada linha */
function processFindBlockLines(lines: { originalLine: string, lineIndex: number, indent: string }[], indentSize: number): string[] {
  const formatted: string[] = [];
  let maxLeftPartLength = 0;
  // Adicionado mais operadores e garantido que sejam verificados em ordem de comprimento decrescente
  const operators = ['>=', '<=', '<>', '=', 'EQ', 'NE', 'GT', 'GE', 'LT', 'LE', 'MATCHES', 'LIKE'];

  // Primeira passagem: Encontrar o comprimento máximo da parte esquerda
  const parsedLines = lines.map(item => {
      let lineTrimmed = item.originalLine;
      let leftPart = lineTrimmed;
      let operator = '';
      let rightPart = '';
      let operatorFound = false;

      // Tenta encontrar o operador
      for (const op of operators.sort((a, b) => b.length - a.length)) {
          const upperLine = lineTrimmed.toUpperCase();
          const index = upperLine.indexOf(op);
          if (index !== -1) {
              // Para operadores textuais (EQ, NE, etc.), garantir que sejam palavras inteiras
              const isWordBoundary = (idx: number, len: number, text: string) => {
                  const charBefore = idx > 0 ? text[idx - 1] : '';
                  const charAfter = idx + len < text.length ? text[idx + len] : '';
                  const isAlphaNumericBefore = /[a-zA-Z0-9_]/.test(charBefore);
                  const isAlphaNumericAfter = /[a-zA-Z0-9_]/.test(charAfter);
                  return (!isAlphaNumericBefore || charBefore === ' ') && (!isAlphaNumericAfter || charAfter === ' ');
              };

              if (op.length > 1 && isWordBoundary(index, op.length, upperLine)) {
                  leftPart = lineTrimmed.substring(0, index).trim();
                  operator = lineTrimmed.substring(index, index + op.length);
                  rightPart = lineTrimmed.substring(index + op.length).trim();
                  operatorFound = true;
                  break;
              } else if (op.length === 1 && !isWordBoundary(index, op.length, upperLine)) {
                  // Para operadores de um caractere, apenas verificar se não é parte de uma palavra
                  // Por exemplo, "FIELD=" vs "SOME_FIELD"
                  leftPart = lineTrimmed.substring(0, index).trim();
                  operator = lineTrimmed.substring(index, index + op.length);
                  rightPart = lineTrimmed.substring(index + op.length).trim();
                  operatorFound = true;
                  break;
              }
          }
      }
      // Se nenhum operador explícito for encontrado, a linha pode ser apenas uma palavra-chave como 'WHERE'
      // ou uma condição sem operador explícito visível (ex: WHERE foo).
      // Para simplificar, consideramos a linha inteira como a parte esquerda neste caso para calcular maxLeftPartLength.
      // O alinhamento será para a cláusula inteira se não tiver operador.

      // Ajusta maxLeftPartLength para incluir a palavra-chave (WHERE, AND, OR)
      const prefixMatch = lineTrimmed.match(/^(where|and|or)\s+/i);
      let contentAfterPrefix = lineTrimmed;
      let currentPrefixLength = 0;
      if (prefixMatch) {
          contentAfterPrefix = lineTrimmed.substring(prefixMatch[0].length).trim();
          currentPrefixLength = prefixMatch[0].length;
      }

      // Calculamos o comprimento da parte esquerda APÓS o WHERE/AND/OR
      const actualLeftPartForLength = operatorFound ? leftPart.substring(currentPrefixLength).trim() : contentAfterPrefix;
      maxLeftPartLength = Math.max(maxLeftPartLength, actualLeftPartForLength.length);

      return { ...item, leftPart, operator, rightPart, operatorFound, originalPrefix: prefixMatch ? prefixMatch[0] : '' };
  });

  // Segunda passagem: Formatar as linhas com alinhamento
  for (const item of parsedLines) {
      let currentLineFormatted: string;
      const currentIndent = item.indent;

      // Formata a palavra-chave (where, and, or)
      const formattedPrefix = item.originalPrefix ? item.originalPrefix.toLowerCase() : '';
      
      let contentToAlign;
      if (item.operatorFound) {
          // A parte que será alinhada (após o prefixo)
          const actualLeftContent = item.leftPart.substring(item.originalPrefix.length).trim();
          const paddedLeft = actualLeftContent.padEnd(maxLeftPartLength);
          contentToAlign = `${paddedLeft} ${item.operator} ${item.rightPart}`;
      } else {
          // Linhas sem operador (ex: apenas WHERE, AND, OR)
          contentToAlign = item.originalLine.substring(item.originalPrefix.length).trim();
      }

      currentLineFormatted = `${currentIndent}${formattedPrefix}${contentToAlign}`;
      formatted.push(currentLineFormatted);
  }

  return formatted;
}
/*fim da função processFindBlockLines */


function formatLineContent(trimmedLine: string, inAssignBlock: boolean, indentString: string, assignAlignmentColumn: number, inFindBlock: boolean): string {
  // Mapa para formas abreviadas e minúsculas
  const keywordMap: { [key: string]: string } = {
    // Palavras-chave com formas reduzidas comuns
    'DEFINE': 'def',
    'VARIABLE': 'var',
    'PARAMETER': 'param',
    'PROCEDURE': 'proc',
    'FUNCTION': 'func',
    'TEMP-TABLE': 'temp-table',
    'VIEW-AS': 'view-as',
    'NO-UNDO': 'no-undo',
    'NO-LOCK': 'no-lock',
    'NO-ERROR': 'no-error',
    'EXCLUSIVE-LOCK': 'exclusive-lock',
    'AVAILABLE': 'avail',
    'CAN-FIND': 'can-find', // Manter como 'can-find' para clareza, pois a abreviação não é tão comum ou oficial
    'DEFINE VARIABLE': 'def var', // Combinações comuns
    'DEFINE PARAMETER': 'def param',
    'DEFINE TEMP-TABLE': 'def temp-table',

    // Palavras-chave que ficam em minúsculas na sua forma completa ou não possuem abreviação comum
    'ADD': 'add',
    'ACCUMULATE': 'accumulate',
    'ADD-LAST': 'add-last',
    'AND': 'and',
    'AS': 'as',
    'ASSIGN': 'assign',
    'BEGIN-PROFILER': 'begin-profiler',
    'BUFFER': 'buffer',
    'BY': 'by',
    'BY-REFERENCE': 'by-reference',
    'CALL': 'call',
    'CASE': 'case',
    'CATCH': 'catch',
    'CLASS': 'class',
    'COLON': 'colon',
    'COMBO-BOX': 'combo-box',
    'COMMIT': 'commit',
    'COPY-DATASET': 'copy-dataset',
    'COPY-FILE': 'copy-file',
    'CREATE': 'create',
    'DATA-SOURCE': 'data-source',
    'DATA-SERVER': 'data-server',
    'DATABASE': 'database',
    'DATASET': 'dataset',
    'DATETIME': 'datetime',
    'DECODE': 'decode',
    'DELETE': 'delete',
    'DIALOG-BOX': 'dialog-box',
    'DISABLE': 'disable',
    'DISPLAY': 'display',
    'DISK-SPACE': 'disk-space',
    'DO': 'do',
    'DYNAMIC': 'dynamic',
    'EACH': 'each',
    'ELSE': 'else',
    'ENABLE': 'enable',
    'END': 'end',
    'ENTRY': 'entry',
    'EXISTS': 'exists',
    'EXPORT': 'export',
    'EXTENT': 'extent',
    'FILE-INFO': 'file-info',
    'FILTER': 'filter',
    'FINALLY': 'finally',
    'FIND': 'find',
    'FIRST': 'first',
    'FIRST-OF': 'first-of',
    'FOR': 'for',
    'FORM': 'form',
    'FRAME': 'frame',
    'GET-BYTE': 'get-byte',
    'GET-KEY-VALUE': 'get-key-value',
    'GO': 'go',
    'HANDLE': 'handle',
    'HIDDEN': 'hidden',
    'IF': 'if',
    'IMAGE': 'image',
    'INDEX': 'index',
    'INITIAL': 'initial',
    'INNER-JOIN': 'inner-join',
    'INPUT': 'input',
    'INSERT': 'insert',
    'IS': 'is',
    'JOIN': 'join',
    'LAST': 'last',
    'LAST-OF': 'last-of',
    'LEAVE': 'leave',
    'LIKE': 'like',
    'LOG-MANAGER': 'log-manager',
    'LOOKUP': 'lookup',
    'MENU': 'menu',
    'MESSAGE': 'message',
    'METHOD': 'method',
    'MOVE': 'move',
    'NEW': 'new',
    'NEXT': 'next',
    'NOT': 'not',
    'NUM-ENTRIES': 'num-entries',
    'OBJECT': 'object',
    'OF': 'of',
    'ON': 'on',
    'OPEN': 'open',
    'OR': 'or',
    'OUTER-JOIN': 'outer-join',
    'OUTPUT': 'output',
    'OVERLAY': 'overlay',
    'PAUSE': 'pause',
    'PERCENT': 'percent',
    'PREPROCESS': 'preprocess',
    'PRINTER': 'printer',
    'PRIVATE': 'private',
    'PROC-TEXT': 'proc-text',
    'PROGRESS': 'progress',
    'PROMPT-FOR': 'prompt-for',
    'PROTECTED': 'protected',
    'PUBLIC': 'public',
    'QUERY': 'query',
    'RADIO-BUTTON': 'radio-button',
    'RECID': 'recid',
    'REPEAT': 'repeat',
    'REPOSITION': 'reposition',
    'RETURN': 'return',
    'ROW-FETCH': 'row-fetch',
    'RUN': 'run',
    'SCHEMA': 'schema',
    'SCREEN': 'screen',
    'SEARCH': 'search',
    'SEEK': 'seek',
    'SELF': 'self',
    'SESSION': 'session',
    'SET': 'set',
    'SHARE': 'share',
    'SKIP': 'skip',
    'SMALLINT': 'smallint',
    'SORT': 'sort',
    'STATIC': 'static',
    'STREAM': 'stream',
    'SUBSTITUTE': 'substitute',
    'SUPER': 'super',
    'SYSTEM-DIALOGS': 'system-dialogs',
    'TABLE': 'table',
    'TEXT': 'text',
    'THEN': 'then',
    'THIS-OBJECT': 'this-object',
    'THROWS': 'throws',
    'TO': 'to',
    'TOP-ONLY': 'top-only',
    'TRAIL': 'trail',
    'TRANSACTION': 'transaction',
    'TRIGGER': 'trigger',
    'TRUNCATE': 'truncate',
    'UNDO': 'undo',
    'UNKNOWN': 'unknown',
    'UNLOAD': 'unload',
    'UPDATE': 'update',
    'USE': 'use',
    'USING': 'using',
    'VALIDATE': 'validate',
    'VIEW': 'view',
    'VOID': 'void',
    'WAIT-FOR': 'wait-for',
    'WHEN': 'when',
    'WHERE': 'where',
    'WHILE': 'while',
    'WIDGET': 'widget',
    'WINDOW': 'window',
    'WITH': 'with',
    'XML-NODE': 'xml-node',
    'XREF': 'xref',
    'YES': 'yes',
    'ZERO': 'zero',
    // Adicione mais aqui conforme necessário
};

  const keywords =  Object.keys(keywordMap).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
  let formatted = trimmedLine.replace(regex, (keyword) => keywordMap[keyword.toUpperCase()] || keyword.toLowerCase());

  // Adiciona espaços ao redor de '='
  if (/assign/i.test(formatted) || (formatted.includes('=') && !/if|for|while|case/i.test(formatted))) {
     formatted = formatted.replace(/\s*=\s*/g, ' = ');
  }

  // Alinha blocos WHERE/AND em um FIND
  if (inFindBlock && (formatted.startsWith('where') || formatted.startsWith('and') || formatted.startsWith('or'))) {
      const parts = formatted.split('=');
      if (parts.length === 2) {
          const conditionPart = parts[0].trim();
          const valuePart = parts[1].trim();
          // Alinha a condição para ter 40 caracteres, depois o '=' e o valor
          return `${conditionPart.padEnd(40)} = ${valuePart}`;
      }
  }

  // Alinha blocos ASSIGN e verificar se uma string começa com um caractere
  if (inAssignBlock && /^\w/.test(formatted) && formatted.includes('=')) {
      const parts = formatted.split('=');
      const variablePart = parts[0].trim();
      const valuePart = parts[1].trim();
      if (!/assign/i.test(variablePart)) { // Se não for a primeira linha do assign
          const padding = indentString.length + assignAlignmentColumn;
          return ' '.repeat(assignAlignmentColumn) + `${variablePart.padEnd(25)} = ${valuePart}`;
      } else { // Primeira linha do assign
          const assignParts = variablePart.split(/\s+/);
          const firstVar = assignParts.slice(1).join(' ');
          return `assign ${firstVar.padEnd(assignAlignmentColumn + 25 - 'assign '.length)} = ${valuePart}`;
      }
  }


  // Alinha definições de variáveis (lógica aprimorada)
  if (/^def(ine)?\s+var(iable)?/i.test(formatted)) {
    const parts = formatted.split(/\s+/);
    // Encontra o índice do nome da variável
    const varNameIndex = formatted.toLowerCase().startsWith('define variable') ? 2 : 2;
    
    if (parts.length > varNameIndex + 1) {
        const keyword = parts[varNameIndex + 1].toLowerCase();
        if (keyword === 'like' || keyword === 'as') {
            const definePart = parts.slice(0, varNameIndex).join(' ');
            const varName = parts[varNameIndex];
            const restOfLine = parts.slice(varNameIndex + 1).join(' ');
            // Preenche o nome da variável para alinhar o resto da linha
            return `${definePart} ${varName.padEnd(30)} ${restOfLine}`;
        }
    }
  }

  return formatted;
}

export function deactivate() {}