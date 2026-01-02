import { FileInfo } from "../Interfaces";
import { CallExpression, Identifier, PropertyAccessExpression, SourceFile, SyntaxKind, TaggedTemplateExpression, ts, Symbol, Node } from "ts-morph";
import { ProjectBuild } from "../ProjectBuild";
import { Type } from "ts-morph";
import { resolve } from "node:path";
import { TemplateBuild } from "./template/TemplateBuild";
import { Debuger } from "../../Debug/Log";

export namespace RefBuild {

  export type REF_TYPES =
    "RefString" |
    "RefNumber" |
    "RefBoolean" |
    "RefList" |
    "RefSet" |
    "RefMap" |
    "RefState" |
    "RefObject"

  function getDefaultValueForType(type: Type): string {
    if (type.isString()) {
      return `""`;
    }
    if (type.isNumber()) {
      return `0`;
    }
    if (type.isBoolean()) {
      return `false`;
    }
    if (type.isArray()) {
      return `[]`;
    }
    if (type.getText().startsWith("Set<")) {
      return `new Set()`;
    }
    if (type.getText().startsWith("Map<")) {
      return `new Map()`;
    }
    if (type.getText().startsWith("Record<")) {
      return `{}`;
    }
    if (type.getText().startsWith("Partial<")) {
      return `{}`;
    }
    if (type.getText().startsWith("Readonly<")) {
      return `{}`;
    }
    if (type.getText() === "Date") {
      return `new Date()`;
    }
    if (type.isObject() && !type.isArray() && !type.isInterface() && !type.isClass()) {
      return convertTypeToInitialization(type);
    }
    return "null";
  }

  function convertTypeToInitialization(type: Type): string {
    if (isPrimitiveType(type)) {
      return getDefaultValueForType(type);
    }

    const properties = type.getProperties();
    const objProperties: string[] = [];

    for (const prop of properties) {
      const propType = prop.getTypeAtLocation(prop.getDeclarations()[0]);
      objProperties.push(`${prop.getName()}: ${getDefaultValueForType(propType)}`);
    }

    return `{ ${objProperties.join(", ")} }`;
  }

  function isPrimitiveType(type: Type): boolean {
    return type.isString() || type.isNumber() || type.isBoolean();
  }

  function getImportSourceFile(importPath: string, project: ProjectBuild): SourceFile | undefined {
    if (importPath.startsWith("@/")) {
      const tsConfigPath = project.getCompilerOptions().baseUrl || process.cwd();
      importPath = resolve(tsConfigPath, importPath.replace("@/", "src/"));
    }
    let sourceFile = project.getSourceFile(importPath);
    if (sourceFile) return sourceFile;
    let sourceFiles = project.getSourceFiles(`${importPath}.{ts,tsx,js,jsx,d.ts}`);
    if (sourceFiles.length > 0) {
      return sourceFiles[0];
    }
    sourceFiles = project.addSourceFilesAtPaths(`${importPath}.{ts,tsx,js,jsx,d.ts}`);
    if (sourceFiles.length > 0) {
      return sourceFiles[0];
    }
    return undefined;
  }

  async function transformCallExpressionComputed(callExpr: CallExpression<ts.CallExpression>): Promise<boolean> {
    const args = callExpr.getArguments();
    if (args.length !== 1) return false;
    const argument = callExpr.getArguments()[0];
    const arrow = argument.isKind(SyntaxKind.ArrowFunction) ? argument.asKindOrThrow(SyntaxKind.ArrowFunction) : null;

    const key = arrow && arrow.getParameters().length > 0 ? arrow.getParameters()[0].getName() : TemplateBuild.generateUniqueKey(callExpr.getText());
    const arg = args[0];

    if (!arg || !arg.compilerNode || !ts.isArrowFunction(arg.compilerNode)) return false;

    const lambda = arg.asKind(SyntaxKind.ArrowFunction);
    if (!lambda) return false;
    const body = lambda.getBody();

    const declaredNames = new Set(lambda.getDescendantsOfKind(SyntaxKind.VariableDeclaration).map((decl) => decl.getName()));

    lambda.getParameters().forEach((param) => declaredNames.add(param.getName()));

    const identifiers = body.getDescendantsOfKind(SyntaxKind.Identifier);

    type Replacement = { expr: PropertyAccessExpression; newText: string };
    const toReplace: Replacement[] = [];

    for (const id of identifiers) {
      const name = id.getText();
      const type = id.getType();
      if (!type || !isRefType(type)) continue;

      const expr = id.getParentIfKind(SyntaxKind.PropertyAccessExpression);
      if (!expr) continue;

      if (declaredNames.has(name)) continue;

      const defs = id.getDefinitions();
      const isDefinedOutside = defs.length === 0 || !lambda.containsRange(defs[0].getNode().getPos(), defs[0].getNode().getEnd());

      if (!isDefinedOutside) continue;

      const original = expr.getText();
      toReplace.push({ expr, newText: `${key}.put(${original})` });
    }

    for (const { expr, newText } of toReplace) {
      expr.replaceWithText(newText);
    }
    if (arrow) {
      if (arrow.getParameters().length === 0)
        arrow.addParameter({ name: key });
      return true;
    }
    // const argument = callExpr.getArguments()[0]?.getText() || "";

    const argumentText = argument.getText() || "";
    const newText = callExpr.getText().replace(argumentText, `(${key}) => { return(${argumentText})(); }`);
    Debuger.log("computed:replace:", newText);
    callExpr.replaceWithText(newText);
    return true;
  }

