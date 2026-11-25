export interface SymbolLocation {
    line: number; // 0-based
    character: number; // 0-based
    length: number;
}

export interface VariableSymbol extends SymbolLocation {
    kind: 'variable' | 'parameter';
    name: string;
    dataType: string;
    direction?: string;
    detail: string;
}

export interface TempTableField extends SymbolLocation {
    name: string;
    dataType: string;
    detail: string;
}

export interface TempTableSymbol extends SymbolLocation {
    name: string;
    likeTable?: string;
    fields: TempTableField[];
}

export interface BufferSymbol extends SymbolLocation {
    name: string;
    targetTable: string;
}

export interface RoutineSymbol extends SymbolLocation {
    kind: 'procedure' | 'function' | 'method';
    name: string;
    returnType?: string;
    signature: string;
}

export interface PreprocessorSymbol extends SymbolLocation {
    name: string;
    value: string;
    scope: 'scoped' | 'global';
}

export interface IncludeReference extends SymbolLocation {
    filePath: string;
}

export interface ParsedAblDocument {
    variables: VariableSymbol[];
    tempTables: TempTableSymbol[];
    buffers: BufferSymbol[];
    routines: RoutineSymbol[];
    preprocessors: PreprocessorSymbol[];
    includes: IncludeReference[];
}

/**
 * Fast, resilient parser for OpenEdge ABL declarations, temp-tables, buffers,
 * routines (procedures/functions/methods), preprocessors, and include references.
 */
