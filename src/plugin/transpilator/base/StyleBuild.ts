import { existsSync, utimesSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { ChangeEvent, ClassInfo, FileInfo } from "../Interfaces";
import { ProjectBuild } from "../ProjectBuild";
import { Debuger } from "../../Debug/Log";

export interface StyleComponentFile { path: string; tag: string | undefined; className: string }

export class StyleBuild {
  public static pathName: string = "public/style.scss";
  public static readonly identifier: string = "virtual:stylebase";
  public static readonly tagPrefix: string = "tc-style";
  public static readonly files: Map<string, StyleComponentFile> = new Map();

  public static read(classInfo: ClassInfo, html: string): string {
    const styles = html.match(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/g);
    classInfo.styles = [];
    let styleComponent = "";
    if (styles != undefined) {
      styles.forEach((style, index) => {
        const styleTag = style.split(">")[0];
        if (classInfo.registerOptions.tag != "" && !styleTag.includes("global")) {
          html = html.replace(styles[index], "");
          style = style.split(">\n")[1];
          style = style.split("</style>")[0];
          styleComponent += style;
        }
      });
      const regex = /\.this\s*\{([^}]*)\}/g;
      styleComponent = styleComponent.replace(regex, (match, group1) => group1.trim());
      Debuger.info("StyleComponent: ", styleComponent);
    }
    if (styleComponent != "") classInfo.styles.push(`${classInfo.registerOptions.tag} {\n${styleComponent.trim()}\n}`.trim());
    return html;
  }

  public static async updateTag(fileInfo: FileInfo) {
    for (const [key, value] of StyleBuild.files) {
      if (value.path != fileInfo.path) continue;
      const classInfo = fileInfo.classes.find((e) => e.className == value.className);
      if (classInfo && classInfo.registerOptions.tag != value.tag) {
        const now = new Date();
        utimesSync(key, now, now);
      }
    }
  }

  public static getStyleCode(fileInfo: FileInfo): string {
    let styleCode = fileInfo.classes.filter((e) => e.styles.length > 0);
    if (styleCode == undefined || styleCode.length == 0) return "";
    return styleCode.map((e) => e.styles.join("\n")).join("\n");
  }

  public static async getStyleCodeAll(project: ProjectBuild): Promise<string> {
    let styleCode = "";
    for await (const fileInfo of project.files.values()) {
      styleCode += "\n" + this.getStyleCode(fileInfo);
    }
    return styleCode;
  }

  public static async build(fileInfo: FileInfo, code: string): Promise<any> {
    fileInfo.styleCode = this.getStyleCode(fileInfo);
    if (fileInfo.styleCode != "") {
      let name = fileInfo.path.split("/").pop();
      name = name?.split(".")[0] || name;
      const timestamp = Date.now();
      fileInfo.virtualFile = `virtual:stylebase${name}${timestamp}.scss`;
      code = `import "${fileInfo.virtualFile}";\n${code}`;
    } else fileInfo.virtualFile = undefined;
    for await (const classInfo of fileInfo.classes) {
      if (classInfo.registerOptions?.styleUrl && existsSync(classInfo.registerOptions.styleUrl)) {
        let url = classInfo.registerOptions.styleUrl;
        code = `import "${url}";\n${code}`;
      }
    }
    return code;
  }

  public static async watchChange(id: string, change: { event: ChangeEvent }, project: ProjectBuild) {
    if (change.event == "delete") {
      const pathComponent = StyleBuild.files.get(id);
      if (pathComponent) {
        StyleBuild.files.delete(id);
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
          StyleBuild.files.set(id, { path: sourceFile.path, tag: classInfo.registerOptions.tag, className: fileName });
          const now = new Date();
          utimesSync(sourceFile.path, now, now);
        }
      }
    }
  }

  public static isStyleFile(filePath: string) {
    return filePath.endsWith(".scss") || filePath.endsWith(".css") || filePath.endsWith(".sass");
  }

  public static async analyze(fileInfo: FileInfo) {
    for await (const classInfo of fileInfo.classes) {
      const componentName = classInfo.className;
      if (!componentName || !fileInfo.path) continue;
      classInfo.isExportedStyle = true;
      if (existsSync(join(fileInfo.pathFolder, componentName + ".css"))) {
        fileInfo.sourceFile.addImportDeclaration({
          moduleSpecifier: `./${componentName}.css`,
          namedImports: [],
          defaultImport: undefined,
        });
        StyleBuild.files.set(join(fileInfo.pathFolder, componentName + ".css"), { path: fileInfo.path, tag: classInfo.registerOptions.tag, className: componentName });
      } else if (existsSync(join(fileInfo.pathFolder, componentName + ".scss"))) {
        fileInfo.sourceFile.addImportDeclaration({
          moduleSpecifier: `./${componentName}.scss`,
          namedImports: [],
          defaultImport: undefined,
        });
        StyleBuild.files.set(join(fileInfo.pathFolder, componentName + ".scss"), { path: fileInfo.path, tag: classInfo.registerOptions.tag, className: componentName });
      } else if (existsSync(join(fileInfo.pathFolder, componentName + ".sass"))) {
        fileInfo.sourceFile.addImportDeclaration({
          moduleSpecifier: `./${componentName}.sass`,
          namedImports: [],
          defaultImport: undefined,
        });
        StyleBuild.files.set(join(fileInfo.pathFolder, componentName + ".sass"), { path: fileInfo.path, tag: classInfo.registerOptions.tag, className: componentName });
      } else classInfo.isExportedStyle = false;
    }
  }

  private static removeComent(input: string): string {
    return input.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "").trim();
  }

  private static extractAndRemoveThisBlock(input: string, tag: string): string {
    try {
      const hostRegex = /(^|\s*)\:host(?:\(([^)]+)\))?(?:::?[\w-]+(?:\([^)]*\))?)*\s*\{[^}]*\}/g;

      let match;
      const extractedBlocks: { block: string; root: boolean }[] = [];
      let cleanedText = input;

      while ((match = hostRegex.exec(input)) !== null) {
        const fullMatch = match[0];
        const selectorGroup = match[2];
        const hostMatch = fullMatch.match(/:host((?:\([^)]+\))?(?:::?[\w-]+(?:\([^)]*\))?)*)/);
        const suffixPart = hostMatch ? hostMatch[1] : "";

        const newSelector = selectorGroup ? `${tag}${selectorGroup}${suffixPart.replace(/^\([^)]+\)/, "")}` : `${tag}${suffixPart}`;
        const modifiedBlock = fullMatch.replace(/:host(?:\([^)]+\))?(?:::?[\w-]+(?:\([^)]*\))?)*/, newSelector);
        const isRoot = !selectorGroup && !suffixPart;
        extractedBlocks.push({ block: modifiedBlock.trim(), root: isRoot });
        cleanedText = cleanedText.replace(fullMatch, "");
      }
      cleanedText = cleanedText.trim();
      const root = extractedBlocks.find((e) => e.root);
      if (root && cleanedText) {
        const blockContent = root.block;
        const lastBraceIndex = blockContent.lastIndexOf("}");
        if (lastBraceIndex !== -1) {
          const beforeBrace = blockContent.substring(0, lastBraceIndex);
          const afterBrace = blockContent.substring(lastBraceIndex);
          root.block = `${beforeBrace}\n\t${cleanedText.trim()}\n${afterBrace}`;
        }
      } else if (cleanedText) {
        extractedBlocks.push({ block: `${tag} {\n\t${cleanedText.trim()}\n}`, root: true });
      }
      return extractedBlocks
        .map((e) => e.block)
        .join("\n\n")
        .trim();
    } catch (error) {
      Debuger.error("Error extracting and removing block: ");
      return input;
    }
  }

  public static getTemplateStyle(id: string): StyleComponentFile | undefined {
    for (const [_key, value] of StyleBuild.files) {
      if (value.path == id) {
        return value;
      }
    }
    return undefined;
  }

  // public static buildLibreryMode(text: string, id: string, project: ProjectBuild) {
  //   // id = /Users/Ezequiel/Documents/TypeComposer/test/test-libray/src/my-button/MyButton.cs
  //   // out: /Users/Ezequiel/Documents/TypeComposer/test/test-libray/dest/my-button/MyButton.cs
  //   const outputDir = project.outputDir//.replace("dist", "dest2");
  //   const relativePath = id.replace(project.projectDir, "");
  //   const outputPath = join(outputDir, relativePath);
  //   const outputFolder = dirname(outputPath);
  //   if (!existsSync(outputFolder)) {
  //     mkdirSync(outputFolder, { recursive: true });
  //   }
  //   writeFileSync(outputPath, text);
  //   console.log("writeFileSync:", text);
  //   Debuger.log("StyleBuild.buildLibreryMode: write style file to ", outputPath);
  // }

  public static async transform(code: string, id: string, project: ProjectBuild): Promise<string> {
    if (StyleBuild.files.has(id)) {
      const pathComponent = StyleBuild.files.get(id);
      if (pathComponent) {
        const componentName = basename(id, extname(id));
        const fileInfo = project.getFileInfo(pathComponent.path);
        const classInfo = fileInfo?.classes.find((e) => e.className == componentName);
        if (classInfo) {
          const baseTag = classInfo.registerOptions.tag || componentName;
          const tag = `[${StyleBuild.tagPrefix}~="${baseTag}"]`;
          const text = StyleBuild.extractAndRemoveThisBlock(StyleBuild.removeComent(code), tag);
          // if (project.isLibMode && project.isBuilding) {
          //   StyleBuild.buildLibreryMode(text, id, project);
          //   return "";
          // }
          Debuger.log("StyleBuild.transform: [", `\n${text}\n`, "] model:", { isLibMode: project.isLibMode, isBuilding: project.isBuilding });
          return text;
        }
      }
    }
    return code;
  }
}
