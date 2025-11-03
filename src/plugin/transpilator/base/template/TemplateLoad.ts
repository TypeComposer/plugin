import { ClassDeclaration, StructureKind, ImportDeclarationStructure, OptionalKind } from "ts-morph";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FileInfo } from "../../Interfaces";
import { Debuger } from "../../../Debug/Log";
import { TemplateBuild } from "./TemplateBuild";

export class TemplateLoad {

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
      } else if (is_fragment == false && newLine.length == 0) lines++;
      else {
        if ((is_fragment == false && newLine.startsWith("<fragment>")) || newLine.startsWith("<>")) {
          is_fragment = true;
        }
        newCode += line + "\n";
      }
    }
    return { newCode, lines, imports };
  }

  private static mergeImports(existingImports: OptionalKind<ImportDeclarationStructure>[], templateImports: OptionalKind<ImportDeclarationStructure>[]): OptionalKind<ImportDeclarationStructure>[] {
    const importMap: Record<string, { namedImports: Set<string>; defaultImport?: string }> = {};

    // Process existing imports from .tsx file
    for (const importDecl of existingImports) {
      const moduleSpecifier = importDecl.moduleSpecifier;
      if (!importMap[moduleSpecifier]) {
        importMap[moduleSpecifier] = { namedImports: new Set() };
      }

      if (importDecl.defaultImport) {
        importMap[moduleSpecifier].defaultImport = importDecl.defaultImport;
      }

      if (importDecl.namedImports) {
        const namedImportsArray = Array.isArray(importDecl.namedImports) ? importDecl.namedImports : [importDecl.namedImports];
        for (const namedImport of namedImportsArray) {
          const name = typeof namedImport === "string" ? namedImport : namedImport.name;
          importMap[moduleSpecifier].namedImports.add(name);
        }
      }
    }

    // Merge template imports, avoiding duplicates
    for (const importDecl of templateImports) {
      const moduleSpecifier = importDecl.moduleSpecifier;
      if (!importMap[moduleSpecifier]) {
        importMap[moduleSpecifier] = { namedImports: new Set() };
      }

      // Only add default import if it doesn't exist
      if (importDecl.defaultImport && !importMap[moduleSpecifier].defaultImport) {
        importMap[moduleSpecifier].defaultImport = importDecl.defaultImport;
      }

      if (importDecl.namedImports) {
        const namedImportsArray = Array.isArray(importDecl.namedImports) ? importDecl.namedImports : [importDecl.namedImports];
        for (const namedImport of namedImportsArray) {
          const name = typeof namedImport === "string" ? namedImport : namedImport.name;
          importMap[moduleSpecifier].namedImports.add(name);
        }
      }
    }

    return Object.entries(importMap).map(([moduleSpecifier, { namedImports, defaultImport }]) => ({
      kind: StructureKind.ImportDeclaration,
      moduleSpecifier,
      namedImports: Array.from(namedImports).filter((name) => name),
      defaultImport,
    }));
  }

  private static convertImports(imports: string[]): OptionalKind<ImportDeclarationStructure>[] {
    const importMap: Record<string, { namedImports: Set<string>; defaultImport?: string }> = {};

    for (const importString of imports) {
      const match = importString.match(/import\s+(?:(\w+)\s*,\s*)?(?:{([^}]+)})?\s*from\s*["']([^"']+)["'];?/);

      if (!match) continue;

      const [, defaultImport, namedImports, moduleSpecifier] = match;

      if (!importMap[moduleSpecifier]) {
        importMap[moduleSpecifier] = { namedImports: new Set() };
      }

      if (defaultImport) {
        importMap[moduleSpecifier].defaultImport = defaultImport;
      }
      if (namedImports) {
        const names = namedImports.split(",").map((name) => name.trim());
        for (const name of names) {
          importMap[moduleSpecifier].namedImports.add(name);
        }
      }
    }

    return Object.entries(importMap).map(([moduleSpecifier, { namedImports, defaultImport }]) => ({
      kind: StructureKind.ImportDeclaration,
      moduleSpecifier,
      namedImports: Array.from(namedImports),
      defaultImport,
    }));
  }

  private static injectTemplate(classDeclaration: ClassDeclaration, templateUrl: string) {
    const templateMethod = classDeclaration.getMethod("template");
    if (templateMethod) {
      Debuger.error("\x1b[31m🔴 Template method already exists, removing itx\x1b[0m");
      templateMethod.remove();
    }
    const templateCallback = classDeclaration.addMethod({
      name: "template",
      isAsync: false,
      isStatic: false,
      statements: [],
      parameters: [],
    });
    const html = readFileSync(templateUrl, "utf-8")?.trim();
    const { newCode, imports } = this.normalizeCode(html);
    html && templateCallback?.insertStatements(0, `return (${newCode});`);
    return imports;
  }

  public static async analyze(fileInfo: FileInfo) {
    const types = [TemplateBuild.EXTENSION];
    const templateImports: string[] = [];

    const existingImports: OptionalKind<ImportDeclarationStructure>[] = fileInfo.sourceFile.getImportDeclarations().map((importDecl) => ({
      kind: StructureKind.ImportDeclaration,
      moduleSpecifier: importDecl.getModuleSpecifierValue(),
      namedImports: importDecl.getNamedImports().map((namedImport) => namedImport.getName()),
      defaultImport: importDecl.getDefaultImport()?.getText(),
    }));

    for await (const classInfo of fileInfo.classes) {
      const componentName = classInfo.className;
      if (!componentName || !fileInfo.path) continue;
      classInfo.isTemplateLoaded = false;
      for await (const type of types) {
        const templatePath = join(fileInfo.pathFolder, componentName + type);
        if (existsSync(templatePath)) {
          // Add template file import
          fileInfo.sourceFile.addImportDeclaration({
            moduleSpecifier: `./${componentName}${type}`,
            namedImports: [],
            defaultImport: undefined,
          });

          TemplateBuild.files.set(templatePath, {
            path: fileInfo.path,
            className: componentName,
          });
          classInfo.isTemplateLoaded = true;
          // Collect template imports
          templateImports.push(...this.injectTemplate(classInfo.classDeclaration, templatePath));
        }
      }
    }

    if (templateImports.length == 0) return;
    // Convert template imports to structured format
    const convertedTemplateImports = this.convertImports(templateImports);

    // Merge existing imports with template imports to avoid duplicates
    const mergedImports = this.mergeImports(existingImports, convertedTemplateImports);

    // Remove existing imports and add merged ones
    const importDeclarations = fileInfo.sourceFile.getImportDeclarations();
    for (const importDecl of importDeclarations) {
      // Only remove imports that are not template file imports
      if (!importDecl.getModuleSpecifierValue().endsWith(".template")) {
        importDecl.remove();
      }
    }

    // Add merged imports (excluding the ones we just removed)
    for (const importDecl of mergedImports) {
      // Skip template file imports as they're already added above
      if (!importDecl.moduleSpecifier.endsWith(".template")) {
        fileInfo.sourceFile.addImportDeclaration(importDecl);
      }
    }
  }
}
