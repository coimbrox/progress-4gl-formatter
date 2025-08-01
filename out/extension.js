"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
function activate(context) {
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(['progress', 'abl', 'OpenEdge ABL', 'Progress 4GL'], {
        provideDocumentFormattingEdits(document) {
            const fullText = document.getText();
            const formattedText = formatDocument(fullText);
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(fullText.length));
            return [vscode.TextEdit.replace(fullRange, formattedText)];
        }
    }));
}
function formatDocument(text) {
    const lines = text.split('\n');
    let formattedLines = [];
    let indentLevel = 0;
    const indentSize = 2; // Define o número de espaços para cada nível de indentação
    // Lista de palavras-chave que indicam o início de blocos de código
    const blockStartKeywords = [
        'DO:', 'FOR', 'REPEAT', 'FUNCTION', 'PROCEDURE', 'IF', 'FORM', 'THEN DO:',
        'CLASS', 'METHOD', 'CONSTRUCTOR', 'DESTRUCTOR' // Adicionadas para OO ABL
    ];
    // Lista de palavras-chave que indicam o fim de blocos de código
    const blockEndKeywords = ['END.', 'END', 'ELSE'];
    // Variáveis de estado - controlam o estado atual do analisador
    let inAssignBlock = false; // Indica se estamos dentro de um bloco ASSIGN
    let assignAlignmentColumn = 0; // Coluna para alinhar o '=' em blocos ASSIGN
    let inDefineBlock = false; // Indica se estamos dentro de um bloco DEFINE multi-linha
    // Estado para coletar linhas de blocos FIND/CAN-FIND
    let currentFindBlockLines = [];
    let processingFindBlock = false;
    // NOVO: Estado para coletar linhas de blocos condicionais (IF, FOR, REPEAT)
    let currentConditionalBlockLines = [];
    let processingConditionalBlock = false;
    let conditionalBlockInitialIndent = 0; // Indentação da palavra-chave inicial (IF, FOR, REPEAT)
    // Loop para iterar sobre cada linha do texto
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let trimmed = line.trim(); // Remove espaços em branco no início e no final da linha
        // Se a linha estiver vazia
        if (trimmed === '') {
            // Processa blocos FIND/CAN-FIND pendentes antes de adicionar linha vazia
            if (processingFindBlock && currentFindBlockLines.length > 0) {
                formattedLines.push(...processFindBlockLines(currentFindBlockLines, indentSize));
                currentFindBlockLines = [];
                // Diminui a indentação após o bloco FIND ser processado
                indentLevel = Math.max(0, indentLevel - 1);
                processingFindBlock = false;
            }
            // Processa blocos condicionais pendentes antes de adicionar linha vazia
            if (processingConditionalBlock && currentConditionalBlockLines.length > 0) {
                formattedLines.push(...processConditionalBlockLines(currentConditionalBlockLines, indentSize, conditionalBlockInitialIndent));
                currentConditionalBlockLines = [];
                // Nível de indentação já foi ajustado ao adicionar o "THEN DO:" ou "DO:"
                // ou a linha que encerra o bloco, então não precisamos mexer aqui.
                processingConditionalBlock = false;
            }
            formattedLines.push('');
            continue;
        }
        const upperTrimmed = trimmed.toUpperCase();
        let currentIndentString = ' '.repeat(indentLevel * indentSize);
        // Lógica para blocos FIND/CAN-FIND (prioridade alta para não conflitar com condições gerais)
        if ((upperTrimmed.startsWith('FIND ') || upperTrimmed.includes('CAN-FIND')) && !processingFindBlock) {
            processingFindBlock = true;
            // Se estava processando um bloco condicional, finaliza-o
            if (processingConditionalBlock && currentConditionalBlockLines.length > 0) {
                formattedLines.push(...processConditionalBlockLines(currentConditionalBlockLines, indentSize, conditionalBlockInitialIndent));
                currentConditionalBlockLines = [];
                processingConditionalBlock = false;
            }
            // Adiciona a linha FIND/CAN-FIND imediatamente
            let formattedFindLine = formatLineContent(trimmed, false, currentIndentString, 0);
            formattedLines.push(currentIndentString + formattedFindLine);
            indentLevel++; // Indenta para as cláusulas WHERE/AND/OR
            continue;
        }
        // Coleta linhas WHERE/AND/OR dentro de um FIND
        if (processingFindBlock && (upperTrimmed.startsWith('WHERE') || upperTrimmed.startsWith('AND') || upperTrimmed.startsWith('OR'))) {
            currentFindBlockLines.push({ originalLine: trimmed, lineIndex: i, indent: ' '.repeat(indentLevel * indentSize) });
            continue;
        }
        // Finaliza o bloco FIND se a linha não for uma condição esperada
        else if (processingFindBlock && !(upperTrimmed.startsWith('WHERE') || upperTrimmed.startsWith('AND') || upperTrimmed.startsWith('OR'))) {
            if (currentFindBlockLines.length > 0) {
                formattedLines.push(...processFindBlockLines(currentFindBlockLines, indentSize));
                currentFindBlockLines = [];
            }
            indentLevel = Math.max(0, indentLevel - 1); // Volta o nível de indentação
            processingFindBlock = false;
            // Continua para o processamento normal da linha atual
        }
        // Lógica para Blocos Condicionais (IF, FOR, REPEAT)
        const isConditionalStart = upperTrimmed.startsWith('IF ') || upperTrimmed.startsWith('FOR ') || upperTrimmed.startsWith('REPEAT ');
        const isConditionalContinuation = (upperTrimmed.startsWith('AND ') || upperTrimmed.startsWith('OR ')) && processingConditionalBlock;
        // Se é o início de um bloco condicional e não estamos processando outro
        if (isConditionalStart && !processingConditionalBlock) {
            processingConditionalBlock = true;
            conditionalBlockInitialIndent = indentLevel; // Salva a indentação inicial do IF/FOR/REPEAT
            // Se estava processando um FIND, finaliza-o (improvável, FIND tem prioridade)
            if (processingFindBlock && currentFindBlockLines.length > 0) {
                formattedLines.push(...processFindBlockLines(currentFindBlockLines, indentSize));
                currentFindBlockLines = [];
                indentLevel = Math.max(0, indentLevel - 1);
                processingFindBlock = false;
            }
            // Adiciona a linha atual ao array de linhas condicionais
            currentConditionalBlockLines.push({
                originalLine: trimmed,
                lineIndex: i,
                indent: currentIndentString,
                parentKeywordIndent: conditionalBlockInitialIndent
            });
            // Não aumenta indentLevel aqui; a indentação para o conteúdo do bloco (THEN DO:) virá depois
            continue;
        }
        // Se é uma continuação de um bloco condicional
        else if (isConditionalContinuation) {
            // Adiciona a linha atual ao array de linhas condicionais
            currentConditionalBlockLines.push({
                originalLine: trimmed,
                lineIndex: i,
                indent: currentIndentString, // Esta indentação não será usada diretamente no output final da função de formatação do bloco
                parentKeywordIndent: conditionalBlockInitialIndent
            });
            continue;
        }
        // Se estamos em um bloco condicional, mas a linha atual não é uma continuação (AND/OR)
        else if (processingConditionalBlock && !isConditionalContinuation) {
            // Processa as linhas condicionais coletadas
            if (currentConditionalBlockLines.length > 0) {
                formattedLines.push(...processConditionalBlockLines(currentConditionalBlockLines, indentSize, conditionalBlockInitialIndent));
                currentConditionalBlockLines = [];
            }
            processingConditionalBlock = false;
            // Continua para o processamento normal da linha atual
        }
        // Lógica para blocos DEFINE multi-linha
        if (inDefineBlock) {
            if (upperTrimmed.startsWith('VIEW-AS')) {
                currentIndentString = ' '.repeat((indentLevel + 1) * indentSize); // Indenta VIEW-AS extra
            }
            else {
                inDefineBlock = false;
            }
        }
        // Lógica para diminuir a indentação para palavras-chave de fim de bloco
        if (blockEndKeywords.some(kw => upperTrimmed.startsWith(kw))) {
            indentLevel = Math.max(0, indentLevel - 1);
            currentIndentString = ' '.repeat(indentLevel * indentSize); // Aplica a nova indentação
            // Se um END encerra um bloco condicional ou FIND, garante que os estados sejam resetados
            processingConditionalBlock = false;
            processingFindBlock = false;
            currentConditionalBlockLines = [];
            currentFindBlockLines = [];
        }
        // Casos especiais que terminam blocos ou não requerem indentação extra
        else if (upperTrimmed.startsWith('THEN DO:')) {
            // Se estava processando um bloco condicional, finaliza-o agora que o THEN DO: apareceu
            if (processingConditionalBlock && currentConditionalBlockLines.length > 0) {
                formattedLines.push(...processConditionalBlockLines(currentConditionalBlockLines, indentSize, conditionalBlockInitialIndent));
                currentConditionalBlockLines = [];
            }
            processingConditionalBlock = false; // O THEN DO: marca o fim das condições e início do bloco de execução
        }
        // Lógica para o bloco ASSIGN
        if (upperTrimmed.startsWith('ASSIGN ')) {
            inAssignBlock = true;
            const assignKeywordMatch = trimmed.match(/^assign\s+/i);
            if (assignKeywordMatch) {
                const afterAssign = trimmed.substring(assignKeywordMatch[0].length);
                const firstFieldMatch = afterAssign.match(/^\S+/);
                if (firstFieldMatch) {
                    assignAlignmentColumn = assignKeywordMatch[0].length + firstFieldMatch[0].length + 2;
                }
            }
        }
        else if (inAssignBlock) {
            if (!/^\w/.test(trimmed) || !trimmed.includes('=')) {
                inAssignBlock = false;
            }
            if (trimmed.endsWith('.')) {
                inAssignBlock = false;
            }
        }
        // Formata a linha atual (se não foi já tratada por um bloco especial)
        // Somente se a linha não faz parte de um bloco que já foi coletado e processado.
        if (!isConditionalStart && !isConditionalContinuation && !processingFindBlock) {
            let formattedLine = formatLineContent(trimmed, inAssignBlock, currentIndentString, assignAlignmentColumn);
            formattedLines.push(currentIndentString + formattedLine);
        }
        // Lógica para aumentar a indentação para a próxima linha
        if (trimmed.endsWith(':') || blockStartKeywords.some(kw => upperTrimmed.startsWith(kw))) {
            if (!blockEndKeywords.some(kw => upperTrimmed.startsWith(kw))) {
                indentLevel++;
            }
        }
        // Verifica o início de um bloco DEFINE que pode continuar na próxima linha
        if (upperTrimmed.startsWith('DEFINE VARIABLE') || upperTrimmed.startsWith('DEF VAR') ||
            upperTrimmed.startsWith('DEFINE TEMP-TABLE') || upperTrimmed.startsWith('DEF TEMP-TABLE') ||
            upperTrimmed.startsWith('DEFINE PARAMETER') || upperTrimmed.startsWith('DEF PARAM')) {
            inDefineBlock = !trimmed.endsWith('.');
        }
        else if (inDefineBlock && trimmed.endsWith('.')) {
            inDefineBlock = false;
        }
    }
    // Processa quaisquer blocos FIND/CAN-FIND ou condicionais restantes no final do arquivo
    if (processingFindBlock && currentFindBlockLines.length > 0) {
        formattedLines.push(...processFindBlockLines(currentFindBlockLines, indentSize));
    }
    if (processingConditionalBlock && currentConditionalBlockLines.length > 0) {
        formattedLines.push(...processConditionalBlockLines(currentConditionalBlockLines, indentSize, conditionalBlockInitialIndent));
    }
    return formattedLines.join('\n');
}
/**
 * Processa um grupo de linhas que fazem parte de um bloco FIND/CAN-FIND para alinhamento.
 * @param lines O array de linhas a serem processadas.
 * @param indentSize O tamanho da indentação.
 * @returns Um array de strings formatadas.
 */
