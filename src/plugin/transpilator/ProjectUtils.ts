import { ClassDeclaration, Project, ScriptKind, SourceFile, Symbol} from "ts-morph";
import path, { join } from 'node:path';
import { FileInfo, IComponentInfo, ImportInfo } from "./Interfaces";
import { TypeComposerOptions } from "../..";
import { Debuger } from "../Debug/Log";
import { readdirSync, statSync, existsSync, readFileSync, utimesSync } from 'node:fs';
import { ViteDevServer } from "vite";

export class ProjectUtils extends Project {

	public files: Map<string, FileInfo> = new Map<string, FileInfo>();
	public pathName: string;
	public mainPath: string = "";
	public rootPath: string = "";
	public typecomposerDir: string = "";
	public nodeModulesDir: string = "";
	public projectDir: string = ""
	public translationPath: string = "";
	public indexPath: string = "";
	public stylePath: string;
	public styleCode: string = "";
	public pathClassMain: string = "";
	public routerPath: string = "";
	public outputDir: string = "";
	public server!: ViteDevServer;
	public tsconfigPath: string = "";
	public staticTags = new Set<string>();
	public dynamicTags = new Map<string, Set<string>>;
	public readonly components = new Map<string, { isStatic: boolean, info: Map<string, IComponentInfo> }>();

	constructor(public options: TypeComposerOptions) {
		super({
			tsConfigFilePath: "tsconfig.json",
			skipAddingFilesFromTsConfig: false,
			//useInMemoryFileSystem: true,
		});
		this.staticTags.has
		////super({ tsConfigFilePath: "tsconfig.json", skipAddingFilesFromTsConfig: true });
		this.pathName = this.getSourceFiles().find(e => e.getFilePath().includes("node_modules/typecomposer-plugin"))?.getFilePath() || "";
		if (this.pathName != "")
			this.pathName = this.pathName.split("node_modules/typecomposer-plugin/")[0] + "node_modules/typecomposer-plugin/";
		this.stylePath = this.pathName + "public/style.scss";
	}


	validTag(tag: string, file: string): boolean {
		if (tag.includes("-") == false) return false;
		const d = this.dynamicTags.get(file);
		if (d && d.has(tag)) return true;
		const remove: string[] = [];
		for (const ds of this.dynamicTags.values()) {
			if (ds.has(tag)) {
				if (existsSync(file)) return false;
				else 
					remove.push(file);
			}
		}
		for (const file of remove)
			this.dynamicTags.delete(file);
		return !(this.staticTags.has(tag));
	}

	putTag(tag: string, file: string)
	{
		const d = this.dynamicTags.get(file);
		if (d) d.add(tag);
		else this.dynamicTags.set(file, new Set([tag]));
	}


	public async viteResolve(id: string, importer: string): Promise<string | null> {
		throw new Error("Method not implemented.");
	}

	public getFileInfo(pathName: string): FileInfo | undefined {
		return this.files.get(pathName);
	}

	public getFilesInfos(pathFolder: string) {
		return Array.from(this.files.values()).filter(e => e.pathFolder == pathFolder);
	}

	public static sendServerUpdate(fileInfo: FileInfo) {
		const now = new Date();
		utimesSync(fileInfo.path, now, now);
	}

	public async invalidateModule(url: string) {
		const filePath = url.replace(this.rootPath, "");
		const module = await this.server.moduleGraph.getModuleByUrl(filePath);
		if (module) {
			this.server.moduleGraph.invalidateModule(module);
			this.server.transformRequest(filePath);
		}
	}

	protected async normalizeImport(pathName: string, code: string, scriptKind: ScriptKind) {
		const sourceFile: SourceFile = this.createSourceFile(pathName, code, { overwrite: true, scriptKind: scriptKind });
		for  (const imp of sourceFile.getImportDeclarations()) {
			const oldModuleSpecifier = imp.getModuleSpecifierValue();
		
			const moduleSpecifier: string = await this.viteResolve(imp.getModuleSpecifierValue(), sourceFile.getFilePath()) || imp.getModuleSpecifierValue();
			if (!moduleSpecifier.includes("node_modules/") && oldModuleSpecifier != moduleSpecifier) {
				imp.setModuleSpecifier(moduleSpecifier);
			}
		}
		return sourceFile;
    }

	private getDefineElements(){
		const sourceFiles = this.getSourceFiles();
		this.staticTags = new Set<string>();

		function getStaticTagValue(classDecl: ClassDeclaration): string | undefined {
			const tagProp = classDecl.getStaticMember("TAG");

			if (!tagProp) return;

			if (tagProp.getKindName() === "PropertyDeclaration") {
				const initializer = (tagProp as any).getInitializer?.();
				if (initializer && initializer.getKindName() === "StringLiteral") {
				return initializer.getLiteralValue();
				}
			}
			return;
		}
			
		for (const sourceFile of sourceFiles) {
			if (!sourceFile.getText().includes("TypeComposer.defineElement")) continue;
			const classDeclarations = sourceFile.getClasses();
			for (const classDeclaration of classDeclarations)
			{
				const tag = getStaticTagValue(classDeclaration);
				if (tag) this.staticTags.add(tag);
			}
		}
		return this.staticTags;
	}

