"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const formatter_1 = require("./formatter");
function activate(context) {
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(['progress', 'abl', 'OpenEdge ABL', 'Progress 4GL'], {
        provideDocumentFormattingEdits(document) {
            const fullText = document.getText();
            const formattedText = (0, formatter_1.formatSource)(fullText);
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(fullText.length));
            return [vscode.TextEdit.replace(fullRange, formattedText)];
        }
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map