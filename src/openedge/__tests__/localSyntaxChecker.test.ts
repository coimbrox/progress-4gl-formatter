import * as assert from 'assert';
import { test } from 'node:test';
import { checkLocalAblSyntax } from '../localSyntaxChecker';

test('checkLocalAblSyntax returns no issues for valid ABL code', () => {
    const valid = `
def var c-nome as char no-undo.
for each customer no-lock:
    if customer.balance > 0 then do:
        message "OK: " + customer.name.
    end.
end.
`;
    assert.deepStrictEqual(checkLocalAblSyntax(valid), []);
});

test('checkLocalAblSyntax catches unclosed strings, comments, parens and blocks', () => {
    const invalid = `
for each customer no-lock:
    assign c-nome = "unclosed string.
    if (customer.balance > 0 then do:
        /* unclosed comment
`;
    const issues = checkLocalAblSyntax(invalid);
    assert.ok(issues.length >= 3, `Expected at least 3 issues, got ${issues.length}`);
    assert.ok(issues.some((i) => i.message.includes('String')));
    assert.ok(issues.some((i) => i.message.includes('Comentário')));
    assert.ok(issues.some((i) => i.message.includes('END.')));
});
