import { ClassDeclaration, JsxAttribute, JsxOpeningElement, JsxSelfClosingElement, SyntaxKind, Node, JsxExpression, StructureKind, ImportDeclarationStructure, OptionalKind, SourceFile, ts, CallExpression, Expression } from 'ts-morph';
import { existsSync, readFileSync, utimesSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { FileInfo, ChangeEvent } from '../Interfaces';
import { ProjectBuild } from '../ProjectBuild';
import { Debuger } from '../../Debug/Log';
import { RefBuild } from './RefBuild';

export interface RefComponentOptions {
    ref: string,
    name: string;
}

type TransformationsType =  { node: JsxExpression | Expression<ts.Expression>; newText: string, args: string[] };
export class TemplateBuild {

    static files: Map<string, { path: string, className: string }> = new Map();
    public static readonly EXTENSION = ".template";

    private static normalizeCode(code: string) {
        let newCode = "";
        const imports: string[] = [];
        let lines = 0;
        let is_fragment = false;
        for (const line of code.split("\n")) {
            const newLine = line.trim();
            if (is_fragment == false && newLine.startsWith("import")) {
                imports.push(newLine);
                lines++;
            } else if (is_fragment == false && newLine.length == 0)
                lines++;
            else {
                if (is_fragment == false && newLine.startsWith("<fragment>") || newLine.startsWith("<>")) {
                    is_fragment = true;
                }
                newCode += line + "\n";
            }
        }
        return { newCode: newCode, lines, imports };
    }

    private static async collectReferencesTopLevel(node: Node): Promise<string[]> {
        const references: string[] = [];
        const seen = new Set<string>();

        function visit(n: Node) {
            if (n.isKind(SyntaxKind.PropertyAccessExpression)) {
                const parentPropAccess = n.getParentIfKind(SyntaxKind.PropertyAccessExpression);
                if (!parentPropAccess) {
                    const text = n.getText();
                    // Ignora duplicados
                    if (!seen.has(text)) {
                        seen.add(text);
                        references.push(text);
                    }
                }
                return;
            }
            if (n.isKind(SyntaxKind.Identifier)) {
                const parentPropAccess = n.getParentIfKind(SyntaxKind.PropertyAccessExpression);
                if (parentPropAccess) {
                    return;
                }
                const isJsxTag =
                    n.getParentIfKind(SyntaxKind.JsxOpeningElement) ||
                    n.getParentIfKind(SyntaxKind.JsxClosingElement) ||
                    n.getParentIfKind(SyntaxKind.JsxSelfClosingElement);
                if (isJsxTag) {
                    return;
                }
                const text = n.getText();
                const ignoreKeywords = ["this", "true", "false", "null", "undefined"];
                if (!ignoreKeywords.includes(text)) {
                    if (!seen.has(text)) {
                        seen.add(text);
                        references.push(text);
                    }
                }
            }
            n.forEachChild(visit);
        }
        visit(node);
        const newReferences: string[] = []
        const suffix = ".value";
        for await (const reference of references) {
            newReferences.push(reference)
            if (reference.endsWith(suffix))
                newReferences.push(reference.slice(0, -suffix.length));
        }
        return newReferences;
    }

    private static collectLoopReferencesTopLevel(node: Node): string[] {
        const references: string[] = [];
        const seen = new Set<string>();

        function visit(n: Node) {
            if (n.isKind(SyntaxKind.PropertyAccessExpression)) {
                const propName = n.getName();
                const fullText = n.getText();

                if (propName === "map") {
                    const objText = n.getExpression().getText();
                    if (!seen.has(objText)) {
                        seen.add(objText);
                        references.push(objText);
                    }
                } else {
                    if (!seen.has(fullText)) {
                        seen.add(fullText);
                        references.push(fullText);
                    }
                }
                return;
            }

            if (n.isKind(SyntaxKind.Identifier)) {
                if (n.getParentIfKind(SyntaxKind.PropertyAccessExpression)) return;
                if (
                    n.getParentIfKind(SyntaxKind.JsxOpeningElement) ||
                    n.getParentIfKind(SyntaxKind.JsxClosingElement) ||
                    n.getParentIfKind(SyntaxKind.JsxSelfClosingElement)
                ) {
                    return;
                }

                const txt = n.getText();
                if (!["this", "true", "false", "null", "undefined"].includes(txt)) {
                    if (!seen.has(txt)) {
                        seen.add(txt);
                        references.push(txt);
                    }
                }
            }
            n.forEachChild(visit);
        }

        visit(node);
        return references.slice(0, 1);
    }

    private static async addBindThis(fileInfo: FileInfo) {
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

    private static async analizeJsxCondition(fileInfo: FileInfo) {
        const jsxExpressions = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.JsxExpression);
        for await (const jsxExpr of jsxExpressions) {
            try {
                const expression = jsxExpr?.getExpression();
                if (!expression) continue;

                const isTernary = expression.isKind(SyntaxKind.ConditionalExpression);
                const isLogical =
                    expression.isKind(SyntaxKind.BinaryExpression) &&
                    (() => {
                        const opToken = expression.asKindOrThrow(SyntaxKind.BinaryExpression).getOperatorToken();
                        const opKind = opToken.getKind();
                        return (
                            opKind === SyntaxKind.AmpersandAmpersandToken ||
                            opKind === SyntaxKind.BarBarToken
                        );
                    })();


                if (isTernary || isLogical) {
                    const original = expression.getText();
                    const references = await TemplateBuild.collectReferencesTopLevel(expression);
                    Debuger.log("references", references);
                     const key = TemplateBuild.generateUniqueKey(original);
                    jsxExpr.replaceWithText(this.wrapInFragmentCondition(key, original, references));
                }
            } catch (e) {
                console.error("Error analyzing JSX condition:", e);
            }
        }
    }

    private static wrapInFragmentCondition(key: string, expressionText: string, dependencies: string[]) {
        for (const dep of dependencies) {
            expressionText = expressionText.replace(new RegExp(`\\b${dep}\\b`, 'g'), `${key}.put(${dep})`);
        }
        return `{computed((${key}) => {
        return (${expressionText.replace(/\s{2,}/g, " ").replaceAll("\n", "")});})}`;
    }

    private static updateJsxKeyProps(callExpr: CallExpression, key: string) {
        const jsxAttributes = callExpr.getDescendantsOfKind(SyntaxKind.JsxAttribute);
        for (const attr of jsxAttributes) {
            if (attr.getNameNode().getText() === "key") {
                const initializer = attr.getInitializer();
                if (initializer && initializer.isKind(SyntaxKind.StringLiteral)) {
                    const value = initializer.getLiteralValue();
                    attr.setInitializer(`{${key}.cache(\`${value}\`)}`);
                }
                else if (initializer && initializer.isKind(SyntaxKind.JsxExpression)) {
                    const expr = initializer.getExpression();
                    if (expr) {
                        attr.setInitializer(`{${key}.cache(${expr.getText()})}`);
                    }
                }
            }
        }
        const localNames = new Set<string>();

        // 1. Coletar nomes de parâmetros de funções internas
        callExpr.forEachDescendant((node) => {
            if (
                node.isKind(SyntaxKind.ArrowFunction) ||
                node.isKind(SyntaxKind.FunctionExpression)
            ) {
                node.getParameters().forEach(param => {
                    localNames.add(param.getName());
                });
            }
            // Variáveis declaradas com let/const/var dentro da call
            if (node.isKind(SyntaxKind.VariableDeclaration)) {
                localNames.add(node.getName());
            }
        });

        // 2. Coletar identificadores usados
        const usedNames = new Set<string>();
        callExpr.forEachDescendant((node) => {
            if (node.isKind(SyntaxKind.Identifier)) {
                const name = node.getText();
                if (!localNames.has(name)) {
                    usedNames.add(name);
                }
            }
        });
        return callExpr.getText();
    }

    public static generateUniqueKey(text: string) {
        let key = '_c__tc_';
        let i = 1;
        while (text.includes(key)) {
            key = `_c__tc_${i++}_`;
        }
        return key;
    }

    private static analyzeCallExpression(callExpr: CallExpression, transformations: TransformationsType[] = []) {
        const propAccess = callExpr.getExpression();
        if (propAccess.isKind(SyntaxKind.PropertyAccessExpression)) {
            const methodName = propAccess.getName();
            if (methodName === "map" && RefBuild.isRefType(propAccess.getExpression().getType())) {

                const references = this.collectLoopReferencesTopLevel(callExpr);
                const key = TemplateBuild.generateUniqueKey(callExpr.getText());
                const originalText = TemplateBuild.updateJsxKeyProps(callExpr, key);
                const newExpr = this.wrapInFragmentCondition(key, originalText, references);

                const args = callExpr.getArguments();
                const mapArgs: string[] = []

                for (const arg of args) {
                    if (arg.isKind(SyntaxKind.ArrowFunction)) {
                        const arrowFn = arg.asKindOrThrow(SyntaxKind.ArrowFunction);
                        const parameters = arrowFn.getParameters();
                        if (parameters.length > 0) {
                            mapArgs.push(parameters[0].getName());
                        }
                    } else if (arg.isKind(SyntaxKind.FunctionExpression)) {
                        const funcExpr = arg.asKindOrThrow(SyntaxKind.FunctionExpression);
                        const parameters = funcExpr.getParameters();
                        if (parameters.length > 0) {
                            mapArgs.push(parameters[0].getName());
                        }
                    }
                }

                const jsxExpr = callExpr.getFirstAncestorByKind(SyntaxKind.JsxExpression);
                if (jsxExpr) {
                    transformations.push({
                        node: jsxExpr, newText: newExpr, args: mapArgs
                    });
                }
            } else {
              
            }
        }
    }

    private static  async  transformCallExpressionComputedTemplate(expression: Expression<ts.Expression>, transformations: TransformationsType[]){
        if (Node.isTemplateExpression(expression)) {
             const identifiers = expression.getDescendantsOfKind(SyntaxKind.Identifier);
              for (const id of identifiers) {
                  const type = id.getType();
                if (!type || !RefBuild.isRefType(type)) continue;
                if (type.getText().includes("ref/Computed")) continue;
                transformations?.push({
                    node: expression,
                    newText: `computed${expression.getText()}`,
                    args: []
                })
                return;
              }
        }
    }

    private static async analizeJsxLoop(fileInfo: FileInfo) {
        const jsxExpressions = fileInfo.sourceFile.getDescendantsOfKind(SyntaxKind.JsxExpression);
            const transformations: TransformationsType[] = [];
            for await (const jsxExpr of jsxExpressions) {
            const expression = jsxExpr.getExpression();
            if (!expression) continue;

             if (expression.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral ||
                expression.getKind() === SyntaxKind.TemplateExpression) {
                  await this.transformCallExpressionComputedTemplate(expression, transformations);
            } else if (expression.isKind(SyntaxKind.CallExpression)) {
                this.analyzeCallExpression(expression, transformations);
            } else {
                const nestedCalls = expression.getDescendantsOfKind(SyntaxKind.CallExpression);
                for await (const call of nestedCalls) {
                    this.analyzeCallExpression(call, transformations);
                }
            }
        };
        for (const { node, newText } of transformations) {
            node.replaceWithText(newText);
        }
    }

  
    public static async analyze(fileInfo: FileInfo) {
        const types = [TemplateBuild.EXTENSION];
        const imports: string[] = []
        for await (const classInfo of fileInfo.classes) {
            const componentName = classInfo.className;
            if (!componentName || !fileInfo.path) continue;
            for (const type of types) {
                if (existsSync(join(fileInfo.pathFolder, componentName + type))) {
                    fileInfo.sourceFile.addImportDeclaration({
                        moduleSpecifier: `./${componentName}${type}`,
                        namedImports: [],
                        defaultImport: undefined
                    });
                    this.files.set(join(fileInfo.pathFolder, componentName + type), { path: fileInfo.path, className: componentName });
                    imports.push(...this.injectTemplate(classInfo.classDeclaration, join(fileInfo.pathFolder, componentName + type)));
                }
            }
        }
        for await (const importLine of this.convertImports(imports)) {
            fileInfo.sourceFile.addImportDeclaration(importLine);
        }
        fileInfo.sourceFile.forEachDescendant((node) => {
            if (node.getKind() === SyntaxKind.JsxSelfClosingElement || node.getKind() === SyntaxKind.JsxOpeningElement) {
                const element = node as JsxSelfClosingElement | JsxOpeningElement;
                const refAttr = element.getAttribute("ref");
                if (refAttr && refAttr.getKind() === SyntaxKind.JsxAttribute) {
                    const jsxAttr = refAttr as JsxAttribute;
                    const refValue = jsxAttr.getInitializer()?.getText();
                    if (refValue) {
                        const newRefValue = `{(e) => (${refValue.slice(1, -1)} = e)}`;
                        jsxAttr.remove();
                        element.addAttribute({ name: "ref", initializer: newRefValue });
                    }
                }
            }
        });
        await this.analizeJsxCondition(fileInfo);
        await this.analizeJsxLoop(fileInfo);
        await RefBuild.transformCallExpressionComputedTemplate(fileInfo);
        if (fileInfo.path.endsWith(".ts"))
            await this.convertHtmlToJsx(fileInfo.sourceFile);
        await this.addBindThis(fileInfo);
    }

    static getTagName(node: JsxSelfClosingElement | JsxOpeningElement): string {
        const symbol = node.getTagNameNode().getSymbol();
        if (symbol && symbol.getDeclarations()) {
            const declaration = symbol.getDeclarations()[0];
            if (declaration?.getKind() !== ts.SyntaxKind.IndexSignature)
                return node.getTagNameNode().getText();
        }
        return (`"${node.getTagNameNode().getText()}"`);
    }

    static convertJsxToCreateElement(node: any): string {
        if (node.isKind(ts.SyntaxKind.JsxElement) || node.isKind(ts.SyntaxKind.JsxFragment)) {
            let tag = "";
            let attributesString = "{}";

            if (node.isKind(ts.SyntaxKind.JsxElement)) {
                const openingElement = node.getOpeningElement();
                const tagName = openingElement.getTagNameNode().getText();

                if (tagName.toLowerCase() === "fragment") {
                    tag = `"fragment"`;
                } else {
                    tag = this.getTagName(openingElement);
                    const attributes: Record<string, any> = {};
                    openingElement.getAttributes().forEach((attr: any) => {
                        if (attr.isKind(ts.SyntaxKind.JsxAttribute)) {
                            const name = attr.getNameNode().getText();
                            const valueNode = attr.getInitializer();
                            if (valueNode) {
                                if (valueNode.isKind(ts.SyntaxKind.StringLiteral)) {
                                    attributes[name] = `"${valueNode.getLiteralValue()}"`;
                                } else if (valueNode.isKind(ts.SyntaxKind.JsxExpression) && valueNode.getExpression()) {
                                    attributes[name] = valueNode.getExpression().getText();
                                }
                            }
                        }
                    });

                    attributesString = Object.keys(attributes).length > 0
                        ? `{ ${Object.entries(attributes).map(([key, val]) => `${key}: ${val}`).join(", ")} }`
                        : "{}";
                }
            }

            const children: string[] = [];
            node.forEachChild((child: any) => {
                if (child.isKind(ts.SyntaxKind.JsxText)) {
                    const text = child.getText().trim();
                    text && children.push(`"${text}"`);
                } else if (child.isKind(ts.SyntaxKind.JsxExpression)) {
                    const text = child.getText().trim().replace(/^\{(.*?)\}$/, '$1');
                    text && children.push(text);
                } else if (child.isKind(ts.SyntaxKind.JsxElement)) {
                    children.push(TemplateBuild.convertJsxToCreateElement(child));
                } else if (child.isKind(ts.SyntaxKind.JsxSelfClosingElement)) {
                    children.push(TemplateBuild.convertJsxToCreateElement(child));
                }
            });

            if (node.isKind(ts.SyntaxKind.JsxFragment)) {
                return `TypeComposer.createFragment(${children.join(", ")})`;
            }

            return `TypeComposer.createElement(${tag}, ${attributesString}${children.length > 0 ? `, ${children.join(", ")}` : ""})`;
        }
        else if (node.isKind(ts.SyntaxKind.JsxSelfClosingElement)) {
            let tagName = this.getTagName(node);
            const attributes: Record<string, any> = {};
            node.getAttributes().forEach((attr: any) => {
                if (attr.isKind(ts.SyntaxKind.JsxAttribute)) {
                    const name = attr.getNameNode().getText();
                    const valueNode = attr.getInitializer();
                    if (valueNode) {
                        if (valueNode.isKind(ts.SyntaxKind.StringLiteral)) {
                            attributes[name] = `"${valueNode.getLiteralValue()}"`;
                        } else if (valueNode.isKind(ts.SyntaxKind.JsxExpression) && valueNode.getExpression()) {
                            attributes[name] = valueNode.getExpression().getText();
                        }
                    }
                }
            });

            const attributesString = Object.keys(attributes).length > 0
                ? `{ ${Object.entries(attributes).map(([key, val]) => `${key}: ${val}`).join(", ")} }`
                : "{}";

            return `TypeComposer.createElement(${tagName}, ${attributesString})`;
        }
        else if (node.isKind(ts.SyntaxKind.JsxExpression)) {
            return node.getText();
        }

        return "";
    }


    static async convertHtmlToJsx(sourceFile: SourceFile) {
        sourceFile.forEachDescendant((node) => {
            if (node.isKind(ts.SyntaxKind.JsxFragment) || node.isKind(ts.SyntaxKind.JsxElement) || node.isKind(ts.SyntaxKind.JsxSelfClosingElement)) {
                const replacement = TemplateBuild.convertJsxToCreateElement(node);
                node.replaceWithText(replacement);
            }
        });
    }

    static convertImports(imports: string[]): OptionalKind<ImportDeclarationStructure>[] {
        const importMap: Record<string, { namedImports: Set<string>; defaultImport?: string }> = {};

        imports.forEach((importString) => {
            const match = importString.match(/import\s+(?:(\w+)\s*,\s*)?(?:{([^}]+)})?\s*from\s*["']([^"']+)["'];?/);

            if (!match) return;

            const [, defaultImport, namedImports, moduleSpecifier] = match;

            if (!importMap[moduleSpecifier]) {
                importMap[moduleSpecifier] = { namedImports: new Set() };
            }

            if (defaultImport) {
                importMap[moduleSpecifier].defaultImport = defaultImport;
            }
            if (namedImports) {
                namedImports.split(",").map(name => name.trim()).forEach(name => importMap[moduleSpecifier].namedImports.add(name));
            }
        });

        return Object.entries(importMap).map(([moduleSpecifier, { namedImports, defaultImport }]) => ({
            kind: StructureKind.ImportDeclaration,
            moduleSpecifier,
            namedImports: Array.from(namedImports),
            defaultImport
        }));
    }

    private static injectTemplate(classDeclaration: ClassDeclaration, templateUrl: string) {
        const templateMethod = classDeclaration.getMethod("template");
        if (templateMethod) {
            console.error("\x1b[31m🔴 Template method already exists, removing itx\x1b[0m");
            templateMethod.remove();
        }
        const templateCallback = classDeclaration.addMethod({
            name: "template",
            isAsync: false,
            isStatic: false,
            statements: [],
            parameters: []
        });
        const html = readFileSync(templateUrl, 'utf-8')?.trim();
        const { newCode, imports } = this.normalizeCode(html);
        html && templateCallback?.insertStatements(0, `return (${newCode});`);
        return imports;
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
            const sourceFiles = project.getFilesInfos(pathFolder).filter(e => e.classes.length > 0 && e.classes.find(c => c.className == fileName));
            for (const sourceFile of sourceFiles) {
                const classInfo = sourceFile.classes.find(e => e.className == fileName);
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