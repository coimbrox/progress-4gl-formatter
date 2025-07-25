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
    const indentSize = 2; // Alterado de 4 para 2
    const blockStartKeywords = [
        'DO:', 'FOR', 'REPEAT', 'FUNCTION', 'PROCEDURE', 'IF', 'FORM', 'THEN DO:'
    ];
    const blockEndKeywords = ['END.', 'END', 'ELSE'];
    let inMultiLineStatement = false;
    let inAssignBlock = false;
    let assignAlignmentColumn = 0;
    let inDefineBlock = false;
    let inFindBlock = false; // Novo estado para blocos FIND/CAN-FIND
    for (const line of lines) {
        let trimmed = line.trim();
        if (trimmed === '') {
            formattedLines.push('');
            continue;
        }
        const upperTrimmed = trimmed.toUpperCase();
        let currentIndentLevel = indentLevel;
        // Lógica para blocos FIND/CAN-FIND
        if (inFindBlock) {
            if (upperTrimmed.startsWith('WHERE') || upperTrimmed.startsWith('AND') || upperTrimmed.startsWith('OR')) {
                currentIndentLevel++;
            }
            else {
                // Qualquer outra coisa encerra o bloco FIND
                inFindBlock = false;
            }
        }
        // Se estiver em um bloco define, indenta o VIEW-AS
        if (inDefineBlock) {
            if (upperTrimmed.startsWith('VIEW-AS')) {
                currentIndentLevel++;
            }
            else {
                // Outra linha qualquer encerra o bloco define
                inDefineBlock = false;
            }
        }
        // Lógica para diminuir a indentação
        if (blockEndKeywords.some(kw => upperTrimmed.startsWith(kw))) {
            indentLevel = Math.max(0, indentLevel - 1);
            currentIndentLevel = indentLevel;
            inMultiLineStatement = false;
            inFindBlock = false; // Encerra o bloco FIND também
        }
        else if (inMultiLineStatement && (upperTrimmed.startsWith('AND ') || upperTrimmed.startsWith('OR '))) {
            if (!inFindBlock) { // A indentação do AND/OR do FIND é tratada acima
                // Não indenta extra para OR/AND em um IF
            }
        }
        else if (upperTrimmed.startsWith('THEN DO:')) {
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
        }
        else if (inDefineBlock && trimmed.endsWith('.')) {
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
function formatLineContent(trimmedLine, inAssignBlock, indentString, assignAlignmentColumn, inFindBlock) {
    // Mapa para formas abreviadas e minúsculas
    const keywordMap = {
        'DEFINE': 'def', 'VARIABLE': 'var', 'PARAMETER': 'param', 'PROCEDURE': 'proc',
        'FUNCTION': 'func', 'TEMP-TABLE': 'temp-table', 'VIEW-AS': 'view-as',
        'NO-UNDO': 'no-undo', 'NO-LOCK': 'no-lock', 'NO-ERROR': 'no-error',
        'EXCLUSIVE-LOCK': 'exclusive-lock', 'AVAILABLE': 'avail',
        // Palavras-chave que ficam apenas minúsculas
        'ADD': 'add', 'AND': 'and', 'AS': 'as', 'ASSIGN': 'assign', 'BY': 'by',
        'CAN-DO': 'can-do', 'CASE': 'case', 'CATCH': 'catch', 'CREATE': 'create',
        'DELETE': 'delete', 'DISPLAY': 'display', 'DO': 'do', 'EACH': 'each',
        'ELSE': 'else', 'END': 'end', 'EXPORT': 'export', 'FINALLY': 'finally',
        'FIND': 'find', 'FIRST': 'first', 'FOR': 'for', 'FORM': 'form', 'FRAME': 'frame',
        'IF': 'if', 'INPUT': 'input', 'JOIN': 'join', 'LAST': 'last', 'LEAVE': 'leave',
        'LIKE': 'like', 'MESSAGE': 'message', 'METHOD': 'method', 'NEW': 'new',
        'NEXT': 'next', 'NOT': 'not', 'OF': 'of', 'ON': 'on', 'OR': 'or', 'OUTPUT': 'output',
        'PRIVATE': 'private', 'PROTECTED': 'protected', 'PUBLIC': 'public', 'QUERY': 'query',
        'REPEAT': 'repeat', 'RETURN': 'return', 'RUN': 'run', 'SET': 'set', 'SKIP': 'skip',
        'STATIC': 'static', 'TABLE': 'table', 'THEN': 'then', 'TO': 'to',
        'TRANSACTION': 'transaction', 'UNDO': 'undo', 'UPDATE': 'update', 'USING': 'using',
        'VALIDATE': 'validate', 'WHERE': 'where', 'WHILE': 'while', 'WITH': 'with'
    };
    const keywords = Object.keys(keywordMap);
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
    // Alinha blocos ASSIGN
    if (inAssignBlock && /^\w/.test(formatted) && formatted.includes('=')) {
        const parts = formatted.split('=');
        const variablePart = parts[0].trim();
        const valuePart = parts[1].trim();
        if (!/assign/i.test(variablePart)) { // Se não for a primeira linha do assign
            const padding = indentString.length + assignAlignmentColumn;
            return ' '.repeat(assignAlignmentColumn) + `${variablePart.padEnd(25)} = ${valuePart}`;
        }
        else { // Primeira linha do assign
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
function deactivate() { }
//# sourceMappingURL=extension.js.map