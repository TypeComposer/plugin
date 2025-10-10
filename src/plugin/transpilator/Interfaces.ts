import { ClassDeclaration, SourceFile, Symbol } from "ts-morph";
import { RegisterOptions } from "./base/Register";
import { Debuger } from "../Debug/Log";

export type ChangeEvent = "create" | "update" | "delete";

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

export interface ClassInfo {
  className: string | undefined;
  extends: string | undefined;
  decorators: string[];
  isComponent: boolean;
  isTemplateLoaded: boolean;
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

export interface FileInfo {
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
