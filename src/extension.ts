import * as vscode from 'vscode';
import { ConfigManager } from './config/configManager';
import { ConfigWebviewPanel } from './config/configWebview';
import { formatSource } from './formatter';
import { transformKeywordCase, trimRightLines } from './formatter/extraCommands';
import { DictionaryService } from './language/dictionaryService';
import { IncludeResolver } from './language/includeResolver';
import {
    AblCompletionProvider,
    AblDefinitionProvider,
    AblFoldingProvider,
    AblHoverProvider,
} from './language/providers';
import { OpenEdgeRunner } from './openedge/oeRunner';

const ABL_SELECTOR: vscode.DocumentSelector = ['progress', 'abl', 'OpenEdge ABL', 'Progress 4GL'];

async function applyDocumentTransform(transform: (text: string) => string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const doc = editor.document;
    const original = doc.getText();
    const updated = transform(original);
    if (updated === original) return;

    const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(original.length));
    await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, updated);
    });
}

function getActiveAblDocument(): vscode.TextDocument | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Abra um arquivo OpenEdge ABL (.p, .w, .i, .cls) primeiro.');
        return undefined;
    }
    return editor.document;
}

export function activate(context: vscode.ExtensionContext) {
    const configManager = new ConfigManager();
    const runner = new OpenEdgeRunner(configManager, context.extensionPath);
    const dictionary = new DictionaryService(configManager);
    const includeResolver = new IncludeResolver(configManager);

    context.subscriptions.push(
        configManager,
        runner,
        dictionary,

        // 1. Existing intelligent formatter (preserved as default)
        vscode.languages.registerDocumentFormattingEditProvider(ABL_SELECTOR, {
            provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
                const fullText = document.getText();
                const formattedText = formatSource(fullText);

                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(fullText.length)
                );

                return [vscode.TextEdit.replace(fullRange, formattedText)];
            },
        }),

        // 2. Language Intelligence Providers
        vscode.languages.registerCompletionItemProvider(
            ABL_SELECTOR,
            new AblCompletionProvider(dictionary, includeResolver),
            '.',
            '{'
        ),
        vscode.languages.registerHoverProvider(ABL_SELECTOR, new AblHoverProvider(dictionary, includeResolver)),
        vscode.languages.registerDefinitionProvider(ABL_SELECTOR, new AblDefinitionProvider(includeResolver)),
        vscode.languages.registerFoldingRangeProvider(ABL_SELECTOR, new AblFoldingProvider()),

        // 3. Configuration Panel Command
        vscode.commands.registerCommand('progressFormatter.openConfig', () => {
            ConfigWebviewPanel.show(configManager);
        }),

        // 4. OpenEdge Execution, Compilation, Deploy & Dictionary Commands
        vscode.commands.registerCommand('progressFormatter.readDictionary', async () => {
            const generated = await runner.readDictionary();
            if (generated) {
                dictionary.reload();
            }
        }),
        vscode.commands.registerCommand('progressFormatter.checkSyntax', async () => {
            const doc = getActiveAblDocument();
            if (doc) await runner.checkSyntax(doc);
        }),
        vscode.commands.registerCommand('progressFormatter.checkSyntaxLocal', () => {
            const doc = getActiveAblDocument();
            if (doc) runner.checkSyntaxLocal(doc);
        }),
        vscode.commands.registerCommand('progressFormatter.compileAndDeploy', async () => {
            const doc = getActiveAblDocument();
            if (doc) await runner.compileAndDeploy(doc);
        }),
        vscode.commands.registerCommand('progressFormatter.compileToFolder', async () => {
            const doc = getActiveAblDocument();
            if (doc) await runner.compileToFolder(doc);
        }),
        vscode.commands.registerCommand('progressFormatter.deploySource', async () => {
            const doc = getActiveAblDocument();
            if (doc) await runner.deploySource(doc);
        }),
        vscode.commands.registerCommand('progressFormatter.compileWithOptions', async () => {
            const doc = getActiveAblDocument();
            if (doc) await runner.compileWithOptions(doc);
        }),
        vscode.commands.registerCommand('progressFormatter.runProgram', async () => {
            const doc = getActiveAblDocument();
            if (doc) await runner.runProgram(doc);
        }),

        // 5. Extra Source Formatting Commands
        vscode.commands.registerCommand('progressFormatter.formatKeywordsUpper', async () => {
            await applyDocumentTransform((text) => transformKeywordCase(text, 'upper'));
        }),
        vscode.commands.registerCommand('progressFormatter.formatKeywordsLower', async () => {
            await applyDocumentTransform((text) => transformKeywordCase(text, 'lower'));
        }),
        vscode.commands.registerCommand('progressFormatter.formatTrimRight', async () => {
            await applyDocumentTransform(trimRightLines);
        })
    );
}

export function deactivate() {}
