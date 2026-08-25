import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { tokenize } from '../lexer';
import { renderInline } from '../render';

function render(src: string): string {
    const tokens = tokenize(src).filter(t => t.kind !== 'eof');
    return renderInline(tokens).join('\n');
}

test('keywords are cased to their canonical abbreviation', () => {
    assert.equal(render('DEFINE VARIABLE x AS CHARACTER NO-UNDO.'), 'def var x as char no-undo.');
});

test('comma gets a trailing space but no leading space', () => {
    assert.equal(render('foo(a,b,c).'), 'foo(a, b, c).');
});

test('member-access colon is tight on both sides', () => {
    assert.equal(render('oJsonObject:add("a", "b").'), 'oJsonObject:add("a", "b").');
});

test('function call parens are tight against the identifier', () => {
    assert.equal(render('string(TODAY, "99-99-9999").'), 'string(TODAY, "99-99-9999").');
});

test('a space is inserted between a return type and its parameter list', () => {
    assert.equal(
        render('function foo returns char (a as char):'),
        'function foo returns char (a as char):'
    );
});

test('static member access :: stays tight', () => {
    assert.equal(render('MyClass::DoWork().'), 'MyClass::DoWork().');
});

test('binary operators get a space on both sides', () => {
    assert.equal(render('x=1.'), 'x = 1.');
});

test('unary minus stays glued to its operand', () => {
    assert.equal(render('x = -1.'), 'x = -1.');
});

test('a line comment forces everything after it to a new line', () => {
    const lines = render('assign // note\n  x = 1.').split('\n');
    assert.equal(lines.length, 2);
    assert.match(lines[0], /\/\/ note$/);
    assert.match(lines[1], /^x = 1\.$/);
});

test('strings are passed through untouched, including keyword-looking content', () => {
    assert.equal(render('message "DEFINE VARIABLE".'), 'message "DEFINE VARIABLE".');
});