  function getFullChain(node: Node): string {
    const result: string[] = [];

    let current: Node | undefined = node;

    // sobe até o PropertyAccessExpression
    while (current && !Node.isPropertyAccessExpression(current)) {
      current = current.getParent();
    }

    while (current) {
      if (Node.isPropertyAccessExpression(current)) {
        result.unshift(current.getName());
        current = current.getExpression();
        continue;
      }

      if (Node.isThisExpression(current)) {
        result.unshift("this");
        break;
      }

      if (Node.isIdentifier(current)) {
        result.unshift(current.getText());
        break;
      }

      break;
    }

    return result.join(".");
  }

  async function transformCallExpressionRefProperty(fileInfo: FileInfo, project: ProjectBuild, callExpr: CallExpression<ts.CallExpression>): Promise<boolean> {
    const classAncestor = callExpr.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    const className = classAncestor?.getName() ?? "";
    const isComponent = fileInfo.classes.find((c) => c.className === className)?.isComponent;
    const callExpression = callExpr as CallExpression;
    const args = callExpression.getArguments().map((arg) => arg.getText());
    const parent = callExpr.getParent();
    const value = args[0] || "''";
    const propertyName: string = args[1] || (parent?.getText().split("=")[0]?.replaceAll("!", "").trim() ?? "");
    callExpr.replaceWithText(`refProperty(${value}, '${propertyName}'${isComponent ? ", this" : ""})`);
    return true;
  }

  export async function transformCallExpressionComputedTemplate(fileInfo: FileInfo) {
    const taggedTemplates = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.TaggedTemplateExpression);

    type Replacement = { expr: PropertyAccessExpression | Identifier | TaggedTemplateExpression; newText: string | (() => string) };
    const toReplaceRoot: Replacement[] = [];

