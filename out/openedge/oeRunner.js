"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenEdgeRunner = void 0;
const cp = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const localSyntaxChecker_1 = require("./localSyntaxChecker");
class OpenEdgeRunner {
    constructor(configManager, extensionPath) {
        this.configManager = configManager;
        this.extensionPath = extensionPath;
        this.output = vscode.window.createOutputChannel('OpenEdge ABL');
        this.diagnostics = vscode.languages.createDiagnosticCollection('openedge-abl');
    }
    findExecutable(dlcPath, gui) {
        if (!dlcPath)
            return undefined;
        const binDir = path.join(dlcPath, 'bin');
        const candidates = gui
            ? process.platform === 'win32'
                ? ['prowin.exe', 'prowin32.exe', '_progres.exe']
                : ['_progres']
            : process.platform === 'win32'
                ? ['_progres.exe', 'prowin.exe', 'prowin32.exe']
                : ['_progres'];
        for (const exe of candidates) {
            const full = path.join(binDir, exe);
            if (fs.existsSync(full))
                return full;
        }
        return undefined;
    }
    async ensureDlc(config, gui, allowLocalFallback = false) {
        const exe = this.findExecutable(config.dlcPath, gui);
        if (exe)
            return exe;
        const actions = allowLocalFallback
            ? ['Abrir Configuração', 'Usar Check Local (Offline)']
            : ['Abrir Configuração'];
        const choice = await vscode.window.showWarningMessage('OpenEdge DLC não encontrado. Configure o caminho do DLC para usar o compilador oficial do Progress.', ...actions);
        if (choice === 'Abrir Configuração') {
            await vscode.commands.executeCommand('progressFormatter.openConfig');
        }
        else if (choice === 'Usar Check Local (Offline)') {
            return 'local';
        }
        return undefined;
    }
    buildEnv(config) {
        const env = { ...process.env };
        if (config.dlcPath) {
            env.DLC = config.dlcPath;
        }
        const sep = ',';
        const configured = config.proPath.filter(Boolean).join(sep);
        const existing = env.PROPATH ?? '';
        if (configured) {
            if (config.proPathMode === 'append' && existing) {
                env.PROPATH = `${existing}${sep}${configured}`;
            }
            else if (config.proPathMode === 'prepend' && existing) {
                env.PROPATH = `${configured}${sep}${existing}`;
            }
            else {
                env.PROPATH = configured;
            }
        }
        return env;
    }
    buildPfArgs(config) {
        const args = [];
        for (const pf of config.parameterFiles) {
            if (fs.existsSync(pf)) {
                args.push('-pf', pf);
            }
            else {
                this.output.appendLine(`[Aviso] Parameter file não encontrado: ${pf}`);
            }
        }
        return args;
    }
    runProcess(exe, args, cwd, env) {
        return new Promise((resolve) => {
            if (cwd && !fs.existsSync(cwd)) {
                fs.mkdirSync(cwd, { recursive: true });
            }
            const proc = cp.spawn(exe, args, { cwd: cwd || undefined, env, windowsHide: true });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (d) => (stdout += d.toString()));
            proc.stderr.on('data', (d) => (stderr += d.toString()));
            proc.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
            proc.on('error', (err) => resolve({ code: 1, stdout, stderr: err.message }));
        });
    }
    parseCompilerResult(resultFile, fallbackFile) {
        if (!fs.existsSync(resultFile)) {
            return { status: 'ERROR', items: [] };
        }
        const lines = fs.readFileSync(resultFile, 'utf8').split(/\r?\n/).filter(Boolean);
        let status = 'ERROR';
        const items = [];
        for (const line of lines) {
            const parts = line.split('|');
            if (parts[0] === 'STATUS') {
                if (parts[1] === 'OK')
                    status = 'OK';
                else if (parts[1] === 'WARNING')
                    status = 'WARNING';
                else
                    status = 'ERROR';
            }
            else if (parts[0] === 'MSG') {
                const severity = parts[1] || 'ERROR';
                const errorNumber = parts[2] ?? '';
                const row = Math.max(1, parseInt(parts[3] ?? '1', 10) || 1);
                const col = Math.max(1, parseInt(parts[4] ?? '1', 10) || 1);
                const file = parts[5] || fallbackFile;
                const message = parts.slice(6).join('|');
                items.push({ file, line: row, column: col, errorNumber, severity, message });
            }
        }
        return { status, items };
    }
    publishDiagnostics(sourceFile, items) {
        this.diagnostics.clear();
        const byFile = new Map();
        for (const item of items) {
            const targetFile = item.file && fs.existsSync(item.file) ? item.file : sourceFile;
            const lineIdx = Math.max(0, item.line - 1);
            const colIdx = Math.max(0, item.column - 1);
            const range = new vscode.Range(lineIdx, colIdx, lineIdx, colIdx + 120);
            const sev = item.severity === 'WARNING'
                ? vscode.DiagnosticSeverity.Warning
                : item.severity === 'INFO'
                    ? vscode.DiagnosticSeverity.Information
                    : vscode.DiagnosticSeverity.Error;
            const diag = new vscode.Diagnostic(range, item.errorNumber ? `(${item.errorNumber}) ${item.message}` : item.message, sev);
            diag.source = 'OpenEdge ABL';
            const list = byFile.get(targetFile) ?? [];
            list.push(diag);
            byFile.set(targetFile, list);
        }
        for (const [file, list] of byFile.entries()) {
            this.diagnostics.set(vscode.Uri.file(file), list);
        }
    }
    checkSyntaxLocal(document) {
        const issues = (0, localSyntaxChecker_1.checkLocalAblSyntax)(document.getText());
        const mapped = issues.map((issue) => ({
            file: document.uri.fsPath,
            line: issue.line,
            column: issue.column,
            errorNumber: 'LOCAL',
            severity: issue.severity === 'warning' ? 'WARNING' : 'ERROR',
            message: issue.message,
        }));
        this.publishDiagnostics(document.uri.fsPath, mapped);
        if (mapped.length === 0) {
            vscode.window.showInformationMessage(`Check Syntax (Offline): Nenhum erro estrutural encontrado em ${path.basename(document.uri.fsPath)}.`);
            return true;
        }
        vscode.window.showErrorMessage(`Check Syntax (Offline): ${mapped.length} problema(s) encontrado(s). Veja o painel Problems.`);
        vscode.commands.executeCommand('workbench.actions.view.problems');
        return false;
    }
    async checkSyntax(document) {
        await document.save();
        const sourceFile = document.uri.fsPath;
        const config = this.configManager.getResolvedConfig(sourceFile);
        const exe = await this.ensureDlc(config, false, true);
        if (!exe)
            return false;
        if (exe === 'local') {
            return this.checkSyntaxLocal(document);
        }
        return this.executeCompile('check', sourceFile, config, exe, []);
    }
    async compileAndDeploy(document, options = []) {
        await document.save();
        const sourceFile = document.uri.fsPath;
        let config = this.configManager.getResolvedConfig(sourceFile);
        const exe = await this.ensureDlc(config, false);
        if (!exe || exe === 'local')
            return false;
        const ok = await this.executeCompile('compile', sourceFile, config, exe, options);
        if (!ok)
            return false;
        const rcodeTasks = config.deployment.filter((d) => d.taskType === 'current.r-code');
        if (rcodeTasks.length > 0) {
            await this.runDeployments(sourceFile, config, 'current.r-code');
        }
        else {
            const pick = await vscode.window.showInformationMessage(`Compilado com sucesso! Nenhuma pasta de deploy (.r) configurada ainda.`, 'Escolher Pasta de Deploy...', 'Abrir Configuração');
            if (pick === 'Escolher Pasta de Deploy...') {
                await this.promptAndDeployToFolder(sourceFile, config, 'current.r-code');
            }
            else if (pick === 'Abrir Configuração') {
                await vscode.commands.executeCommand('progressFormatter.openConfig');
            }
        }
        return true;
    }
    async compileToFolder(document) {
        await document.save();
        const sourceFile = document.uri.fsPath;
        const config = this.configManager.getResolvedConfig(sourceFile);
        const exe = await this.ensureDlc(config, false);
        if (!exe || exe === 'local')
            return;
        const ok = await this.executeCompile('compile', sourceFile, config, exe, []);
        if (!ok)
            return;
        await this.promptAndDeployToFolder(sourceFile, config, 'current.r-code');
    }
    async promptAndDeployToFolder(sourceFile, config, taskType) {
        const selected = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: config.workspaceFolder ? vscode.Uri.file(config.workspaceFolder) : undefined,
            openLabel: 'Gerar Arquivo Nesta Pasta',
        });
        if (!selected || !selected[0])
            return;
        const targetDir = selected[0].fsPath;
        const tempConfig = {
            ...config,
            deployment: [{ taskType, path: targetDir, preserveSubfolder: false }],
        };
        await this.runDeployments(sourceFile, tempConfig, taskType);
        if (config.workspaceFolder) {
            const saveChoice = await vscode.window.showInformationMessage(`Deseja salvar "${targetDir}" como pasta padrão de deploy em .openedge-zext.json?`, 'Salvar na Configuração', 'Não');
            if (saveChoice === 'Salvar na Configuração') {
                const { config: raw } = this.configManager.readRawConfig(config.workspaceFolder);
                const existingDeploys = raw.deployment ?? [];
                existingDeploys.push({ taskType, path: targetDir, preserveSubfolder: false });
                await this.configManager.saveConfig(config.workspaceFolder, {
                    ...raw,
                    deployment: existingDeploys,
                });
            }
        }
    }
    async compileWithOptions(document) {
        const picked = await vscode.window.showQuickPick([
            { label: 'XREF', description: 'Gera arquivo .xref de referências cruzadas' },
            { label: 'XREF-XML', description: 'Gera arquivo .xref.xml em formato XML' },
            { label: 'DEBUG-LIST', description: 'Gera arquivo .dbg com números de linha expandidos' },
            { label: 'PREPROCESS', description: 'Gera arquivo .pre pré-processado' },
            { label: 'LISTING', description: 'Gera arquivo .lis de listagem' },
            { label: 'STRING-XREF', description: 'Gera arquivo .strxref de strings' },
        ], {
            canPickMany: true,
            placeHolder: 'Selecione as opções de compilação adicionais',
        });
        if (!picked)
            return;
        const options = picked.map((p) => p.label);
        await this.compileAndDeploy(document, options);
    }
    async deploySource(document) {
        await document.save();
        const sourceFile = document.uri.fsPath;
        const config = this.configManager.getResolvedConfig(sourceFile);
        const sourceTasks = config.deployment.filter((d) => d.taskType === 'current.source');
        if (sourceTasks.length === 0) {
            const pick = await vscode.window.showWarningMessage('Nenhuma pasta de deploy "current.source" configurada em .openedge-zext.json.', 'Escolher Pasta Agora...', 'Abrir Configuração');
            if (pick === 'Escolher Pasta Agora...') {
                await this.promptAndDeployToFolder(sourceFile, config, 'current.source');
            }
            else if (pick === 'Abrir Configuração') {
                await vscode.commands.executeCommand('progressFormatter.openConfig');
            }
            return;
        }
        await this.runDeployments(sourceFile, config, 'current.source');
    }
    async runProgram(document) {
        await document.save();
        const sourceFile = document.uri.fsPath;
        const config = this.configManager.getResolvedConfig(sourceFile);
        const exe = await this.ensureDlc(config, true);
        if (!exe || exe === 'local')
            return;
        const env = this.buildEnv(config);
        const args = [...this.buildPfArgs(config), '-p', sourceFile];
        this.output.appendLine(`[Run] ${exe} ${args.join(' ')}`);
        this.output.show(true);
        const proc = cp.spawn(exe, args, {
            cwd: config.workingDirectory || path.dirname(sourceFile),
            env,
            detached: true,
            stdio: 'ignore',
        });
        proc.unref();
    }
    async readDictionary() {
        const config = this.configManager.getResolvedConfig();
        const exe = await this.ensureDlc(config, false);
        if (!exe || exe === 'local')
            return undefined;
        if (!config.workspaceFolder) {
            vscode.window.showErrorMessage('Abra um workspace para salvar o dicionário de banco.');
            return undefined;
        }
        const dictDir = path.join(config.workspaceFolder, '.vscode', 'openedge-dict');
        fs.mkdirSync(dictDir, { recursive: true });
        const outFile = path.join(dictDir, 'dictionary.json');
        const scriptPath = path.join(this.extensionPath, 'abl-scripts', 'read-dictionary.p');
        const param = `${config.dbDictionary.join(',')}|${outFile}`;
        const args = ['-b', ...this.buildPfArgs(config), '-p', scriptPath, '-param', param];
        const env = this.buildEnv(config);
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'OpenEdge ABL: Lendo estrutura do dicionário de banco...',
            cancellable: false,
        }, async () => {
            this.output.appendLine(`[Read Dictionary] ${exe} ${args.join(' ')}`);
            const res = await this.runProcess(exe, args, config.workingDirectory, env);
            if (res.stdout)
                this.output.appendLine(res.stdout);
            if (res.stderr)
                this.output.appendLine(res.stderr);
            if (fs.existsSync(outFile)) {
                vscode.window.showInformationMessage('Dicionário OpenEdge atualizado com sucesso! Auto-complete de tabelas e campos pronto.');
                return outFile;
            }
            else {
                vscode.window.showErrorMessage('Não foi possível gerar o dicionário. Verifique o Output "OpenEdge ABL" e seus arquivos .pf.');
                this.output.show(true);
                return undefined;
            }
        });
    }
    async executeCompile(mode, sourceFile, config, exe, options) {
        const scriptPath = path.join(this.extensionPath, 'abl-scripts', 'compile.p');
        const resultFile = path.join(os.tmpdir(), `oe-abl-result-${Date.now()}.txt`);
        const saveDir = config.workingDirectory || path.dirname(sourceFile);
        if (mode === 'compile' && saveDir && !fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }
        const param = `${mode}|${sourceFile}|${saveDir}|${options.join(',')}|${resultFile}`;
        const args = ['-b', ...this.buildPfArgs(config), '-p', scriptPath, '-param', param];
        const env = this.buildEnv(config);
        const label = mode === 'check' ? 'Check Syntax' : 'Compile';
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `OpenEdge ABL: ${label} (${path.basename(sourceFile)})...`,
            cancellable: false,
        }, async () => {
            this.output.appendLine(`[${label}] ${sourceFile}`);
            const res = await this.runProcess(exe, args, saveDir, env);
            if (res.stdout.trim())
                this.output.appendLine(res.stdout.trim());
            if (res.stderr.trim())
                this.output.appendLine(res.stderr.trim());
            const parsed = this.parseCompilerResult(resultFile, sourceFile);
            try {
                if (fs.existsSync(resultFile))
                    fs.unlinkSync(resultFile);
            }
            catch {
                // ignore cleanup error
            }
            this.publishDiagnostics(sourceFile, parsed.items);
            if (parsed.status === 'OK') {
                const okMsg = mode === 'check'
                    ? `Syntax is correct: ${path.basename(sourceFile)}`
                    : `Compilado com sucesso: ${path.basename(sourceFile)}`;
                vscode.window.showInformationMessage(okMsg);
                return true;
            }
            else if (parsed.status === 'WARNING') {
                vscode.window.showWarningMessage(`${label} concluído com avisos (${parsed.items.length}): ${path.basename(sourceFile)}`);
                vscode.commands.executeCommand('workbench.actions.view.problems');
                return true;
            }
            else {
                const firstMsg = parsed.items[0]?.message ?? res.stderr.trim() ?? 'Erro desconhecido na compilação.';
                vscode.window.showErrorMessage(`${label} falhou: ${firstMsg}`);
                vscode.commands.executeCommand('workbench.actions.view.problems');
                this.output.show(true);
                return false;
            }
        });
    }
    computeDestinationPath(sourceFile, fileToCopy, task, config) {
        if (task.preserveSubfolder && config.workspaceFolder) {
            const relDir = path.relative(config.workspaceFolder, path.dirname(sourceFile));
            if (relDir && !relDir.startsWith('..') && !path.isAbsolute(relDir)) {
                return path.join(task.path, relDir, path.basename(fileToCopy));
            }
        }
        return path.join(task.path, path.basename(fileToCopy));
    }
    async runDeployments(sourceFile, config, taskType) {
        const tasks = config.deployment.filter((t) => t.taskType === taskType);
        if (tasks.length === 0)
            return;
        const baseNoExt = path.basename(sourceFile, path.extname(sourceFile));
        const rCodeFile = path.join(config.workingDirectory || path.dirname(sourceFile), `${baseNoExt}.r`);
        const fileToCopy = taskType === 'current.r-code' ? rCodeFile : sourceFile;
        if (!fs.existsSync(fileToCopy)) {
            vscode.window.showWarningMessage(`Arquivo para deploy não encontrado: ${fileToCopy}`);
            return;
        }
        const deployedFiles = [];
        for (const task of tasks) {
            try {
                const destFile = this.computeDestinationPath(sourceFile, fileToCopy, task, config);
                fs.mkdirSync(path.dirname(destFile), { recursive: true });
                fs.copyFileSync(fileToCopy, destFile);
                deployedFiles.push(destFile);
                this.output.appendLine(`[Deploy] Gerado: ${destFile}`);
                if (task.postAction) {
                    for (const action of task.postAction) {
                        if (action.actionType === 'URL') {
                            await this.triggerUrl(action.command);
                        }
                        else if (action.actionType === 'COMMAND') {
                            await this.triggerCommand(action.command, config.workspaceFolder);
                        }
                    }
                }
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.output.appendLine(`[Deploy Erro] ${msg}`);
                vscode.window.showErrorMessage(`Erro no deploy para ${task.path}: ${msg}`);
            }
        }
        if (deployedFiles.length > 0) {
            vscode.window.showInformationMessage(`Deploy concluído! Arquivo gerado em: ${deployedFiles.join(', ')}`);
        }
    }
    triggerUrl(url) {
        return new Promise((resolve) => {
            this.output.appendLine(`[PostAction URL] GET ${url}`);
            const client = url.startsWith('https://') ? https : http;
            const req = client.get(url, (res) => {
                this.output.appendLine(`[PostAction URL] Status ${res.statusCode}`);
                res.resume();
                resolve();
            });
            req.on('error', (err) => {
                this.output.appendLine(`[PostAction URL Erro] ${err.message}`);
                resolve();
            });
            req.setTimeout(10000, () => {
                req.destroy();
                this.output.appendLine(`[PostAction URL] Timeout: ${url}`);
                resolve();
            });
        });
    }
    triggerCommand(command, cwd) {
        return new Promise((resolve) => {
            this.output.appendLine(`[PostAction CMD] ${command}`);
            cp.exec(command, { cwd: cwd || undefined }, (err, stdout, stderr) => {
                if (stdout)
                    this.output.appendLine(stdout.trim());
                if (stderr)
                    this.output.appendLine(stderr.trim());
                if (err)
                    this.output.appendLine(`[PostAction CMD Erro] ${err.message}`);
                resolve();
            });
        });
    }
    dispose() {
        this.output.dispose();
        this.diagnostics.dispose();
    }
}
exports.OpenEdgeRunner = OpenEdgeRunner;
//# sourceMappingURL=oeRunner.js.map