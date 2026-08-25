"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KEYWORD_CASING = void 0;
exports.isKeyword = isKeyword;
exports.canonicalKeyword = canonicalKeyword;
/**
 * Canonical casing for ABL keywords: lowercase, using the abbreviated form
 * that Mateus Hahn's code consistently uses (def, var, param, no-lock, ...).
 * Keys are matched case-insensitively against a token's text.
 */
exports.KEYWORD_CASING = {
    'define': 'def', 'def': 'def',
    'variable': 'var', 'var': 'var',
    'parameter': 'param', 'param': 'param',
    'global': 'global', 'shared': 'shared', 'input-output': 'input-output',
    'character': 'char', 'char': 'char',
    'integer': 'int', 'int': 'int',
    'logical': 'log', 'log': 'log',
    'decimal': 'dec', 'dec': 'dec',
    'temp-table': 'temp-table',
    'view-as': 'view-as',
    'no-undo': 'no-undo',
    'no-lock': 'no-lock',
    'no-error': 'no-error',
    'exclusive-lock': 'exclusive-lock',
    'share-lock': 'share-lock',
    'available': 'avail',
    'avail': 'avail',
    'can-find': 'can-find',
    'add': 'add', 'accumulate': 'accumulate', 'add-last': 'add-last', 'and': 'and',
    'as': 'as', 'assign': 'assign', 'begin-profiler': 'begin-profiler', 'buffer': 'buffer',
    'by': 'by', 'by-reference': 'by-reference', 'call': 'call', 'case': 'case',
    'catch': 'catch', 'class': 'class', 'colon': 'colon', 'combo-box': 'combo-box',
    'commit': 'commit', 'copy-dataset': 'copy-dataset', 'copy-file': 'copy-file',
    'create': 'create', 'data-source': 'data-source', 'data-server': 'data-server',
    'database': 'database', 'dataset': 'dataset', 'datetime': 'datetime',
    'decode': 'decode', 'delete': 'delete', 'dialog-box': 'dialog-box', 'disable': 'disable',
    'display': 'display', 'disk-space': 'disk-space', 'do': 'do', 'dynamic': 'dynamic',
    'each': 'each', 'else': 'else', 'enable': 'enable', 'end': 'end', 'entry': 'entry',
    'exists': 'exists', 'export': 'export', 'extent': 'extent', 'field': 'field', 'file-info': 'file-info',
    'filter': 'filter', 'finally': 'finally', 'find': 'find', 'first': 'first',
    'first-of': 'first-of', 'for': 'for', 'form': 'form', 'frame': 'frame',
    'function': 'function', 'get-byte': 'get-byte', 'get-key-value': 'get-key-value', 'go': 'go',
    'handle': 'handle', 'hidden': 'hidden', 'hide': 'hide', 'if': 'if', 'image': 'image',
    'index': 'index', 'initial': 'initial', 'input': 'input',
    'insert': 'insert', 'is': 'is', 'join': 'join', 'last': 'last', 'last-of': 'last-of',
    'leave': 'leave', 'like': 'like', 'log-manager': 'log-manager', 'lookup': 'lookup',
    'menu': 'menu', 'message': 'message', 'method': 'method', 'move': 'move',
    'new': 'new', 'next': 'next', 'no-pause': 'no-pause', 'not': 'not', 'num-entries': 'num-entries',
    'object': 'object', 'of': 'of', 'on': 'on', 'open': 'open', 'or': 'or',
    'output': 'output', 'overlay': 'overlay', 'pause': 'pause',
    'percent': 'percent', 'preprocess': 'preprocess', 'printer': 'printer', 'private': 'private',
    'procedure': 'procedure', 'proc-text': 'proc-text', 'progress': 'progress', 'prompt-for': 'prompt-for',
    'protected': 'protected', 'public': 'public', 'query': 'query', 'radio-button': 'radio-button',
    'recid': 'recid', 'repeat': 'repeat', 'reposition': 'reposition', 'return': 'return',
    'row-fetch': 'row-fetch', 'run': 'run', 'schema': 'schema', 'screen': 'screen',
    'search': 'search', 'seek': 'seek', 'self': 'self', 'session': 'session', 'set': 'set',
    'share': 'share', 'skip': 'skip', 'smallint': 'smallint', 'sort': 'sort', 'static': 'static',
    'stream': 'stream', 'substitute': 'substitute', 'super': 'super',
    'system-dialogs': 'system-dialogs', 'table': 'table', 'text': 'text', 'then': 'then',
    'this-object': 'this-object', 'throws': 'throws', 'to': 'to', 'top-only': 'top-only',
    'trail': 'trail', 'transaction': 'transaction', 'trigger': 'trigger', 'truncate': 'truncate',
    'undo': 'undo', 'unknown': 'unknown', 'unload': 'unload', 'update': 'update', 'use': 'use',
    'using': 'using', 'validate': 'validate', 'view': 'view', 'void': 'void',
    'wait-for': 'wait-for', 'when': 'when', 'where': 'where', 'while': 'while',
    'widget': 'widget', 'window': 'window', 'with': 'with', 'xml-node': 'xml-node',
    'xref': 'xref', 'yes': 'yes', 'no': 'no', 'zero': 'zero',
};
function isKeyword(text) {
    return Object.prototype.hasOwnProperty.call(exports.KEYWORD_CASING, text.toLowerCase());
}
function canonicalKeyword(text) {
    return exports.KEYWORD_CASING[text.toLowerCase()] ?? text.toLowerCase();
}
//# sourceMappingURL=keywords.js.map