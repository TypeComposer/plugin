import { join, resolve } from "node:path";
import { Options } from "..";
import { ChangeEvent, FileInfo, TypeComposeCompilerOptions } from "../typings";
import { ScriptPlugin } from "./script";
import { TemplatePlugin } from "./template";
import { existsSync } from "node:fs";
import { ProjectBuild } from "./base/ProjectBuild";
import { StyletPlugin } from "./style";





export namespace TypeComposeCompiler {
    export function compile(options: Options): TypeComposeCompilerOptions {
        const project: ProjectBuild = new ProjectBuild(options);
        const plugins = [
            ScriptPlugin(project),
            TemplatePlugin(project),
            StyletPlugin(project)
        ];


        const plugin = {
            compile: async (id: string, code: string) => {
                const fileInfo: FileInfo | undefined = await plugin.analyze(id, code);
                project.putFileInfo(id, fileInfo);
                if (fileInfo) {
                    return plugin.transform(id, fileInfo, code);
                }
            },
            analyze: async (id: string, code: string,) => {
                const action = plugins.find(p => p.isApplicable(id));
                if (action) {
                    return action.analyze(id);
                }
            },
            transform: async (id: string, fileInfo: FileInfo, code: string) => {
                const action = plugins.find(p => p.isApplicable(id));
                if (action) {
                    return action.transform(id, fileInfo, code);
                }
            },
            watchChange: async (id: string, change: { event: ChangeEvent }) => {
                const action = plugins.find(p => p.isApplicable(id));
                if (action) {
                    return action.watchChange(id, change);
                }
            },
            buildStart: async () => {
                for (const plugin of plugins) {
                    await plugin.buildStart();
                }
            },
            configResolved: async (config: any) => {
                project.isBuilding = config.command === "build";
                project.isLibMode = !!config.build.lib;
                project.cssCodeSplit = config.build.cssCodeSplit ?? false;
                project.rootPath = config.root;
                project.projectDir = join(config.root, 'src');
                project.indexPath = join(config.root, 'index.html');
                project.mainPath = join(config.root, 'src', 'main.ts');
                project.tsconfigPath = resolve(config.root, 'tsconfig.json');
                if (!existsSync(project.mainPath)) {
                    project.mainPath = join(config.root, 'src', 'main.js');
                }
                project.outputDir = join(config.root, 'dist');
                project.typecomposerDir = join(config.root, "node_modules", "typecomposer");
                project.nodeModulesDir = join(config.root, "node_modules");
                //if (project.assetsDir && project.isAssetsValid) {
                //    Asstes.listFiles(project.assetsDir, project.assetsDir);
                //}
                //Asstes.build(project.typecomposerDir);
                if (project.isLibMode && config.command === "build") {
                    config.build.rollupOptions ??= {};
                    config.build.rollupOptions.external = config.build.rollupOptions.external || ['typecomposer'];
                }
            },
            configureServer: async (server: any) => {
                // Implement the configureServer logic here
            },
            load: async (d: string) => {
                // Implement the load logic here
                return null; // Return the loaded module or null if not found
            },
            resolveId: async (id: string, importer: string) => {
                // Implement the resolveId logic here
                return null; // Return the resolved ID or null if not found
            }
        };
        return plugin;
    }
}

