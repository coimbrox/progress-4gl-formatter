"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderInline = renderInline;
exports.isKeywordToken = isKeywordToken;
const keywords_1 = require("./keywords");
/** Type-name words that take a space before a following '(' (e.g. `returns char (...)`). */
const TYPE_LIKE_WORDS = new Set([
    'char', 'character', 'int', 'integer', 'log', 'logical', 'dec', 'decimal',
    'date', 'datetime', 'datetime-tz', 'handle', 'void', 'longchar', 'recid',
    'rowid', 'com-handle', 'widget-handle', 'class',
]);
function displayText(tok) {
    if (tok.kind === 'word' && (0, keywords_1.isKeyword)(tok.text))
        return (0, keywords_1.canonicalKeyword)(tok.text);
    return tok.text;
}
/**
 * Renders a flat token slice with ABL spacing conventions: tight around
 * `.`/`,`/`::`/member-access `:`, single space elsewhere, unary +/- glued to
 * its operand. A standalone lineComment token forces everything after it
 * onto a new output line (nothing may legally follow `//...` on one line),
 * so the result is an array of lines rather than a single string.
 */
function renderInline(tokens) {
    const lines = [];
    let current = '';
    const isPunctNoSpaceBefore = (t) => t.kind === 'eos' || (t.kind === 'punct' && [')', ']', ',', '::'].includes(t.text));
    const isPunctNoSpaceAfter = (t) => t.kind === 'punct' && ['(', '[', '::'].includes(t.text);
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        const prev = tokens[i - 1];
        const text = displayText(tok);
        if (tok.kind === 'blockComment' || tok.kind === 'preprocessor') {
            if (current.length > 0 && !current.endsWith(' '))
                current += ' ';
            current += text;
            continue;
        }
        if (tok.kind === 'lineComment') {
            if (current.length > 0 && !current.endsWith(' '))
                current += ' ';
            current += text;
            lines.push(current);
            current = '';
            continue;
        }
        if (current.length === 0) {
            current = text;
            continue;
        }
        // member-access colon: tight both sides
        if (tok.kind === 'punct' && tok.text === ':') {
            current += text;
            continue;
        }
        if (prev && prev.kind === 'punct' && prev.text === ':') {
            current += text;
            continue;
        }
        // unary +/- : glued to the operand that follows it, preceded by a normal space
        if (tok.kind === 'operator' && (tok.text === '-' || tok.text === '+')) {
            const prevIsOperandBoundary = !prev ||
                prev.kind === 'operator' ||
                (prev.kind === 'punct' && ['(', '[', ','].includes(prev.text));
            if (prevIsOperandBoundary) {
                current += ' ' + text;
                continue;
            }
        }
        if (i > 0 && tokens[i - 1].kind === 'operator' && (tokens[i - 1].text === '-' || tokens[i - 1].text === '+')) {
            const prevPrev = tokens[i - 2];
            const wasUnary = !prevPrev ||
                prevPrev.kind === 'operator' ||
                (prevPrev.kind === 'punct' && ['(', '[', ','].includes(prevPrev.text));
            if (wasUnary) {
                current += text;
                continue;
            }
        }
        if (isPunctNoSpaceBefore(tok)) {
            current += text;
            continue;
        }
        if (prev && isPunctNoSpaceAfter(prev)) {
            current += text;
            continue;
        }
        if (tok.kind === 'punct' && tok.text === '(' && prev) {
            const prevCanonical = prev.kind === 'word' ? (0, keywords_1.canonicalKeyword)(prev.text) : '';
            const needsSpace = prev.kind !== 'word' || TYPE_LIKE_WORDS.has(prevCanonical) || prevCanonical === 'returns';
            current += (needsSpace ? ' ' : '') + text;
            continue;
        }
        current += ' ' + text;
    }
    if (current.length > 0)
        lines.push(current);
    return lines;
}
function isKeywordToken(tok, keyword) {
    return tok.kind === 'word' && (0, keywords_1.isKeyword)(tok.text) && (0, keywords_1.canonicalKeyword)(tok.text) === keyword;
}
//# sourceMappingURL=render.js.map