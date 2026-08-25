"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const assert = require("node:assert/strict");
const lexer_1 = require("../lexer");
function kinds(src) {
    return (0, lexer_1.tokenize)(src).map(t => t.kind);
}
function texts(src) {
    return (0, lexer_1.tokenize)(src).filter(t => t.kind !== 'eof').map(t => t.text);
}
(0, node_test_1.test)('splits simple assign statement into words, operator and eos', () => {
    const t = (0, lexer_1.tokenize)('x = 1.');
    assert.deepEqual(t.map(x => x.kind), ['word', 'operator', 'number', 'eos', 'eof']);
});
(0, node_test_1.test)('table.field and hyphenated identifiers stay a single word token', () => {
    assert.deepEqual(texts('moviproc.cd-prestador = 1.'), ['moviproc.cd-prestador', '=', '1', '.']);
});
(0, node_test_1.test)('dot followed by whitespace is end-of-statement, not glued to the word', () => {
    assert.deepEqual(texts('run foo.p .'), ['run', 'foo.p', '.']);
});
(0, node_test_1.test)('decimal numbers are not split on the dot', () => {
    assert.deepEqual(texts('x = 3.14.'), ['x', '=', '3.14', '.']);
});
(0, node_test_1.test)('string literals: doubled-quote escape does not end the string', () => {
    const t = (0, lexer_1.tokenize)(`message "it""s fine".`);
    const str = t.find(x => x.kind === 'string');
    assert.equal(str.text, '"it""s fine"');
});
(0, node_test_1.test)('string literals: tilde escapes the following character, including the quote char', () => {
    const t = (0, lexer_1.tokenize)(`message "a~"b".`);
    const str = t.find(x => x.kind === 'string');
    assert.equal(str.text, '"a~"b"');
});
(0, node_test_1.test)('keywords or dots inside a string are never split out as separate tokens', () => {
    const t = (0, lexer_1.tokenize)(`message "DEFINE VARIABLE x.y".`);
    const strTokens = t.filter(x => x.kind === 'string');
    assert.equal(strTokens.length, 1);
    assert.equal(strTokens[0].text, '"DEFINE VARIABLE x.y"');
});
(0, node_test_1.test)('line comments run to end of line and are a single token', () => {
    const t = (0, lexer_1.tokenize)('x = 1. // comment with a . dot\ny = 2.');
    assert.deepEqual(t.map(x => x.kind), ['word', 'operator', 'number', 'eos', 'lineComment', 'word', 'operator', 'number', 'eos', 'eof']);
});
(0, node_test_1.test)('block comments nest', () => {
    const t = (0, lexer_1.tokenize)('/* outer /* inner */ still-in-comment */ x = 1.');
    const bc = t.find(x => x.kind === 'blockComment');
    assert.equal(bc.text, '/* outer /* inner */ still-in-comment */');
});
(0, node_test_1.test)('preprocessor include directives are one opaque token, braces may nest', () => {
    const t = (0, lexer_1.tokenize)('{hdp/hdvarregua.i} run foo.p.');
    assert.equal(t[0].kind, 'preprocessor');
    assert.equal(t[0].text, '{hdp/hdvarregua.i}');
});
(0, node_test_1.test)('preprocessor directive with nested {&VAR} braces', () => {
    const t = (0, lexer_1.tokenize)('{myinclude.i "{&VAR}"}');
    assert.equal(t[0].kind, 'preprocessor');
    assert.equal(t[0].text, '{myinclude.i "{&VAR}"}');
});
(0, node_test_1.test)('multi-char operators are recognized', () => {
    assert.deepEqual(texts('a <> b <= c >= d.'), ['a', '<>', 'b', '<=', 'c', '>=', 'd', '.']);
});
(0, node_test_1.test)('static member access :: is a distinct punct token', () => {
    const t = (0, lexer_1.tokenize)('MyClass::Method().');
    assert.equal(t[1].kind, 'punct');
    assert.equal(t[1].text, '::');
});
(0, node_test_1.test)('blank line tracking: counts blank lines before a token', () => {
    const t = (0, lexer_1.tokenize)('a = 1.\n\n\nb = 2.');
    const bToken = t.find(x => x.kind === 'word' && x.text === 'b');
    assert.equal(bToken.blankLinesBefore, 2);
});
(0, node_test_1.test)('minus operator stays separate from surrounding words when spaced', () => {
    assert.deepEqual(texts('x = a - b.'), ['x', '=', 'a', '-', 'b', '.']);
});
//# sourceMappingURL=lexer.test.js.map