function processFindBlockLines(lines, indentSize) {
    const formatted = [];
    let maxLeftPartLength = 0;
    const operators = ['>=', '<=', '<>', '=', 'EQ', 'NE', 'GT', 'GE', 'LT', 'LE', 'MATCHES', 'LIKE'];
    const parsedLines = lines.map(item => {
        let lineTrimmed = item.originalLine;
        let leftPart = lineTrimmed;
        let operator = '';
        let rightPart = '';
        let operatorFound = false;
        for (const op of operators.sort((a, b) => b.length - a.length)) {
            const upperLine = lineTrimmed.toUpperCase();
            const index = upperLine.indexOf(op);
            if (index !== -1) {
                const isWordBoundary = (idx, len, text) => {
                    const charBefore = idx > 0 ? text[idx - 1] : '';
                    const charAfter = idx + len < text.length ? text[idx + len] : '';
                    const isAlphaNumericBefore = /[a-zA-Z0-9_]/.test(charBefore);
                    const isAlphaNumericAfter = /[a-zA-Z0-9_]/.test(charAfter);
                    return (!isAlphaNumericBefore) && (!isAlphaNumericAfter || charAfter === ' ');
                };
                if (op.length > 1) {
                    if (isWordBoundary(index, op.length, upperLine)) {
                        leftPart = lineTrimmed.substring(0, index).trim();
                        operator = lineTrimmed.substring(index, index + op.length);
                        rightPart = lineTrimmed.substring(index + op.length).trim();
                        operatorFound = true;
                        break;
                    }
                }
                else {
                    if (!(/[a-zA-Z0-9_]/.test(upperLine[index - 1])) && !(/[a-zA-Z0-9_]/.test(upperLine[index + 1]))) {
                        leftPart = lineTrimmed.substring(0, index).trim();
                        operator = lineTrimmed.substring(index, index + op.length);
                        rightPart = lineTrimmed.substring(index + op.length).trim();
                        operatorFound = true;
                        break;
                    }
                }
            }
        }
        const prefixMatch = lineTrimmed.match(/^(where|and|or)\s+/i);
        let contentAfterPrefix = lineTrimmed;
        let currentPrefixLength = 0;
        if (prefixMatch) {
            contentAfterPrefix = lineTrimmed.substring(prefixMatch[0].length).trim();
            currentPrefixLength = prefixMatch[0].length;
        }
        const actualLeftPartForLength = operatorFound ? leftPart.substring(currentPrefixLength).trim() : contentAfterPrefix;
        maxLeftPartLength = Math.max(maxLeftPartLength, actualLeftPartForLength.length);
        return { ...item, leftPart, operator, rightPart, operatorFound, originalPrefix: prefixMatch ? prefixMatch[0] : '' };
    });
    for (const item of parsedLines) {
        const currentIndent = item.indent;
        const formattedPrefix = item.originalPrefix ? item.originalPrefix.toLowerCase() + ' ' : '';
        let contentToAlign;
        if (item.operatorFound) {
            const actualLeftContent = item.leftPart.substring(item.originalPrefix.length).trim();
            const paddedLeft = actualLeftContent.padEnd(maxLeftPartLength);
            contentToAlign = `${paddedLeft} ${item.operator} ${item.rightPart}`;
        }
        else {
            contentToAlign = item.originalLine.substring(item.originalPrefix.length).trim();
        }
        const currentLineFormatted = `${currentIndent}${formattedPrefix}${contentToAlign}`.replace(/\s+/g, ' ');
        formatted.push(currentLineFormatted.trim());
    }
    return formatted;
}
/**
 * NOVO: Processa um grupo de linhas que fazem parte de um bloco condicional (IF, FOR, REPEAT) para alinhamento.
 * @param lines O array de linhas a serem processadas.
 * @param indentSize O tamanho da indentação.
 * @param parentKeywordIndent O nível de indentação da palavra-chave inicial (IF, FOR, REPEAT).
 * @returns Um array de strings formatadas.
 */
