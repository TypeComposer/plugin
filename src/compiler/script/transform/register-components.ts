import { Debuger } from "../../../plugin/Debug/Log";
import { ClassInfo, FileInfo, RegisterOptions } from "../../../typings";
import { ProjectBuild } from "../../base/ProjectBuild";


const nativeElements: Record<string, string> = {
  HTMLButtonElement: "button",
  HTMLAnchorElement: "a",
  HTMLInputElement: "input",
  HTMLSelectElement: "select",
  HTMLTextAreaElement: "textarea",
  HTMLImageElement: "img",
  HTMLFormElement: "form",
  HTMLLabelElement: "label",
  HTMLUListElement: "ul",
  HTMLOListElement: "ol",
  HTMLLIElement: "li",
  HTMLTableElement: "table",
  HTMLTableRowElement: "tr",
  HTMLTableCellElement: "td",
  HTMLTableSectionElement: "tbody",
  HTMLParagraphElement: "p",
  HTMLHeadingElement: "h1",
  HTMLDivElement: "div",
  HTMLSpanElement: "span",
  HTMLQuoteElement: "blockquote",
  HTMLTimeElement: "time",
  HTMLProgressElement: "progress",
  HTMLMeterElement: "meter",
  HTMLDetailsElement: "details",
  HTMLDialogElement: "dialog",
  HTMLFieldSetElement: "fieldset",
  HTMLOutputElement: "output",
};

export class RegisterComponents {
  private static index: number = 1;
  private readonly project: ProjectBuild;

  constructor(project: ProjectBuild) {
    this.project = project;
  }

  private converClasNameToTag(file: string, classInfo: ClassInfo, project: ProjectBuild): string {
    const className = classInfo.className || "";
    const name = className
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/(\d+)([A-Z])/g, "$1-$2")
      .toLowerCase();
    let tag = name;
    while (!project.validTag(tag, file)) {
      RegisterComponents.index++;
      tag = `${name}-tc${RegisterComponents.index.toString()}`;
    }
    project.putTag(tag, file);
    return tag;
  }

  private async readRegister(fileInfo: FileInfo, classInfo: ClassInfo, project: ProjectBuild) {
    const decorators = classInfo.classDeclaration.getDecorators();
    const register = decorators.find((e: any) => e.getName() == "Register" && project.isDecoratorTypeComposer(e));
    const scoped = decorators.find((e: any) => e.getName() == "scoped" && project.isDecoratorTypeComposer(e));
    const registerArgs = register
      ?.getArguments()
      .map((arg: any) => arg.getText().replace(/,(?=\s*})/, ""))
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

  private normalizeExtends(registerOptions: RegisterOptions): string | undefined {
    const extendsValue = nativeElements[registerOptions.extends || ""];
    return (extendsValue && ("HTMLElement" !== extendsValue)) ? ',{ extends: "' + extendsValue + '" }' : ""
  }

  private async injectTag(fileInfo: FileInfo, classInfo: ClassInfo) {
    const tag = classInfo.registerOptions.tag;
    const className = classInfo.className;
    const classDecl = classInfo.classDeclaration;
    if (!classDecl) {
      Debuger.error(`Class ${className} not found in file ${fileInfo.path}`);
      return;
    }
    const line = `\TypeComposer.defineElement(${className}.TAG, ${className}${this.normalizeExtends(classInfo.registerOptions)});\n`;

    if (!classDecl.getStaticMember("NEW_TAG")) {
      classDecl.addProperty({
        name: "TAG",
        isStatic: true,
        isReadonly: true,
        initializer: `"${tag}"`,
      });
    }
    fileInfo.sourceFile.insertStatements(classDecl.getChildIndex() + 1, line);
  }

  public async register(fileInfo: FileInfo) {
    for await (const classInfo of fileInfo.classes) {
      if (classInfo.isComponent) {
        await this.readRegister(fileInfo, classInfo, this.project);
        await this.injectTag(fileInfo, classInfo);
      }
    }
    // await StyleBuild.updateTag(fileInfo);
  }
}
