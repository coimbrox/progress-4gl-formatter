"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const node_test_1 = require("node:test");
const localSyntaxChecker_1 = require("../localSyntaxChecker");
(0, node_test_1.test)('checkLocalAblSyntax returns no issues for valid ABL code', () => {
    const valid = `
def var c-nome as char no-undo.
for each customer no-lock:
    if customer.balance > 0 then do:
        message "OK: " + customer.name.
    end.
end.
`;
    assert.deepStrictEqual((0, localSyntaxChecker_1.checkLocalAblSyntax)(valid), []);
});
(0, node_test_1.test)('checkLocalAblSyntax catches unclosed strings, comments, parens and blocks', () => {
    const invalid = `
for each customer no-lock:
    assign c-nome = "unclosed string.
    if (customer.balance > 0 then do:
        /* unclosed comment
`;
    const issues = (0, localSyntaxChecker_1.checkLocalAblSyntax)(invalid);
    assert.ok(issues.length >= 3, `Expected at least 3 issues, got ${issues.length}`);
    assert.ok(issues.some((i) => i.message.includes('String')));
    assert.ok(issues.some((i) => i.message.includes('Comentário')));
    assert.ok(issues.some((i) => i.message.includes('END.')));
});
//# sourceMappingURL=localSyntaxChecker.test.js.map