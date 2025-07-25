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
    const indentSize = 4;
    const blockStartKeywords = [
        'DO:', 'FOR', 'REPEAT', 'FUNCTION', 'PROCEDURE', 'IF', 'FORM', 'THEN DO:'
    ];
    const blockEndKeywords = ['END.', 'END', 'ELSE'];
    let inMultiLineStatement = false;
    let inAssignBlock = false;
    let assignAlignmentColumn = 0;
    let inDefineBlock = false; // Novo estado para blocos DEFINE
    for (const line of lines) {
        let trimmed = line.trim();
        if (trimmed === '') {
            formattedLines.push('');
            continue;
        }
        const upperTrimmed = trimmed.toUpperCase();
        let currentIndentLevel = indentLevel;
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
        }
        else if (inMultiLineStatement && (upperTrimmed.startsWith('AND ') || upperTrimmed.startsWith('OR '))) {
            // Não indenta extra para OR/AND em um IF, mas mantém para FIND/WHERE
            // Esta lógica pode precisar de mais refinamento
        }
        else if (upperTrimmed.startsWith('THEN DO:')) {
            inMultiLineStatement = false;
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
        let formattedLine = formatLineContent(trimmed, inAssignBlock, ' '.repeat(currentIndentLevel * indentSize), assignAlignmentColumn);
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
        if (upperTrimmed.startsWith('IF ') || upperTrimmed.startsWith('FIND ') || upperTrimmed.startsWith('FOR ')) {
            inMultiLineStatement = true;
        }
    }
    return formattedLines.join('\n');
}
function formatLineContent(trimmedLine, inAssignBlock, indentString, assignAlignmentColumn) {
    const keywords = [
        'ADD', 'AND', 'AS', 'ASSIGN', 'AVAILABLE', 'BY', 'CAN-DO', 'CASE', 'CATCH',
        'CREATE', 'DEF', 'DEFINE', 'DELETE', 'DISPLAY', 'DO', 'EACH', 'ELSE', 'END',
        'EXCLUSIVE-LOCK', 'EXPORT', 'FINALLY', 'FIND', 'FIRST', 'FOR', 'FORM', 'FRAME',
        'FUNCTION', 'IF', 'INPUT', 'JOIN', 'LAST', 'LEAVE', 'LIKE', 'MESSAGE', 'METHOD',
        'NEW', 'NEXT', 'NO-ERROR', 'NO-LOCK', 'NO-UNDO', 'NOT', 'OF', 'ON', 'OR', 'OUTPUT',
        'PARAMETER', 'PRIVATE', 'PROCEDURE', 'PROTECTED', 'PUBLIC', 'QUERY', 'REPEAT',
        'RETURN', 'RUN', 'SET', 'SKIP', 'STATIC', 'TABLE', 'TEMP-TABLE', 'THEN', 'TO',
        'TRANSACTION', 'UNDO', 'UPDATE', 'USING', 'VALIDATE', 'VAR', 'VARIABLE', 'VIEW-AS',
        'WHERE', 'WHILE', 'WITH'
    ];
    const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
    let formatted = trimmedLine.replace(regex, (keyword) => keyword.toLowerCase());
    // Adiciona espaços ao redor de '=' em atribuições
    if (/assign/i.test(formatted) || (formatted.includes('=') && !/if|for|while|case/i.test(formatted))) {
        formatted = formatted.replace(/\s*=\s*/g, ' = ');
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