    for (const expr of taggedTemplates) {
      const tag = expr.getTag();
      const tagText = tag.getText();
      if ((tagText === "computed" || tagText === "C") && isRefType(tag.getType(), tagText === "C" ? tag.getType()?.getSymbol() : undefined)) {
        const key = TemplateBuild.generateUniqueKey(expr.getText());
        const symbol = tag.getSymbol();
        if (!symbol) continue;

        type Replacement = { expr: PropertyAccessExpression | Identifier; newText: string };
        const toReplace: Replacement[] = [];

        const template = expr.getTemplate();
        if (template.getKind() !== SyntaxKind.TemplateExpression) {
          continue;
        }
        const spans = template.asKindOrThrow(SyntaxKind.TemplateExpression).getTemplateSpans();
        for (const span of spans) {
          const identifiers = span.getExpression().getDescendantsOfKind(SyntaxKind.Identifier);
          for (let index = identifiers.length - 1; index >= 0; index--) {
            const id = identifiers[index];
            const type = id.getType();
            if (!type || !isRefType(type)) continue;
            let newText = `${key}.put(`;
            for (let i = 0; i < identifiers.length; i++) {
              newText += getFullChain(identifiers[i]);
              if (i === index) newText += ")";
              if (i < identifiers.length - 1) newText += ".";
            }
            const expr = span.getExpression();
            if (!expr) continue;
            // @ts-ignore
            toReplace.push({ expr: expr, newText });
            break;
          }
        }

        toReplaceRoot.push({
          expr: expr,
          newText: () => {
            const argument = expr.getTemplate().getText() || "";
            return `C((${key}) => ${argument})`
          },
        });

        for (const { expr, newText } of toReplace) {
          expr.replaceWithText(newText);
        }
      }
    }
    for (const tr of toReplaceRoot) {
      tr.newText = typeof tr.newText === "function" ? tr.newText() : tr.newText;
    }
    if (toReplaceRoot.length)
      Debuger.log(
        "computed:template:replace:",
        toReplaceRoot.map((tr) => `${typeof tr.newText === "string" ? tr.newText : tr.newText()}`)
      );
    for (const { expr, newText } of toReplaceRoot) {
      expr.replaceWithText(newText);
    }
  }

  async function transformCallExpressionRef(fileInfo: FileInfo, project: ProjectBuild, callExpr: CallExpression<ts.CallExpression>): Promise<boolean> {
    const typeArguments = callExpr.getTypeArguments();
    const args = callExpr.getArguments();
    if (typeArguments.length > 0 && args.length === 0) {
      const typeNode = typeArguments[0];
      const typeChecker = project.getTypeChecker();
      let type = typeChecker.getTypeAtLocation(typeNode);
      if (isPrimitiveType(type)) {
        const defaultValue = convertTypeToInitialization(type);
        callExpr.replaceWithText(`ref<${typeNode.getText()}>(${defaultValue})`);
        return true;
      }
      let symbol = type.getSymbol();
      if (!symbol) {
        const importDeclaration = fileInfo.sourceFile.getImportDeclarations().find((imp) => imp.getNamedImports().some((ni) => ni.getText() === typeNode.getText()));
        if (importDeclaration) {
          let importPath = importDeclaration.getModuleSpecifierValue();
          const importedSourceFile = getImportSourceFile(importPath, project);
          if (importedSourceFile) {
            const interfaceDeclaration = importedSourceFile.getInterfaces().find((intf) => intf.getName() === typeNode.getText());
            if (interfaceDeclaration) {
              type = typeChecker.getTypeAtLocation(interfaceDeclaration);
              symbol = type.getSymbol();
            }
          }
        }
        if (!symbol) return false;
      }
      const defaultValue = convertTypeToInitialization(type);
      callExpr.replaceWithText(`ref<${typeNode.getText()}>(${defaultValue})`);
      return true;
    }
    return false;
  }

  export function isRefType(type: Type, symbol?: Symbol, types?: RefBuild.REF_TYPES[]): boolean {
    if (symbol) {
      const declarations = symbol.getDeclarations();
      for (const decl of declarations) {
        const sourceFile = decl.getSourceFile();
        const filePath = sourceFile.getFilePath();
        if (/typecomposer[\\/]+typings[\\/]+index\.d\.ts/.test(filePath)) {
          return true;
        }
      }
    }
    if (type.getText().trim().startsWith("{"))
      return false;
    if (types && types.length > 0 && !types.find((typeName) => type.getText().includes(typeName))) {
      return false;
    }
    return /typecomposer[\\/]+core[\\/]+ref[\\/]/.test(type.getText());
  }

  export async function analyze(fileInfo: FileInfo, project: ProjectBuild): Promise<void> {
    let callExpressions = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    const checked = new Set<CallExpression<ts.CallExpression>>();
    let index = 0;
    while (index < callExpressions.length) {
      const callExpr = callExpressions[index] as CallExpression<ts.CallExpression>;
      if (callExpr.wasForgotten()) {
        index++;
        continue;
      }
      const expression = callExpr?.getExpression();
      if (!expression || checked.has(callExpr)) {
        index++;
        continue;
      }
      checked.add(callExpr);
      const text = expression.getText();
      if (text !== "TypeComposer.computed" && !isRefType(expression.getType(), expression.getSymbol())) {
        index++;
        continue;
      }

      if (text.includes("ref")) {
        await transformCallExpressionRef(fileInfo, project, callExpr);
      } else if (text === "refProperty") {
        await transformCallExpressionRefProperty(fileInfo, project, callExpr);
      } else if (text === "computed" || text == "TypeComposer.computed") {
        await transformCallExpressionComputed(callExpr);
      }
      callExpressions = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      index++;
    }
    await transformCallExpressionComputedTemplate(fileInfo);
  }
}
