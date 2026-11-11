import {
  CallExpression,
  ImportDeclaration,
  Node,
  SourceFile,
  SyntaxKind,
} from "ts-morph";
import { FileInfo, TranslationOption } from "../../../typings";
import { ProjectBuild } from "../../base/ProjectBuild";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type TranslationData = Record<string, string>;

export class TransformTranslations {
  private translationFilesCache: Record<string, TranslationData> = {};

  constructor(readonly project: ProjectBuild) {}

  private getLocales(translationOption: TranslationOption): string[] {
    return Array.from(new Set([
      translationOption.defaulLocale || "en",
      ...(translationOption.Locales || []),
    ].filter((locale): locale is string => locale.trim().length > 0)));
  }

  private getTranslationPath(translationOption: TranslationOption): string {
    const translationPath = translationOption.translationPath || path.join("src", "translations");
    return path.resolve(this.project.rootPath, translationPath);
  }

  private isTypeComposerImport(importDeclaration: ImportDeclaration): boolean {
    return importDeclaration.getModuleSpecifierValue() === "typecomposer";
  }

  private isTypeComposerFunction(
    callExpression: CallExpression,
    sourceFile: SourceFile,
  ): boolean {
    const expression = callExpression.getExpression();
    const typeComposerImports = sourceFile
      .getImportDeclarations()
      .filter(importDeclaration => this.isTypeComposerImport(importDeclaration));

    if (Node.isIdentifier(expression)) {
      const symbol = expression.getSymbol();
      const aliasedSymbol = symbol?.getAliasedSymbol();
      const declarations = [
        ...(symbol?.getDeclarations() ?? []),
        ...(aliasedSymbol?.getDeclarations() ?? []),
      ];

      return declarations.some(declaration => {
        if (!Node.isImportSpecifier(declaration)) return false;
        const importDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
        return importDeclaration !== undefined
          && this.isTypeComposerImport(importDeclaration)
          && declaration.getName() === "t";
      });
    }

    if (!Node.isPropertyAccessExpression(expression)) return false;
    if (expression.getName() !== "t") return false;

    const namespace = expression.getExpression();
    if (!Node.isIdentifier(namespace)) return false;

    const namespaceSymbol = namespace.getSymbol();
    return typeComposerImports.some(importDeclaration => {
      const namespaceImport = importDeclaration.getNamespaceImport();
      if (!namespaceImport || namespaceImport.getText() !== namespace.getText()) return false;

      return namespaceSymbol?.getDeclarations().some(
        declaration => declaration === namespaceImport,
      ) ?? false;
    });
  }

  public findTranslationCalls(fileInfo: FileInfo): CallExpression[] {
    const sourceFile = fileInfo.sourceFile;
    return sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(callExpression => this.isTypeComposerFunction(callExpression, sourceFile));
  }

  private updateTypeComposerLocales(translationOption: TranslationOption): void {
    const locales = this.getLocales(translationOption);

    if (locales.length === 0) {
      throw new Error("Translation options must define at least one locale.");
    }

    const translationTypesPath = path.join(
      this.project.typecomposerDir,
      "translations",
      "index.d.ts",
    );

    if (!existsSync(translationTypesPath)) {
      throw new Error(`TypeComposer translation types not found: ${translationTypesPath}`);
    }

    const source = readFileSync(translationTypesPath, "utf-8");
    const localeType = locales.map(locale => JSON.stringify(locale)).join(" | ");
    const localeTypePattern = /export type Locale\s*=\s*[^;]+;/;
    if (!localeTypePattern.test(source)) {
      throw new Error(`Locale declarations not found in TypeComposer translation types: ${translationTypesPath}`);
    }

    const updatedSource = source
      .replace(localeTypePattern, `export type Locale = ${localeType};`);
    writeFileSync(translationTypesPath, updatedSource, "utf-8");
  }

  public async buildStart() {
    const translationOption = this.project.getTranslationOption();
    if (!translationOption) {
      return;
    }

    this.translationFilesCache = {};
    this.updateTypeComposerLocales(translationOption);
    const translationPath = this.getTranslationPath(translationOption);

    for (const lang of this.getLocales(translationOption)) {
      const filePath = path.join(translationPath, `${lang}.json`);
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(content);
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("translation data must be a JSON object");
          }
          this.translationFilesCache[lang] = parsed as TranslationData;
        } catch (error) {
          throw new Error(
            `Failed to read translation file "${filePath}": ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        }
      } else {
        this.translationFilesCache[lang] = {};
      }
    }
  }

  private synchronizeTranslations(translationKey: string, text: string, translationOption: TranslationOption): void {
    for (const lang of this.getLocales(translationOption)) {
      this.translationFilesCache[lang] = this.translationFilesCache[lang] || {};
      if (!(translationKey in this.translationFilesCache[lang])) {
        this.translationFilesCache[lang][translationKey] = text;
      }
    }
  }

  private synchronizeTranslationsFile(translationOption: TranslationOption): void {
    const translationPath = this.getTranslationPath(translationOption);
    mkdirSync(translationPath, { recursive: true });

    for (const lang of this.getLocales(translationOption)) {
      const translations = this.translationFilesCache[lang] || {};
      const filePath = path.join(translationPath, `${lang}.json`);
      writeFileSync(filePath, JSON.stringify(translations, null, 4) + "\n", "utf-8");
    }
  }

  private generateTranslationKey(text: string): string {
    return text.toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '');
  }

  private insertTranslationLocales(fileInfo: FileInfo, translationOption: TranslationOption): void {
    const locales = this.getLocales(translationOption);
    let translationCode = `(globalThis as any).TypeComposerTranslations.Locales = ${JSON.stringify(locales)};`;
    const translationPath = this.getTranslationPath(translationOption);

    for (const lang of locales) {
      const translationFilePath = path.join(translationPath, `${lang}.json`);
      if (!existsSync(translationFilePath)) {
        continue;
      }

      translationCode += `\n(globalThis as any).TypeComposerTranslations.registerTranslation(${JSON.stringify(lang)}, async () => { return await import(${JSON.stringify(translationFilePath)}); });`;
    }
    fileInfo.sourceFile.insertStatements(0, translationCode);
  }

  public async transform(fileInfo: FileInfo): Promise<void> {
    const translationCalls = this.findTranslationCalls(fileInfo);
    const translationOption = this.project.getTranslationOption();
    if (!translationOption) {
      return;
    }

    let isTranslationFileChanged = false;
    const defaultLocale = translationOption.defaulLocale || "en";
    const defaultTranslations = this.translationFilesCache[defaultLocale] || {};

    for (const callExpression of translationCalls) {
      const args = callExpression.getArguments();
      if (args.length < 1) continue;

      const messageArg = args[0];
      if (!Node.isStringLiteral(messageArg)) continue;

      const text = messageArg.getLiteralText();
      const translationKey = this.generateTranslationKey(text);
      if (!translationKey) continue;

      if (!(translationKey in defaultTranslations)) {
        isTranslationFileChanged = true;
        this.synchronizeTranslations(translationKey, text, translationOption);
      }
    }

    if (isTranslationFileChanged) {
      this.synchronizeTranslationsFile(translationOption);
    }

    if (this.project.isMainFile(fileInfo)) {
      this.insertTranslationLocales(fileInfo, translationOption);
    }
  }
}
