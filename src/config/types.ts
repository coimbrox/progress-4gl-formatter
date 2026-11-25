export type ProPathMode = 'overwrite' | 'append' | 'prepend';

export type DeploymentTaskType = 'current.r-code' | 'current.source';

export type PostActionType = 'URL' | 'COMMAND';

export interface PostAction {
    actionType: PostActionType;
    command: string;
}

export interface DeploymentTask {
    taskType: DeploymentTaskType;
    path: string;
    preserveSubfolder?: boolean;
    postAction?: PostAction[];
}

export interface OpenEdgeConfig {
    workingDirectory?: string;
    proPath?: string[];
    proPathMode?: ProPathMode;
    dlcPath?: string;
    parameterFiles?: string[];
    dbDictionary?: string[];
    deployment?: DeploymentTask[];
}

export interface ResolvedOpenEdgeConfig {
    configFilePath: string | undefined;
    workspaceFolder: string;
    workingDirectory: string;
    proPath: string[];
    proPathMode: ProPathMode;
    dlcPath: string;
    parameterFiles: string[];
    dbDictionary: string[];
    deployment: DeploymentTask[];
}

export interface DetectedDlc {
    path: string;
    version: string;
    source: string;
}
