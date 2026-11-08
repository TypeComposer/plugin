import {
    Node,
    type ClassDeclaration,
    type ClassExpression,
    type ExpressionWithTypeArguments,
    type Symbol as MorphSymbol,
} from 'ts-morph';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { ClassInfo, FileInfoScript } from '../../../typings';
import { InjectRouter } from '../transform/inject-router';
import { ProjectBuild } from '../../base/ProjectBuild';

type ClassNode = ClassDeclaration | ClassExpression;
type BaseExpression = ExpressionWithTypeArguments;
type CachedScript = ClassScriptAnalysis;

interface ClassScriptAnalysis extends ClassInfo {
    hasTypeComposerBase: boolean;
    hasWebComponentBase: boolean;
    unresolved: string[];
    analysisCount: number;
}

export interface ScriptAnalyzerOptions {
    projectRoot?: string;
}

export class ScriptAnalyzer {
    private readonly baseCache = new WeakMap<
        BaseExpression,
        ClassNode | undefined
    >();
    private readonly dependencyCache = new WeakMap<
        ClassNode,
        CachedScript
    >();
    private readonly dependencyAnalysisInProgress = new WeakSet<ClassNode>();

    constructor(
        private readonly project: ProjectBuild,
        _options: ScriptAnalyzerOptions = {},
    ) { }

    private analyze(classDeclaration: ClassDeclaration): ClassInfo {
        return this.toPublicResult(this.analyzeNode(classDeclaration));
    }

    async buildStart() {
        const routers = await InjectRouter.findRouterTsFiles(this.project.projectDir);
        if (routers.length > 0) {
            this.project.routerPath = routers[0];
        }
    }

    private hasTemplate(pathFolder: string, componentName: string): boolean {
        const templatePath = join(pathFolder, componentName + ".template");
        return existsSync(templatePath);
    }

    private hasStyle(pathFolder: string, componentName: string): boolean {
        const styleExtensions = [".css", ".scss", ".sass", ".less", ".styl"];
        for (const ext of styleExtensions) {
            const stylePath = join(pathFolder, componentName + ext);
            if (existsSync(stylePath)) {
                return true;
            }
        }
        return false;
    }

    public async analyzeFile(filePath: string): Promise<FileInfoScript | undefined> {
        const sourceFile = this.project.getSourceFile(filePath);

        if (!sourceFile) {
            return undefined;
        }

        sourceFile.refreshFromFileSystemSync();
        const result = sourceFile.getClasses().map(classDeclaration =>
            this.analyze(classDeclaration),
        );



        const fileInfo: FileInfoScript = {
            type: "script",
            path: sourceFile.getFilePath(),
            sourceFile,
            classes: result,
            templatesUrl: [],
            removeDatas: [],
            pathFolder: sourceFile.getDirectoryPath(),
            startDatas: [],
            endDatas: [],
            styleCode: undefined,
            virtualFile: undefined,
        };
        return fileInfo;
    }


    private analyzeNode(declaration: ClassNode): ClassScriptAnalysis {
        const cached = this.dependencyCache.get(declaration);
        if (cached) {
            return {
                ...cached,
                analysisCount: 0,
                isComponent: false,
                unresolved: [...cached.unresolved],
            };
        }

        const isDependency = this.isNodeModuleClass(declaration);
        if (isDependency) {
            this.dependencyAnalysisInProgress.add(declaration);
        }

        const extendsExpression = declaration.getExtends();
        const analysis: ClassScriptAnalysis = {
            hasExtends: extendsExpression !== undefined,
            analysisCount: 0,
            isComponent: false,
            unresolved: [],
            decorators: [],
            classDeclaration: declaration as ClassDeclaration,
            hasTypeComposerBase: false,
            hasWebComponentBase: false,
            className: this.getClassName(declaration),
            extends: extendsExpression?.getExpression().getText(),
            elementTag: undefined,
            insertProperties: [],
            isExported: false,
            isTemplateLoaded: false,
            isExportedStyle: false,
            hasStyle: this.hasStyle(
                declaration.getSourceFile().getDirectoryPath(),
                this.getClassName(declaration),
            ),
            hasTemplate: this.hasTemplate(
                declaration.getSourceFile().getDirectoryPath(),
                this.getClassName(declaration),
            ),
            parent: undefined,
            refComponents: [],
            registerOptions: {},
            styles: [],
            beforeClassDatas: [],
            afterClassDatas: [],
            constructorDatas: [],
        };

        if (!extendsExpression) {
            return this.cacheDependencyResult(declaration, analysis);
        }

        analysis.analysisCount++;
        const direct = this.resolveBase(extendsExpression);
        if (!direct) {
            this.addUnresolved(analysis, extendsExpression);
            return this.cacheDependencyResult(declaration, analysis);
        }

        this.addScriptMarkers(analysis, direct);

        const visited = new Set<ClassNode>([declaration, direct]);
        let current: ClassNode | undefined = direct;

        while (current) {
            const baseExpression = current.getExtends();
            if (!baseExpression) {
                break;
            }

            if (
                this.isNodeModuleClass(current) &&
                !this.dependencyAnalysisInProgress.has(current)
            ) {
                const dependency = this.analyzeNode(current);
                analysis.analysisCount += dependency.analysisCount;
                this.mergeScriptMarkers(analysis, dependency);
                break;
            }

            analysis.analysisCount++;
            const isWebComponentBase =
                this.isWebComponentExpression(baseExpression);
            analysis.hasWebComponentBase ||= isWebComponentBase;
            const resolved = this.resolveBase(baseExpression);

            if (!resolved) {
                this.addUnresolved(analysis, baseExpression);
                break;
            }

            if (isWebComponentBase) {
                this.addUnresolved(analysis, baseExpression);
            }

            this.addScriptMarkers(analysis, resolved);

            if (visited.has(resolved)) {
                break;
            }

            visited.add(resolved);
            current = resolved;
        }

        analysis.isComponent =
            !isDependency &&
            analysis.hasTypeComposerBase &&
            analysis.hasWebComponentBase;

        return this.cacheDependencyResult(declaration, analysis);
    }

