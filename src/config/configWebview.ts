import * as path from 'path';
import * as vscode from 'vscode';
import {
    ConfigManager,
    DEFAULT_CONFIG_FILE,
    detectDlcInstallations,
    discoverParameterFiles,
} from './configManager';
import { OpenEdgeConfig } from './types';

export class ConfigWebviewPanel {
    private static currentPanel: ConfigWebviewPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly configManager: ConfigManager;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, configManager: ConfigManager) {
        this.panel = panel;
        this.configManager = configManager;

        this.panel.webview.html = this.getHtml();
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleMessage(message);
            },
            null,
            this.disposables
        );

        this.sendInitialState();
    }

    public static show(configManager: ConfigManager): void {
        if (ConfigWebviewPanel.currentPanel) {
            ConfigWebviewPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
            ConfigWebviewPanel.currentPanel.sendInitialState();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'openedgeAblConfig',
            'Configuração OpenEdge ABL',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        ConfigWebviewPanel.currentPanel = new ConfigWebviewPanel(panel, configManager);
    }

    private sendInitialState(): void {
        const workspaceFolder = this.configManager.getWorkspaceFolder();
        const { config, filePath } = this.configManager.readRawConfig(workspaceFolder);
        const detectedDlcs = detectDlcInstallations();
        const discoveredPfs = discoverParameterFiles(workspaceFolder);

        this.panel.webview.postMessage({
            type: 'init',
            payload: {
                workspaceFolder,
                configFileName: filePath ? path.basename(filePath) : DEFAULT_CONFIG_FILE,
                hasExistingConfig: Boolean(filePath),
                config: {
                    workingDirectory: config.workingDirectory ?? '${workspaceFolder}\\Temp',
                    proPath: config.proPath ?? (workspaceFolder ? ['${workspaceFolder}'] : []),
                    proPathMode: config.proPathMode ?? 'overwrite',
                    dlcPath: config.dlcPath ?? detectedDlcs[0]?.path ?? '',
                    parameterFiles: config.parameterFiles ?? [],
                    dbDictionary: config.dbDictionary ?? [],
                    deployment: config.deployment ?? [],
                },
                detectedDlcs,
                discoveredPfs,
            },
        });
    }

    private async handleMessage(message: { type: string; payload?: unknown }): Promise<void> {
        const workspaceFolder = this.configManager.getWorkspaceFolder();

        switch (message.type) {
            case 'refresh': {
                this.sendInitialState();
                break;
            }
            case 'browseFolder': {
                const payload = message.payload as { field: string; index?: number };
                const selected = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    defaultUri: workspaceFolder ? vscode.Uri.file(workspaceFolder) : undefined,
                    openLabel: 'Selecionar Pasta',
                });
                if (selected && selected[0]) {
                    this.panel.webview.postMessage({
                        type: 'folderSelected',
                        payload: {
                            field: payload.field,
                            index: payload.index,
                            value: selected[0].fsPath,
                        },
                    });
                }
                break;
            }
            case 'browsePfFile': {
                const selected = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: true,
                    filters: { 'OpenEdge Parameter Files': ['pf'], 'All Files': ['*'] },
                    defaultUri: workspaceFolder ? vscode.Uri.file(workspaceFolder) : undefined,
                    openLabel: 'Selecionar Arquivo .pf',
                });
                if (selected && selected.length > 0) {
                    const paths = selected.map((u) => {
                        if (workspaceFolder && u.fsPath.toLowerCase().startsWith(workspaceFolder.toLowerCase())) {
                            return path.relative(workspaceFolder, u.fsPath);
                        }
                        return u.fsPath;
                    });
                    this.panel.webview.postMessage({
                        type: 'pfFilesSelected',
                        payload: paths,
                    });
                }
                break;
            }
            case 'save': {
                if (!workspaceFolder) {
                    vscode.window.showErrorMessage(
                        'Abra uma pasta (workspace) no VS Code antes de salvar a configuração OpenEdge.'
                    );
                    return;
                }
                const config = message.payload as OpenEdgeConfig;
                const savedPath = await this.configManager.saveConfig(workspaceFolder, config);
                vscode.window.showInformationMessage(
                    `Configuração OpenEdge salva em ${path.basename(savedPath)}!`
                );
                this.sendInitialState();
                break;
            }
            case 'openRawJson': {
                if (!workspaceFolder) {
                    vscode.window.showErrorMessage('Nenhum workspace aberto.');
                    return;
                }
                let filePath = this.configManager.findConfigFile(workspaceFolder);
                if (!filePath) {
                    filePath = await this.configManager.saveConfig(workspaceFolder, {
                        workingDirectory: '${workspaceFolder}\\Temp',
                        proPath: ['${workspaceFolder}'],
                        proPathMode: 'overwrite',
                    });
                }
                const doc = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(doc);
                break;
            }
            case 'readDictionary': {
                await vscode.commands.executeCommand('progressFormatter.readDictionary');
                break;
            }
        }
    }

    private dispose(): void {
        ConfigWebviewPanel.currentPanel = undefined;
        while (this.disposables.length) {
            this.disposables.pop()?.dispose();
        }
    }

    private getHtml(): string {
        return /* html */ `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Configuração OpenEdge ABL</title>
<style>
  :root {
    --gap: 12px;
    --radius: 6px;
  }
  * { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0;
    padding: 20px 24px 60px;
    max-width: 920px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 14px;
    margin-bottom: 20px;
  }
  h1 {
    margin: 0;
    font-size: 1.45em;
    font-weight: 600;
  }
  .subtitle {
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
    margin-top: 4px;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.8em;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
  }
  .card {
    background: var(--vscode-sideBar-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 16px;
  }
  .card h2 {
    margin: 0 0 6px;
    font-size: 1.08em;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .hint {
    color: var(--vscode-descriptionForeground);
    font-size: 0.88em;
    margin: 0 0 12px;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }
  .row > input, .row > select {
    flex: 1;
  }
  label {
    display: block;
    font-weight: 500;
    margin: 10px 0 4px;
    font-size: 0.92em;
  }
  input[type="text"], select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border-radius: 4px;
    font-family: inherit;
    font-size: inherit;
  }
  input:focus, select:focus {
    outline: 1px solid var(--vscode-focusBorder);
  }
  button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.92em;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    white-space: nowrap;
  }
  button:hover {
    background: var(--vscode-button-secondaryHoverBackground);
  }
  button.primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    font-weight: 500;
  }
  button.primary:hover {
    background: var(--vscode-button-hoverBackground);
  }
  button.danger {
    background: transparent;
    color: var(--vscode-errorForeground);
    border: 1px solid var(--vscode-errorForeground);
    padding: 4px 8px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    font-size: 0.86em;
    cursor: pointer;
  }
  .chip:hover {
    border-color: var(--vscode-focusBorder);
  }
  .list-item {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
  }
  .deploy-card {
    border: 1px solid var(--vscode-panel-border);
    background: var(--vscode-editor-background);
    border-radius: var(--radius);
    padding: 12px;
    margin-bottom: 10px;
  }
  .actions-bar {
    position: sticky;
    bottom: 0;
    background: var(--vscode-editor-background);
    border-top: 1px solid var(--vscode-panel-border);
    padding: 12px 0;
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 20px;
  }
  .shortcuts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 8px;
    font-size: 0.88em;
  }
  .shortcut-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 10px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
  }
  kbd {
    font-family: var(--vscode-editor-font-family);
    background: var(--vscode-keybindingLabel-background, rgba(128,128,128,0.2));
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 0.9em;
  }
</style>
</head>
<body>
  <header>
    <div>
      <h1>Configuração OpenEdge ABL</h1>
      <div class="subtitle" id="workspaceInfo">Carregando workspace...</div>
    </div>
    <div style="display:flex; gap:8px; align-items:center;">
      <span class="badge" id="configBadge">.openedge-zext.json</span>
      <button id="btnOpenJson">Abrir JSON</button>
      <button class="primary" id="btnSaveTop">Salvar</button>
    </div>
  </header>

  <section class="card">
    <h2>1. Instalação OpenEdge (DLC) e Diretório de Trabalho</h2>
    <p class="hint">Selecione a pasta DLC detectada automaticamente ou procure manualmente. Deixe vazio para usar a variável de ambiente <code>DLC</code>.</p>
    <label for="dlcPath">Caminho DLC (dlcPath)</label>
    <div class="row">
      <input type="text" id="dlcPath" placeholder="Ex: C:\\Progress\\OpenEdge ou C:\\dlc116" />
      <button id="btnBrowseDlc">Procurar...</button>
    </div>
    <div class="chips" id="detectedDlcs"></div>

    <label for="workingDirectory">Diretório de Trabalho (workingDirectory)</label>
    <div class="row">
      <input type="text" id="workingDirectory" placeholder="\${workspaceFolder}\\Temp" />
      <button id="btnBrowseWorkDir">Procurar...</button>
    </div>
  </section>

  <section class="card">
    <h2>
      <span>2. PROPATH</span>
      <select id="proPathMode" style="width:auto;">
        <option value="overwrite">overwrite (substituir)</option>
        <option value="prepend">prepend (antes do ambiente)</option>
        <option value="append">append (depois do ambiente)</option>
      </select>
    </h2>
    <p class="hint">Diretórios onde o OpenEdge busca includes (<code>{arquivo.i}</code>) e programas. Suporta <code>\${workspaceFolder}</code>.</p>
    <div id="proPathList"></div>
    <div class="row" style="margin-top:8px;">
      <button id="btnAddProPath">+ Adicionar Pasta</button>
      <button id="btnAddWorkspaceProPath">+ Adicionar \${workspaceFolder}</button>
    </div>
  </section>

  <section class="card">
    <h2>3. Parameter Files (.pf) e Dicionário de Banco</h2>
    <p class="hint">Arquivos <code>.pf</code> usados para conectar aos bancos na compilação, execução e leitura do dicionário.</p>
    <div id="pfList"></div>
    <div class="row" style="margin-top:8px;">
      <button id="btnAddPf">+ Selecionar Arquivo .pf</button>
    </div>
    <div class="chips" id="discoveredPfs"></div>

    <label>Bancos para Auto-Complete (dbDictionary — nomes lógicos)</label>
    <div id="dbList"></div>
    <div class="row" style="margin-top:8px;">
      <input type="text" id="newDbName" placeholder="Ex: sports2000 ou ems2cad" />
      <button id="btnAddDb">+ Adicionar Banco</button>
      <button class="primary" id="btnReadDict">Ler Dicionário Agora</button>
    </div>
  </section>

  <section class="card">
    <h2>4. Deploy (Compilação e Envio)</h2>
    <p class="hint">Define para onde copiar o <code>.r</code> (Alt+F1 / Alt+F3) ou o código fonte (Alt+F2) e ações pós-deploy (URL ou comando).</p>
    <div id="deployList"></div>
    <button id="btnAddDeploy">+ Adicionar Tarefa de Deploy</button>
  </section>

  <section class="card">
    <h2>Atalhos Rápidos</h2>
    <div class="shortcuts">
      <div class="shortcut-item"><span>Check Syntax</span><kbd>Shift+F2</kbd></div>
      <div class="shortcut-item"><span>Compile &amp; Deploy</span><kbd>Alt+F1</kbd></div>
      <div class="shortcut-item"><span>Deploy Source</span><kbd>Alt+F2</kbd></div>
      <div class="shortcut-item"><span>Compile with Options</span><kbd>Alt+F3</kbd></div>
      <div class="shortcut-item"><span>Run Program</span><kbd>F2</kbd></div>
    </div>
  </section>

  <div class="actions-bar">
    <button id="btnRefresh">Recarregar</button>
    <button class="primary" id="btnSaveBottom">Salvar Configuração</button>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  let state = {
    workingDirectory: '',
    proPath: [],
    proPathMode: 'overwrite',
    dlcPath: '',
    parameterFiles: [],
    dbDictionary: [],
    deployment: []
  };

  function render() {
    document.getElementById('dlcPath').value = state.dlcPath || '';
    document.getElementById('workingDirectory').value = state.workingDirectory || '';
    document.getElementById('proPathMode').value = state.proPathMode || 'overwrite';

    // PROPATH list
    const proPathEl = document.getElementById('proPathList');
    proPathEl.innerHTML = '';
    state.proPath.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = \`
        <input type="text" value="\${escapeAttr(p)}" data-propath="\${idx}" />
        <button data-browse-propath="\${idx}">Pasta...</button>
        <button class="danger" data-del-propath="\${idx}">Remover</button>
      \`;
      proPathEl.appendChild(div);
    });

    // PF list
    const pfEl = document.getElementById('pfList');
    pfEl.innerHTML = '';
    state.parameterFiles.forEach((pf, idx) => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = \`
        <input type="text" value="\${escapeAttr(pf)}" data-pf="\${idx}" />
        <button class="danger" data-del-pf="\${idx}">Remover</button>
      \`;
      pfEl.appendChild(div);
    });

    // DB Dictionary list
    const dbEl = document.getElementById('dbList');
    dbEl.innerHTML = '';
    state.dbDictionary.forEach((db, idx) => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = \`
        <input type="text" value="\${escapeAttr(db)}" data-db="\${idx}" />
        <button class="danger" data-del-db="\${idx}">Remover</button>
      \`;
      dbEl.appendChild(div);
    });

    // Deploy list
    const deployEl = document.getElementById('deployList');
    deployEl.innerHTML = '';
    state.deployment.forEach((task, idx) => {
      const card = document.createElement('div');
      card.className = 'deploy-card';
      const postActionsHtml = (task.postAction || []).map((act, aIdx) => \`
        <div class="list-item" style="margin-top:6px;">
          <select data-pa-type="\${idx}:\${aIdx}" style="width:120px;flex:none;">
            <option value="URL" \${act.actionType === 'URL' ? 'selected' : ''}>URL</option>
            <option value="COMMAND" \${act.actionType === 'COMMAND' ? 'selected' : ''}>COMMAND</option>
          </select>
          <input type="text" value="\${escapeAttr(act.command)}" placeholder="http://localhost:8080/..." data-pa-cmd="\${idx}:\${aIdx}" />
          <button class="danger" data-del-pa="\${idx}:\${aIdx}">X</button>
        </div>
      \`).join('');

      card.innerHTML = \`
        <div class="row">
          <select data-deploy-type="\${idx}" style="width:170px;flex:none;">
            <option value="current.r-code" \${task.taskType === 'current.r-code' ? 'selected' : ''}>current.r-code (.r)</option>
            <option value="current.source" \${task.taskType === 'current.source' ? 'selected' : ''}>current.source (fonte)</option>
          </select>
          <input type="text" value="\${escapeAttr(task.path)}" placeholder="Pasta de destino (ex: C:\\\\out)" data-deploy-path="\${idx}" />
          <button data-browse-deploy="\${idx}">Pasta...</button>
          <button class="danger" data-del-deploy="\${idx}">Remover</button>
        </div>
        <label style="display:flex;align-items:center;gap:6px;margin:6px 0 0;font-weight:normal;font-size:0.88em;cursor:pointer;">
          <input type="checkbox" data-deploy-sub="\${idx}" \${task.preserveSubfolder ? 'checked' : ''} style="width:auto;" />
          Manter estrutura de subpastas relativa ao workspace
        </label>
        <div style="margin-top:8px;">
          <small style="color:var(--vscode-descriptionForeground);">Post-Actions (opcional):</small>
          \${postActionsHtml}
          <button style="margin-top:6px;" data-add-pa="\${idx}">+ Post-Action</button>
        </div>
      \`;
      deployEl.appendChild(card);
    });

    bindDynamicEvents();
  }

  function escapeAttr(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function bindDynamicEvents() {
    document.querySelectorAll('[data-propath]').forEach(el => {
      el.oninput = () => { state.proPath[Number(el.dataset.propath)] = el.value; };
    });
    document.querySelectorAll('[data-browse-propath]').forEach(el => {
      el.onclick = () => vscode.postMessage({ type: 'browseFolder', payload: { field: 'proPath', index: Number(el.dataset.browsePropath) } });
    });
    document.querySelectorAll('[data-del-propath]').forEach(el => {
      el.onclick = () => { state.proPath.splice(Number(el.dataset.delPropath), 1); render(); };
    });

    document.querySelectorAll('[data-pf]').forEach(el => {
      el.oninput = () => { state.parameterFiles[Number(el.dataset.pf)] = el.value; };
    });
    document.querySelectorAll('[data-del-pf]').forEach(el => {
      el.onclick = () => { state.parameterFiles.splice(Number(el.dataset.delPf), 1); render(); };
    });

    document.querySelectorAll('[data-db]').forEach(el => {
      el.oninput = () => { state.dbDictionary[Number(el.dataset.db)] = el.value; };
    });
    document.querySelectorAll('[data-del-db]').forEach(el => {
      el.onclick = () => { state.dbDictionary.splice(Number(el.dataset.delDb), 1); render(); };
    });

    document.querySelectorAll('[data-deploy-type]').forEach(el => {
      el.onchange = () => { state.deployment[Number(el.dataset.deployType)].taskType = el.value; };
    });
    document.querySelectorAll('[data-deploy-path]').forEach(el => {
      el.oninput = () => { state.deployment[Number(el.dataset.deployPath)].path = el.value; };
    });
    document.querySelectorAll('[data-deploy-sub]').forEach(el => {
      el.onchange = () => { state.deployment[Number(el.dataset.deploySub)].preserveSubfolder = el.checked; };
    });
    document.querySelectorAll('[data-browse-deploy]').forEach(el => {
      el.onclick = () => vscode.postMessage({ type: 'browseFolder', payload: { field: 'deploy', index: Number(el.dataset.browseDeploy) } });
    });
    document.querySelectorAll('[data-del-deploy]').forEach(el => {
      el.onclick = () => { state.deployment.splice(Number(el.dataset.delDeploy), 1); render(); };
    });
    document.querySelectorAll('[data-add-pa]').forEach(el => {
      el.onclick = () => {
        const idx = Number(el.dataset.addPa);
        state.deployment[idx].postAction = state.deployment[idx].postAction || [];
        state.deployment[idx].postAction.push({ actionType: 'URL', command: '' });
        render();
      };
    });
    document.querySelectorAll('[data-pa-type]').forEach(el => {
      el.onchange = () => {
        const [i, a] = el.dataset.paType.split(':').map(Number);
        state.deployment[i].postAction[a].actionType = el.value;
      };
    });
    document.querySelectorAll('[data-pa-cmd]').forEach(el => {
      el.oninput = () => {
        const [i, a] = el.dataset.paCmd.split(':').map(Number);
        state.deployment[i].postAction[a].command = el.value;
      };
    });
    document.querySelectorAll('[data-del-pa]').forEach(el => {
      el.onclick = () => {
        const [i, a] = el.dataset.delPa.split(':').map(Number);
        state.deployment[i].postAction.splice(a, 1);
        render();
      };
    });
  }

  function syncTopInputs() {
    state.dlcPath = document.getElementById('dlcPath').value.trim();
    state.workingDirectory = document.getElementById('workingDirectory').value.trim();
    state.proPathMode = document.getElementById('proPathMode').value;
  }

  function save() {
    syncTopInputs();
    const cleaned = {
      ...state,
      proPath: state.proPath.map(s => s.trim()).filter(Boolean),
      parameterFiles: state.parameterFiles.map(s => s.trim()).filter(Boolean),
      dbDictionary: state.dbDictionary.map(s => s.trim()).filter(Boolean),
      deployment: state.deployment
        .filter(d => d.path && d.path.trim())
        .map(d => ({
          taskType: d.taskType,
          path: d.path.trim(),
          ...(d.preserveSubfolder ? { preserveSubfolder: true } : {}),
          ...(d.postAction && d.postAction.filter(a => a.command.trim()).length > 0
            ? { postAction: d.postAction.filter(a => a.command.trim()) }
            : {})
        }))
    };
    vscode.postMessage({ type: 'save', payload: cleaned });
  }

  document.getElementById('btnSaveTop').onclick = save;
  document.getElementById('btnSaveBottom').onclick = save;
  document.getElementById('btnOpenJson').onclick = () => vscode.postMessage({ type: 'openRawJson' });
  document.getElementById('btnRefresh').onclick = () => vscode.postMessage({ type: 'refresh' });
  document.getElementById('btnReadDict').onclick = () => vscode.postMessage({ type: 'readDictionary' });

  document.getElementById('btnBrowseDlc').onclick = () => vscode.postMessage({ type: 'browseFolder', payload: { field: 'dlcPath' } });
  document.getElementById('btnBrowseWorkDir').onclick = () => vscode.postMessage({ type: 'browseFolder', payload: { field: 'workingDirectory' } });
  document.getElementById('btnAddProPath').onclick = () => {
    state.proPath.push('');
    render();
    vscode.postMessage({ type: 'browseFolder', payload: { field: 'proPath', index: state.proPath.length - 1 } });
  };
  document.getElementById('btnAddWorkspaceProPath').onclick = () => {
    if (!state.proPath.includes('\${workspaceFolder}')) {
      state.proPath.push('\${workspaceFolder}');
      render();
    }
  };
  document.getElementById('btnAddPf').onclick = () => vscode.postMessage({ type: 'browsePfFile' });
  document.getElementById('btnAddDb').onclick = () => {
    const input = document.getElementById('newDbName');
    const val = input.value.trim();
    if (val && !state.dbDictionary.includes(val)) {
      state.dbDictionary.push(val);
      input.value = '';
      render();
    }
  };
  document.getElementById('btnAddDeploy').onclick = () => {
    state.deployment.push({ taskType: 'current.r-code', path: '', postAction: [] });
    render();
  };

  window.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    if (type === 'init') {
      state = payload.config;
      document.getElementById('workspaceInfo').textContent = payload.workspaceFolder
        ? 'Workspace: ' + payload.workspaceFolder
        : 'Nenhum workspace aberto (abra uma pasta no VS Code)';
      document.getElementById('configBadge').textContent = payload.hasExistingConfig
        ? payload.configFileName + ' (ativo)'
        : payload.configFileName + ' (novo)';

      const dlcContainer = document.getElementById('detectedDlcs');
      dlcContainer.innerHTML = '';
      (payload.detectedDlcs || []).forEach(d => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = '✓ ' + d.path + ' (' + d.version + ')';
        chip.title = d.source;
        chip.onclick = () => { state.dlcPath = d.path; render(); };
        dlcContainer.appendChild(chip);
      });

      const pfContainer = document.getElementById('discoveredPfs');
      pfContainer.innerHTML = '';
      (payload.discoveredPfs || []).forEach(pf => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = '+ ' + pf;
        chip.onclick = () => {
          if (!state.parameterFiles.includes(pf)) {
            state.parameterFiles.push(pf);
            render();
          }
        };
        pfContainer.appendChild(chip);
      });

      render();
    } else if (type === 'folderSelected') {
      syncTopInputs();
      if (payload.field === 'dlcPath') state.dlcPath = payload.value;
      else if (payload.field === 'workingDirectory') state.workingDirectory = payload.value;
      else if (payload.field === 'proPath') state.proPath[payload.index] = payload.value;
      else if (payload.field === 'deploy') state.deployment[payload.index].path = payload.value;
      render();
    } else if (type === 'pfFilesSelected') {
      for (const p of payload) {
        if (!state.parameterFiles.includes(p)) state.parameterFiles.push(p);
      }
      render();
    }
  });
</script>
</body>
</html>`;
    }
}
