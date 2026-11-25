export interface LocalSyntaxIssue {
    line: number; // 1-based
    column: number; // 1-based
    severity: 'error' | 'warning';
    message: string;
}

/**
 * Lightweight offline/static syntax checker for OpenEdge ABL.
 * Useful as a fast fallback when an OpenEdge DLC compiler is not configured yet.
 * Checks: unclosed block comments, unclosed strings, unbalanced parentheses/brackets,
 * and unmatched block openers (DO/FOR/REPEAT/CASE/PROCEDURE/FUNCTION/METHOD/CLASS vs END).
 */
export function checkLocalAblSyntax(source: string): LocalSyntaxIssue[] {
    const issues: LocalSyntaxIssue[] = [];
    const lines = source.split(/\r?\n/);

    let blockCommentDepth = 0;
    let blockCommentStartLine = 1;
    const parenStack: Array<{ ch: string; line: number; col: number }> = [];
    const blockStack: Array<{ kind: string; line: number; col: number }> = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const raw = lines[lineIdx];
        const lineNum = lineIdx + 1;
        let clean = '';
        let inString: string | null = null;
        let stringStartCol = 1;

        for (let i = 0; i < raw.length; i++) {
            const c = raw[i];
            const next = raw[i + 1];

            if (blockCommentDepth > 0) {
                if (c === '/' && next === '*') {
                    blockCommentDepth++;
                    i++;
                } else if (c === '*' && next === '/') {
                    blockCommentDepth--;
                    i++;
                }
                continue;
            }

            if (inString) {
                if (c === '~' && i + 1 < raw.length) {
                    i++;
                    continue;
                }
                if (c === inString) {
                    if (next === inString) {
                        i++;
                        continue;
                    }
                    inString = null;
                }
                continue;
            }

            if (c === '/' && next === '/') {
                break;
            }
            if (c === '/' && next === '*') {
                if (blockCommentDepth === 0) blockCommentStartLine = lineNum;
                blockCommentDepth++;
                i++;
                continue;
            }
            if (c === '"' || c === "'") {
                inString = c;
                stringStartCol = i + 1;
                clean += ' ';
                continue;
            }

            if (c === '(' || c === '[') {
                parenStack.push({ ch: c, line: lineNum, col: i + 1 });
            } else if (c === ')' || c === ']') {
                const expected = c === ')' ? '(' : '[';
                const top = parenStack[parenStack.length - 1];
                if (!top || top.ch !== expected) {
                    issues.push({
                        line: lineNum,
                        column: i + 1,
                        severity: 'error',
                        message: `Caractere de fechamento '${c}' inesperado (sem '${expected}' correspondente).`,
                    });
                } else {
                    parenStack.pop();
                }
            }

            clean += c;
        }

        if (inString) {
            issues.push({
                line: lineNum,
                column: stringStartCol,
                severity: 'error',
                message: `String iniciada com ${inString} não foi fechada nesta linha.`,
            });
        }

        const trimmed = clean.trim();
        if (!trimmed || trimmed.startsWith('&') || trimmed.startsWith('{')) continue;

        // Track block openers ending with ':'
        if (trimmed.endsWith(':')) {
            const openerMatch = trimmed.match(
                /^(?:(?:[A-Za-z_][A-Za-z0-9_\-]*\s*:\s*)?(DO|FOR|REPEAT|CASE|PROCEDURE|FUNCTION|METHOD|CONSTRUCTOR|DESTRUCTOR|CLASS|INTERFACE|CATCH|FINALLY)\b|.*\bTHEN\s+DO\b|.*\bELSE\s+DO\b)/i
            );
            if (openerMatch) {
                const kind = (openerMatch[1] ?? 'DO').toUpperCase();
                blockStack.push({ kind, line: lineNum, col: raw.search(/\S/) + 1 });
            }
        }

        // Track END statements
        const endMatch = trimmed.match(/^END(?:\s+(PROCEDURE|FUNCTION|METHOD|CONSTRUCTOR|DESTRUCTOR|CLASS|INTERFACE|CASE|CATCH|FINALLY))?\s*\./i);
        if (endMatch) {
            if (blockStack.length === 0) {
                issues.push({
                    line: lineNum,
                    column: raw.search(/\S/) + 1,
                    severity: 'error',
                    message: `'${trimmed}' sem bloco de abertura correspondente.`,
                });
            } else {
                blockStack.pop();
            }
        }
    }

    if (blockCommentDepth > 0) {
        issues.push({
            line: blockCommentStartLine,
            column: 1,
            severity: 'error',
            message: 'Comentário de bloco /* ... */ não foi fechado até o final do arquivo.',
        });
    }

    for (const unclosed of parenStack) {
        issues.push({
            line: unclosed.line,
            column: unclosed.col,
            severity: 'error',
            message: `'${unclosed.ch}' não foi fechado.`,
        });
    }

    for (const unclosedBlock of blockStack) {
        issues.push({
            line: unclosedBlock.line,
            column: unclosedBlock.col,
            severity: 'error',
            message: `Bloco '${unclosedBlock.kind}' aberto na linha ${unclosedBlock.line} não possui 'END.' correspondente.`,
        });
    }

    return issues;
}
