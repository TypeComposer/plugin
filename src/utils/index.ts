import { readdirSync, statSync } from "node:fs";
import path from "node:path";


export namespace TypeComposerUtils {
    /**
        * Checks if a file is a script file.
        * @param filePath - The path to the file.
        * @returns True if the file is a script file, false otherwise.
        */
    export function isScriptFile(filePath: string): boolean {
        const extension = filePath.split('.').pop()?.toLowerCase();
        return extension === 'ts' || extension === 'tsx' || extension === 'js' || extension === 'jsx';
    }

    /**
        * Checks if a file is a style file.
        * @param filePath - The path to the file.
        * @returns True if the file is a style file, false otherwise.
        */
    export function isStyleFile(filePath: string): boolean {
        const extension = filePath.split('.').pop()?.toLowerCase();
        return extension === 'css' || extension === 'scss' || extension === 'sass' || extension === 'less';
    }

    export const STYLE_EXTENSIONS = ['css', 'scss', 'sass', 'less'];

    export const TEMPLATE_EXTENSIONS = ['template', 'tpl'];

    /**
        * Checks if a file is a template file.
        * @param filePath - The path to the file.
        * @returns True if the file is a template file, false otherwise.
        */
    export function isTemplateFile(filePath: string): boolean {
        const extension = filePath.split('.').pop()?.toLowerCase();
        return extension === 'template' || extension === 'tpl';
    }

    export function printFileInfo(fileInfo: any) {
        const { sourceFile, ...info } = fileInfo;
        console.log("TypeComposerAnalyze printFileInfo:", JSON.stringify(info, (key, value) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return Object.keys(value).reduce((obj, k) => {
                    if (k == 'sourceFile')
                        // @ts-ignore
                        obj[k] = { filePath: value[k].getFilePath() };
                    else if (k == 'classDeclaration')
                        // @ts-ignore
                        obj[k] = { name: value[k].getName() };
                    else
                        // @ts-ignore
                        obj[k] = value[k];
                    return obj;
                }, {});
            }
            return value;
        }, 2));
    }

    export function isRouterFile(file: string): boolean {
        return file === "router.ts" || file === "router.js" || file === "Router.js" || file === "Router.ts";
    }


    export async function findRouterTsFiles(directory: string): Promise<string[]> {
        const routerTsFiles: string[] = [];
        function searchRecursively(dir: string) {
            const files = readdirSync(dir);
            files.forEach((file: string) => {
                const filePath = path.join(dir, file);
                const isDirectory = statSync(filePath).isDirectory();
                if (isDirectory) {
                    searchRecursively(filePath);
                } else if (isRouterFile(file)) {
                    routerTsFiles.push(filePath);
                }
            });
        }
        searchRecursively(directory);
        return routerTsFiles;
    }

}