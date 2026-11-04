import { Options } from "..";
import { ChangeEvent, FileInfo } from "../plugin/transpilator/Interfaces";
import { ProjectBuild } from "../plugin/transpilator/ProjectBuild";
import { TypeComposeCompilerOptions } from "../typings";
import { ScriptPlugin } from "./script";
import { TemplatePlugin } from "./template";





export namespace TypeComposeCompiler {
    export function compile(options: Options): TypeComposeCompilerOptions {
        const project: ProjectBuild = new ProjectBuild(options);
        const plugins = [
            ScriptPlugin(project),
            TemplatePlugin(project)
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

