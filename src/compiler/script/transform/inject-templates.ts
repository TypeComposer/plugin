import { writeFileSync } from "node:fs";
import { ClassInfo, FileInfo } from "../../../plugin/transpilator/Interfaces";
import { ProjectBuild } from "../../base/ProjectBuild";



export class InjectTemplates {

  constructor(private readonly project: ProjectBuild) { }

  private async injectImport(fileInfo: FileInfo, classInfo: ClassInfo) {
    const importPath = "./" + classInfo.className + ".template";
    fileInfo.sourceFile.addImportDeclaration({
      moduleSpecifier: importPath,
    });

  }

  private async injectTemplate(fileInfo: FileInfo, classInfo: ClassInfo) {
    const templatePath = fileInfo.pathFolder + "/" + classInfo.className + ".template";
    console.log("RegisterTemplates injectTemplate:", templatePath);
    const info = this.project.getTemplate(templatePath);
    if (info && info.code) {
      const existingMethod = classInfo.classDeclaration.getInstanceMethod("template");
      if (existingMethod) {
        existingMethod.setBodyText(`return (${info.code});`);
      }
      else {
        classInfo.classDeclaration.addMethod({
          name: "template",
          isAsync: false,
          isStatic: false,
          returnType: "any",
          statements: [`return (${info.code});`],
        });
      }
    }
    const code = fileInfo.sourceFile.getFullText();
    // debug criar um file de teste para verificar se o template foi injetado corretamente
    const testFilePath = fileInfo.pathFolder + "/" + classInfo.className + ".test.tsx";
    writeFileSync(testFilePath, code, "utf-8");
  }

  public async inject(fileInfo: FileInfo) {
    for await (const classInfo of fileInfo.classes) {
      if (classInfo.isComponent && classInfo.hasTemplate) {
        await this.injectImport(fileInfo, classInfo);
        await this.injectTemplate(fileInfo, classInfo);
      }
    }
  }
}
