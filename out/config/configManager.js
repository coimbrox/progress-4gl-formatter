"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = exports.DEFAULT_CONFIG_FILE = exports.CONFIG_FILE_NAMES = void 0;
exports.stripJsonComments = stripJsonComments;
exports.resolveVariables = resolveVariables;
exports.detectDlcInstallations = detectDlcInstallations;
exports.discoverParameterFiles = discoverParameterFiles;
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
exports.CONFIG_FILE_NAMES = ['.openedge-zext.json', '.openedge-abl.json'];
exports.DEFAULT_CONFIG_FILE = '.openedge-zext.json';
/**
 * Strips // and /* *\/ comments from JSONC content while preserving string literals.
 */
function stripJsonComments(content) {
    let result = '';
    let inString = false;
    let i = 0;
    while (i < content.length) {
        const c = content[i];
        const next = content[i + 1];
        if (inString) {
            result += c;
            if (c === '\\' && i + 1 < content.length) {
                result += next;
                i += 2;
                continue;
            }
            if (c === '"') {
                inString = false;
            }
            i++;
            continue;
        }
        if (c === '"') {
            inString = true;
            result += c;
            i++;
            continue;
        }
        if (c === '/' && next === '/') {
            while (i < content.length && content[i] !== '\n')
                i++;
            continue;
        }
        if (c === '/' && next === '*') {
            i += 2;
            while (i < content.length && !(content[i] === '*' && content[i + 1] === '/'))
                i++;
            i += 2;
            continue;
        }
        result += c;
        i++;
    }
    return result;
}
function resolveVariables(value, workspaceFolder) {
    let resolved = value.replace(/\$\{workspaceFolder\}/gi, workspaceFolder);
    resolved = resolved.replace(/\$\{workspaceRoot\}/gi, workspaceFolder);
    resolved = resolved.replace(/\$\{env:([^}]+)\}/gi, (_, name) => process.env[name] ?? '');
    return resolved;
}
/**
 * Auto-detects OpenEdge DLC installations on Windows and Linux.
 */
function detectDlcInstallations() {
    const found = new Map();
    const checkDir = (dirPath, source) => {
        if (!dirPath)
            return;
        const normalized = path.normalize(dirPath);
        if (found.has(normalized.toLowerCase()))
            return;
        const binDir = path.join(normalized, 'bin');
        if (!fs.existsSync(binDir))
            return;
        const hasExe = fs.existsSync(path.join(binDir, '_progres.exe')) ||
            fs.existsSync(path.join(binDir, 'prowin.exe')) ||
            fs.existsSync(path.join(binDir, 'prowin32.exe')) ||
            fs.existsSync(path.join(binDir, '_progres'));
        if (!hasExe)
            return;
        let version = 'OpenEdge';
        const versionFile = path.join(normalized, 'version');
        if (fs.existsSync(versionFile)) {
            try {
                version = fs.readFileSync(versionFile, 'utf8').trim().split(/\r?\n/)[0] || 'OpenEdge';
            }
            catch {
                // ignore read errors
            }
        }
        found.set(normalized.toLowerCase(), { path: normalized, version, source });
    };
    if (process.env.DLC) {
        checkDir(process.env.DLC, 'Variável de ambiente DLC');
    }
    const candidates = [];
    if (process.platform === 'win32') {
        const roots = [
            'C:\\Progress',
            'C:\\Program Files\\Progress',
            'C:\\Program Files (x86)\\Progress',
            'C:\\',
            'D:\\Progress',
            'D:\\',
        ];
        for (const root of roots) {
            if (!fs.existsSync(root))
                continue;
            try {
                for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
                    if (!entry.isDirectory())
                        continue;
                    const lower = entry.name.toLowerCase();
                    if (lower.startsWith('dlc') || lower.includes('openedge') || lower.includes('progress')) {
                        const full = path.join(root, entry.name);
                        candidates.push(full);
                        candidates.push(path.join(full, 'dlc'));
                    }
                }
            }
            catch {
                // ignore permission errors
            }
        }
    }
    else {
        candidates.push('/usr/dlc', '/psc/dlc', '/opt/progress/dlc', '/opt/openedge/dlc');
    }
    for (const candidate of candidates) {
        checkDir(candidate, 'Detecção automática');
    }
    return Array.from(found.values());
}
/**
 * Finds .pf parameter files in the workspace (up to 3 levels deep).
 */
