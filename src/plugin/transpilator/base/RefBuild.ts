import { FileInfo } from "../Interfaces";
import { CallExpression, Identifier, SourceFile, SyntaxKind, ts, Symbol, Node } from "ts-morph";
import { ProjectBuild } from "../ProjectBuild";
import { Type } from "ts-morph";
import { resolve } from "node:path";
import { TemplateBuild } from "./template/TemplateBuild";

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

  function isComputedCall(callExpr: CallExpression): boolean {
    const expr = callExpr.getExpression();

    // computed(...)
    if (Node.isIdentifier(expr)) {
      return expr.getText() === "computed";
    }

    // TypeComposer.computed(...)
    if (Node.isPropertyAccessExpression(expr)) {
      const name = expr.getName();
      const left = expr.getExpression().getText();
      return (name === "computed" || name === "C") && left === "TypeComposer";
    }

    return false;
  }

  // function isComputedRef(id: Identifier | PropertyAccessExpression<ts.PropertyAccessExpression>): boolean {
  //   if (id instanceof PropertyAccessExpression) {
  //     const expr = id.getExpression();
  //     if (Node.isIdentifier(expr) && expr.getText() === "computed") {
  //       return true;
  //     }
  //     if (Node.isPropertyAccessExpression(expr) && expr.getName() === "computed") {
  //       return true;
  //     }
  //     return false;
  //   }
  //   const defs = id.getDefinitions();

  //   for (const def of defs) {
  //     const decl = def.getDeclarationNode();
  //     if (!decl) continue;

  //     let initializer: Node | undefined;

  //     // class property
  //     if (Node.isPropertyDeclaration(decl)) {
  //       initializer = decl.getInitializer();
  //     }

  //     // variável local / const / let
  //     else if (Node.isVariableDeclaration(decl)) {
  //       initializer = decl.getInitializer();
  //     }

  //     // parâmetro com default (raro, mas possível)
  //     else if (Node.isParameterDeclaration(decl)) {
  //       initializer = decl.getInitializer();
  //     }

  //     if (!initializer) continue;

  //     // precisa ser call expression
  //     if (!Node.isCallExpression(initializer)) continue;

  //     const expr = initializer.getExpression();

  //     // computed(...)
  //     if (Node.isIdentifier(expr) && expr.getText() === "computed") {
  //       return true;
  //     }

  //     // TypeComposer.computed(...)
  //     if (
  //       Node.isPropertyAccessExpression(expr) &&
  //       expr.getName() === "computed"
  //     ) {
  //       return true;
  //     }
  //   }

  //   return false;
  // }


  function getUsedVariables(body: Node): Identifier[] {
    const identifiers = body.getDescendantsOfKind(SyntaxKind.Identifier);

    return identifiers.filter(id => {
      const parent = id.getParent();

      // ❌ declaração: let x = ...
      if (Node.isVariableDeclaration(parent) && parent.getNameNode() === id) {
        return false;
      }

      // ❌ parâmetro: (x) => ...
      if (Node.isParameterDeclaration(parent)) {
        return false;
      }

      // ❌ nome da propriedade: obj.prop
      if (
        Node.isPropertyAccessExpression(parent) &&
        parent.getNameNode() === id
      ) {
        return false;
      }

      // ❌ nome de método: obj.method()
      if (
        Node.isCallExpression(parent) &&
        parent.getExpression() === id
      ) {
        return false;
      }

      // ❌ chave de objeto: { foo: bar }
      if (
        Node.isPropertyAssignment(parent) &&
        parent.getNameNode() === id
      ) {
        return false;
      }

      // ❌ import / type
      if (
        Node.isImportSpecifier(parent) ||
        Node.isTypeReference(parent)
      ) {
        return false;
      }

      // ✅ uso real de variável
      return true;
    });
  }

  function isComputedSymbol(symbol: Symbol | undefined): boolean {
    if (!symbol) return false;

    return symbol.getDeclarations()?.some(decl => {
      if (Node.isVariableDeclaration(decl)) {
        return isComputedInitializer(decl.getInitializer());
      }

      if (Node.isPropertyDeclaration(decl)) {
        return isComputedInitializer(decl.getInitializer());
      }

      return false;
    }) ?? false;
  }

  function isComputedInitializer(node: Node | undefined): boolean {
    if (!node || !Node.isCallExpression(node)) return false;

    const expr = node.getExpression();
    return Node.isIdentifier(expr) && expr.getText() === "computed";
  }

  async function transformCallExpressionComputed(
    callExpr: CallExpression<ts.CallExpression>
  ): Promise<boolean> {

    const args = callExpr.getArguments();
    if (args.length !== 1) return false;

    const argument = args[0];
    if (!Node.isArrowFunction(argument)) return false;

    const arrow = argument;
    const body = arrow.getBody();
    if (!body) return false;

    const key =
      arrow.getParameters().length > 0
        ? arrow.getParameters()[0].getName()
        : TemplateBuild.generateUniqueKey(callExpr.getText());

    /* ---------------------------------------
     * Variáveis locais e parâmetros
     * --------------------------------------- */
    const declaredNames = new Set<string>();
    arrow.getParameters().forEach(p => declaredNames.add(p.getName()));
    arrow.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .forEach(v => declaredNames.add(v.getName()));

    /* ---------------------------------------
     * Identifiers usados como VALOR
     * --------------------------------------- */
    const identifiers = getUsedVariables(body);
    // evita substituir a mesma ref duas vezes
    const replaced = new Set<Identifier>();

    for (const id of identifiers) {
      const name = id.getText();

      if (declaredNames.has(name)) continue;

      const type = id.getType();
      const isRef = isRefType(type, type.getSymbol());
      // if (name === "TypeComposer") {
      //   isRefType(type, type.getSymbol(), undefined, true);
      // }

      if (!isRef) continue;
      if (replaced.has(id)) continue;

      // ⛔ nunca substituir o parâmetro do computed
      if (name === key) continue;

      // ⛔ nunca tocar em declaração
      const parent = id.getParent();
      if (
        Node.isVariableDeclaration(parent) ||
        Node.isParameterDeclaration(parent)
      ) {
        continue;
      }

      /* ---------------------------------------
       * SUBSTITUIÇÃO CORRETA
       * --------------------------------------- */
      // substituímos APENAS o identifier base
      // mantendo .value, .map, etc.
      id.replaceWithText(`${key}.put(${name})`);
      replaced.add(id);
    }
    const propertyAccesses = body.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression
    );
    for (const pa of propertyAccesses) {
      const expr = pa.getExpression();
      const name = pa.getName();

      if (!Node.isThisExpression(expr)) continue;

      const symbol = pa.getSymbol();
      const type = pa.getType();

      const isRef = isRefType(type, symbol);

      if (!isRef) continue;

      pa.replaceWithText(`${key}.put(this.${name})`);
    }


    /* ---------------------------------------
     * Garante parâmetro do computed
     * --------------------------------------- */
    if (arrow.getParameters().length === 0) {
      arrow.addParameter({ name: key });
    }

    return true;
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
    // pega todos os TaggedTemplateExpression no arquivo
    const taggedTemplates = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.TaggedTemplateExpression);

    for (const expr of taggedTemplates) {
      const tag = expr.getTag();
      const tagText = tag.getText();

      // filtra apenas templates marcados como `computed` ou `C` que sejam refs
      if ((tagText !== "computed" && tagText !== "C")) continue;
      if (!isRefType(tag.getType(), tagText === "C" ? tag.getType()?.getSymbol() : undefined)) continue;

      // const key = TemplateBuild.generateUniqueKey(expr.getText());

      const template = expr.getTemplate();
      // if (!Node.isTemplateExpression(template)) continue;

      // const spans = template.getTemplateSpans();

      // // percorre cada span do template
      // for (const span of spans) {
      //   const spanExpr = span.getExpression();
      //   if (!spanExpr) continue;

      //   // pega todos os identifiers dentro do span
      //   const identifiers = spanExpr.getDescendantsOfKind(SyntaxKind.Identifier);

      //   // pega apenas a primeira ref
      //   const firstRef = identifiers.find(id => isRefType(id.getType()));
      //   if (!firstRef) continue;

      //   // pega a cadeia completa da ref (ex: this.opened, this.foo.bar)
      //   const fullChain = getFullChain(firstRef);

      //   // pega o texto atual do span (ex: this.opened.toString())
      //   const spanText = spanExpr.getText();

      //   // substitui apenas a primeira ref dentro do texto do span
      //   Debuger.log("Transforming TaggedTemplateExpression span:", spanText, "->", `${key}.put(${fullChain})`);
      //   const newSpanText = spanText.replace(TemplateBuild.getFullRefText(firstRef), `${key}.put(${fullChain})`);

      //   // substitui o span inteiro de forma segura
      //   spanExpr.replaceWithText(newSpanText);

      //   // só transformamos a primeira ref
      //   break;
      // }

      // substitui o tagged template inteiro de forma segura
      const templateText = template.getText(); // já contém _c__tc_.put(...) na primeira ref
      expr.replaceWithText(`TypeComposer.computed(() => ${templateText})`);
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

  export function isRefType(type: Type, symbol?: Symbol, types?: RefBuild.REF_TYPES[], tes = false): boolean {
    if (symbol && isComputedSymbol(symbol)) {
      return true;
    }
    if (type.getText().trim().startsWith("{"))
      return false;
    if (types && types.length > 0 && !types.find((typeName) => type.getText().includes(typeName))) {
      return false;
    }
    return /typecomposer[\\/]+core[\\/]+ref[\\/]/.test(type.getText());
  }

  export async function analyze(fileInfo: FileInfo, project: ProjectBuild): Promise<void> {
    await transformCallExpressionComputedTemplate(fileInfo);
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
      } else if (isComputedCall(callExpr)) {
        await transformCallExpressionComputed(callExpr);
      }
      callExpressions = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      index++;
    }
  }
}