function processConditionalBlockLines(lines, indentSize, parentKeywordIndent) {
    const formatted = [];
    let maxLeftPartLength = 0;
    const operators = ['>=', '<=', '<>', '=', 'EQ', 'NE', 'GT', 'GE', 'LT', 'LE', 'MATCHES', 'LIKE'];
    // Primeira passagem: Analisar cada linha e encontrar o comprimento máximo da parte esquerda
    const parsedLines = lines.map(item => {
        let lineTrimmed = item.originalLine;
        let logicalOperator = ''; // 'IF', 'AND', 'OR'
        let conditionPart = lineTrimmed; // A condição completa após o operador lógico
        // Tenta extrair o operador lógico (IF, AND, OR)
        const logicalOpMatch = lineTrimmed.match(/^(if|and|or|for|repeat)\s+/i); // Adicionado for e repeat aqui
        if (logicalOpMatch) {
            logicalOperator = logicalOpMatch[0].toLowerCase();
            conditionPart = lineTrimmed.substring(logicalOpMatch[0].length).trim();
        }
        let leftPart = conditionPart;
        let comparisonOperator = '';
        let rightPart = '';
        let comparisonOperatorFound = false;
        // Tenta encontrar o operador de comparação dentro da condição
        for (const op of operators.sort((a, b) => b.length - a.length)) {
            const upperCondition = conditionPart.toUpperCase();
            const index = upperCondition.indexOf(op);
            if (index !== -1) {
                const isWordBoundary = (idx, len, text) => {
                    const charBefore = idx > 0 ? text[idx - 1] : '';
                    const charAfter = idx + len < text.length ? text[idx + len] : '';
                    const isAlphaNumericBefore = /[a-zA-Z0-9_]/.test(charBefore);
                    const isAlphaNumericAfter = /[a-zA-Z0-9_]/.test(charAfter);
                    return (!isAlphaNumericBefore) && (!isAlphaNumericAfter || charAfter === ' ');
                };
                if (op.length > 1) {
                    if (isWordBoundary(index, op.length, upperCondition)) {
                        leftPart = conditionPart.substring(0, index).trim();
                        comparisonOperator = conditionPart.substring(index, index + op.length);
                        rightPart = conditionPart.substring(index + op.length).trim();
                        comparisonOperatorFound = true;
                        break;
                    }
                }
                else {
                    // Para operadores de um caractere (=, <, >), verificar que não são parte de um nome (ex: "campo=")
                    // e que não estão imediatamente seguidos ou precedidos por um caractere alfanumérico.
                    if ((index === 0 || !/[a-zA-Z0-9_]/.test(upperCondition[index - 1])) &&
                        (index === upperCondition.length - 1 || !/[a-zA-Z0-9_]/.test(upperCondition[index + 1]))) {
                        leftPart = conditionPart.substring(0, index).trim();
                        comparisonOperator = conditionPart.substring(index, index + op.length);
                        rightPart = conditionPart.substring(index + op.length).trim();
                        comparisonOperatorFound = true;
                        break;
                    }
                }
            }
        }
        // Se não encontrou operador de comparação, a "parte esquerda" é a condição inteira.
        const actualLeftPartForLength = comparisonOperatorFound ? leftPart : conditionPart;
        // Considera o comprimento máximo da parte esquerda para alinhamento
        maxLeftPartLength = Math.max(maxLeftPartLength, actualLeftPartForLength.length);
        return {
            ...item,
            logicalOperator,
            conditionPart,
            leftPart,
            comparisonOperator,
            rightPart,
            comparisonOperatorFound
        };
    });
    // Segunda passagem: Formatar as linhas com alinhamento
    for (const item of parsedLines) {
        let currentLineFormatted;
        const initialIndentString = ' '.repeat(item.parentKeywordIndent * indentSize);
        let contentToAlign;
        if (item.comparisonOperatorFound) {
            // Se houver um operador de comparação, alinhamos as três partes
            const paddedLeft = item.leftPart.padEnd(maxLeftPartLength);
            contentToAlign = `${paddedLeft} ${item.comparisonOperator} ${item.rightPart}`;
        }
        else {
            // Se não houver operador de comparação (ex: 'if available table'), a condição é a própria parte esquerda
            contentToAlign = item.conditionPart;
        }
        if (item.logicalOperator) {
            const keyword = item.logicalOperator.toLowerCase();
            // O padding ideal para o CONTEÚDO da condição será o mesmo tamanho do "IF " (if+espaco).
            // Isso garante que o conteúdo ("condicao1", "condicao2") se alinhe.
            const fixedContentPadding = '   '; // 3 espaços para alinhar com o "I" de "IF" (if + espaço)
            // A linha formatada para AND/OR
            // O AND/OR se alinha com o 'I' de 'IF'
            currentLineFormatted = `${initialIndentString}${keyword}${fixedContentPadding}${contentToAlign}`;
        }
        else {
            // Esta é a primeira linha do IF/FOR/REPEAT
            const keywordMatch = item.originalLine.match(/^(if|for|repeat)\s+/i);
            const keyword = keywordMatch ? keywordMatch[0].toLowerCase() : ''; // ex: "if "
            // O conteúdo da primeira condição também usa o fixedContentPadding para alinhar
            // com as linhas AND/OR subsequentes.
            const fixedContentPadding = '   ';
            currentLineFormatted = `${initialIndentString}${keyword}${fixedContentPadding}${contentToAlign}`;
        }
        formatted.push(currentLineFormatted.trim()); // Trim final para garantir que não haja espaços extras no fim
    }
    return formatted;
}
/**
 * Formata o conteúdo de uma linha individual, incluindo capitalização de palavras-chave,
 * alinhamento de ASSIGN e formatação de nomes de variáveis/temp-tables.
 * @param trimmedLine A linha sem indentação, mas com espaços extras no meio.
 * @param inAssignBlock Indica se estamos dentro de um bloco ASSIGN.
 * @param indentString A string de indentação a ser usada para a linha.
 * @param assignAlignmentColumn A coluna onde o '=' deve ser alinhado em um bloco ASSIGN.
 * @returns A linha formatada.
 */
