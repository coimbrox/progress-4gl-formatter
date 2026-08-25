"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDefPadWidths = computeDefPadWidths;
const statements_1 = require("./statements");
const statementPrinter_1 = require("./statementPrinter");
/**
 * Consecutive `def var` / `def param` / `def buffer` / `def stream`
 * declarations (same modifiers+kind, no blank line or other statement
 * breaking the run) get their name column padded to the widest name in
 * that run — mirrors how this codebase hand-aligns batches of declarations.
 */
function computeDefPadWidths(chunks) {
    const widths = new Map();
    let group = [];
    let groupSignature = '';
    const flush = () => {
        if (group.length === 0)
            return;
        const maxLen = Math.max(...group.map(s => nameLengthOf(s)));
        for (const s of group)
            widths.set(s, maxLen);
        group = [];
    };
    const nameLengthOf = (s) => {
        const header = (0, statementPrinter_1.parseDefHeader)(s.tokens.slice(0, -1));
        return header ? header.nameTok.text.length : 0;
    };
    const signatureOf = (s) => {
        const header = (0, statementPrinter_1.parseDefHeader)(s.tokens.slice(0, -1));
        if (!header || !statementPrinter_1.DEF_SIMPLE_KINDS.has(header.kind))
            return null;
        return header.prefixTokens.map(t => t.text.toLowerCase()).join(' ');
    };
    for (const chunk of chunks) {
        if ((0, statements_1.isTrivia)(chunk)) {
            flush();
            continue;
        }
        const stmt = chunk;
        if (stmt.blankLinesBefore > 0)
            flush();
        const sig = signatureOf(stmt);
        if (sig === null) {
            flush();
            continue;
        }
        if (group.length > 0 && sig !== groupSignature)
            flush();
        groupSignature = sig;
        group.push(stmt);
    }
    flush();
    return widths;
}
//# sourceMappingURL=defGroups.js.map