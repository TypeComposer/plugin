import { ProjectBuild } from "../../../plugin/transpilator/ProjectBuild";
import { TransformStream } from "../../../plugin/transpilator/base/template/transform";



import { ClassDeclaration, JsxAttribute, JsxOpeningElement, JsxSelfClosingElement, SyntaxKind, Node, JsxExpression, ts, CallExpression, Expression, Identifier } from "ts-morph";
import { FileInfo } from "../../../typings";
import { RefBuild } from "../../../plugin/transpilator/base/RefBuild";
import { Debuger } from "../../../plugin/Debug/Log";



type TransformationsType = { node: JsxExpression | JsxAttribute | Expression<ts.Expression>; newText: string; args: string[] };

export class TransformTsx {
  static files: Map<string, { path: string; className: string }> = new Map();
  public static readonly EXTENSION = ".template";

  constructor(readonly project: ProjectBuild) { }

  private async transformBindThis(fileInfo: FileInfo) {
    const jsxAttributes = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute);
    for (const attr of jsxAttributes) {
      const initializer = attr.getInitializer();
      if (initializer && initializer.isKind(SyntaxKind.JsxExpression)) {
        const expression = initializer.getExpression();
        if (expression && expression.isKind(SyntaxKind.PropertyAccessExpression)) {
          const propAccess = expression.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
          const text = propAccess.getText();
          if (text.startsWith("this.")) {
            const classDeclaration = fileInfo.sourceFile.getFirstDescendantByKind(SyntaxKind.ClassDeclaration);
            if (classDeclaration) {
              const method = classDeclaration.getInstanceMethod(propAccess.getName());
              if (method) {
                attr.setInitializer(`{${text}.bind(this)}`);
              }
            }
          }
        }
      }
    }
  }

  public generateUniqueKey(text: string) {
    let key = "_c__tc_";
    let i = 1;
    while (text.includes(key)) {
      key = `_c__tc_${i++}_`;
    }
    return key;
  }

  private async transformAtributtesRef(jsxElements: (JsxSelfClosingElement | JsxOpeningElement)[]) {
    for await (const element of jsxElements) {
      const wasForgotten = (element as any).wasForgotten ? (element as any).wasForgotten() : false;
      if (wasForgotten) continue;
      const refAttr = element.getAttribute("ref");
      if (refAttr && refAttr.getKind() === SyntaxKind.JsxAttribute) {
        const jsxAttr = refAttr as JsxAttribute;
        const refValue = jsxAttr.getInitializer()?.getText();
        if (refValue) {
          const newRefValue = `{(e) => (${refValue.slice(1, -1)} = e)}`;
          try {
            jsxAttr.remove();
            element.addAttribute({ name: "ref", initializer: newRefValue });
          } catch (e) {
            continue;
          }
        }
      }
    }
  }

  private async transformAtributtesKey(expression: CallExpression<ts.CallExpression> | Node<ts.Node>, computedKey: string, transformations: TransformationsType[]) {
    const selfClosingElements = expression.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement) as JsxSelfClosingElement[];
    const openingElements = expression.getDescendantsOfKind(SyntaxKind.JsxOpeningElement) as JsxOpeningElement[];
    const jsxElements = [...selfClosingElements, ...openingElements];
    for await (const element of jsxElements) {
      const wasForgotten = (element as any).wasForgotten ? (element as any).wasForgotten() : false;
      if (wasForgotten) continue;
      const keyAttr = element.getAttribute("key");
      if (keyAttr && keyAttr.getKind() === SyntaxKind.JsxAttribute) {
        const jsxAttr = keyAttr as JsxAttribute;
        const keyValue = jsxAttr.getInitializer()?.getText().trim().replace(/^\{|\}$/g, '');
        if (keyValue) {
          const newKeyValue = `{${computedKey}.cache(${keyValue})}`;
          jsxAttr.replaceWithText(`key=${newKeyValue}`);
        }
      }
    }
  }

  public getFullRefText(id: Identifier): string {
    let node: Node = id;
    while (
      node.getParent()?.isKind(SyntaxKind.PropertyAccessExpression)
    ) {
      node = node.getParent()!;
      return node.getText();
    }
    return node.getText();
  }

  isSimpleRefExpression(expr: Expression): boolean {
    if (Node.isPropertyAccessExpression(expr)) {
      const type = expr.getType();
      return RefBuild.isRefType(type, undefined);
    }

    if (Node.isIdentifier(expr)) {
      const type = expr.getType();
      return RefBuild.isRefType(type, undefined);
    }

    return false;
  }

  // AQUI
  private async transformJsxCondition(
    fileInfo: FileInfo,
    project: ProjectBuild
  ) {
    const transformations: TransformationsType[] = [];

    for await (const classInfo of fileInfo.classes) {
      const method = classInfo.classDeclaration.getMethod("template");
      if (!method) continue;

      for (const jsxExpr of method.getDescendantsOfKind(SyntaxKind.JsxExpression)) {
        const expression = jsxExpr.getExpression();
        if (!expression) continue;

        if (
          Node.isCallExpression(expression) &&
          (expression.getExpression().getText() === "TypeComposer.computed"
            || expression.getExpression().getText() === "computed")
        ) {
          continue;
        }

        // 🚫 nunca mexer em funções
        if (
          expression.isKind(SyntaxKind.ArrowFunction) ||
          expression.isKind(SyntaxKind.FunctionExpression)
        ) {
          continue;
        }

        // 🚫 NÃO envolver ref simples
        if (this.isSimpleRefExpression(expression)) {
          continue;
        }

        const refs = new Set<string>();

        const identifiers = expression.getDescendantsOfKind(SyntaxKind.Identifier);
        for (const id of identifiers) {
          const type = id.getType();
          if (RefBuild.isRefType(type, undefined)) {
            refs.add(this.getFullRefText(id));
          }
        }

        if (!refs.size) continue;

        const originalText = expression.getText();
        const computedKey = this.generateUniqueKey(originalText);

        Debuger.log(
          "Transforming JSX Expression with Refs:",
          originalText
        );

        const finalText =
          `TypeComposer.computed((${computedKey}) => { return (${originalText}); })`;

        transformations.push({
          node: expression,
          newText: finalText,
          args: [computedKey],
        });
      }
    }

    const transformationsKeyAttrs: TransformationsType[] = [];

    for (const { node, newText, args } of transformations) {
      const newNode = node.replaceWithText(newText);
      this.transformAtributtesKey(newNode, args[0], transformationsKeyAttrs);
    }
  }




  // TemplateExpression
  async transformTemplateExpression(fileInfo: FileInfo) {
    const sourceFile = fileInfo.sourceFile;

    const jsxExpressions = sourceFile.getDescendantsOfKind(
      SyntaxKind.JsxExpression
    );

    for (const jsxExpr of jsxExpressions) {
      const expr = jsxExpr.getExpression();
      if (!expr) continue;

      if (!Node.isTemplateExpression(expr)) continue;

      let hasRef = false;

      for (const span of expr.getTemplateSpans()) {
        const spanExpr = span.getExpression();

        const containsRef = spanExpr
          .getDescendants()
          .some(node => {
            if (!Node.isExpression(node)) return false;

            if (
              Node.isPropertyAccessExpression(node) &&
              Node.isCallExpression(node.getParent())
            ) {
              return false;
            }

            return RefBuild.isRefType(
              node.getType(),
              node.getSymbol()
            );
          });

        if (containsRef) {
          hasRef = true;
          break;
        }
      }

      if (!hasRef) continue;
      expr.replaceWithText(`TypeComposer.computed(() => ${expr.getText().replace(/^C`/, "`")})`);
    }
  }


  public async transform(fileInfo: FileInfo) {
    await this.transformTemplateExpression(fileInfo);
    const selfClosingElements = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement) as JsxSelfClosingElement[];
    const openingElements = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement) as JsxOpeningElement[];
    const jsxElements = [...selfClosingElements, ...openingElements];
    this.transformAtributtesRef(jsxElements);
    await this.transformBindThis(fileInfo);
    await this.transformJsxCondition(fileInfo, this.project);
    for await (const classInfo of fileInfo.classes) {
      this.convertTemplate(classInfo.classDeclaration, this.project);
    }
  }

  private convertTemplate(classDeclaration: ClassDeclaration, project: ProjectBuild) {
    const templateMethod = classDeclaration.getMethod("template");
    if (templateMethod) {
      const html = templateMethod.getBodyText()?.trim() || "";
      Debuger.error("\x1b[31m🔴 Template method already exists, removing itx\x1b[0m");
      templateMethod.remove();
      const templateCallback = classDeclaration.addMethod({
        name: "template",
        isAsync: false,
        isStatic: false,
        statements: [],
        parameters: [],
      });
      if (!project.enabledTemplate) {
        if (project.jsx === ts.JsxEmit.ReactJSX || project.jsx === ts.JsxEmit.ReactJSXDev) {
          const newCode = html.startsWith("return") ? html.replace(/^return\s*/, "").replace(/;$/, "") : html;
          templateCallback?.insertStatements(0, `createRoot(this).render(${newCode}); return null;`);
        }
      } else {
        const newCode = TransformStream.convertTsxToTypeComposer(html);
        console.log("TransformTsx convertTemplate:", newCode);
        templateCallback?.insertStatements(0, newCode ? `return (${newCode});` : html);
      }
    }
  }

  public getTagName(node: JsxSelfClosingElement | JsxOpeningElement): string {
    const symbol = node.getTagNameNode().getSymbol();
    if (symbol && symbol.getDeclarations()) {
      const declaration = symbol.getDeclarations()[0];
      if (declaration?.getKind() !== ts.SyntaxKind.IndexSignature) return node.getTagNameNode().getText();
    }
    return `"${node.getTagNameNode().getText()}"`;
  }

  public isTemplateFile(filePath: string) {
    return filePath.endsWith(TransformTsx.EXTENSION);
  }
}