function formatLineContent(trimmedLine, inAssignBlock, indentString, assignAlignmentColumn) {
    // Mapa para formas abreviadas e minúsculas
    const keywordMap = {
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
        'CAN-FIND': 'can-find',
        'DEFINE VARIABLE': 'def var',
        'DEFINE PARAMETER': 'def param',
        'DEFINE TEMP-TABLE': 'def temp-table',
        // Palavras-chave que ficam em minúsculas na sua forma completa ou não possuem abreviação comum
        'ADD': 'add', 'ACCUMULATE': 'accumulate', 'ADD-LAST': 'add-last', 'AND': 'and',
        'AS': 'as', 'ASSIGN': 'assign', 'BEGIN-PROFILER': 'begin-profiler', 'BUFFER': 'buffer',
        'BY': 'by', 'BY-REFERENCE': 'by-reference', 'CALL': 'call', 'CASE': 'case',
        'CATCH': 'catch', 'CLASS': 'class', 'COLON': 'colon', 'COMBO-BOX': 'combo-box',
        'COMMIT': 'commit', 'COPY-DATASET': 'copy-dataset', 'COPY-FILE': 'copy-file',
        'CREATE': 'create', 'DATA-SOURCE': 'data-source', 'DATA-SERVER': 'data-server',
        'DATABASE': 'database', 'DATASET': 'dataset', 'DATETIME': 'datetime',
        'DECODE': 'decode', 'DELETE': 'delete', 'DIALOG-BOX': 'dialog-box', 'DISABLE': 'disable',
        'DISPLAY': 'display', 'DISK-SPACE': 'disk-space', 'DO': 'do', 'DYNAMIC': 'dynamic',
        'EACH': 'each', 'ELSE': 'else', 'ENABLE': 'enable', 'END': 'end', 'ENTRY': 'entry',
        'EXISTS': 'exists', 'EXPORT': 'export', 'EXTENT': 'extent', 'FILE-INFO': 'file-info',
        'FILTER': 'filter', 'FINALLY': 'finally', 'FIND': 'find', 'FIRST': 'first',
        'FIRST-OF': 'first-of', 'FOR': 'for', 'FORM': 'form', 'FRAME': 'frame',
        'GET-BYTE': 'get-byte', 'GET-KEY-VALUE': 'get-key-value', 'GO': 'go',
        'HANDLE': 'handle', 'HIDDEN': 'hidden', 'IF': 'if', 'IMAGE': 'image',
        'INDEX': 'index', 'INITIAL': 'initial', 'INNER-JOIN': 'inner-join', 'INPUT': 'input',
        'INSERT': 'insert', 'IS': 'is', 'JOIN': 'join', 'LAST': 'last', 'LAST-OF': 'last-of',
        'LEAVE': 'leave', 'LIKE': 'like', 'LOG-MANAGER': 'log-manager', 'LOOKUP': 'lookup',
        'MENU': 'menu', 'MESSAGE': 'message', 'METHOD': 'method', 'MOVE': 'move',
        'NEW': 'new', 'NEXT': 'next', 'NOT': 'not', 'NUM-ENTRIES': 'num-entries',
        'OBJECT': 'object', 'OF': 'of', 'ON': 'on', 'OPEN': 'open', 'OR': 'or',
        'OUTER-JOIN': 'outer-join', 'OUTPUT': 'output', 'OVERLAY': 'overlay', 'PAUSE': 'pause',
        'PERCENT': 'percent', 'PREPROCESS': 'preprocess', 'PRINTER': 'printer', 'PRIVATE': 'private',
        'PROC-TEXT': 'proc-text', 'PROGRESS': 'progress', 'PROMPT-FOR': 'prompt-for',
        'PROTECTED': 'protected', 'PUBLIC': 'public', 'QUERY': 'query', 'RADIO-BUTTON': 'radio-button',
        'RECID': 'recid', 'REPEAT': 'repeat', 'REPOSITION': 'reposition', 'RETURN': 'return',
        'ROW-FETCH': 'row-fetch', 'RUN': 'run', 'SCHEMA': 'schema', 'SCREEN': 'screen',
        'SEARCH': 'search', 'SEEK': 'seek', 'SELF': 'self', 'SESSION': 'session', 'SET': 'set',
        'SHARE': 'share', 'SKIP': 'skip', 'SMALLINT': 'smallint', 'SORT': 'sort', 'STATIC': 'static',
        'STREAM': 'stream', 'SUBSTITUTE': 'substitute', 'SUPER': 'super',
        'SYSTEM-DIALOGS': 'system-dialogs', 'TABLE': 'table', 'TEXT': 'text', 'THEN': 'then',
        'THIS-OBJECT': 'this-object', 'THROWS': 'throws', 'TO': 'to', 'TOP-ONLY': 'top-only',
        'TRAIL': 'trail', 'TRANSACTION': 'transaction', 'TRIGGER': 'trigger', 'TRUNCATE': 'truncate',
        'UNDO': 'undo', 'UNKNOWN': 'unknown', 'UNLOAD': 'unload', 'UPDATE': 'update', 'USE': 'use',
        'USING': 'using', 'VALIDATE': 'validate', 'VIEW': 'view', 'VOID': 'void',
        'WAIT-FOR': 'wait-for', 'WHEN': 'when', 'WHERE': 'where', 'WHILE': 'while',
        'WIDGET': 'widget', 'WINDOW': 'window', 'WITH': 'with', 'XML-NODE': 'xml-node',
        'XREF': 'xref', 'YES': 'yes', 'ZERO': 'zero',
    };
    const keywords = Object.keys(keywordMap).sort((a, b) => b.length - a.length);
    const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
    let formatted = trimmedLine.replace(regex, (keyword) => keywordMap[keyword.toUpperCase()] || keyword.toLowerCase());
    if (formatted.includes('=') && !/if|for|while|case|eq|ne|gt|ge|lt|le/i.test(formatted)) {
        const isAssignment = formatted.match(/^\s*\w+\s*=/) || inAssignBlock;
        if (isAssignment) {
            const parts = formatted.split('=');
            if (parts.length > 1) {
                const left = parts[0].trim();
                const right = parts.slice(1).join('=').trim();
                formatted = `${left} = ${right}`;
            }
        }
        else {
            formatted = formatted.replace(/\s*=\s*/g, ' = ');
        }
    }
    if (inAssignBlock) {
        const parts = formatted.split('=');
        if (parts.length > 1) {
            const variablePart = parts[0].trim();
            const valuePart = parts.slice(1).join('=').trim();
            const currentLengthBeforeEquals = variablePart.length;
            const padding = Math.max(0, assignAlignmentColumn - currentLengthBeforeEquals);
            return `${variablePart}${' '.repeat(padding)} = ${valuePart}`;
        }
    }
    if (/^def(ine)?\s+(var(iable)?|temp-table|param(eter)?)/i.test(formatted)) {
        const parts = formatted.split(/\s+/);
        let nameIndex = -1;
        if (parts[0].toLowerCase() === 'def' || parts[0].toLowerCase() === 'define') {
            const typeKeyword = parts[1].toLowerCase();
            if (typeKeyword === 'var' || typeKeyword === 'variable' ||
                typeKeyword === 'temp-table' || typeKeyword === 'param' || typeKeyword === 'parameter') {
                nameIndex = 2;
            }
        }
        if (nameIndex !== -1 && parts[nameIndex]) {
            let originalName = parts[nameIndex];
            const hasQuotes = originalName.startsWith('"') && originalName.endsWith('"');
            let cleanName = originalName.replace(/^"|"$/g, '');
            let formattedName = cleanName;
            const hungarianPrefixes = [
                'c', 'i', 'l', 'd', 'h', 'm', 'r', 'dt', 'dtt', 'dec', 'g', 'r-'
            ];
            const ttPrefix = 'tt-';
            if (cleanName.startsWith(ttPrefix)) {
                let restOfName = cleanName.substring(ttPrefix.length);
                formattedName = ttPrefix + toPascalCase(restOfName);
            }
            else {
                let foundHungarianPrefix = '';
                for (const prefix of hungarianPrefixes) {
                    if (cleanName.startsWith(prefix) && cleanName.length > prefix.length && /[A-Za-z_]/.test(cleanName[prefix.length])) {
                        foundHungarianPrefix = prefix;
                        break;
                    }
                }
                if (foundHungarianPrefix) {
                    let restOfName = cleanName.substring(foundHungarianPrefix.length);
                    formattedName = foundHungarianPrefix + toPascalCase(restOfName);
                }
                else {
                    formattedName = toPascalCase(cleanName);
                }
            }
            parts[nameIndex] = hasQuotes ? `"${formattedName}"` : formattedName;
            formatted = parts.join(' ');
            const match = formatted.match(/^(def(ine)?\s+(var(iable)?|temp-table|param(eter)?)\s+)([\w-]+|"[^"]+")(\s+(as|like|no-undo|initial|extent).*)*$/i);
            if (match) {
                const prefixPart = match[1];
                const namePart = match[6];
                const suffixPart = match[7] || '';
                const namePadding = 30;
                const nameLength = namePart.replace(/^"|"$/g, '').length;
                return `${prefixPart}${namePart.padEnd(namePadding - (namePart.length - nameLength))}${suffixPart}`;
            }
        }
    }
    return formatted;
}
function toPascalCase(str) {
    return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase())
        .replace(/^(.)/, (g) => g.toUpperCase());
}
function deactivate() { }
//# sourceMappingURL=extension.js.map