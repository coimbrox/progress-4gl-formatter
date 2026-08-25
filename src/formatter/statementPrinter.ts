import { Token } from './tokens';
import { Statement } from './statements';
import { canonicalKeyword, isKeyword } from './keywords';
import { renderInline } from './render';
import { computeDepths } from './depth';

const COMPARISON_OPS = ['<>', '<=', '>=', '=', '<', '>'];
const COMPARISON_OP_WORDS = new Set(['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'matches']);
const CONDITION_LOGICAL_KEYWORDS = new Set(['where', 'and', 'or']);
const IF_LOGICAL_KEYWORDS = new Set(['if', 'and', 'or']);
const TRAILING_MODIFIER_KEYWORDS = new Set([
    'no-lock', 'no-error', 'exclusive-lock', 'share-lock', 'no-wait', 'no-prefetch',
    'by', 'break', 'transaction', 'use-index', 'indexed-reposition',
]);
export const DEF_SIMPLE_KINDS = new Set(['var', 'param', 'buffer', 'stream']);
const DEF_MODIFIER_WORDS = new Set(['new', 'global', 'shared', 'input', 'output', 'input-output', 'static']);

function ind(level: number, size: number): string {
    return ' '.repeat(Math.max(0, level) * size);
}

function canon(tok: Token | undefined): string {
    return tok && tok.kind === 'word' && isKeyword(tok.text) ? canonicalKeyword(tok.text) : '';
}

interface ParsedClause {
    kw: string;
    lhs: string;
    op: string;
    rhs: string;
}

function findComparisonOpIndex(body: Token[]): number {
    const depths = computeDepths(body);
    for (let i = 0; i < body.length; i++) {
        if (depths[i] !== 0) continue;
        if (body[i].kind === 'operator' && COMPARISON_OPS.includes(body[i].text)) return i;
        if (body[i].kind === 'word' && COMPARISON_OP_WORDS.has(canon(body[i]))) return i;
    }
    return -1;
}

function parseClause(clauseTokens: Token[]): ParsedClause {
    const kw = canon(clauseTokens[0]);
    const body = clauseTokens.slice(1);
    const opIdx = findComparisonOpIndex(body);
    if (opIdx === -1) {
        return { kw, lhs: renderInline(body).join(' '), op: '', rhs: '' };
    }
    const opTok = body[opIdx];
    return {
        kw,
        lhs: renderInline(body.slice(0, opIdx)).join(' '),
        op: opTok.kind === 'word' ? canonicalKeyword(opTok.text) : opTok.text,
        rhs: renderInline(body.slice(opIdx + 1)).join(' '),
    };
}

function renderAlignedClauses(parsed: ParsedClause[]): string[] {
    const maxKwWidth = Math.max(...parsed.map(p => p.kw.length));
    const maxLhsWidth = Math.max(0, ...parsed.filter(p => p.op).map(p => p.lhs.length));
    return parsed.map(p => {
        const kwPadded = p.kw.padEnd(maxKwWidth);
        const text = p.op ? `${kwPadded} ${p.lhs.padEnd(maxLhsWidth)} ${p.op} ${p.rhs}` : `${kwPadded} ${p.lhs}`;
        return text.trimEnd();
    });
}

function formatGeneric(tokens: Token[], indentLevel: number, indentSize: number, terminatorText: string): string[] {
    const lines = renderInline(tokens);
    if (lines.length === 0) return [ind(indentLevel, indentSize) + terminatorText];
    return lines.map((l, i) => ind(indentLevel, indentSize) + l + (i === lines.length - 1 ? terminatorText : ''));
}

function formatAssign(tokens: Token[], indentLevel: number, indentSize: number, terminatorText: string): string[] {
    const rest = tokens.slice(1); // drop 'assign'
    const depths = computeDepths(rest);
    const eqPositions: number[] = [];
    for (let i = 0; i < rest.length; i++) {
        if (depths[i] === 0 && rest[i].kind === 'operator' && rest[i].text === '=') eqPositions.push(i);
    }
    if (eqPositions.length === 0) {
        return formatGeneric(tokens, indentLevel, indentSize, terminatorText);
    }

    const clauseStarts: number[] = eqPositions.map(eqPos => {
        let idx = eqPos - 1;
        while (idx >= 0) {
            const t = rest[idx];
            if (t.kind === 'word') { idx--; continue; }
            if (t.kind === 'punct' && t.text === ':' && idx > 0 && rest[idx - 1].kind === 'word') { idx--; continue; }
            break;
        }
        return idx + 1;
    });

    const clauses = eqPositions.map((eqPos, k) => {
        const start = clauseStarts[k];
        const end = k + 1 < clauseStarts.length ? clauseStarts[k + 1] : rest.length;
        return {
            lhs: renderInline(rest.slice(start, eqPos)).join(' '),
            rhs: renderInline(rest.slice(eqPos + 1, end)).join(' '),
        };
    });

    if (clauses.length === 1) {
        const line = `assign ${clauses[0].lhs} = ${clauses[0].rhs}`;
        return [ind(indentLevel, indentSize) + line + terminatorText];
    }

    const maxLhs = Math.max(...clauses.map(c => c.lhs.length));
    const lines = [ind(indentLevel, indentSize) + 'assign'];
    clauses.forEach((c, i) => {
        const isLast = i === clauses.length - 1;
        const text = `${c.lhs.padEnd(maxLhs)} = ${c.rhs}`;
        lines.push(ind(indentLevel + 1, indentSize) + text + (isLast ? terminatorText : ''));
    });
    return lines;
}

export interface DefHeader {
    prefixTokens: Token[];
    kind: string;
    nameTok: Token;
    restTokens: Token[];
}

export function parseDefHeader(content: Token[]): DefHeader | null {
    let i = 1; // skip 'def'
    while (i < content.length && content[i].kind === 'word' && DEF_MODIFIER_WORDS.has(canon(content[i]))) {
        i++;
    }
    const kindTok = content[i];
    const kind = canon(kindTok);
    if (!kindTok || !(DEF_SIMPLE_KINDS.has(kind) || kind === 'temp-table')) return null;
    i++;
    const prefixTokens = content.slice(0, i);
    const nameTok = content[i];
    if (!nameTok) return null;
    return { prefixTokens, kind, nameTok, restTokens: content.slice(i + 1) };
}

function formatDefTempTable(
    prefixTokens: Token[], nameTok: Token, rest: Token[], indentLevel: number, indentSize: number, terminatorText: string
): string[] {
    const header = renderInline(prefixTokens).join(' ') + ' ' + nameTok.text;
    const depths = computeDepths(rest);
    const starts: number[] = [];
    for (let i = 0; i < rest.length; i++) {
        if (depths[i] === 0 && rest[i].kind === 'word' && (canon(rest[i]) === 'field' || canon(rest[i]) === 'index')) {
            starts.push(i);
        }
    }
    if (starts.length === 0) {
        const restText = renderInline(rest).join(' ');
        const line = restText ? `${header} ${restText}` : header;
        return [ind(indentLevel, indentSize) + line + terminatorText];
    }

    const clauses = starts.map((s, idx) => rest.slice(s, idx + 1 < starts.length ? starts[idx + 1] : rest.length));
    const fieldNameLengths = clauses
        .filter(c => canon(c[0]) === 'field' && c[1])
        .map(c => c[1].text.length);
    const padWidth = fieldNameLengths.length ? Math.max(...fieldNameLengths) : 0;

    const lines = [ind(indentLevel, indentSize) + header];
    clauses.forEach((c, idx) => {
        const isLast = idx === clauses.length - 1;
        const kw = canon(c[0]);
        let text: string;
        if (kw === 'field' && c.length > 1) {
            const fieldName = c[1].text;
            const restOfClause = renderInline(c.slice(2)).join(' ');
            text = `field ${fieldName.padEnd(padWidth)} ${restOfClause}`.trimEnd();
        } else {
            text = renderInline(c).join(' ');
        }
        lines.push(ind(indentLevel + 1, indentSize) + text + (isLast ? terminatorText : ''));
    });
    return lines;
}

function formatDef(
    content: Token[], indentLevel: number, indentSize: number, terminatorText: string, groupPadWidth?: number
): string[] {
    const header = parseDefHeader(content);
    if (!header) return formatGeneric(content, indentLevel, indentSize, terminatorText);
    const { prefixTokens, kind, nameTok, restTokens } = header;

    if (kind === 'temp-table') {
        return formatDefTempTable(prefixTokens, nameTok, restTokens, indentLevel, indentSize, terminatorText);
    }

    const prefixText = renderInline(prefixTokens).join(' ');
    const nameText = nameTok.text;
    const restText = renderInline(restTokens).join(' ');
    const namePadded = restText ? nameText.padEnd(groupPadWidth ?? nameText.length) : nameText;
    const line = restText ? `${prefixText} ${namePadded} ${restText}` : `${prefixText} ${namePadded}`;
    return [ind(indentLevel, indentSize) + line.trimEnd() + terminatorText];
}

function formatFindOrForEach(content: Token[], indentLevel: number, indentSize: number, terminatorText: string): string[] {
    const depths = computeDepths(content);
    let whereIdx = -1;
    for (let i = 0; i < content.length; i++) {
        if (depths[i] === 0 && content[i].kind === 'word' && canon(content[i]) === 'where') { whereIdx = i; break; }
    }
    if (whereIdx === -1) {
        const text = renderInline(content).join(' ');
        return [ind(indentLevel, indentSize) + text + terminatorText];
    }

    const headerText = renderInline(content.slice(0, whereIdx)).join(' ');

    let trailingStart = content.length;
    const clauseKeywordPositions: number[] = [];
    for (let i = whereIdx; i < content.length; i++) {
        if (depths[i] !== 0 || content[i].kind !== 'word') continue;
        const kw = canon(content[i]);
        if (CONDITION_LOGICAL_KEYWORDS.has(kw)) { clauseKeywordPositions.push(i); continue; }
        if (TRAILING_MODIFIER_KEYWORDS.has(kw)) { trailingStart = i; break; }
    }

    const clauses = clauseKeywordPositions.map((pos, idx) => {
        const end = idx + 1 < clauseKeywordPositions.length ? clauseKeywordPositions[idx + 1] : trailingStart;
        return content.slice(pos, end);
    });
    const trailingTokens = content.slice(trailingStart);
    const parsed = clauses.map(parseClause);
    const alignedLines = renderAlignedClauses(parsed);

    const lines = [ind(indentLevel, indentSize) + headerText];
    const conditionIndent = ind(indentLevel + 1, indentSize);
    alignedLines.forEach((text, idx) => {
        const isLastOverall = idx === alignedLines.length - 1 && trailingTokens.length === 0;
        lines.push(conditionIndent + text + (isLastOverall ? terminatorText : ''));
    });
    if (trailingTokens.length > 0) {
        const trailingText = renderInline(trailingTokens).join(' ');
        lines.push(ind(indentLevel + 2, indentSize) + trailingText + terminatorText);
    }
    return lines;
}

function formatIf(content: Token[], indentLevel: number, indentSize: number, terminatorText: string): string[] {
    const depths = computeDepths(content);
    let thenIdx = -1;
    for (let i = 0; i < content.length; i++) {
        if (depths[i] === 0 && content[i].kind === 'word' && canon(content[i]) === 'then') { thenIdx = i; break; }
    }
    if (thenIdx === -1) {
        return [ind(indentLevel, indentSize) + renderInline(content).join(' ') + terminatorText];
    }

    const condTokens = content.slice(0, thenIdx);
    const actionTokens = content.slice(thenIdx + 1);
    const condDepths = computeDepths(condTokens);
    const positions: number[] = [];
    for (let i = 0; i < condTokens.length; i++) {
        if (condDepths[i] === 0 && condTokens[i].kind === 'word' && IF_LOGICAL_KEYWORDS.has(canon(condTokens[i]))) {
            positions.push(i);
        }
    }
    if (positions.length === 0 || positions[0] !== 0) {
        return [ind(indentLevel, indentSize) + renderInline(content).join(' ') + terminatorText];
    }

    const clauses = positions.map((pos, idx) => condTokens.slice(pos, idx + 1 < positions.length ? positions[idx + 1] : condTokens.length));
    const parsed = clauses.map(parseClause);
    const alignedLines = renderAlignedClauses(parsed);

    const lines = alignedLines.map(text => ind(indentLevel, indentSize) + text);
    const actionText = renderInline(actionTokens).join(' ');
    const thenLine = actionText ? `then ${actionText}` : 'then';
    lines.push(ind(indentLevel, indentSize) + thenLine + terminatorText);
    return lines;
}

export function formatStatement(stmt: Statement, indentLevel: number, indentSize: number, defPadWidth?: number): string[] {
    const terminatorTok = stmt.tokens[stmt.tokens.length - 1];
    const terminatorText = terminatorTok.text;
    const content = stmt.tokens.slice(0, -1);
    if (content.length === 0) return [ind(indentLevel, indentSize) + terminatorText];

    const firstKw = canon(content[0]);

    if (firstKw === 'assign') return formatAssign(content, indentLevel, indentSize, terminatorText);
    if (firstKw === 'def') return formatDef(content, indentLevel, indentSize, terminatorText, defPadWidth);
    if (firstKw === 'find') return formatFindOrForEach(content, indentLevel, indentSize, terminatorText);
    if (firstKw === 'for' && ['each', 'first', 'last', 'first-of', 'last-of'].includes(canon(content[1]))) {
        return formatFindOrForEach(content, indentLevel, indentSize, terminatorText);
    }
    if (firstKw === 'if') return formatIf(content, indentLevel, indentSize, terminatorText);

    return formatGeneric(content, indentLevel, indentSize, terminatorText);
}
