import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../config/configManager';

export interface IncludeSuggestion {
    relativePath: string;
    fullPath: string;
    root: string;
}

export class IncludeResolver {
    private readonly configManager: ConfigManager;

    constructor(configManager: ConfigManager) {
        this.configManager = configManager;
    }

    /**
     * Resolves an include reference like `inc/utils.i` against the active file's
     * directory first, then each entry in PROPATH.
     */
    public resolveInclude(includePath: string, activeFilePath?: string): string | undefined {
        const cleaned = includePath.trim().replace(/^["']|["']$/g, '');
        if (!cleaned) return undefined;

        if (path.isAbsolute(cleaned) && fs.existsSync(cleaned)) {
            return cleaned;
        }

        const searchDirs: string[] = [];
        if (activeFilePath) {
            searchDirs.push(path.dirname(activeFilePath));
        }

        const config = this.configManager.getResolvedConfig(activeFilePath);
        for (const dir of config.proPath) {
            if (dir && !searchDirs.includes(dir)) {
                searchDirs.push(dir);
            }
        }

        for (const dir of searchDirs) {
            const candidate = path.join(dir, cleaned);
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return candidate;
            }
        }

        return undefined;
    }

    /**
     * Lists available .i include files across PROPATH (up to 4 levels deep, capped at 500 entries).
     */
    public listIncludeFiles(activeFilePath?: string): IncludeSuggestion[] {
        const config = this.configManager.getResolvedConfig(activeFilePath);
        const roots = config.proPath.length > 0 ? config.proPath : activeFilePath ? [path.dirname(activeFilePath)] : [];
        const results: IncludeSuggestion[] = [];
        const seen = new Set<string>();
        const ignoreDirs = new Set(['node_modules', '.git', 'out', 'dist', '.vscode']);
        const MAX_FILES = 500;

        const walk = (root: string, dir: string, depth: number) => {
            if (depth > 4 || results.length >= MAX_FILES) return;
            let entries: fs.Dirent[];
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                if (results.length >= MAX_FILES) break;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (!ignoreDirs.has(entry.name)) {
                        walk(root, full, depth + 1);
                    }
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.i')) {
                    const rel = path.relative(root, full).replace(/\\/g, '/');
                    const key = rel.toLowerCase();
                    if (!seen.has(key)) {
                        seen.add(key);
                        results.push({ relativePath: rel, fullPath: full, root });
                    }
                }
            }
        };

        for (const root of roots) {
            if (root && fs.existsSync(root)) {
                walk(root, root, 0);
            }
        }

        return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    }
}
