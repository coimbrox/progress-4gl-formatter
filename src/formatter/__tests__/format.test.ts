import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { formatSource } from '../index';

test('indents nested function/if/do/end blocks', () => {
    const src = [
        'function foo returns char (x as int):',
        'if x = 1',
        'then do:',
        'message "one".',
        'end.',
        'return "".',
        'end function.',
    ].join('\n');
    const expected = [
        'function foo returns char (x as int):',
        '  if x = 1',
        '  then do:',
        '    message "one".',
        '  end.',
        '  return "".',
        'end function.',
        '',
    ].join('\n');
    assert.equal(formatSource(src), expected);
});

test('aligns a run of def var declarations by name column', () => {
    const src = [
        'def var cd-unimed-z like unimed.cd-unimed no-undo.',
        'def var cd-med-prest-z like preserv.cd-prestador no-undo.',
    ].join('\n');
    const out = formatSource(src);
    const lines = out.trimEnd().split('\n');
    const col = (line: string) => line.indexOf('like');
    assert.equal(col(lines[0]), col(lines[1]));
});

test('a blank line breaks a def var alignment group', () => {
    const src = [
        'def var a-short as char no-undo.',
        '',
        'def var a-much-longer-name as char no-undo.',
    ].join('\n');
    const out = formatSource(src);
    assert.equal(out, 'def var a-short as char no-undo.\n\ndef var a-much-longer-name as char no-undo.\n');
});

test('single-clause assign stays on one line', () => {
    assert.equal(formatSource('assign lg-erro-par = yes.'), 'assign lg-erro-par = yes.\n');
});

test('multi-clause assign is split and aligned on the equals sign', () => {
    const src = 'assign dt-anoref-aux = year(today) nr-perref-aux = month(today).';
    const out = formatSource(src);
    const lines = out.trimEnd().split('\n');
    assert.equal(lines[0], 'assign');
    const eqCol = (l: string) => l.indexOf('=');
    assert.equal(eqCol(lines[1]), eqCol(lines[2]));
    assert.ok(lines[2].endsWith('.'));
});

test('find with a multi-condition where clause aligns operators in a column', () => {
    const src = [
        'find imposto',
        '  where imposto.cod_pais = pais-par',
        '  and imposto.cod_unid_federac = uf-par',
        '  no-lock no-error.',
    ].join('\n');
    const out = formatSource(src);
    const lines = out.trimEnd().split('\n');
    assert.equal(lines[0], 'find imposto');
    const eqCol = (l: string) => l.indexOf('=');
    assert.equal(eqCol(lines[1]), eqCol(lines[2]));
    assert.ok(lines[1].trim().startsWith('where'));
    assert.ok(lines[2].trim().startsWith('and'));
    assert.ok(lines[3].includes('no-lock no-error.'));
});

test('if/and condition chain is split with then on its own line', () => {
    const src = 'if index(a, string(b)) = 0 and index(a, string(c)) = 0 then return "".';
    const out = formatSource(src);
    const lines = out.trimEnd().split('\n');
    assert.equal(lines.length, 3);
    assert.ok(lines[0].trim().startsWith('if'));
    assert.ok(lines[1].trim().startsWith('and'));
    assert.equal(lines[2].trim(), 'then return "".');
});

test('formatting is idempotent on a realistic multi-construct snippet', () => {
    const src = [
        'function validaimposto returns char (pais-par as char, uf-par as char):',
        '  find imposto',
        '    where imposto.cod_pais = pais-par',
        '      and imposto.cod_unid_federac = uf-par',
        '          no-lock no-error.',
        '',
        '  if avail imposto',
        '  then return "".',
        '',
        '  return "erro".',
        'end function.',
    ].join('\n');
    const once = formatSource(src);
    const twice = formatSource(once);
    assert.equal(twice, once);
});

test('preserves at most one blank line between statements', () => {
    const src = 'x = 1.\n\n\n\ny = 2.';
    const out = formatSource(src);
    assert.equal(out, 'x = 1.\n\ny = 2.\n');
});

test('a standalone comment keeps its own line at the current indent', () => {
    const src = 'do:\n// note\nx = 1.\nend.';
    const out = formatSource(src);
    assert.equal(out, 'do:\n  // note\n  x = 1.\nend.\n');
});
