import { ClassDeclaration, JsxAttribute, JsxOpeningElement, JsxSelfClosingElement, SyntaxKind, Node, JsxExpression, ts, CallExpression, Expression, Identifier } from "ts-morph";
import { utimesSync } from "node:fs";
import { basename, dirname, extname } from "node:path";
import { FileInfo, ChangeEvent } from "../../Interfaces";
import { ProjectBuild } from "../../ProjectBuild";
import { Debuger } from "../../../Debug/Log";
import { RefBuild } from "../RefBuild";
import { TransformStream } from "./transform";
import { TemplateLoad } from "./TemplateLoad";

export interface RefComponentOptions {
  ref: string;
  name: string;
}

type TransformationsType = { node: JsxExpression | JsxAttribute | Expression<ts.Expression>; newText: string; args: string[] };
export class TemplateBuild {
  static files: Map<string, { path: string; className: string }> = new Map();
  public static readonly EXTENSION = ".template";

  private static async transformBindThis(fileInfo: FileInfo) {
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

  public static generateUniqueKey(text: string) {
    let key = "_c__tc_";
    let i = 1;
    while (text.includes(key)) {
      key = `_c__tc_${i++}_`;
    }
    return key;
  }

  private static async transformAtributtesRef(jsxElements: (JsxSelfClosingElement | JsxOpeningElement)[]) {
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

  private static async transformAtributtesKey(expression: CallExpression<ts.CallExpression> | Node<ts.Node>, computedKey: string, transformations: TransformationsType[]) {
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

  private static getFullRefText(id: Identifier): string {
    let node: Node = id;
    while (
      node.getParent()?.isKind(SyntaxKind.PropertyAccessExpression)
    ) {
      node = node.getParent()!;
      return node.getText();
    }
    return node.getText();
  }

  private static async transformJsxCondition(fileInfo: FileInfo, project: ProjectBuild) {
    const transformations: TransformationsType[] = [];
    for await (const classInfo of fileInfo.classes) {
      const method = classInfo.classDeclaration.getMethod("template");
      if (!method) continue;
      for await (const jsxExpr of method.getDescendantsOfKind(SyntaxKind.JsxExpression)) {
        const expression = jsxExpr?.getExpression();
        if (!expression) continue;
        const refs = new Set<string>();
        //  CallExpression
        if (expression.isKind(SyntaxKind.CallExpression)) {
          const identifiers = expression.getDescendantsOfKind(SyntaxKind.Identifier);
          for (let index = 0; index < identifiers.length; index++) {
            const id = identifiers[index];
            const type = id.getType();
            if (RefBuild.isRefType(type, undefined)) {
              refs.add(TemplateBuild.getFullRefText(id));
            }
          }
        }
        // ternary 
        else if (expression.isKind(SyntaxKind.ConditionalExpression)) {
          const identifiers = expression.getDescendantsOfKind(SyntaxKind.Identifier);
          for (let index = 0; index < identifiers.length; index++) {
            const id = identifiers[index];
            const type = id.getType();
            if (RefBuild.isRefType(type, undefined)) {
              refs.add(TemplateBuild.getFullRefText(id));
            }
          }
        }
        // logical expression
        else if (expression.isKind(SyntaxKind.BinaryExpression)) {
          const binaryExpr = expression.asKindOrThrow(SyntaxKind.BinaryExpression);
          const operatorToken = binaryExpr.getOperatorToken();
          const operatorKind = operatorToken.getKind();
          if (operatorKind === SyntaxKind.AmpersandAmpersandToken || operatorKind === SyntaxKind.BarBarToken) {
            const identifiers = expression.getDescendantsOfKind(SyntaxKind.Identifier);
            for (let index = 0; index < identifiers.length; index++) {
              const id = identifiers[index];
              const type = id.getType();
              if (RefBuild.isRefType(type, undefined)) {
                refs.add(TemplateBuild.getFullRefText(id));
              }
            }
          }
        }
        if (refs.size) {
          const computedKey = TemplateBuild.generateUniqueKey(expression.getText());
          transformations.push({
            node: expression,
            newText: `TypeComposer.computed((${computedKey}) => { return (${expression.getText()}); })`,
            args: [computedKey],
          });
        }
      }
    }
    const transformationsKeyAttrs: TransformationsType[] = [];
    for (const { node, newText, args } of transformations) {
      const newNode = node.replaceWithText(newText);
      this.transformAtributtesKey(newNode, args[0], transformationsKeyAttrs);
    }
  }

  public static async analyze(fileInfo: FileInfo, project: ProjectBuild) {
    await TemplateLoad.analyze(fileInfo);
    const selfClosingElements = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement) as JsxSelfClosingElement[];
    const openingElements = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement) as JsxOpeningElement[];
    const jsxElements = [...selfClosingElements, ...openingElements];
    this.transformAtributtesRef(jsxElements);
    await this.transformBindThis(fileInfo);
    await this.transformJsxCondition(fileInfo, project);
    for await (const classInfo of fileInfo.classes) {
      this.convertTemplate(classInfo.classDeclaration, project);
    }
  }

  private static convertTemplate(classDeclaration: ClassDeclaration, project: ProjectBuild) {
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
        templateCallback?.insertStatements(0, newCode ? `return (${newCode});` : html);
      }
    }
  }

  public static getTagName(node: JsxSelfClosingElement | JsxOpeningElement): string {
    const symbol = node.getTagNameNode().getSymbol();
    if (symbol && symbol.getDeclarations()) {
      const declaration = symbol.getDeclarations()[0];
      if (declaration?.getKind() !== ts.SyntaxKind.IndexSignature) return node.getTagNameNode().getText();
    }
    return `"${node.getTagNameNode().getText()}"`;
  }

  public static async watchChange(id: string, change: { event: ChangeEvent }, project: ProjectBuild) {
    if (change.event == "delete") {
      const pathComponent = TemplateBuild.files.get(id);
      if (pathComponent) {
        TemplateBuild.files.delete(id);
        const now = new Date();
        utimesSync(pathComponent.path, now, now);
      }
    } else if (change.event == "create") {
      const pathFolder = dirname(id);
      const fileName = basename(id, extname(id));
      const sourceFiles = project.getFilesInfos(pathFolder).filter((e) => e.classes.length > 0 && e.classes.find((c) => c.className == fileName));
      for (const sourceFile of sourceFiles) {
        const classInfo = sourceFile.classes.find((e) => e.className == fileName);
        if (classInfo) {
          TemplateBuild.files.set(id, { path: sourceFile.path, className: fileName });
          const now = new Date();
          utimesSync(sourceFile.path, now, now);
        }
      }
    }
  }

  public static async transform(code: string, id: string, project: ProjectBuild) {
    if (id == project.indexPath) {
      return code;
    }
    return `
            export default function () {
              return '${id}';
            }
          `;
  }

  public static isTemplateFile(filePath: string) {
    return filePath.endsWith(TemplateBuild.EXTENSION);
  }
}