function discoverParameterFiles(workspaceFolder) {
    const results = [];
    const ignoreDirs = new Set(['node_modules', '.git', 'out', 'dist', '.vscode']);
    const walk = (dir, depth) => {
        if (depth > 3)
            return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!ignoreDirs.has(entry.name)) {
                    walk(path.join(dir, entry.name), depth + 1);
                }
            }
            else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pf')) {
                const rel = path.relative(workspaceFolder, path.join(dir, entry.name));
                results.push(rel);
            }
        }
    };
    if (workspaceFolder && fs.existsSync(workspaceFolder)) {
        walk(workspaceFolder, 0);
    }
    return results.sort();
}
class ConfigManager {
    constructor() {
        this._onDidChangeConfig = new vscode.EventEmitter();
        this.onDidChangeConfig = this._onDidChangeConfig.event;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
        this.statusBarItem.command = 'progressFormatter.openConfig';
        this.setupWatcher();
        this.updateStatusBar();
    }
    setupWatcher() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/.openedge-{zext,abl}.json');
        const notify = () => {
            this.updateStatusBar();
            this._onDidChangeConfig.fire();
        };
        this.watcher.onDidChange(notify);
        this.watcher.onDidCreate(notify);
        this.watcher.onDidDelete(notify);
    }
    getWorkspaceFolder(activeFilePath) {
        if (activeFilePath) {
            const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(activeFilePath));
            if (folder)
                return folder.uri.fsPath;
        }
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    }
    findConfigFile(workspaceFolder) {
        if (!workspaceFolder)
            return undefined;
        for (const name of exports.CONFIG_FILE_NAMES) {
            const fullPath = path.join(workspaceFolder, name);
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }
        return undefined;
    }
    readRawConfig(workspaceFolder) {
        const filePath = this.findConfigFile(workspaceFolder);
        if (!filePath) {
            return { config: {} };
        }
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(stripJsonComments(raw));
            return { config: parsed ?? {}, filePath };
        }
        catch (err) {
            vscode.window.showWarningMessage(`Erro ao ler ${path.basename(filePath)}: ${err instanceof Error ? err.message : String(err)}`);
            return { config: {}, filePath };
        }
    }
    getResolvedConfig(activeFilePath) {
        const workspaceFolder = this.getWorkspaceFolder(activeFilePath);
        const { config, filePath } = this.readRawConfig(workspaceFolder);
        const defaultWorkDir = activeFilePath ? path.dirname(activeFilePath) : workspaceFolder;
        const workingDirectory = config.workingDirectory
            ? resolveVariables(config.workingDirectory, workspaceFolder)
            : defaultWorkDir;
        const proPath = config.proPath && config.proPath.length > 0
            ? config.proPath.map((p) => resolveVariables(p, workspaceFolder))
            : workspaceFolder
                ? [workspaceFolder]
                : [];
        const proPathMode = config.proPathMode ?? 'overwrite';
        let dlcPath = config.dlcPath ? resolveVariables(config.dlcPath, workspaceFolder) : process.env.DLC ?? '';
        if (!dlcPath) {
            const detected = detectDlcInstallations();
            if (detected.length > 0) {
                dlcPath = detected[0].path;
            }
        }
        const parameterFiles = (config.parameterFiles ?? []).map((pf) => {
            const resolved = resolveVariables(pf, workspaceFolder);
            return path.isAbsolute(resolved) ? resolved : path.join(workspaceFolder, resolved);
        });
        const dbDictionary = config.dbDictionary ?? [];
        const deployment = (config.deployment ?? []).map((task) => ({
            ...task,
            path: resolveVariables(task.path, workspaceFolder),
            postAction: task.postAction?.map((a) => ({
                ...a,
                command: resolveVariables(a.command, workspaceFolder),
            })),
        }));
        return {
            configFilePath: filePath,
            workspaceFolder,
            workingDirectory,
            proPath,
            proPathMode,
            dlcPath,
            parameterFiles,
            dbDictionary,
            deployment,
        };
    }
    async saveConfig(workspaceFolder, config) {
        const existing = this.findConfigFile(workspaceFolder);
        const targetPath = existing ?? path.join(workspaceFolder, exports.DEFAULT_CONFIG_FILE);
        const cleaned = {};
        if (config.workingDirectory?.trim())
            cleaned.workingDirectory = config.workingDirectory.trim();
        if (config.proPath && config.proPath.length > 0)
            cleaned.proPath = config.proPath;
        if (config.proPathMode)
            cleaned.proPathMode = config.proPathMode;
        if (config.dlcPath?.trim())
            cleaned.dlcPath = config.dlcPath.trim();
        if (config.parameterFiles && config.parameterFiles.length > 0) {
            cleaned.parameterFiles = config.parameterFiles;
        }
        if (config.dbDictionary && config.dbDictionary.length > 0) {
            cleaned.dbDictionary = config.dbDictionary;
        }
        if (config.deployment && config.deployment.length > 0) {
            cleaned.deployment = config.deployment;
        }
        fs.writeFileSync(targetPath, JSON.stringify(cleaned, null, 2) + '\n', 'utf8');
        this.updateStatusBar();
        this._onDidChangeConfig.fire();
        return targetPath;
    }
    updateStatusBar() {
        const workspaceFolder = this.getWorkspaceFolder();
        const { filePath } = this.readRawConfig(workspaceFolder);
        const resolved = this.getResolvedConfig();
        if (resolved.dlcPath) {
            const dlcName = path.basename(resolved.dlcPath);
            this.statusBarItem.text = filePath
                ? `$(tools) OpenEdge: ${dlcName}`
                : `$(tools) OpenEdge: ${dlcName} (auto)`;
            this.statusBarItem.tooltip = filePath
                ? `Configuração OpenEdge ativa (${path.basename(filePath)})\nDLC: ${resolved.dlcPath}\nClique para abrir o painel de configuração`
                : `DLC detectado automaticamente: ${resolved.dlcPath}\nClique para criar/editar .openedge-zext.json`;
        }
        else {
            this.statusBarItem.text = '$(gear) Configurar OpenEdge ABL';
            this.statusBarItem.tooltip = 'Clique para configurar DLC, PROPATH, Bancos e Deploy do OpenEdge ABL';
        }
        this.statusBarItem.show();
    }
    dispose() {
        this.watcher?.dispose();
        this.statusBarItem.dispose();
        this._onDidChangeConfig.dispose();
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=configManager.js.map