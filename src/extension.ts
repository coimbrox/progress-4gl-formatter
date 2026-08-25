import * as vscode from 'vscode';
import { formatSource } from './formatter';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(['progress', 'abl', 'OpenEdge ABL', 'Progress 4GL'], {
            provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
                const fullText = document.getText();
                const formattedText = formatSource(fullText);

                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(fullText.length)
                );

                return [vscode.TextEdit.replace(fullRange, formattedText)];
            }
        })
    );
}

export function deactivate() {}
