import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { tokenize } from '../lexer';
import { groupStatements, isTrivia, Statement } from '../statements';

function statementTexts(src: string): string[] {
    const chunks = groupStatements(tokenize(src));
    return chunks
        .filter((c): c is Statement => !isTrivia(c))
        .map(s => s.tokens.map(t => t.text).join(' '));
}

test('splits two simple statements on the period', () => {
    assert.deepEqual(statementTexts('x = 1. y = 2.'), ['x = 1 .', 'y = 2 .']);
});

test('period inside parens does not end the statement (function call args)', () => {
    const texts = statementTexts('run foo.p (input a, input b).');
    assert.equal(texts.length, 1);
    assert.match(texts[0], /^run foo\.p \( input a , input b \) \.$/);
});

test('block-opening colon ends the statement without a period', () => {
    const chunks = groupStatements(tokenize('do:\nmessage "hi".\nend.'));
    const stmts = chunks.filter((c): c is Statement => !isTrivia(c));
    assert.equal(stmts.length, 3);
    assert.equal(stmts[0].terminator, 'blockColon');
    assert.equal(stmts[0].tokens.map(t => t.text).join(''), 'do:');
    assert.equal(stmts[1].terminator, 'period');
    assert.equal(stmts[2].terminator, 'period');
});

test('member-access colon (same line) does not end the statement', () => {
    const texts = statementTexts('oJsonObject:add("a", "b").');
    assert.equal(texts.length, 1);
    assert.match(texts[0], /^oJsonObject : add/);
});

test('standalone comment between statements becomes its own trivia chunk', () => {
    const chunks = groupStatements(tokenize('x = 1.\n// note\ny = 2.'));
    assert.equal(chunks.length, 3);
    assert.ok(isTrivia(chunks[1]));
});

test('comment mid-statement stays embedded in the statement tokens', () => {
    const chunks = groupStatements(tokenize('find x\n  // note\n  where y = 1 no-lock.'));
    const stmts = chunks.filter((c): c is Statement => !isTrivia(c));
    assert.equal(stmts.length, 1);
    assert.ok(stmts[0].tokens.some(t => t.kind === 'lineComment'));
});

test('preserves blank-lines-before count on statements', () => {
    const chunks = groupStatements(tokenize('x = 1.\n\n\ny = 2.'));
    const stmts = chunks.filter((c): c is Statement => !isTrivia(c));
    assert.equal(stmts[1].blankLinesBefore, 2);
});

test('for each ... : with where clause is one blockColon statement', () => {
    const chunks = groupStatements(tokenize('for each customer where customer.balance > 0 no-lock:\nend.'));
    const stmts = chunks.filter((c): c is Statement => !isTrivia(c));
    assert.equal(stmts[0].terminator, 'blockColon');
});
