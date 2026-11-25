"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AblFoldingProvider = exports.AblDefinitionProvider = exports.AblHoverProvider = exports.AblCompletionProvider = void 0;
const fs = require("fs");
const vscode = require("vscode");
const keywords_1 = require("../formatter/keywords");
const documentParser_1 = require("./documentParser");
const ABL_WORD_REGEX = /[A-Za-z_][A-Za-z0-9_\-]*/;
const ABL_DOTTED_REGEX = /[A-Za-z_][A-Za-z0-9_\-]*(?:\.[A-Za-z_][A-Za-z0-9_\-]*)?/;
function resolveFieldsForPrefix(prefix, parsed, dictionary) {
    const lower = prefix.toLowerCase();
    // 1. Check buffers first -> redirect to target table/temp-table
    const buf = parsed.buffers.find((b) => b.name.toLowerCase() === lower);
    if (buf) {
        return resolveFieldsForPrefix(buf.targetTable, parsed, dictionary);
    }
    // 2. Check temp-tables
    const tt = parsed.tempTables.find((t) => t.name.toLowerCase() === lower);
    if (tt) {
        const fields = tt.fields.map((f) => ({
            name: f.name,
            dataType: f.dataType,
            detail: `Temp-Table ${tt.name}: ${f.dataType}`,
        }));
        if (tt.likeTable) {
            for (const inherited of dictionary.getFields(tt.likeTable)) {
                if (!fields.some((f) => f.name.toLowerCase() === inherited.name.toLowerCase())) {
                    fields.push({
                        name: inherited.name,
                        dataType: inherited.dataType,
                        detail: `${tt.likeTable}.${inherited.name} (${inherited.dataType})`,
                        documentation: inherited.description || inherited.label,
                    });
                }
            }
        }
        return fields;
    }
    // 3. Check database dictionary tables
    const dbTable = dictionary.getTable(prefix);
    if (dbTable) {
        return dbTable.fields.map((f) => ({
            name: f.name,
            dataType: f.dataType,
            detail: `${dbTable.database}.${dbTable.name}.${f.name} (${f.dataType}${f.format ? ' ' + f.format : ''})`,
            documentation: [f.label ? `Label: ${f.label}` : '', f.description ?? ''].filter(Boolean).join('\n'),
        }));
    }
    return [];
}
class AblCompletionProvider {
    constructor(dictionary, includeResolver) {
        this.dictionary = dictionary;
        this.includeResolver = includeResolver;
    }
    provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position).text.slice(0, position.character);
        // 1. Include file suggestion on typing `{`
        const includeMatch = linePrefix.match(/\{([A-Za-z0-9_./\\-]*)$/);
        if (includeMatch) {
            const includes = this.includeResolver.listIncludeFiles(document.uri.fsPath);
            return includes.map((inc) => {
                const item = new vscode.CompletionItem(inc.relativePath, vscode.CompletionItemKind.File);
                item.detail = 'Include file';
                item.documentation = new vscode.MarkdownString(`\`${inc.fullPath}\``);
                return item;
            });
        }
        const parsed = (0, documentParser_1.parseAblDocument)(document.getText());
        // 2. Field completion after `table.` or `buffer.` or `temp-table.`
        const dotMatch = linePrefix.match(/([A-Za-z_][A-Za-z0-9_\-]*)\.([A-Za-z0-9_\-]*)$/);
        if (dotMatch) {
            const prefix = dotMatch[1];
            const fields = resolveFieldsForPrefix(prefix, parsed, this.dictionary);
            return fields.map((f) => {
                const item = new vscode.CompletionItem(f.name, vscode.CompletionItemKind.Field);
                item.detail = f.detail;
                if (f.documentation) {
                    item.documentation = new vscode.MarkdownString(f.documentation);
                }
                return item;
            });
        }
        // 3. General completion: variables, params, temp-tables, buffers, routines, preprocessors, DB tables, keywords
        const items = [];
        const seen = new Set();
        const add = (item) => {
            const key = `${item.kind}:${typeof item.label === 'string' ? item.label : item.label.label}`.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                items.push(item);
            }
        };
        for (const v of parsed.variables) {
            const item = new vscode.CompletionItem(v.name, vscode.CompletionItemKind.Variable);
            item.detail = v.kind === 'parameter' ? `${v.direction} PARAM (${v.dataType})` : `VAR (${v.dataType})`;
            item.documentation = new vscode.MarkdownString('```abl\n' + v.detail + '\n```');
            add(item);
        }
        for (const tt of parsed.tempTables) {
            const item = new vscode.CompletionItem(tt.name, vscode.CompletionItemKind.Struct);
            item.detail = tt.likeTable ? `TEMP-TABLE LIKE ${tt.likeTable}` : `TEMP-TABLE (${tt.fields.length} campos)`;
            add(item);
        }
        for (const b of parsed.buffers) {
            const item = new vscode.CompletionItem(b.name, vscode.CompletionItemKind.Reference);
            item.detail = `BUFFER FOR ${b.targetTable}`;
            add(item);
        }
        for (const r of parsed.routines) {
            const kind = r.kind === 'method'
                ? vscode.CompletionItemKind.Method
                : vscode.CompletionItemKind.Function;
            const item = new vscode.CompletionItem(r.name, kind);
            item.detail = r.signature;
            add(item);
        }
        for (const p of parsed.preprocessors) {
            const item = new vscode.CompletionItem(`{&${p.name}}`, vscode.CompletionItemKind.Constant);
            item.detail = `&${p.scope.toUpperCase()}-DEFINE ${p.name} = ${p.value}`;
            add(item);
        }
        for (const tbl of this.dictionary.getAllTables()) {
            const item = new vscode.CompletionItem(tbl.name, vscode.CompletionItemKind.Class);
            item.detail = `Table (${tbl.database}) — ${tbl.fields.length} campos`;
            if (tbl.description) {
                item.documentation = new vscode.MarkdownString(tbl.description);
            }
            add(item);
        }
        for (const kw of Object.keys(keywords_1.KEYWORD_CASING)) {
            const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
            item.detail = 'ABL Keyword';
            add(item);
        }
        return items;
    }
}
exports.AblCompletionProvider = AblCompletionProvider;
class AblHoverProvider {
    constructor(dictionary, includeResolver) {
        this.dictionary = dictionary;
        this.includeResolver = includeResolver;
    }
    provideHover(document, position) {
        const lineText = document.lineAt(position).text;
        // 1. Check if hovering over an include {file.i}
        const parsed = (0, documentParser_1.parseAblDocument)(document.getText());
        for (const inc of parsed.includes) {
            if (inc.line === position.line &&
                position.character >= inc.character &&
                position.character <= inc.character + inc.length) {
                const resolved = this.includeResolver.resolveInclude(inc.filePath, document.uri.fsPath);
                const md = new vscode.MarkdownString();
                md.appendMarkdown(`**Include:** \`${inc.filePath}\`\n\n`);
                md.appendMarkdown(resolved ? `Resolvido em: \`${resolved}\`` : '_Arquivo não encontrado no PROPATH atual._');
                return new vscode.Hover(md);
            }
        }
        // 2. Check dotted identifier (table.field or buffer.field)
        const dottedRange = document.getWordRangeAtPosition(position, ABL_DOTTED_REGEX);
        if (dottedRange) {
            const dotted = document.getText(dottedRange);
            if (dotted.includes('.')) {
                const [prefix, fieldName] = dotted.split('.');
                const fields = resolveFieldsForPrefix(prefix, parsed, this.dictionary);
                const field = fields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase());
                if (field) {
                    const md = new vscode.MarkdownString();
                    md.appendCodeblock(`${prefix}.${field.name} AS ${field.dataType}`, 'progress');
                    md.appendMarkdown(`\n${field.detail}`);
                    if (field.documentation)
                        md.appendMarkdown(`\n\n${field.documentation}`);
                    return new vscode.Hover(md, dottedRange);
                }
            }
        }
        // 3. Single word hover
        const wordRange = document.getWordRangeAtPosition(position, ABL_WORD_REGEX);
        if (!wordRange)
            return undefined;
        const word = document.getText(wordRange);
        const lower = word.toLowerCase();
        // Variable / parameter
        const v = parsed.variables.find((x) => x.name.toLowerCase() === lower);
        if (v) {
            const md = new vscode.MarkdownString();
            md.appendCodeblock(v.detail, 'progress');
            md.appendMarkdown(`*${v.kind === 'parameter' ? 'Parâmetro' : 'Variável'}* — Tipo: \`${v.dataType}\``);
            return new vscode.Hover(md, wordRange);
        }
        // Temp-table
        const tt = parsed.tempTables.find((x) => x.name.toLowerCase() === lower);
        if (tt) {
            const md = new vscode.MarkdownString();
            md.appendMarkdown(`**Temp-Table** \`${tt.name}\``);
            if (tt.likeTable)
                md.appendMarkdown(` *(LIKE ${tt.likeTable})*`);
            if (tt.fields.length > 0) {
                const preview = tt.fields
                    .slice(0, 12)
                    .map((f) => `- \`${f.name}\`: ${f.dataType}`)
                    .join('\n');
                md.appendMarkdown(`\n\n${preview}`);
                if (tt.fields.length > 12)
                    md.appendMarkdown(`\n- ... (+${tt.fields.length - 12} campos)`);
            }
            return new vscode.Hover(md, wordRange);
        }
        // Buffer
        const buf = parsed.buffers.find((x) => x.name.toLowerCase() === lower);
        if (buf) {
            const md = new vscode.MarkdownString();
            md.appendCodeblock(`DEFINE BUFFER ${buf.name} FOR ${buf.targetTable}.`, 'progress');
            return new vscode.Hover(md, wordRange);
        }
        // Routine (procedure / function / method)
        const routine = parsed.routines.find((x) => x.name.toLowerCase() === lower);
        if (routine) {
            const md = new vscode.MarkdownString();
            md.appendCodeblock(routine.signature, 'progress');
            return new vscode.Hover(md, wordRange);
        }
        // Preprocessor
        const prep = parsed.preprocessors.find((x) => x.name.toLowerCase() === lower);
        if (prep) {
            const md = new vscode.MarkdownString();
            md.appendCodeblock(`&${prep.scope.toUpperCase()}-DEFINE ${prep.name} ${prep.value}`, 'progress');
            return new vscode.Hover(md, wordRange);
        }
        // Database table
        const dbTable = this.dictionary.getTable(word);
        if (dbTable) {
            const md = new vscode.MarkdownString();
            md.appendMarkdown(`**Tabela** \`${dbTable.database}.${dbTable.name}\` (${dbTable.fields.length} campos)`);
            if (dbTable.description)
                md.appendMarkdown(`\n\n${dbTable.description}`);
            return new vscode.Hover(md, wordRange);
        }
        void lineText;
        return undefined;
    }
}
exports.AblHoverProvider = AblHoverProvider;
class AblDefinitionProvider {
    constructor(includeResolver) {
        this.includeResolver = includeResolver;
    }
    provideDefinition(document, position) {
        const parsed = (0, documentParser_1.parseAblDocument)(document.getText());
        // 1. Ctrl+Click on include file {path/to/file.i}
        for (const inc of parsed.includes) {
            if (inc.line === position.line &&
                position.character >= inc.character &&
                position.character <= inc.character + inc.length) {
                const resolved = this.includeResolver.resolveInclude(inc.filePath, document.uri.fsPath);
                if (resolved) {
                    return new vscode.Location(vscode.Uri.file(resolved), new vscode.Position(0, 0));
                }
            }
        }
        const wordRange = document.getWordRangeAtPosition(position, ABL_WORD_REGEX);
        if (!wordRange)
            return undefined;
        const word = document.getText(wordRange);
        // 2. Search declaration in current document
        const localHit = this.findSymbolInParsed(parsed, word, document.uri);
        if (localHit)
            return localHit;
        // 3. Search declaration in direct included files
        for (const inc of parsed.includes) {
            const resolved = this.includeResolver.resolveInclude(inc.filePath, document.uri.fsPath);
            if (!resolved)
                continue;
            try {
                const incText = fs.readFileSync(resolved, 'utf8');
                const incParsed = (0, documentParser_1.parseAblDocument)(incText);
                const incHit = this.findSymbolInParsed(incParsed, word, vscode.Uri.file(resolved));
                if (incHit)
                    return incHit;
            }
            catch {
                // ignore unreadable include
            }
        }
        return undefined;
    }
    findSymbolInParsed(parsed, word, uri) {
        const lower = word.toLowerCase();
        const v = parsed.variables.find((x) => x.name.toLowerCase() === lower);
        if (v)
            return new vscode.Location(uri, new vscode.Position(v.line, v.character));
        const tt = parsed.tempTables.find((x) => x.name.toLowerCase() === lower);
        if (tt)
            return new vscode.Location(uri, new vscode.Position(tt.line, tt.character));
        for (const t of parsed.tempTables) {
            const f = t.fields.find((x) => x.name.toLowerCase() === lower);
            if (f)
                return new vscode.Location(uri, new vscode.Position(f.line, f.character));
        }
        const buf = parsed.buffers.find((x) => x.name.toLowerCase() === lower);
        if (buf)
            return new vscode.Location(uri, new vscode.Position(buf.line, buf.character));
        const routine = parsed.routines.find((x) => x.name.toLowerCase() === lower);
        if (routine)
            return new vscode.Location(uri, new vscode.Position(routine.line, routine.character));
        const prep = parsed.preprocessors.find((x) => x.name.toLowerCase() === lower);
        if (prep)
            return new vscode.Location(uri, new vscode.Position(prep.line, prep.character));
        return undefined;
    }
}
exports.AblDefinitionProvider = AblDefinitionProvider;
class AblFoldingProvider {
    provideFoldingRanges(document) {
        const ranges = [];
        const regionStack = [];
        const blockStack = [];
        for (let i = 0; i < document.lineCount; i++) {
            const text = document.lineAt(i).text;
            const trimmed = text.trim();
            // //#region and /*#region*/
            if (/^(?:\/\/|\/\*)\s*#?region\b/i.test(trimmed)) {
                regionStack.push(i);
                continue;
            }
            if (/^(?:\/\/|\/\*)\s*#?endregion\b/i.test(trimmed)) {
                const start = regionStack.pop();
                if (start !== undefined && i > start) {
                    ranges.push(new vscode.FoldingRange(start, i, vscode.FoldingRangeKind.Region));
                }
                continue;
            }
            // PROCEDURE / FUNCTION / METHOD / CLASS blocks
            const startBlock = trimmed.match(/^(PROCEDURE|FUNCTION|METHOD|CONSTRUCTOR|DESTRUCTOR|CLASS)\b.*:\s*$/i);
            if (startBlock) {
                blockStack.push({ line: i, kind: startBlock[1].toUpperCase() });
                continue;
            }
            const endBlock = trimmed.match(/^END\s+(PROCEDURE|FUNCTION|METHOD|CONSTRUCTOR|DESTRUCTOR|CLASS)\s*\./i);
            if (endBlock) {
                const kind = endBlock[1].toUpperCase();
                for (let idx = blockStack.length - 1; idx >= 0; idx--) {
                    if (blockStack[idx].kind === kind) {
                        const start = blockStack.splice(idx, 1)[0].line;
                        if (i > start) {
                            ranges.push(new vscode.FoldingRange(start, i));
                        }
                        break;
                    }
                }
            }
        }
        return ranges;
    }
}
exports.AblFoldingProvider = AblFoldingProvider;
//# sourceMappingURL=providers.js.map