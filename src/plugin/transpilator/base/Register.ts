import { FileInfo, ClassInfo } from "../Interfaces";
import { Debuger } from "../../Debug/Log";
import { StyleBuild } from "./StyleBuild";
import { ProjectUtils } from "../ProjectUtils";

export interface RegisterOptions {
  tag?: string;
  templateUrl?: string;
  extends?: string;
  styleUrl?: string;
  scoped?: boolean;
}

export class RegisterBuild {
  private static index: number = 1;

  private static converClasNameToTag(file: string, classInfo: ClassInfo, project: ProjectUtils): string {
    const className = classInfo.className || "";
    const name = className
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/(\d+)([A-Z])/g, "$1-$2")
      .toLowerCase();
    let tag = name;
    while (!project.validTag(tag, file)) {
      RegisterBuild.index++;
      tag = `${name}-tc${RegisterBuild.index.toString()}`;
    }
    project.putTag(tag, file);
    return tag;
  }

  private static async readRegister(fileInfo: FileInfo, classInfo: ClassInfo, project: ProjectUtils) {
    const decorators = classInfo.classDeclaration.getDecorators();
    const register = decorators.find((e) => e.getName() == "Register" && project.isDecoratorTypeComposer(e));
    const scoped = decorators.find((e) => e.getName() == "scoped" && project.isDecoratorTypeComposer(e));
    const registerArgs = register
      ?.getArguments()
      .map((arg) => arg.getText().replace(/,(?=\s*})/, ""))
      .join(", ")
      .replace(/(\w+):/g, '"$1":')
      .replace(/'/g, '"');
    if (scoped) classInfo.isExported = false;
    if (register) fileInfo.removeDatas.push(register.getText());
    try {
      classInfo.registerOptions = classInfo.registerOptions ? { ...classInfo.registerOptions, ...JSON.parse(registerArgs || "{}") } : JSON.parse(registerArgs || "{}");
    } catch (error) {
      Debuger.error("error: ", error);
    }
    if (classInfo.registerOptions?.scoped) classInfo.isExported = !classInfo.registerOptions.scoped;
    if (classInfo.registerOptions.tag == undefined) classInfo.registerOptions.tag = this.converClasNameToTag(fileInfo.path, classInfo, project);
    else project.putTag(classInfo.registerOptions.tag, fileInfo.path);
    classInfo.elementTag = classInfo.registerOptions.tag;
    register?.remove();
    scoped?.remove();
  }

  public static async injectTag(fileInfo: FileInfo, classInfo: ClassInfo) {
    const tag = classInfo.registerOptions.tag;
    const className = classInfo.classDeclaration.getName();
    const line = `\TypeComposer.defineElement(${className}.TAG, ${className}${classInfo.registerOptions?.extends ? ',{ extends: "' + classInfo.registerOptions.extends + '" }' : ""});\n`;

    const classDecl = classInfo.classDeclaration;
    if (!classDecl.getStaticMember("NEW_TAG")) {
      classDecl.addProperty({
        name: "TAG",
        isStatic: true,
        isReadonly: true,
        initializer: `"${tag}"`,
      });
    }
    fileInfo.sourceFile.insertStatements(classInfo.classDeclaration.getChildIndex() + 1, line);
  }

  public static async analyze(fileInfo: FileInfo, project: ProjectUtils) {
    for await (const classInfo of fileInfo.classes) {
      await this.readRegister(fileInfo, classInfo, project);
      await this.injectTag(fileInfo, classInfo);
    }
    await StyleBuild.updateTag(fileInfo);
  }
}
