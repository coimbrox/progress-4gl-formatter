import { tokenize } from './lexer';
import { groupStatements, isTrivia, Statement } from './statements';
import { renderInline } from './render';
import { formatStatement } from './statementPrinter';
import { computeDefPadWidths } from './defGroups';

const INDENT_SIZE = 2;
const MAX_BLANK_LINES = 1;

function indentOf(level: number): string {
    return ' '.repeat(Math.max(0, level) * INDENT_SIZE);
}

function isEndStatement(stmt: Statement): boolean {
    const first = stmt.tokens[0];
    return !!first && first.kind === 'word' && first.text.toLowerCase() === 'end';
}

export function formatSource(source: string): string {
    const tokens = tokenize(source);
    const chunks = groupStatements(tokens);
    const defPadWidths = computeDefPadWidths(chunks);

    const outputLines: string[] = [];
    let indentLevel = 0;
    let isFirst = true;

    const emitBlankLines = (blankLinesBefore: number) => {
        if (isFirst) return;
        const n = Math.min(MAX_BLANK_LINES, blankLinesBefore);
        for (let i = 0; i < n; i++) outputLines.push('');
    };

    for (const chunk of chunks) {
        if (isTrivia(chunk)) {
            emitBlankLines(chunk.blankLinesBefore);
            const rendered = renderInline([chunk.token]);
            for (const line of rendered) outputLines.push(indentOf(indentLevel) + line);
            isFirst = false;
            continue;
        }

        const stmt = chunk;
        if (stmt.tokens.length === 0) continue;

        if (isEndStatement(stmt)) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        emitBlankLines(stmt.blankLinesBefore);
        const lines = formatStatement(stmt, indentLevel, INDENT_SIZE, defPadWidths.get(stmt));
        outputLines.push(...lines);
        isFirst = false;

        if (stmt.terminator === 'blockColon') {
            indentLevel++;
        }
    }

    return outputLines.join('\n') + '\n';
}
