"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const node_test_1 = require("node:test");
const extraCommands_1 = require("../extraCommands");
(0, node_test_1.test)('transformKeywordCase uppercases ABL keywords while leaving strings and comments untouched', () => {
    const src = [
        'def var c-msg as char no-undo.',
        '/* find first customer no-lock */',
        'assign c-msg = "def var if then else".',
    ].join('\n');
    const upper = (0, extraCommands_1.transformKeywordCase)(src, 'upper');
    assert.strictEqual(upper, [
        'DEF VAR c-msg AS CHAR NO-UNDO.',
        '/* find first customer no-lock */',
        'ASSIGN c-msg = "def var if then else".',
    ].join('\n'));
});
(0, node_test_1.test)('transformKeywordCase lowercases ABL keywords while preserving identifiers and strings', () => {
    const src = 'FIND FIRST customer NO-LOCK WHERE customer.Name = "FIND FIRST" NO-ERROR.';
    const lower = (0, extraCommands_1.transformKeywordCase)(src, 'lower');
    assert.strictEqual(lower, 'find first customer no-lock where customer.Name = "FIND FIRST" no-error.');
});
(0, node_test_1.test)('trimRightLines strips trailing spaces and tabs while keeping newlines intact', () => {
    const src = 'def var a as int no-undo.   \r\n  assign a = 1.\t \nend.   ';
    assert.strictEqual((0, extraCommands_1.trimRightLines)(src), 'def var a as int no-undo.\r\n  assign a = 1.\nend.');
});
//# sourceMappingURL=extraCommands.test.js.map