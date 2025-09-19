import path from "node:path";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { ProjectBuild } from "../ProjectBuild";

export namespace TranslationController {
  function extractKeys(value: string): string[] {
    const keys: string[] = [];
    const regex = /\$\{([A-Za-z_$][A-Za-z0-9_$]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(value)) !== null) {
      keys.push(match[1]);
    }
    return keys;
  }

  function transformValue(value: any, pathKey: string, isComputed: boolean): string {
    if (typeof value === "string") {
      const params = extractKeys(value);
      const computedKey = isComputed ? "_t_c_l_" : "";
      const translationStart = isComputed
        ? `computed((${computedKey}) => { ${computedKey}.put(App.language); ${params.map((param) => `${computedKey}.put(${param});`).join(" ")} return translation`
        : "translation";
      const translationEnd = isComputed ? ")})" : ")";
      if (params.length > 0) {
        return `/** ${value} */\n"${pathKey}": (${params.join(", ")}) => ${translationStart}("${pathKey}", {${params.join(", ")}}${translationEnd},`;
      }
      return `/** ${value} */\n"${pathKey}": () => ${translationStart}("${pathKey}"${translationEnd},`;
    }

    if (typeof value === "object" && value !== null) {
      return Object.entries(value)
        .map(([key, val]) => transformValue(val, pathKey ? `${pathKey}.${key}` : key, isComputed))
        .join("\n");
    }

    return `"${pathKey}": ${JSON.stringify(value)},`;
  }

  export function isFileTranslation(filePath: string, folderPath: string): boolean {
    if (!filePath.endsWith(".json")) return false;
    const absoluteFilePath = path.resolve(filePath);
    const absoluteFolderPath = path.resolve(folderPath);
    const relative = path.relative(absoluteFolderPath, absoluteFilePath);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  }

  function generateJsContent(json: any, jsonData: any, lan: string, isComputed: boolean): string {
    const transformedData = transformValue(json, "", isComputed);
    return `
        const defaultLanguage = "${lan || "en"}";
        const data = ${JSON.stringify(jsonData, null, 2)};
        const Translation = {
        ${transformedData}
        };`;
  }

  function generateDtsContent(json: any, isComputed: boolean): string {
    const returnType = isComputed ? "ref<string>" : "string";
    function extractKeysDt(obj: any, prefix = ""): string {
      return Object.entries(obj)
        .map(([key, val]) => {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (typeof val === "string") {
            const params = extractKeys(val);
            if (params) {
              return `/** ${val} */\n"${newKey}": (${params.join(", ")}) => ${returnType};`;
            }
            return `/** ${val} */\n"${newKey}": () => ${returnType};`;
          }
          if (typeof val === "object" && val !== null) {
            return extractKeysDt(val, newKey);
          }
          return `/** ${val} */\n"${newKey}": () => ${returnType};`;
        })
        .join("\n");
    }
    return `declare const Translation: {\n${extractKeysDt(json)}\n};\ndeclare const T:{\n${extractKeysDt(json)}\n}\ntype Translation = typeof Translation;type T = typeof Translation;`;
  }

  async function loadJsonFile(defaultLang: string, files: string[]): Promise<{ json: any; jsonData: any }> {
    let jsonData: { [key: string]: any } = {};
    for await (const file of files) {
      const name = path.basename(file, ".json");
      const fileContent = readFileSync(file, "utf-8");
      jsonData[name] = JSON.parse(fileContent);
    }
    return { json: jsonData[defaultLang] || {}, jsonData };
  }

  export async function build(project: ProjectBuild, defaultLang: string, files: string[]): Promise<string> {
    const { json, jsonData } = await loadJsonFile(defaultLang, files);
    let jsContent = "const Translation = {};globalThis.Translation = Translation;";
    try {
      const lan = project.options.translation?.defaultLanguage || "en";
      const isComputed = project.options.translation?.computed || false;
      const dtsFilePath = path.join(project.typecomposerDir, "translation/index.d.ts");

      jsContent = `
            import "typecomposer/global";
            import { App ${isComputed ? ", computed" : ""} } from "typecomposer";
            ${isComputed ? "App.translateComputed = true" : ""}
            ${generateJsContent(json, jsonData, lan, isComputed)}
            function replacePlaceholders(text, params) {
                if (!text || params.length === 0) return text || "";
                return text.replace(\/\\\${\(\.\*\?\)}\/\g, (_, key) => {
                    if (params[key] === undefined || params[key] === null) {
                        return '';
                    }
                    return params[key];
                });
            }
            function translation(path, params = {}) {
                const paths = path.split(".");
                const defaultValues = data[defaultLanguage];
                const value = data[App.language.value];

                let defaultItem = defaultValues;
                let item = value;
                for (const key of paths) { 
                    if (item != null && item != undefined) item = item[key];
                    if (defaultItem != null && defaultItem != undefined) defaultItem = defaultItem[key];
                }
                if (!item) item = defaultItem;
                
                return replacePlaceholders(String(item), params);
            }
            globalThis.Translation = Translation;
            globalThis.T = Translation;
            `;
      if (existsSync(dtsFilePath)) writeFileSync(dtsFilePath, generateDtsContent(json, isComputed), "utf-8");
    } catch (e) {
      jsContent = "const Translation = {};globalThis.Translation = Translation;globalThis.T = Translation;";
      console.error("Error generating translation file:", e);
    }
    return jsContent;
  }

  function listFiles(url: string): string[] {
    try {
      const files = readdirSync(url);
      return (files || []).filter((file) => file.endsWith(".json")).map((file) => path.join(url, file));
    } catch (error) {
      return [];
    }
  }

  export async function load(project: ProjectBuild): Promise<string> {
    if (!project.options?.translation) {
      return "";
    }
    const absolutePath = project.translationPath;
    const defaultLang = project.options.translation?.defaultLanguage || "";
    let files: string[] = [];
    if (defaultLang && project.options.translation && existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
      files = listFiles(absolutePath);
    }
    return await build(project, defaultLang, files);
  }
}
