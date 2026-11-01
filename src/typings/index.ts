
import type { ResolvedConfig } from 'vite';
import { ProjectBuild } from '../plugin/transpilator/ProjectBuild';
import { ChangeEvent, FileInfo } from '../plugin/transpilator/Interfaces';

export interface ProjectContext {
    command: ResolvedConfig['command'];
    mode: string;
    isBuilding: boolean;
    isDev: boolean;
    isProduction: boolean;
    isLibMode: boolean;

    rootPath: string;
    projectDir: string;
    indexPath: string | undefined;
    mainPath: string | undefined;
    tsconfigPath: string | undefined;
    outputDir: string;
    publicDir: string | undefined;

    cssCodeSplit: boolean;
}



export type TypeComposerPluginOptions = {
    name: string;
    analyze?: (code: string, id: string) => Promise<FileInfo | undefined>;
    transform?: (fileInfo: FileInfo) => Promise<string | null | undefined>;
    buildStart?: () => Promise<void>;
    watchChange?: (

        id: string,
        change: { event: ChangeEvent },
    ) => Promise<void>;
};

export type TypeComposeCompilerOptions = {
    compile: (_code: string, id: string) => Promise<any>;
    analyze: (code: string, id: string) => Promise<FileInfo | undefined>;

    transform: (
        fileInfo: FileInfo
    ) => Promise<String | null | undefined>;

    watchChange: (

        id: string,
        change: { event: ChangeEvent },
    ) => Promise<void>;

    buildStart: (

    ) => Promise<void>;

    configResolved: (

        config: any,
    ) => Promise<void>;

    configureServer: (

        server: any,
    ) => Promise<void>;

    load: (

        id: string,
    ) => Promise<string | null | undefined>;

    resolveId: (

        id: string,
        importer: string,
    ) => Promise<any | null | undefined>;
};