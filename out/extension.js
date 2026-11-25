"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const configManager_1 = require("./config/configManager");
const configWebview_1 = require("./config/configWebview");
const formatter_1 = require("./formatter");
const extraCommands_1 = require("./formatter/extraCommands");
const dictionaryService_1 = require("./language/dictionaryService");
const includeResolver_1 = require("./language/includeResolver");
const providers_1 = require("./language/providers");
const oeRunner_1 = require("./openedge/oeRunner");
const ABL_SELECTOR = ['progress', 'abl', 'OpenEdge ABL', 'Progress 4GL'];
async function applyDocumentTransform(transform) {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const doc = editor.document;
    const original = doc.getText();
    const updated = transform(original);
    if (updated === original)
        return;
    const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(original.length));
    await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, updated);
    });
}
function getActiveAblDocument() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Abra um arquivo OpenEdge ABL (.p, .w, .i, .cls) primeiro.');
        return undefined;
    }
    return editor.document;
}
function activate(context) {
    const configManager = new configManager_1.ConfigManager();
    const runner = new oeRunner_1.OpenEdgeRunner(configManager, context.extensionPath);
    const dictionary = new dictionaryService_1.DictionaryService(configManager);
    const includeResolver = new includeResolver_1.IncludeResolver(configManager);
    context.subscriptions.push(configManager, runner, dictionary, 
    // 1. Existing intelligent formatter (preserved as default)
    vscode.languages.registerDocumentFormattingEditProvider(ABL_SELECTOR, {
        provideDocumentFormattingEdits(document) {
            const fullText = document.getText();
            const formattedText = (0, formatter_1.formatSource)(fullText);
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(fullText.length));
            return [vscode.TextEdit.replace(fullRange, formattedText)];
        },
    }), 
    // 2. Language Intelligence Providers
    vscode.languages.registerCompletionItemProvider(ABL_SELECTOR, new providers_1.AblCompletionProvider(dictionary, includeResolver), '.', '{'), vscode.languages.registerHoverProvider(ABL_SELECTOR, new providers_1.AblHoverProvider(dictionary, includeResolver)), vscode.languages.registerDefinitionProvider(ABL_SELECTOR, new providers_1.AblDefinitionProvider(includeResolver)), vscode.languages.registerFoldingRangeProvider(ABL_SELECTOR, new providers_1.AblFoldingProvider()), 
    // 3. Configuration Panel Command
    vscode.commands.registerCommand('progressFormatter.openConfig', () => {
        configWebview_1.ConfigWebviewPanel.show(configManager);
    }), 
    // 4. OpenEdge Execution, Compilation, Deploy & Dictionary Commands
    vscode.commands.registerCommand('progressFormatter.readDictionary', async () => {
        const generated = await runner.readDictionary();
        if (generated) {
            dictionary.reload();
        }
    }), vscode.commands.registerCommand('progressFormatter.checkSyntax', async () => {
        const doc = getActiveAblDocument();
        if (doc)
            await runner.checkSyntax(doc);
    }), vscode.commands.registerCommand('progressFormatter.checkSyntaxLocal', () => {
        const doc = getActiveAblDocument();
        if (doc)
            runner.checkSyntaxLocal(doc);
    }), vscode.commands.registerCommand('progressFormatter.compileAndDeploy', async () => {
        const doc = getActiveAblDocument();
        if (doc)
            await runner.compileAndDeploy(doc);
    }), vscode.commands.registerCommand('progressFormatter.compileToFolder', async () => {
        const doc = getActiveAblDocument();
        if (doc)
            await runner.compileToFolder(doc);
    }), vscode.commands.registerCommand('progressFormatter.deploySource', async () => {
        const doc = getActiveAblDocument();
        if (doc)
            await runner.deploySource(doc);
    }), vscode.commands.registerCommand('progressFormatter.compileWithOptions', async () => {
        const doc = getActiveAblDocument();
        if (doc)
            await runner.compileWithOptions(doc);
    }), vscode.commands.registerCommand('progressFormatter.runProgram', async () => {
        const doc = getActiveAblDocument();
        if (doc)
            await runner.runProgram(doc);
    }), 
    // 5. Extra Source Formatting Commands
    vscode.commands.registerCommand('progressFormatter.formatKeywordsUpper', async () => {
        await applyDocumentTransform((text) => (0, extraCommands_1.transformKeywordCase)(text, 'upper'));
    }), vscode.commands.registerCommand('progressFormatter.formatKeywordsLower', async () => {
        await applyDocumentTransform((text) => (0, extraCommands_1.transformKeywordCase)(text, 'lower'));
    }), vscode.commands.registerCommand('progressFormatter.formatTrimRight', async () => {
        await applyDocumentTransform(extraCommands_1.trimRightLines);
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map