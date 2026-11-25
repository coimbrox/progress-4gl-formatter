"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformKeywordCase = transformKeywordCase;
exports.trimRightLines = trimRightLines;
const keywords_1 = require("./keywords");
const lexer_1 = require("./lexer");
/**
 * Transforms only ABL keyword tokens (never strings, comments, or includes)
 * to upper-case or lower-case, preserving all original whitespace and formatting.
 */
function transformKeywordCase(source, mode) {
    const tokens = (0, lexer_1.tokenize)(source);
    const lines = source.split('\n');
    const lineOffsets = [];
    let offset = 0;
    for (const line of lines) {
        lineOffsets.push(offset);
        offset += line.length + 1; // +1 for '\n'
    }
    const edits = [];
    for (const tok of tokens) {
        if (tok.kind !== 'word')
            continue;
        // Skip table.field dotted identifiers; only transform pure keywords
        if (tok.text.includes('.'))
            continue;
        if (!(0, keywords_1.isKeyword)(tok.text))
            continue;
        const replacement = mode === 'upper' ? tok.text.toUpperCase() : tok.text.toLowerCase();
        if (replacement === tok.text)
            continue;
        const start = lineOffsets[tok.line - 1] + (tok.col - 1);
        const end = start + tok.text.length;
        edits.push({ start, end, replacement });
    }
    if (edits.length === 0)
        return source;
    let result = source;
    // Apply from end to start so offsets remain valid
    for (let i = edits.length - 1; i >= 0; i--) {
        const { start, end, replacement } = edits[i];
        result = result.slice(0, start) + replacement + result.slice(end);
    }
    return result;
}
/**
 * Removes trailing spaces and tabs from every line while preserving line endings.
 */
function trimRightLines(source) {
    return source.replace(/[ \t]+(\r?\n|$)/g, '$1');
}
//# sourceMappingURL=extraCommands.js.map