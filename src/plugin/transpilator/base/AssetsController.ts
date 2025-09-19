import path from 'node:path';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { ChangeEvent, IAsstesFile } from '../Interfaces';
import { ProjectBuild } from '../ProjectBuild';
import { Debuger } from '../../Debug/Log';

export namespace Asstes {

    interface AssetsObject {
        [key: string]: any;
    }

    const files: Map<string, IAsstesFile> = new Map<string, IAsstesFile>();

    export function listFiles(dir: string, asstesPath: string) {
        try {
            const list = readdirSync(dir);
            list.forEach((file) => {
                const filePath = path.join(dir, file);
                const stat = statSync(filePath);
                if (stat && stat.isDirectory()) {
                    listFiles(filePath, asstesPath);
                } else {
                    const isHidden = file.startsWith(".");
                    if (!isHidden) {
                        const pathFile = filePath.replace(asstesPath, "");
                        files.set(pathFile, {
                            fileName: path.parse(file).ext.trim() ? `${path.parse(file).name}_${path.parse(file).ext.replace(".", "")}` : path.parse(file).name,
                            path: pathFile
                        });
                    }
                }
            });
        } catch (error: any) {
            Debuger.error(error.message);
        }
    }

    function convertMapToObject(fileMap: Map<string, IAsstesFile>) {
        const result: any = {};

        fileMap.forEach((value, key) => {
            const pathParts = key.split('/').filter(Boolean);
            const fileName = value.fileName;
            const fullPath = value.path;

            if (pathParts.length > 1) {
                const folder = pathParts[0];
                if (!result[folder]) {
                    result[folder] = {};
                }
                result[folder][fileName] = fullPath;
            } else {
                result[fileName] = fullPath;
            }
        });

        return result;
    }

    function generateDeclarationContent(assets: AssetsObject): string {
        const lines: string[] = ['export declare const Asstes: {'];

        function processObject(obj: AssetsObject, indent: string = '  ') {
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                if (typeof value === 'object' && value !== null) {
                    lines.push(`${indent}"${key}": {`);
                    processObject(value, indent + '  ');
                    lines.push(`${indent}};`);
                } else {
                    lines.push(`${indent}/**`);
                    lines.push(`${indent} * @file src/assets${value}`);
                    lines.push(`${indent} */`);
                    lines.push(`${indent}"${key}": string;`);
                }
            });
        }
        processObject(assets);
        lines.push('};');
        return lines.join('\n');
    }

    function generateJavaScriptContent(assets: AssetsObject): string {
        const lines: string[] = ['export const Asstes = {'];

        function processObject(obj: AssetsObject, indent: string = '  ') {
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                if (typeof value === 'object' && value !== null) {
                    lines.push(`${indent}"${key}": {`);
                    processObject(value, indent + '  ');
                    lines.push(`${indent}},`);
                } else {
                    lines.push(`${indent}"${key}": "assets${value}",`);
                }
            });
        }

        processObject(assets);
        lines.push('};');
        return lines.join('\n');
    }


    function updateFiles(assets: AssetsObject, dtsPath: string, jsPath: string) {
        const statDts = statSync(dtsPath);
        if (statDts && statDts.isFile()) {
            const staJs = statSync(jsPath);
            if (staJs && staJs.isFile()) {
                const dtsContent = generateDeclarationContent(assets);
                const jsContent = generateJavaScriptContent(assets);
                writeFileSync(dtsPath, dtsContent);
                writeFileSync(jsPath, jsContent);
            }
        }
    }

    function createAsstesFile(filePath: string, asstesPath: string): IAsstesFile | undefined {
        const stat = statSync(filePath);
        if (stat && stat.isFile()) {
            return {
                fileName: path.parse(filePath).ext.trim() ? `${path.parse(filePath).name}_${path.parse(filePath).ext.replace(".", "")}` : path.parse(filePath).name,
                path: filePath.replace(asstesPath, "")
            }
        }
    };

    export function build(typecomposerDir: string) {
        const assetsObject = convertMapToObject(files);
        // esm
        {
            const dtsFilePath = path.join(typecomposerDir, 'assets/index.d.ts');
            const jsFilePath = path.join(typecomposerDir, 'assets/index.js');

            updateFiles(assetsObject, dtsFilePath, jsFilePath);
        }
        //// cjs
        //{
        //    const dtsFilePath = path.join(typecomposerDir, 'dist/cjs/assets/index.d.ts');
        //    const jsFilePath = path.join(typecomposerDir, 'dist/cjs/assets/index.js');

        //    updateFiles(assetsObject, dtsFilePath, jsFilePath);
        //}
    }

    export async function watchChange(filePath: string, change: { event: ChangeEvent }, project: ProjectBuild) {
        if (project.assetsDir && project.isAssetsValid) {
            if (filePath.includes("src/assets/")) {
                const pathName = filePath.replace(project.assetsDir, "");
                if (change.event === "delete") {
                    files.delete(pathName);
                }
                else {
                    const item = createAsstesFile(filePath, project.assetsDir);
                    if (item) {
                        files.set(item.path, item);
                    }
                }
                build(project.typecomposerDir);
            }
        }
    }
}