import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from '../config/configManager';

export interface DbFieldInfo {
    name: string;
    dataType: string;
    format?: string;
    label?: string;
    description?: string;
    extent?: number;
}

export interface DbTableInfo {
    database: string;
    name: string;
    description?: string;
    fields: DbFieldInfo[];
}

interface DictionaryCacheFile {
    databases: Array<{
        name: string;
        tables: Array<{
            name: string;
            description?: string;
            fields: DbFieldInfo[];
        }>;
    }>;
}

export class DictionaryService implements vscode.Disposable {
    private tables = new Map<string, DbTableInfo>();
    private watcher: vscode.FileSystemWatcher | undefined;
    private readonly configManager: ConfigManager;

    constructor(configManager: ConfigManager) {
        this.configManager = configManager;
        this.reload();
        this.watcher = vscode.workspace.createFileSystemWatcher('**/.vscode/openedge-dict/*.json');
        this.watcher.onDidChange(() => this.reload());
        this.watcher.onDidCreate(() => this.reload());
        this.watcher.onDidDelete(() => this.reload());
    }

    public reload(): void {
        this.tables.clear();
        const workspaceFolder = this.configManager.getWorkspaceFolder();
        if (!workspaceFolder) return;

        const cachePath = path.join(workspaceFolder, '.vscode', 'openedge-dict', 'dictionary.json');
        if (!fs.existsSync(cachePath)) return;

        try {
            const raw = fs.readFileSync(cachePath, 'utf8');
            const parsed = JSON.parse(raw) as DictionaryCacheFile;
            for (const db of parsed.databases ?? []) {
                for (const tbl of db.tables ?? []) {
                    const info: DbTableInfo = {
                        database: db.name,
                        name: tbl.name,
                        description: tbl.description,
                        fields: tbl.fields ?? [],
                    };
                    this.tables.set(tbl.name.toLowerCase(), info);
                    this.tables.set(`${db.name}.${tbl.name}`.toLowerCase(), info);
                }
            }
        } catch {
            // ignore corrupt cache until regenerated
        }
    }

    public getAllTables(): DbTableInfo[] {
        const seen = new Set<string>();
        const list: DbTableInfo[] = [];
        for (const tbl of this.tables.values()) {
            const key = `${tbl.database}.${tbl.name}`.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                list.push(tbl);
            }
        }
        return list;
    }

    public getTable(name: string): DbTableInfo | undefined {
        return this.tables.get(name.toLowerCase());
    }

    public getFields(tableName: string): DbFieldInfo[] {
        return this.tables.get(tableName.toLowerCase())?.fields ?? [];
    }

    public dispose(): void {
        this.watcher?.dispose();
    }
}
