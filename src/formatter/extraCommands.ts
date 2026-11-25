import { isKeyword } from './keywords';
import { tokenize } from './lexer';

/**
 * Transforms only ABL keyword tokens (never strings, comments, or includes)
 * to upper-case or lower-case, preserving all original whitespace and formatting.
 */
export function transformKeywordCase(source: string, mode: 'upper' | 'lower'): string {
    const tokens = tokenize(source);
    const lines = source.split('\n');
    const lineOffsets: number[] = [];
    let offset = 0;
    for (const line of lines) {
        lineOffsets.push(offset);
        offset += line.length + 1; // +1 for '\n'
    }

    const edits: Array<{ start: number; end: number; replacement: string }> = [];

    for (const tok of tokens) {
        if (tok.kind !== 'word') continue;
        // Skip table.field dotted identifiers; only transform pure keywords
        if (tok.text.includes('.')) continue;
        if (!isKeyword(tok.text)) continue;

        const replacement = mode === 'upper' ? tok.text.toUpperCase() : tok.text.toLowerCase();
        if (replacement === tok.text) continue;

        const start = lineOffsets[tok.line - 1] + (tok.col - 1);
        const end = start + tok.text.length;
        edits.push({ start, end, replacement });
    }

    if (edits.length === 0) return source;

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
export function trimRightLines(source: string): string {
    return source.replace(/[ \t]+(\r?\n|$)/g, '$1');
}
