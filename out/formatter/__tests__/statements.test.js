"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const assert = require("node:assert/strict");
const lexer_1 = require("../lexer");
const statements_1 = require("../statements");
function statementTexts(src) {
    const chunks = (0, statements_1.groupStatements)((0, lexer_1.tokenize)(src));
    return chunks
        .filter((c) => !(0, statements_1.isTrivia)(c))
        .map(s => s.tokens.map(t => t.text).join(' '));
}
(0, node_test_1.test)('splits two simple statements on the period', () => {
    assert.deepEqual(statementTexts('x = 1. y = 2.'), ['x = 1 .', 'y = 2 .']);
});
(0, node_test_1.test)('period inside parens does not end the statement (function call args)', () => {
    const texts = statementTexts('run foo.p (input a, input b).');
    assert.equal(texts.length, 1);
    assert.match(texts[0], /^run foo\.p \( input a , input b \) \.$/);
});
(0, node_test_1.test)('block-opening colon ends the statement without a period', () => {
    const chunks = (0, statements_1.groupStatements)((0, lexer_1.tokenize)('do:\nmessage "hi".\nend.'));
    const stmts = chunks.filter((c) => !(0, statements_1.isTrivia)(c));
    assert.equal(stmts.length, 3);
    assert.equal(stmts[0].terminator, 'blockColon');
    assert.equal(stmts[0].tokens.map(t => t.text).join(''), 'do:');
    assert.equal(stmts[1].terminator, 'period');
    assert.equal(stmts[2].terminator, 'period');
});
(0, node_test_1.test)('member-access colon (same line) does not end the statement', () => {
    const texts = statementTexts('oJsonObject:add("a", "b").');
    assert.equal(texts.length, 1);
    assert.match(texts[0], /^oJsonObject : add/);
});
(0, node_test_1.test)('standalone comment between statements becomes its own trivia chunk', () => {
    const chunks = (0, statements_1.groupStatements)((0, lexer_1.tokenize)('x = 1.\n// note\ny = 2.'));
    assert.equal(chunks.length, 3);
    assert.ok((0, statements_1.isTrivia)(chunks[1]));
});
(0, node_test_1.test)('comment mid-statement stays embedded in the statement tokens', () => {
    const chunks = (0, statements_1.groupStatements)((0, lexer_1.tokenize)('find x\n  // note\n  where y = 1 no-lock.'));
    const stmts = chunks.filter((c) => !(0, statements_1.isTrivia)(c));
    assert.equal(stmts.length, 1);
    assert.ok(stmts[0].tokens.some(t => t.kind === 'lineComment'));
});
(0, node_test_1.test)('preserves blank-lines-before count on statements', () => {
    const chunks = (0, statements_1.groupStatements)((0, lexer_1.tokenize)('x = 1.\n\n\ny = 2.'));
    const stmts = chunks.filter((c) => !(0, statements_1.isTrivia)(c));
    assert.equal(stmts[1].blankLinesBefore, 2);
});
(0, node_test_1.test)('for each ... : with where clause is one blockColon statement', () => {
    const chunks = (0, statements_1.groupStatements)((0, lexer_1.tokenize)('for each customer where customer.balance > 0 no-lock:\nend.'));
    const stmts = chunks.filter((c) => !(0, statements_1.isTrivia)(c));
    assert.equal(stmts[0].terminator, 'blockColon');
});
//# sourceMappingURL=statements.test.js.map