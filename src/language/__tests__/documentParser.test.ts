import * as assert from 'assert';
import { test } from 'node:test';
import { parseAblDocument } from '../documentParser';

test('parseAblDocument extracts variables, parameters, temp-tables, buffers, routines, preprocessors and includes', () => {
    const code = `
{inc/common.i}
&SCOPED-DEFINE MAX-ROWS 100

def input param p-cod as int no-undo.
def var c-nome as char no-undo.

def temp-table tt-cliente no-undo like cliente
    field valor-total as dec
    field ativo as log.

def buffer b-cliente for tt-cliente.

procedure pi-processa:
    /* comment with def var fake as char. */
    message "ok".
end procedure.

function fn-calc returns dec (input p-val as dec):
    return p-val * 2.
end function.

method public char GetName(input pId as int):
    return "".
end method.
`;

    const parsed = parseAblDocument(code);

    assert.strictEqual(parsed.includes.length, 1);
    assert.strictEqual(parsed.includes[0].filePath, 'inc/common.i');

    assert.strictEqual(parsed.preprocessors.length, 1);
    assert.strictEqual(parsed.preprocessors[0].name, 'MAX-ROWS');
    assert.strictEqual(parsed.preprocessors[0].value, '100');

    assert.strictEqual(parsed.variables.length, 2);
    assert.strictEqual(parsed.variables[0].name, 'p-cod');
    assert.strictEqual(parsed.variables[0].kind, 'parameter');
    assert.strictEqual(parsed.variables[1].name, 'c-nome');
    assert.strictEqual(parsed.variables[1].kind, 'variable');

    assert.strictEqual(parsed.tempTables.length, 1);
    assert.strictEqual(parsed.tempTables[0].name, 'tt-cliente');
    assert.strictEqual(parsed.tempTables[0].likeTable, 'cliente');
    assert.deepStrictEqual(
        parsed.tempTables[0].fields.map((f) => f.name),
        ['valor-total', 'ativo']
    );

    assert.strictEqual(parsed.buffers.length, 1);
    assert.strictEqual(parsed.buffers[0].name, 'b-cliente');
    assert.strictEqual(parsed.buffers[0].targetTable, 'tt-cliente');

    assert.strictEqual(parsed.routines.length, 3);
    assert.deepStrictEqual(
        parsed.routines.map((r) => `${r.kind}:${r.name}`),
        ['procedure:pi-processa', 'function:fn-calc', 'method:GetName']
    );
});
