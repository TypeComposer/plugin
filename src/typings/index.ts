
import type { ResolvedConfig } from 'vite';
import { ClassDeclaration, SourceFile } from 'ts-morph';
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

export type REF_TYPES =
    "RefString" |
    "RefNumber" |
    "RefBoolean" |
    "RefList" |
    "RefSet" |
    "RefMap" |
    "RefState" |
    "RefObject"

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




export type ElementStyle =
    | "button"
    | "div"
    | "span"
    | "input"
    | "a"
    | "label"
    | "select"
    | "textarea"
    | "form"
    | "img"
    | "header"
    | "footer"
    | "nav"
    | "section"
    | "article"
    | "aside"
    | "main"
    | "figure"
    | "figcaption"
    | "table"
    | "thead"
    | "tbody"
    | "tr"
    | "td"
    | "th"
    | "ul"
    | "ol"
    | "li"
    | "dl"
    | "dt"
    | "dd"
    | "p"
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6";

export type TranslationOption = {
    defaulLocale: string;
    Locales: string[];
    translationPath?: string;
};

export interface Options {
    // pwa?: TypeComposerPWA.PWDOptions;
    debugger?: boolean;
    library?: boolean;
    router?: "auto" | "manual";
    translation?: TranslationOption;
    /**
     * assetsDir: assets directory
     * to disable assetsDir is neseariol pass undefined
     * @default 'src/assets'
     * */
    assetsDir?: string | undefined;
    serviceWorker?: "auto" | string;
    otimize?: boolean;
    /**
     * svgBuild: build svg
     * @default true
     */
    svgBuild?: boolean;
    /**
     * SSR support
     * @default false
     */
    ssr?: boolean;
    /**
     * Enable HMR (Hot Module Replacement)
     * @default false
     */
    metaHot?: boolean;
    /**
     * Enable API proxying
     * @default true
     */
    proxy?: boolean;
    /**
     * Styles configuration
     */
    styles?:
    | {
        exclude?: ElementStyle[] | "all";
        include?: ElementStyle[] | "all";
    }
    | false;
}