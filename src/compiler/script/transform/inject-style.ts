import { existsSync } from "node:fs";
import { join } from "node:path";
import { FileInfo } from "../../../typings";
import { ProjectBuild } from "../../base/ProjectBuild";
import { TypeComposerUtils } from "../../../utils";

export interface StyleComponentFile { path: string; tag: string | undefined; className: string }

export class InjectStyle {

  constructor(readonly project: ProjectBuild) { }



  // private  getStyleCode(fileInfo: FileInfo): string {
  //   let styleCode = fileInfo.classes.filter((e) => e.styles.length > 0);
  //   if (styleCode == undefined || styleCode.length == 0) return "";
  //   return styleCode.map((e) => e.styles.join("\n")).join("\n");
  // }



  // public static async build(fileInfo: FileInfo, code: string): Promise<any> {
  //   fileInfo.styleCode = this.getStyleCode(fileInfo);
  //   if (fileInfo.styleCode != "") {
  //     let name = fileInfo.path.split("/").pop();
  //     name = name?.split(".")[0] || name;
  //     const timestamp = Date.now();
  //     fileInfo.virtualFile = `virtual:stylebase${name}${timestamp}.scss`;
  //     code = `import "${fileInfo.virtualFile}";\n${code}`;
  //   } else fileInfo.virtualFile = undefined;
  //   for await (const classInfo of fileInfo.classes) {
  //     if (classInfo.registerOptions?.styleUrl && existsSync(classInfo.registerOptions.styleUrl)) {
  //       let url = classInfo.registerOptions.styleUrl;
  //       code = `import "${url}";\n${code}`;
  //     }
  //   }
  //   return code;
  // }




  public async inject(fileInfo: FileInfo) {
    const types = TypeComposerUtils.STYLE_EXTENSIONS;
    for await (const classInfo of fileInfo.classes) {
      const componentName = classInfo.className;
      if (!componentName || !fileInfo.path) continue;
      classInfo.hasStyle = false;
      for await (const type of types) {
        if (existsSync(join(fileInfo.pathFolder, componentName + "." + type))) {
          fileInfo.sourceFile.addImportDeclaration({
            moduleSpecifier: `./${componentName}.${type}`,
            namedImports: [],
            defaultImport: undefined,
          });
          classInfo.isExportedStyle = true;
          classInfo.hasStyle = true;
          this.project.putStyle(join(fileInfo.pathFolder, componentName + "." + type), { link: fileInfo.path, tag: classInfo.registerOptions.tag, className: componentName, code: "", timestamp: 0 });
        }
      }
      if (classInfo.hasStyle) {
        const constructor = classInfo.classDeclaration.getConstructors()[0];
        const baseTag = classInfo.registerOptions.tag || componentName;
        if (constructor) {
          constructor.addStatements(`this.setAttribute("tc-style", "${baseTag}");`);
        } else {
          classInfo.classDeclaration.addConstructor({
            statements: [`this.setAttribute("tc-style", "${baseTag}");`],
          });
        }
      }

    }
  }





}
