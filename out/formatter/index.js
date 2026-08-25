"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSource = formatSource;
const lexer_1 = require("./lexer");
const statements_1 = require("./statements");
const render_1 = require("./render");
const statementPrinter_1 = require("./statementPrinter");
const defGroups_1 = require("./defGroups");
const INDENT_SIZE = 2;
const MAX_BLANK_LINES = 1;
function indentOf(level) {
    return ' '.repeat(Math.max(0, level) * INDENT_SIZE);
}
function isEndStatement(stmt) {
    const first = stmt.tokens[0];
    return !!first && first.kind === 'word' && first.text.toLowerCase() === 'end';
}
function formatSource(source) {
    const tokens = (0, lexer_1.tokenize)(source);
    const chunks = (0, statements_1.groupStatements)(tokens);
    const defPadWidths = (0, defGroups_1.computeDefPadWidths)(chunks);
    const outputLines = [];
    let indentLevel = 0;
    let isFirst = true;
    const emitBlankLines = (blankLinesBefore) => {
        if (isFirst)
            return;
        const n = Math.min(MAX_BLANK_LINES, blankLinesBefore);
        for (let i = 0; i < n; i++)
            outputLines.push('');
    };
    for (const chunk of chunks) {
        if ((0, statements_1.isTrivia)(chunk)) {
            emitBlankLines(chunk.blankLinesBefore);
            const rendered = (0, render_1.renderInline)([chunk.token]);
            for (const line of rendered)
                outputLines.push(indentOf(indentLevel) + line);
            isFirst = false;
            continue;
        }
        const stmt = chunk;
        if (stmt.tokens.length === 0)
            continue;
        if (isEndStatement(stmt)) {
            indentLevel = Math.max(0, indentLevel - 1);
        }
        emitBlankLines(stmt.blankLinesBefore);
        const lines = (0, statementPrinter_1.formatStatement)(stmt, indentLevel, INDENT_SIZE, defPadWidths.get(stmt));
        outputLines.push(...lines);
        isFirst = false;
        if (stmt.terminator === 'blockColon') {
            indentLevel++;
        }
    }
    return outputLines.join('\n') + '\n';
}
//# sourceMappingURL=index.js.map