export function parseAblDocument(text: string): ParsedAblDocument {
    const result: ParsedAblDocument = {
        variables: [],
        tempTables: [],
        buffers: [],
        routines: [],
        preprocessors: [],
        includes: [],
    };

    const lines = text.split(/\r?\n/);
    let currentTempTable: TempTableSymbol | null = null;
    let inBlockComment = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const rawLine = lines[lineIdx];

        // Strip comments on this line while tracking multi-line block comments
        let line = '';
        let i = 0;
        let inString: string | null = null;
        while (i < rawLine.length) {
            const c = rawLine[i];
            const next = rawLine[i + 1];

            if (inBlockComment) {
                if (c === '*' && next === '/') {
                    inBlockComment = false;
                    line += '  ';
                    i += 2;
                    continue;
                }
                line += ' ';
                i++;
                continue;
            }

            if (inString) {
                line += c;
                if (c === '~' && i + 1 < rawLine.length) {
                    line += next;
                    i += 2;
                    continue;
                }
                if (c === inString) {
                    inString = null;
                }
                i++;
                continue;
            }

            if (c === '/' && next === '/') {
                break;
            }
            if (c === '/' && next === '*') {
                inBlockComment = true;
                line += '  ';
                i += 2;
                continue;
            }
            if (c === '"' || c === "'") {
                inString = c;
                line += c;
                i++;
                continue;
            }

            line += c;
            i++;
        }

        const trimmed = line.trim();
        if (!trimmed) continue;

        // 1. Include references: {path/to/file.i ...}
        const includeRegex = /\{\s*([A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+)(?:\s|})/g;
        let incMatch: RegExpExecArray | null;
        while ((incMatch = includeRegex.exec(line)) !== null) {
            const filePath = incMatch[1];
            const charIdx = incMatch.index + incMatch[0].indexOf(filePath);
            result.includes.push({
                filePath,
                line: lineIdx,
                character: charIdx,
                length: filePath.length,
            });
        }

        // 2. Preprocessor definitions: &SCOPED-DEFINE / &GLOBAL-DEFINE
        const prepMatch = line.match(/^\s*&(SCOPED-DEFINE|GLOBAL-DEFINE)\s+([A-Za-z0-9_\-]+)(?:\s+(.*))?$/i);
        if (prepMatch) {
            const scope = prepMatch[1].toLowerCase().startsWith('global') ? 'global' : 'scoped';
            const name = prepMatch[2];
            const value = (prepMatch[3] ?? '').trim();
            result.preprocessors.push({
                name,
                value,
                scope,
                line: lineIdx,
                character: line.indexOf(name),
                length: name.length,
            });
            continue;
        }

        // 3. Inside a multi-line DEFINE TEMP-TABLE block: capture FIELD clauses
        if (currentTempTable) {
            const fieldRegex = /\bFIELD\s+([A-Za-z_][A-Za-z0-9_\-]*)\s+(AS|LIKE)\s+([A-Za-z0-9_.\-]+)/gi;
            let fMatch: RegExpExecArray | null;
            while ((fMatch = fieldRegex.exec(line)) !== null) {
                const fName = fMatch[1];
                const fKind = fMatch[2].toUpperCase();
                const fType = fMatch[3].replace(/\.+$/, '');
                const charIdx = fMatch.index + fMatch[0].indexOf(fName);
                currentTempTable.fields.push({
                    name: fName,
                    dataType: fKind === 'LIKE' ? `LIKE ${fType}` : fType,
                    detail: `FIELD ${fName} ${fKind} ${fType}`,
                    line: lineIdx,
                    character: charIdx,
                    length: fName.length,
                });
            }
            const likeMatch = line.match(/\bLIKE(?:-SEQUENTIAL)?\s+([A-Za-z_][A-Za-z0-9_\-]*)/i);
            if (likeMatch && !/\bFIELD\b/i.test(line) && !currentTempTable.likeTable) {
                currentTempTable.likeTable = likeMatch[1];
            }
            if (/\.\s*$/.test(trimmed)) {
                currentTempTable = null;
            }
            continue;
        }

        // 4. DEFINE VARIABLE
        const varMatch = line.match(
            /\bDEF(?:INE)?\s+(?:(?:NEW\s+)?(?:GLOBAL\s+)?(?:SHARED\s+)?|(?:PRIVATE|PUBLIC|PROTECTED|STATIC)\s+)*VAR(?:IABLE)?\s+([A-Za-z_][A-Za-z0-9_\-]*)\s+(AS|LIKE)\s+([A-Za-z0-9_.\-]+)/i
        );
        if (varMatch) {
            const name = varMatch[1];
            const kindWord = varMatch[2].toUpperCase();
            const cleanType = varMatch[3].replace(/\.+$/, '');
            const dataType = kindWord === 'LIKE' ? `LIKE ${cleanType}` : cleanType;
            result.variables.push({
                kind: 'variable',
                name,
                dataType,
                detail: trimmed,
                line: lineIdx,
                character: line.indexOf(name),
                length: name.length,
            });
            continue;
        }

        // 5. DEFINE PARAMETER
        const paramMatch = line.match(
            /\bDEF(?:INE)?\s+(INPUT-OUTPUT|INPUT|OUTPUT)\s+PARAM(?:ETER)?\s+(?:(TABLE|TABLE-HANDLE|DATASET|DATASET-HANDLE|BUFFER)\s+(?:FOR\s+)?)?([A-Za-z_][A-Za-z0-9_\-]*)(?:\s+(AS|LIKE)\s+([A-Za-z0-9_.\-]+))?/i
        );
        if (paramMatch) {
            const direction = paramMatch[1].toUpperCase();
            const specialKind = paramMatch[2]?.toUpperCase();
            const name = paramMatch[3];
            const dataType = specialKind
                ? specialKind
                : paramMatch[5]
                  ? `${paramMatch[4].toUpperCase() === 'LIKE' ? 'LIKE ' : ''}${paramMatch[5]}`
                  : 'ANY';
            result.variables.push({
                kind: 'parameter',
                name,
                dataType,
                direction,
                detail: trimmed,
                line: lineIdx,
                character: line.indexOf(name),
                length: name.length,
            });
            continue;
        }

        // 6. DEFINE TEMP-TABLE
        const ttMatch = line.match(
            /\bDEF(?:INE)?\s+(?:(?:NEW\s+)?(?:GLOBAL\s+)?(?:SHARED\s+)?|(?:PRIVATE|PUBLIC|PROTECTED|STATIC)\s+)*TEMP-TABLE\s+([A-Za-z_][A-Za-z0-9_\-]*)/i
        );
        if (ttMatch) {
            const name = ttMatch[1];
            const likeMatch = line.match(/\bLIKE(?:-SEQUENTIAL)?\s+([A-Za-z_][A-Za-z0-9_\-]*)/i);
            const tt: TempTableSymbol = {
                name,
                likeTable: likeMatch ? likeMatch[1] : undefined,
                fields: [],
                line: lineIdx,
                character: line.indexOf(name),
                length: name.length,
            };
            // Check if any FIELD is on the same line
            const fieldRegex = /\bFIELD\s+([A-Za-z_][A-Za-z0-9_\-]*)\s+(AS|LIKE)\s+([A-Za-z0-9_.\-]+)/gi;
            let fMatch: RegExpExecArray | null;
            while ((fMatch = fieldRegex.exec(line)) !== null) {
                tt.fields.push({
                    name: fMatch[1],
                    dataType: fMatch[2].toUpperCase() === 'LIKE' ? `LIKE ${fMatch[3]}` : fMatch[3],
                    detail: `FIELD ${fMatch[1]} ${fMatch[2].toUpperCase()} ${fMatch[3]}`,
                    line: lineIdx,
                    character: fMatch.index + fMatch[0].indexOf(fMatch[1]),
                    length: fMatch[1].length,
                });
            }
            result.tempTables.push(tt);
            if (!/\.\s*$/.test(trimmed)) {
                currentTempTable = tt;
            }
            continue;
        }

        // 7. DEFINE BUFFER
        const bufMatch = line.match(
            /\bDEF(?:INE)?\s+(?:(?:NEW\s+)?(?:SHARED\s+)?|(?:PRIVATE|PUBLIC|PROTECTED|STATIC)\s+)*BUFFER\s+([A-Za-z_][A-Za-z0-9_\-]*)\s+FOR\s+(?:TEMP-TABLE\s+)?([A-Za-z_][A-Za-z0-9_.\-]*)/i
        );
        if (bufMatch) {
            const name = bufMatch[1];
            const targetTable = bufMatch[2].replace(/\.+$/, '');
            result.buffers.push({
                name,
                targetTable,
                line: lineIdx,
                character: line.indexOf(name),
                length: name.length,
            });
            continue;
        }

        // 8. PROCEDURE
        const procMatch = line.match(/^\s*PROCEDURE\s+([A-Za-z_][A-Za-z0-9_\-]*)\s*(?:PRIVATE|PUBLIC)?\s*:/i);
        if (procMatch) {
            const name = procMatch[1];
            result.routines.push({
                kind: 'procedure',
                name,
                signature: trimmed.replace(/:$/, ''),
                line: lineIdx,
                character: line.indexOf(name),
                length: name.length,
            });
            continue;
        }

        // 9. FUNCTION
        const funcMatch = line.match(/^\s*FUNCTION\s+([A-Za-z_][A-Za-z0-9_\-]*)\s+RETURNS\s+([A-Za-z0-9_.\-]+)/i);
        if (funcMatch) {
            const name = funcMatch[1];
            const returnType = funcMatch[2];
            result.routines.push({
                kind: 'function',
                name,
                returnType,
                signature: trimmed.replace(/[:.]$/, ''),
                line: lineIdx,
                character: line.indexOf(name),
                length: name.length,
            });
            continue;
        }

        // 10. METHOD
        const methodMatch = line.match(
            /^\s*METHOD\s+(?:(?:PUBLIC|PRIVATE|PROTECTED|PACKAGE-PRIVATE|PACKAGE-PROTECTED|STATIC|OVERRIDE|FINAL|ABSTRACT)\s+)*([A-Za-z0-9_.\-]+)\s+([A-Za-z_][A-Za-z0-9_\-]*)\s*\(/i
        );
        if (methodMatch) {
            const returnType = methodMatch[1];
            const name = methodMatch[2];
            result.routines.push({
                kind: 'method',
                name,
                returnType,
                signature: trimmed.replace(/:$/, ''),
                line: lineIdx,
                character: line.indexOf(name),
                length: name.length,
            });
            continue;
        }
    }

    return result;
}
