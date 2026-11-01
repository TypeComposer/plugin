import { Options } from "..";
import { TypeComposerAnalyze } from "../analyze";
import { ChangeEvent, FileInfo } from "../plugin/transpilator/Interfaces";
import { ProjectBuild } from "../plugin/transpilator/ProjectBuild";
import { TypeComposerRuntime } from "../runtime";
import { TypeComposeCompilerOptions } from "../typings";
import { TypeComposerTemplate } from "./template";





export namespace TypeComposeCompiler {
    export function compile(options: Options): TypeComposeCompilerOptions {
        const project: ProjectBuild = new ProjectBuild(options);
        const analyzer = TypeComposerAnalyze.plugin(project);
        const transform = TypeComposerRuntime.plugin(project);
        const template = TypeComposerTemplate.plugin(project);

        const plugin = {
            compile: async (_code: string, id: string) => {
                const fileInfo: FileInfo | undefined = await plugin.analyze(_code, id);
                project.putFileInfo(id, fileInfo);
                if (fileInfo) {
                    return plugin.transform(fileInfo);
                }
            },
            analyze: async (code: string, id: string) => {
                return await analyzer.analyze!(code, id);
            },
            transform: async (fileInfo: FileInfo) => {
                return transform.transform!(fileInfo);
            },
            watchChange: async (id: string, change: { event: ChangeEvent }) => {
                template.watchChange!(id, change);
            },
            buildStart: async () => {
                // Implement the buildStart logic here
            },
            configResolved: async (config: any) => {
                // Implement the configResolved logic here
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