    private cacheDependencyResult(
        declaration: ClassNode,
        result: ClassScriptAnalysis,
    ): ClassScriptAnalysis {
        this.dependencyAnalysisInProgress.delete(declaration);
        if (this.isNodeModuleClass(declaration)) {
            this.dependencyCache.set(declaration, { ...result });
        }
        return result;
    }

    private toPublicResult(
        analysis: ClassScriptAnalysis,
    ): ClassInfo {
        return {
            hasStyle: analysis.hasStyle,
            hasTemplate: analysis.hasTemplate,
            hasExtends: analysis.hasExtends,
            isComponent: analysis.isComponent,
            decorators: [],
            classDeclaration: analysis.classDeclaration,
            className: analysis.className,
            extends: analysis.extends,
            elementTag: analysis.elementTag,
            insertProperties: [],
            isExported: analysis.isExported,
            isExportedStyle: analysis.isExportedStyle,
            isTemplateLoaded: analysis.isTemplateLoaded,
            parent: analysis.parent,
            refComponents: [],
            registerOptions: analysis.unresolved.length > 0 ? { extends: analysis.unresolved[0] } : {},
            styles: [],
            beforeClassDatas: [],
            afterClassDatas: [],
            constructorDatas: [],
        };
    }

    private addScriptMarkers(
        analysis: ClassScriptAnalysis,
        declaration: ClassNode,
    ): void {
        analysis.hasTypeComposerBase ||= this.isTypeComposerClass(declaration);
        analysis.hasWebComponentBase ||= this.isWebComponentClass(declaration);
    }

    private mergeScriptMarkers(
        target: ClassScriptAnalysis,
        source: ClassScriptAnalysis,
    ): void {
        target.hasTypeComposerBase ||= source.hasTypeComposerBase;
        target.hasWebComponentBase ||= source.hasWebComponentBase;
        for (const unresolved of source.unresolved) {
            if (!target.unresolved.includes(unresolved)) {
                target.unresolved.push(unresolved);
            }
        }
    }

    private addUnresolved(
        analysis: ClassScriptAnalysis,
        expression: BaseExpression,
    ): void {
        const unresolved = expression.getText();
        if (!analysis.unresolved.includes(unresolved)) {
            analysis.unresolved.push(unresolved);
        }
    }

    private isTypeComposerClass(declaration: ClassNode): boolean {
        return /\/node_modules\/typecomposer(?:\/|$)/.test(
            this.getFilePath(declaration),
        );
    }

    private isWebComponentClass(declaration: ClassNode): boolean {
        const className = this.getClassName(declaration);
        return (
            className === 'HTMLElement' ||
            className === 'WebComponent' ||
            /^HTML[A-Z][A-Za-z0-9]*Element$/.test(className) ||
            this.implementsComponent(declaration)
        );
    }

    private isWebComponentExpression(expression: BaseExpression): boolean {
        const name = expression.getExpression().getText();
        return (
            name === 'HTMLElement' ||
            name === 'WebComponent' ||
            /^HTML[A-Z][A-Za-z0-9]*Element$/.test(name)
        );
    }

    private implementsComponent(declaration: ClassNode): boolean {
        return declaration
            .getImplements()
            .some(type => type.getExpression().getText() === 'IComponent');
    }

    private isNodeModuleClass(declaration: ClassNode): boolean {
        return this.getFilePath(declaration).includes('/node_modules/');
    }

    private resolveBase(expression: BaseExpression): ClassNode | undefined {
        if (this.baseCache.has(expression)) {
            return this.baseCache.get(expression);
        }

        const checker = this.project.getTypeChecker();
        const type = expression.getType();
        const symbols = new Set<MorphSymbol>();

        const addSymbol = (symbol?: MorphSymbol): void => {
            if (symbol) {
                symbols.add(symbol);
            }
        };

        addSymbol(type.getAliasSymbol());
        addSymbol(type.getSymbol());
        addSymbol(expression.getSymbol());
        addSymbol(checker.getSymbolAtLocation(expression));

        const declaration = [...symbols]
            .flatMap(symbol => [symbol, this.resolveAlias(symbol)])
            .flatMap(symbol => symbol.getDeclarations());
        const classNode = declaration.find(
            (node): node is ClassNode =>
                Node.isClassDeclaration(node) || Node.isClassExpression(node),
        );

        if (!classNode) {
            this.baseCache.set(expression, undefined);
            return undefined;
        }

        this.baseCache.set(expression, classNode);
        return classNode;
    }

    private resolveAlias(symbol: MorphSymbol): MorphSymbol {
        const visited = new Set<MorphSymbol>();
        let current = symbol;

        while (current.isAlias() && !visited.has(current)) {
            visited.add(current);
            const aliased = current.getAliasedSymbol();
            if (!aliased || aliased === current) {
                break;
            }
            current = aliased;
        }

        return current;
    }

    private getClassName(declaration: ClassNode): string {
        return declaration.getName() ?? '<anonymous>';
    }

    private getFilePath(declaration: ClassNode): string {
        return declaration.getSourceFile().getFilePath().replace(/\\/g, '/');
    }
}
