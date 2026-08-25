import { Token } from './tokens';

/**
 * depth[i] = nesting level of tokens[i] relative to the start of the slice.
 * An opening `(`/`[` is recorded at the depth it lives in (before
 * incrementing); its matching close is recorded at that same depth (after
 * decrementing) — so a top-level parenthesised group has depth 0 on both
 * its parens and depth >= 1 strictly inside it.
 */
export function computeDepths(tokens: Token[]): number[] {
    const depths: number[] = new Array(tokens.length);
    let depth = 0;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.kind === 'punct' && (t.text === '(' || t.text === '[')) {
            depths[i] = depth;
            depth++;
        } else if (t.kind === 'punct' && (t.text === ')' || t.text === ']')) {
            depth = Math.max(0, depth - 1);
            depths[i] = depth;
        } else {
            depths[i] = depth;
        }
    }
    return depths;
}