	public async load_node_modules_dependencys() {
		const listDependencies: any[] = ['node_modules/typecomposer'];
		try {
			const items = readdirSync("node_modules");
			const packets = items.filter(item => statSync(path.join("node_modules", item)).
				isDirectory() && item !== "." && item !== "..").map(item => path.join("node_modules", path.join(item, "package.json"))).filter(item => existsSync(item));
			await Promise.all(packets.map((packageJsonPath) => {
				const packageJsonContent = readFileSync(packageJsonPath, "utf-8");
				const packageJson = JSON.parse(packageJsonContent);
				const dependencies = packageJson.dependencies || {};
				const devDependencies = packageJson.devDependencies || {};
				if (dependencies?.typecomposer || devDependencies?.typecomposer)
					listDependencies.push(packageJsonPath.replace("package.json", ""));
			}));
		} catch (error) {
			Debuger.error("error load_node_modules_dependencys: ", error);
		}
		for (const dependencies of listDependencies) {
			this.addSourceFilesAtPaths(join(dependencies, "**/*.{d.ts,js}"));
		}
        Debuger.warn("Project:Components ", this.getDefineElements().size);
	}

	public getSourceFileSymbol(symbol: Symbol | undefined): SourceFile | undefined {
			if (!symbol) return undefined;
			const realSymbol = symbol.getAliasedSymbol() ?? symbol;
			const [decl] = realSymbol.getDeclarations();
			if (!decl) return undefined;
			const sourceFile = decl.getSourceFile();
			if (sourceFile.getFilePath().endsWith('.d.ts')) {
				const originalFilePath = sourceFile.getFilePath().replace(/\.d\.ts$/, ".js");
				return this.addSourceFileAtPathIfExists(originalFilePath) || sourceFile;
			}
			return decl.getSourceFile();
	}

	public async getImportInfo(sourceFile: SourceFile): Promise<ImportInfo[]> {
		const imports: ImportInfo[] = [];
		for await (const imp of sourceFile.getImportDeclarations()) {
			const moduleSpecifier: string = await this.viteResolve(imp.getModuleSpecifierValue(), sourceFile.getFilePath()) || imp.getModuleSpecifierValue();

			for await (const named of imp.getNamedImports()) {
				const nameNode = named.getNameNode();
				const symbol = nameNode.getSymbol()?.getAliasedSymbol() ?? nameNode.getSymbol();
				if (!symbol) continue;
				const decl = symbol.getDeclarations()[0];
				imports.push({
					moduleSpecifier: moduleSpecifier,
					namedImport: named.getText(),
					symbol: symbol,
					moduleSourcePath: decl?.getSourceFile().getFilePath() || "",
					isDefaultImport: imp.getDefaultImport() != undefined,
				});
			}

		const ns = imp.getNamespaceImport();
		if (ns) {
			imports.push({
				moduleSpecifier: moduleSpecifier,
				namedImport: ns.getText(),
				moduleSourcePath: "",
				namespaceImport: ns.getText(),
				symbol: ns.getSymbol(),
				isDefaultImport: false,
			});
		}

		}
		for (const imp of imports) {
			if (imp.moduleSourcePath.includes("?v="))
				imp.moduleSourcePath = imp.moduleSourcePath.split("?v=")[0];
		}
		return imports
	}


	public isClassFromModule(classDeclaration: ClassDeclaration, moduleName: string): boolean {
		const sourceFile = classDeclaration.getSourceFile();
		return sourceFile.getImportDeclarations().some((importDeclaration) => {
			return importDeclaration.getNamedImports().some((namedImport) => {
				return namedImport.getText() === classDeclaration.getName() && importDeclaration.getModuleSpecifierValue() === moduleName;
			});
		});
	}


	public static getScriptKind(filePath: string) {
		if (filePath.endsWith('.ts')) {
			return ScriptKind.TSX;
		}
		else if (filePath.endsWith('.tsx')) {
			return ScriptKind.TSX;
		}
		else if (filePath.endsWith('.js')) {
			return ScriptKind.JSX;
		}
		else if (filePath.endsWith('.jsx')) {
			return ScriptKind.JSX;
		}
		return ScriptKind.Unknown;
	}

	public static isScriptFile(filePath: string) {
		return filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx');
	}


	public reloadNodeModule(moduleName: string) {
		if (!this.server) return;

		const modulePath = path.join(this.rootPath, "node_modules", ".vite/deps", `${moduleName}.js`);
		const modules = this.server.moduleGraph.getModulesByFile(modulePath);
		if (modules) {
			modules.forEach((module) => {
				this.server.moduleGraph.invalidateModule(module);
			});

			this.server.ws.send({
				type: "update",
				updates: Array.from(modules).map((module: any) => ({
					type: "js-update",
					path: module.url,
					acceptedPath: module.url,
					timestamp: Date.now(),
				})),
			});
		}
	}


}