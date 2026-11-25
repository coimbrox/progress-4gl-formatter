"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DictionaryService = void 0;
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
class DictionaryService {
    constructor(configManager) {
        this.tables = new Map();
        this.configManager = configManager;
        this.reload();
        this.watcher = vscode.workspace.createFileSystemWatcher('**/.vscode/openedge-dict/*.json');
        this.watcher.onDidChange(() => this.reload());
        this.watcher.onDidCreate(() => this.reload());
        this.watcher.onDidDelete(() => this.reload());
    }
    reload() {
        this.tables.clear();
        const workspaceFolder = this.configManager.getWorkspaceFolder();
        if (!workspaceFolder)
            return;
        const cachePath = path.join(workspaceFolder, '.vscode', 'openedge-dict', 'dictionary.json');
        if (!fs.existsSync(cachePath))
            return;
        try {
            const raw = fs.readFileSync(cachePath, 'utf8');
            const parsed = JSON.parse(raw);
            for (const db of parsed.databases ?? []) {
                for (const tbl of db.tables ?? []) {
                    const info = {
                        database: db.name,
                        name: tbl.name,
                        description: tbl.description,
                        fields: tbl.fields ?? [],
                    };
                    this.tables.set(tbl.name.toLowerCase(), info);
                    this.tables.set(`${db.name}.${tbl.name}`.toLowerCase(), info);
                }
            }
        }
        catch {
            // ignore corrupt cache until regenerated
        }
    }
    getAllTables() {
        const seen = new Set();
        const list = [];
        for (const tbl of this.tables.values()) {
            const key = `${tbl.database}.${tbl.name}`.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                list.push(tbl);
            }
        }
        return list;
    }
    getTable(name) {
        return this.tables.get(name.toLowerCase());
    }
    getFields(tableName) {
        return this.tables.get(tableName.toLowerCase())?.fields ?? [];
    }
    dispose() {
        this.watcher?.dispose();
    }
}
exports.DictionaryService = DictionaryService;
//# sourceMappingURL=dictionaryService.js.map