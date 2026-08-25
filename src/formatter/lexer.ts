import { Token, TokenKind } from './tokens';

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';
const isWordStart = (c: string | undefined) => c !== undefined && /[A-Za-z_&]/.test(c);
const isWordChar = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_]/.test(c);

/**
 * Tokenizes Progress 4GL / OpenEdge ABL source into a flat stream.
 *
 * Deliberately not a full grammar: strings, comments and preprocessor blocks
 * are lexed precisely (so formatting never mutates their contents), while
 * `table.field` / `no-lock` style dotted-or-hyphenated names are folded into
 * a single 'word' token. A standalone '.' (not glued to word chars on both
 * sides, and not a numeric decimal point) becomes an 'eos' token — that is
 * the statement terminator the rest of the formatter keys off of.
 */
export function tokenize(source: string): Token[] {
    const tokens: Token[] = [];
    const len = source.length;
    let i = 0;
    let line = 1;
    let col = 1;
    let pendingNewlines = 0;

    const peek = (offset = 0) => source[i + offset];

    const advance = (n = 1) => {
        for (let k = 0; k < n; k++) {
            if (source[i] === '\n') {
                line++;
                col = 1;
                pendingNewlines++;
            } else {
                col++;
            }
            i++;
        }
    };

    const push = (kind: TokenKind, text: string, startLine: number, startCol: number) => {
        tokens.push({
            kind,
            text,
            blankLinesBefore: Math.max(0, pendingNewlines - 1),
            precededByNewline: pendingNewlines > 0,
            line: startLine,
            col: startCol,
        });
        pendingNewlines = 0;
    };

    while (i < len) {
        const c = peek();

        // whitespace (not newline-significant beyond blank-line counting)
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
            advance();
            continue;
        }

        const startLine = line;
        const startCol = col;

        // line comment
        if (c === '/' && peek(1) === '/') {
            let j = i;
            while (j < len && source[j] !== '\n') j++;
            const text = source.slice(i, j);
            advance(j - i);
            push('lineComment', text, startLine, startCol);
            continue;
        }

        // block comment (nested)
        if (c === '/' && peek(1) === '*') {
            let depth = 0;
            let j = i;
            while (j < len) {
                if (source[j] === '/' && source[j + 1] === '*') {
                    depth++;
                    j += 2;
                    continue;
                }
                if (source[j] === '*' && source[j + 1] === '/') {
                    depth--;
                    j += 2;
                    if (depth === 0) break;
                    continue;
                }
                j++;
            }
            const text = source.slice(i, j);
            advance(j - i);
            push('blockComment', text, startLine, startCol);
            continue;
        }

        // preprocessor / include directive: { ... } (brace-nested)
        if (c === '{') {
            let depth = 0;
            let j = i;
            while (j < len) {
                if (source[j] === '{') depth++;
                else if (source[j] === '}') {
                    depth--;
                    if (depth === 0) {
                        j++;
                        break;
                    }
                }
                j++;
            }
            const text = source.slice(i, j);
            advance(j - i);
            push('preprocessor', text, startLine, startCol);
            continue;
        }

        // string literal
        if (c === '"' || c === "'") {
            const quote = c;
            let j = i + 1;
            while (j < len) {
                if (source[j] === '~') {
                    j += 2; // escape: skip next char too
                    continue;
                }
                if (source[j] === quote) {
                    if (source[j + 1] === quote) {
                        j += 2; // doubled-quote escape
                        continue;
                    }
                    j++;
                    break;
                }
                j++;
            }
            const text = source.slice(i, j);
            advance(j - i);
            push('string', text, startLine, startCol);
            continue;
        }

        // number: digits, optional single decimal point
        if (isDigit(c) || (c === '.' && isDigit(peek(1)))) {
            let j = i;
            let sawDot = false;
            while (j < len) {
                if (isDigit(source[j])) {
                    j++;
                } else if (source[j] === '.' && !sawDot && isDigit(source[j + 1])) {
                    sawDot = true;
                    j++;
                } else {
                    break;
                }
            }
            const text = source.slice(i, j);
            advance(j - i);
            push('number', text, startLine, startCol);
            continue;
        }

        // word: identifier/keyword, folding in internal '-' and '.' when glued to word chars
        if (isWordStart(c)) {
            let j = i + 1;
            while (j < len) {
                if (isWordChar(source[j])) {
                    j++;
                } else if ((source[j] === '-' || source[j] === '.') && isWordChar(source[j + 1])) {
                    j++;
                } else {
                    break;
                }
            }
            const text = source.slice(i, j);
            advance(j - i);
            push('word', text, startLine, startCol);
            continue;
        }

        // standalone '.' not part of a number/word => end of statement
        if (c === '.') {
            advance();
            push('eos', '.', startLine, startCol);
            continue;
        }

        // multi-char operators
        const two = c + (peek(1) ?? '');
        if (two === '<>' || two === '<=' || two === '>=' || two === '::') {
            advance(2);
            push(two === '::' ? 'punct' : 'operator', two, startLine, startCol);
            continue;
        }

        if ('=<>+*/'.includes(c)) {
            advance();
            push('operator', c, startLine, startCol);
            continue;
        }
        // '-' is only an operator here; as part of a word it was already consumed above
        if (c === '-') {
            advance();
            push('operator', c, startLine, startCol);
            continue;
        }

        if ('(),[]:'.includes(c)) {
            advance();
            push('punct', c, startLine, startCol);
            continue;
        }

        // unknown char: emit as its own punct token rather than crash
        advance();
        push('punct', c, startLine, startCol);
    }

    tokens.push({
        kind: 'eof',
        text: '',
        blankLinesBefore: Math.max(0, pendingNewlines - 1),
        precededByNewline: pendingNewlines > 0,
        line,
        col,
    });
    return tokens;
}
