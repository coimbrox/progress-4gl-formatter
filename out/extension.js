"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
function activate(context) {
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('progress', {
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
    const indentSize = 4; // Aumentado para 4 para melhor legibilidade, como no print
    // Palavras-chave que aumentam a indentação para a próxima linha
    const indentKeywords = [
        'DO:', 'FOR', 'REPEAT', 'FUNCTION', 'PROCEDURE', 'IF', 'FORM'
    ];
    // Palavras-chave que diminuem a indentação na linha atual
    const unindentKeywords = ['END.', 'END', 'ELSE'];
    // Palavras-chave que não devem ser seguidas por um aumento de indentação na mesma linha
    const singleLineKeywords = ['THEN'];
    for (const line of lines) {
        let trimmed = line.trim();
        if (trimmed === '') {
            formattedLines.push('');
            continue;
        }
        const upperTrimmed = trimmed.toUpperCase();
        // Lógica de indentação
        if (unindentKeywords.some(kw => upperTrimmed.startsWith(kw))) {
            indentLevel = Math.max(0, indentLevel - 1);
        }
        let formattedLine = ' '.repeat(indentLevel * indentSize) + formatLineContent(trimmed);
        formattedLines.push(formattedLine);
        // Aumenta a indentação para a próxima linha
        if (indentKeywords.some(kw => upperTrimmed.startsWith(kw))) {
            // Evita indentar após um 'THEN' na mesma linha de um 'IF'
            if (!singleLineKeywords.some(slk => upperTrimmed.includes(slk))) {
                indentLevel++;
            }
        }
    }
    return formattedLines.join('\n');
}
function formatLineContent(trimmedLine) {
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
    // Alinha definições de variáveis
    if (/^def var/i.test(formatted)) {
        const parts = formatted.split(/\s+/);
        if (parts.length > 3 && parts[3].toLowerCase() === 'like') {
            const varName = parts[2];
            const restOfLine = parts.slice(3).join(' ');
            return `${parts.slice(0, 2).join(' ')} ${varName.padEnd(25)} ${restOfLine}`;
        }
    }
    return formatted;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map