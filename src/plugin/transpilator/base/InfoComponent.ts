import { ClassDeclaration, Decorator, SourceFile, ts } from "ts-morph";
import { FileInfo, ClassInfo, printFileInfo, IComponentInfo } from "../Interfaces";
import { ProjectBuild } from "../ProjectBuild";
import { Node } from "ts-morph";

interface IExtendsInfo {
  extendsName: string;
  path: string;
  pathDeclaration: string;
  sourceFile?: SourceFile;
  options?: ElementDefinitionOptions & { tag?: string };
}

export class InfoComponent {
  private static changeExtensionToJs(filePath: string): string {
    return filePath.replace(/\.d\.ts$/, ".js");
  }

  private static getDefineElementArgsWithClassRef(data: IExtendsInfo, project: ProjectBuild): IComponentInfo | undefined {
    if (!data.sourceFile) return undefined;
    const path = data.sourceFile.getFilePath();
    const componentInfo = project.components.get(path) || { isStatic: path.includes("node_modules/"), info: new Map<string, IComponentInfo>() };
    if (componentInfo.info.has(data.extendsName)) {
      return componentInfo.info.get(data.extendsName);
    }
    for (const node of data.sourceFile.getDescendants()) {
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression();

        if (Node.isPropertyAccessExpression(expr)) {
          const fullAccess = expr.getText();
          if (fullAccess === "TypeComposer.defineElement") {
            const args = node.getArguments().map((arg) => arg.getText());
            if (args.length >= 2 && args[1] === data.extendsName) {
              const info = {
                ...(args.length > 2
                  ? JSON.parse(
                      args[2]
                        .replace(/,\s*}/g, "}")
                        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
                        .replace(/'/g, '"')
                    )
                  : {}),
                tag: args[0].replace(/^['"]|['"]$/g, ""),
              };
              componentInfo.info.set(data.extendsName, info);
              project.components.set(data.sourceFile.getFilePath(), componentInfo);
              return info;
            }
          }
        }
      }
    }
    return undefined;
  }

  private static getExtendsInfo(classDeclaration: ClassDeclaration, project: ProjectBuild): IExtendsInfo {
    const heritage = classDeclaration.getHeritageClauses().find((h) => h.getToken() === ts.SyntaxKind.ExtendsKeyword);
    const extendsType = heritage?.getTypeNodes()[0];

    const extendsSymbol = extendsType?.getType().getSymbol();
    const extendsDecl = extendsSymbol?.getDeclarations()?.[0];
    const extendsSourceFile = extendsDecl?.getSourceFile();
    const sourceFile = (extendsSourceFile?.getFilePath().endsWith("d.ts") ? project.getSourceFile(this.changeExtensionToJs(extendsSourceFile?.getFilePath())) : extendsSourceFile) || extendsSourceFile;
    const data: IExtendsInfo = {
      extendsName: extendsSymbol?.getName() || "",
      path: sourceFile?.getFilePath() || "",
      pathDeclaration: extendsSourceFile?.getFilePath().endsWith("d.ts") ? extendsSourceFile.getFilePath() : "",
      options: undefined,
      sourceFile: sourceFile,
    };
    data.options = this.getDefineElementArgsWithClassRef(data, project);
    if (!data.options) {
      const classDeclaration = extendsSourceFile?.getClass(extendsSymbol?.getName() || "");
      if (classDeclaration) data.options = this.getExtendsInfo(classDeclaration, project)?.options;
    }
    return data;
  }

  private static getClassInfo(classDeclaration: ClassDeclaration, project: ProjectBuild): ClassInfo {
    const className = classDeclaration.getName() ?? "UnnamedClass";
    const data = this.getExtendsInfo(classDeclaration, project);
    const decorators =
      classDeclaration
        .getDecorators()
        ?.filter((decorator: Decorator) => project.isDecoratorTypeComposer(decorator))
        .map((decorator: Decorator) => decorator.getText()) || [];
    const classInfo: ClassInfo = {
      className,
      extends: data.extendsName,
      decorators: decorators,
      isComponent: data.options !== undefined,
      classDeclaration: classDeclaration,
      registerOptions: data.options as any,
      constructorDatas: [],
      styles: [],
      isTemplateLoaded: false,
      insertProperties: [],
      isExported: classDeclaration.isExported(),
      beforeClassDatas: [],
      afterClassDatas: [],
      refComponents: [],
      isExportedStyle: false,
      elementTag: data.options?.tag || "",
      parent: {
        className: data.extendsName,
        path: data.path,
      },
    };
    if (classInfo.registerOptions) delete classInfo.registerOptions.tag;
    return classInfo;
  }

  public static async analyze(fileInfo: FileInfo, project: ProjectBuild) {
    const sourceFile = fileInfo.sourceFile;
    const classes = sourceFile.getClasses();
    printFileInfo(fileInfo);
    fileInfo.classes = classes.map((classDeclaration: ClassDeclaration) => {
      return this.getClassInfo(classDeclaration, project);
    });
  }
}
