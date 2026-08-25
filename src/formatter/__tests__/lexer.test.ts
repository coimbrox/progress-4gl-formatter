import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { tokenize } from '../lexer';

function kinds(src: string) {
    return tokenize(src).map(t => t.kind);
}
function texts(src: string) {
    return tokenize(src).filter(t => t.kind !== 'eof').map(t => t.text);
}

test('splits simple assign statement into words, operator and eos', () => {
    const t = tokenize('x = 1.');
    assert.deepEqual(t.map(x => x.kind), ['word', 'operator', 'number', 'eos', 'eof']);
});

test('table.field and hyphenated identifiers stay a single word token', () => {
    assert.deepEqual(texts('moviproc.cd-prestador = 1.'), ['moviproc.cd-prestador', '=', '1', '.']);
});

test('dot followed by whitespace is end-of-statement, not glued to the word', () => {
    assert.deepEqual(texts('run foo.p .'), ['run', 'foo.p', '.']);
});

test('decimal numbers are not split on the dot', () => {
    assert.deepEqual(texts('x = 3.14.'), ['x', '=', '3.14', '.']);
});

test('string literals: doubled-quote escape does not end the string', () => {
    const t = tokenize(`message "it""s fine".`);
    const str = t.find(x => x.kind === 'string')!;
    assert.equal(str.text, '"it""s fine"');
});

test('string literals: tilde escapes the following character, including the quote char', () => {
    const t = tokenize(`message "a~"b".`);
    const str = t.find(x => x.kind === 'string')!;
    assert.equal(str.text, '"a~"b"');
});

test('keywords or dots inside a string are never split out as separate tokens', () => {
    const t = tokenize(`message "DEFINE VARIABLE x.y".`);
    const strTokens = t.filter(x => x.kind === 'string');
    assert.equal(strTokens.length, 1);
    assert.equal(strTokens[0].text, '"DEFINE VARIABLE x.y"');
});

test('line comments run to end of line and are a single token', () => {
    const t = tokenize('x = 1. // comment with a . dot\ny = 2.');
    assert.deepEqual(t.map(x => x.kind), ['word', 'operator', 'number', 'eos', 'lineComment', 'word', 'operator', 'number', 'eos', 'eof']);
});

test('block comments nest', () => {
    const t = tokenize('/* outer /* inner */ still-in-comment */ x = 1.');
    const bc = t.find(x => x.kind === 'blockComment')!;
    assert.equal(bc.text, '/* outer /* inner */ still-in-comment */');
});

test('preprocessor include directives are one opaque token, braces may nest', () => {
    const t = tokenize('{hdp/hdvarregua.i} run foo.p.');
    assert.equal(t[0].kind, 'preprocessor');
    assert.equal(t[0].text, '{hdp/hdvarregua.i}');
});

test('preprocessor directive with nested {&VAR} braces', () => {
    const t = tokenize('{myinclude.i "{&VAR}"}');
    assert.equal(t[0].kind, 'preprocessor');
    assert.equal(t[0].text, '{myinclude.i "{&VAR}"}');
});

test('multi-char operators are recognized', () => {
    assert.deepEqual(texts('a <> b <= c >= d.'), ['a', '<>', 'b', '<=', 'c', '>=', 'd', '.']);
});

test('static member access :: is a distinct punct token', () => {
    const t = tokenize('MyClass::Method().');
    assert.equal(t[1].kind, 'punct');
    assert.equal(t[1].text, '::');
});

test('blank line tracking: counts blank lines before a token', () => {
    const t = tokenize('a = 1.\n\n\nb = 2.');
    const bToken = t.find(x => x.kind === 'word' && x.text === 'b')!;
    assert.equal(bToken.blankLinesBefore, 2);
});

test('minus operator stays separate from surrounding words when spaced', () => {
    assert.deepEqual(texts('x = a - b.'), ['x', '=', 'a', '-', 'b', '.']);
});
