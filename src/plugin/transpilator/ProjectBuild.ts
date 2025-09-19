import { ScriptKind } from "ts-morph";
import { statSync, existsSync } from "node:fs";
import { RegisterBuild } from "./base/Register";
import { StyleBuild } from "./base/StyleBuild";
import { FileInfo, ClassInfo, ChangeEvent } from "./Interfaces";
import path from "node:path";
import { Router } from "./base/RouterController";
import { Theme } from "./base/ThemeController";
import { TypeComposerOptions } from "../..";
import * as os from "os";
import { ProjectUtils } from "./ProjectUtils";
import { TemplateBuild } from "./base/TemplateBuild";
import { ComponentBuild } from "./base/ComponentBuild";
import { RefBuild } from "./base/RefBuild";
import { SvgBuild } from "./base/SvgBuild";
import { InfoComponent } from "./base/InfoComponent";

export class ProjectBuild extends ProjectUtils {
  constructor(public options: TypeComposerOptions) {
    super(options);
  }

  get assetsDir(): string | undefined {
    if (this.options.assetsDir == undefined) return undefined;
    return path.join(this.rootPath, this.options.assetsDir);
  }

  get isAssetsValid(): boolean {
    if (this.assetsDir == undefined) return false;
    if (existsSync(this.assetsDir)) {
      const stat = statSync(this.assetsDir);
      return stat && stat.isDirectory();
    }
    return false;
  }

  async buildStart() {
    const routers = await Router.findRouterTsFiles(this.projectDir);
    if (routers.length > 0) {
      this.routerPath = routers[0];
    }
    Theme.findFiles(this.projectDir);
    if (this.options?.translation && this.options?.translation?.defaultLanguage) {
      if (this.options.translation?.folder?.includes("src/")) {
        this.options.translation.folder = this.options.translation.folder.split("src/")[1];
      }
      this.options.translation["folder"] = path.join(this.rootPath, "src", this.options.translation?.folder || "translation");
      this.translationPath = this.options.translation["folder"];
    }
  }

  public async analyze(pathName: string, code: string, scriptKind: ScriptKind, tpc: any): Promise<string> {
    const existingSourceFile = this.getSourceFile(pathName);
    if (existingSourceFile) this.removeSourceFile(existingSourceFile);
    const sourceFile = await this.normalizeImport(pathName, code, scriptKind);
    const fileInfo: FileInfo = {
      sourceFile: sourceFile,
      classes: [],
      removeDatas: [],
      path: pathName,
      templatesUrl: [],
      startDatas: [],
      endDatas: [],
      pathFolder: path.dirname(pathName),
    };
    this.files.set(pathName, fileInfo);
    this.components.set(pathName, { isStatic: false, info: new Map() });
    await InfoComponent.analyze(fileInfo, this);
    if (fileInfo.classes.find((classInfo: ClassInfo) => classInfo.isComponent) == undefined) {
      await RefBuild.analyze(fileInfo, this);
      return await this.build(fileInfo);
    }
    await RegisterBuild.analyze(fileInfo, this);
    await StyleBuild.analyze(fileInfo);
    await RefBuild.analyze(fileInfo, this);
    await TemplateBuild.analyze(fileInfo);
    await ComponentBuild.analyze(fileInfo);
    await Router.analyze(fileInfo, this);
    return await this.build(fileInfo);
  }

  insertProperties(classInfo: ClassInfo): string {
    let classCode: string = classInfo.classDeclaration.getText();
    const constructorDatas = classInfo.classDeclaration.getConstructors()[0]?.getText();
    const properties = classInfo.insertProperties.join("\n");
    classCode = classCode.replace(constructorDatas, properties + "\n" + constructorDatas);
    return classCode;
  }

  private async build(fileInfo: FileInfo) {
    if (fileInfo.path == this.mainPath) {
      const imports = ["import 'virtual:translation';"];
      if (this.options.styles !== false) imports.push(`import "typecomposer/styles/style.scss"`);
      if (this.options.router !== "manual" && this.routerPath) imports.push(`import "${this.routerPath}"`);
      return `${imports.join("\n")}\n${fileInfo.sourceFile.getFullText()}`;
    }
    return fileInfo.sourceFile.getFullText();
  }

  public async transform(code: string, id: string, tpc: any): Promise<string> {
    if (!code) return code;
    const scriptKind = ProjectBuild.getScriptKind(id);
    if (scriptKind !== ScriptKind.Unknown) {
      return await this.analyze(id, code, scriptKind, tpc);
    } else if (id.endsWith(TemplateBuild.EXTENSION)) {
      return TemplateBuild.transform(code, id, this);
    } else if (this.options.svgBuild != false && id.endsWith(".svg")) {
      return SvgBuild.transform(code, id, this);
    } else if (StyleBuild.isStyleFile(id)) {
      return StyleBuild.transform(code, id, this);
    }
    return code;
  }

  async watchChange(id: string, change: { event: ChangeEvent }) {
    Router.watchChange(id, change, this);
    Theme.watchChange(id, change, this);
    if (TemplateBuild.isTemplateFile(id)) TemplateBuild.watchChange(id, change, this);
    if (StyleBuild.isStyleFile(id)) StyleBuild.watchChange(id, change, this);
  }

  public static normalizePath(pathName: string): string {
    if (pathName && os.platform() == "win32") return pathName.replace(/\\/g, "/");
    return pathName;
  }
}
