
import type { ResolvedConfig } from 'vite';
import { ClassDeclaration, SourceFile } from 'ts-morph';
import { Debuger } from '../plugin/Debug/Log';
import { ProjectBuild } from '../compiler/base/ProjectBuild';

export type ChangeEvent = "create" | "update" | "delete" | "start";

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

export type FileCache = {
    code: string;
    className: string;
    timestamp: number;
    link?: string;
    [key: string]: any;
};


export type TypeComposerPlugin = {
    name: string;
    project: ProjectBuild;
    isApplicable: (id: string) => boolean;
    analyze: (id: string) => Promise<FileInfo | undefined>;
    transform: (id: string, fileInfo: FileInfo, code: string) => Promise<string | null | undefined>;
    buildStart: () => Promise<void>;
    resolveId: (id: string, importer: string) => Promise<any | null | undefined>;
    watchChange: (id: string, change: { event: ChangeEvent }) => Promise<void>;
};

export type TypeComposeCompilerOptions = {
    compile: (id: string, code: string) => Promise<any>;
    analyze: (id: string, code: string) => Promise<FileInfo | undefined>;

    transform: (
        id: string,
        fileInfo: FileInfo,
        code: string,
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


export type StandardizedFilePath = string & {
    _standardizedFilePathBrand: undefined;
};

export interface FileTheme {
    path: string;
    name: string;
}

export interface IAsstesFile {
    fileName: string;
    path: string;
}

export interface ImportInfo {
    moduleSpecifier: string;
    namedImport: string;
    symbol: Symbol | undefined;
    namespaceImport?: string;
    moduleSourcePath: string;
    isDefaultImport: boolean;
}

export interface IComponentInfo extends ElementDefinitionOptions {
    tag: string;
}

export interface RegisterOptions {
    tag?: string;
    templateUrl?: string;
    extends?: string;
    styleUrl?: string;
    scoped?: boolean;
}

export interface ClassInfo {
    className: string;
    extends: string | undefined;
    decorators: string[];
    isComponent: boolean;
    hasStyle: boolean;
    hasTemplate: boolean;
    isTemplateLoaded: boolean;
    hasExtends: boolean;
    elementTag: string | undefined;
    classDeclaration: ClassDeclaration;
    registerOptions: RegisterOptions;
    constructorDatas: string[];
    beforeClassDatas: string[];
    insertProperties: string[];
    afterClassDatas: string[];
    styles: string[];
    isExported: boolean;
    isExportedStyle: boolean;
    refComponents: { name: string; selectors: string; multiple?: boolean }[];
    parent:
    | {
        path: string;
        className: string;
    }
    | undefined;
}

export type FileInfoType = "script" | "style" | "template";

export interface FileInfoBase {
    type: FileInfoType;
}

export interface FileInfoScript extends FileInfoBase {
    path: string;
    sourceFile: SourceFile;
    classes: ClassInfo[];
    templatesUrl: string[];
    styleCode?: string;
    virtualFile?: string;
    removeDatas: string[];
    pathFolder: string;
    startDatas: string[];
    endDatas: string[];
}

export interface FileInfoStyle extends FileInfoBase {
    path: string;
    sourceFile: SourceFile;
    classes: ClassInfo[];
    templatesUrl: string[];
    styleCode: string;
    virtualFile?: string;
    removeDatas: string[];
    pathFolder: string;
    startDatas: string[];
    endDatas: string[];
}

export interface FileInfoTemplate extends FileInfoBase {
    path: string;
    sourceFile: SourceFile;
    classes: ClassInfo[];
    templatesUrl: string[];
    styleCode: string;
    virtualFile?: string;
    removeDatas: string[];
    pathFolder: string;
    startDatas: string[];
    endDatas: string[];
    code: string;
}

export type FileInfo = FileInfoScript | FileInfoStyle | FileInfoTemplate;

export function printClassInfo(classInfo: ClassInfo) {
    Debuger.log(`============ classInfo: ${classInfo.className} ============`);
    Debuger.log("extends: ", classInfo.extends);
    Debuger.log("decorators: ", classInfo.decorators);
    //Debuger.log('imports: ', classInfo.imports);
    Debuger.log("isComponent: ", classInfo.isComponent);
    Debuger.log("constructorDatas: ", classInfo.constructorDatas);
    Debuger.log("styles: ", classInfo.styles);
    Debuger.log("parent: ", classInfo.parent);
    Debuger.log("refComponents: ", classInfo.refComponents);
    Debuger.log("registerOptions: ", classInfo.registerOptions);
}

export function printFileInfo(fileInfo: FileInfo) {
    if (fileInfo.classes.length == 0) return;
    Debuger.log("============ fileInfo ============");
    Debuger.log("path: ", fileInfo.path);
    Debuger.log("templatesUrl: ", fileInfo.templatesUrl);
    Debuger.log("styleCode: ", fileInfo.styleCode);
    Debuger.log("virtualFile: ", fileInfo.virtualFile);
    Debuger.log("removeDatas: ", fileInfo.removeDatas);
    Debuger.log("startDatas: ", fileInfo.startDatas);
    Debuger.log("endDatas: ", fileInfo.endDatas);
    //Debuger.log('imports: ', fileInfo.imports);
}
