import path, { basename } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { ChangeEvent, FileInfo } from '../Interfaces';
import { ProjectBuild } from '../ProjectBuild';

export namespace Router {


    export function isRouterFile(file: string): boolean {
        return file === 'router.ts' || file === 'router.js' || file === 'Router.js' || file === 'Router.ts';
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

    export async function watchChange(id: string, change: { event: ChangeEvent }, project: ProjectBuild) {
        if ((id.endsWith('.ts') || id.endsWith('.js')) && Router.isRouterFile(basename(id))) {
            if (change.event == "update") return;
            if (change.event == "delete") {
                project.routerPath = "";
            }
            else {
                const routers = await Router.findRouterTsFiles(project.projectDir);
                if (routers.length > 0) {
                    project.routerPath = routers[0];
                }
                else {
                    project.routerPath = "";
                }

            }
            project.invalidateModule(project.mainPath);
        }
    }


    export async function analyze(fileInfo: FileInfo, project: ProjectBuild) {
        const pathName = fileInfo.path;
        const fileName = path.basename(pathName);
        if (fileName == "router.ts" || fileName == "router.js") {
            Router.watchChange(pathName, { event: "update" }, project);
        }
    }
}