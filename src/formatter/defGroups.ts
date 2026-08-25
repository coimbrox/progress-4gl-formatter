import { Chunk, isTrivia, Statement } from './statements';
import { parseDefHeader, DEF_SIMPLE_KINDS } from './statementPrinter';

/**
 * Consecutive `def var` / `def param` / `def buffer` / `def stream`
 * declarations (same modifiers+kind, no blank line or other statement
 * breaking the run) get their name column padded to the widest name in
 * that run — mirrors how this codebase hand-aligns batches of declarations.
 */
export function computeDefPadWidths(chunks: Chunk[]): Map<Statement, number> {
    const widths = new Map<Statement, number>();
    let group: Statement[] = [];
    let groupSignature = '';

    const flush = () => {
        if (group.length === 0) return;
        const maxLen = Math.max(...group.map(s => nameLengthOf(s)));
        for (const s of group) widths.set(s, maxLen);
        group = [];
    };

    const nameLengthOf = (s: Statement): number => {
        const header = parseDefHeader(s.tokens.slice(0, -1));
        return header ? header.nameTok.text.length : 0;
    };

    const signatureOf = (s: Statement): string | null => {
        const header = parseDefHeader(s.tokens.slice(0, -1));
        if (!header || !DEF_SIMPLE_KINDS.has(header.kind)) return null;
        return header.prefixTokens.map(t => t.text.toLowerCase()).join(' ');
    };

    for (const chunk of chunks) {
        if (isTrivia(chunk)) { flush(); continue; }
        const stmt = chunk;
        if (stmt.blankLinesBefore > 0) flush();
        const sig = signatureOf(stmt);
        if (sig === null) { flush(); continue; }
        if (group.length > 0 && sig !== groupSignature) flush();
        groupSignature = sig;
        group.push(stmt);
    }
    flush();

    return widths;
}
