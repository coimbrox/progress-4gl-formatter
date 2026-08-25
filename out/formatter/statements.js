"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTrivia = isTrivia;
exports.groupStatements = groupStatements;
function isTrivia(chunk) {
    return chunk.kind === 'trivia';
}
const isTriviaKind = (k) => k === 'lineComment' || k === 'blockComment' || k === 'preprocessor';
/**
 * Groups a flat token stream into logical statements.
 *
 * A statement ends at a top-level (paren-depth 0) '.' (eos), or at a
 * top-level ':' that opens a block — distinguished from a member-access
 * colon (e.g. `obj:method()`) by whether anything else follows on the same
 * source line. Standalone comments/preprocessor directives between
 * statements become their own Trivia chunks so they're never subjected to
 * statement-level reformatting.
 */
function groupStatements(tokens) {
    const chunks = [];
    let buffer = [];
    let depth = 0;
    let bufferBlankLinesBefore = 0;
    const flushStatement = (terminator) => {
        if (buffer.length === 0)
            return;
        chunks.push({ tokens: buffer, blankLinesBefore: bufferBlankLinesBefore, terminator });
        buffer = [];
    };
    for (let idx = 0; idx < tokens.length; idx++) {
        const tok = tokens[idx];
        if (tok.kind === 'eof') {
            flushStatement('eof');
            continue;
        }
        if (isTriviaKind(tok.kind) && buffer.length === 0) {
            chunks.push({ kind: 'trivia', token: tok, blankLinesBefore: tok.blankLinesBefore });
            continue;
        }
        if (buffer.length === 0) {
            bufferBlankLinesBefore = tok.blankLinesBefore;
        }
        buffer.push(tok);
        if (tok.kind === 'punct' && (tok.text === '(' || tok.text === '[')) {
            depth++;
            continue;
        }
        if (tok.kind === 'punct' && (tok.text === ')' || tok.text === ']')) {
            depth = Math.max(0, depth - 1);
            continue;
        }
        if (depth === 0 && tok.kind === 'eos') {
            flushStatement('period');
            continue;
        }
        if (depth === 0 && tok.kind === 'punct' && tok.text === ':') {
            const next = tokens[idx + 1];
            const isBlockColon = !next || next.kind === 'eof' || next.precededByNewline;
            if (isBlockColon) {
                flushStatement('blockColon');
            }
            continue;
        }
    }
    flushStatement('eof');
    return chunks;
}
//# sourceMappingURL=statements.js.map