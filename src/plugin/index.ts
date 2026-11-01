import { Plugin, ViteDevServer, } from 'vite';
import { ChangeEvent } from '../plugin/transpilator/Interfaces';
import { TypeComposeCompiler } from '../compiler';
import { Options } from '..';


export namespace TypeComposerVitePlugin {




    /**
     * TypeCompose plugin function for project analysis and transformation during pre-build.
     * This plugin is responsible for analyzing the project and applying transformations
     * necessary to ensure that the code is compatible with browsers.
     *
     * @param project - Object that represents the project to be built.
     * @returns A plugin that analyzes and transforms the code during pre-build.
     */
    export function plugin(options: Options): Plugin {
        const plugin = TypeComposeCompiler.compile(options);
        return {
            name: 'typescript-elements',
            enforce: 'pre',
            async configResolved(config) {
                const context = await plugin.configResolved(config);
                console.log("TypeComposerAnalyze configResolved:", context);
            },

            watchChange(id: string, change: { event: ChangeEvent }) {
                plugin.watchChange(id, change);
                console.log("TypeComposerAnalyze watchChange:", id, change);
            },
            configureServer(server: ViteDevServer) {
                // project.server = server;
                // server.pluginContainer.resolveId
                console.log("TypeComposerAnalyze configureServer:");

            },
            async buildStart() {
                // project.viteResolve = async (id: string, importer?: string) => {
                //     const resolved = await this.resolve(id, importer, { skipSelf: true });
                //     return resolved?.id ?? null;
                // };
                // await project.buildStart();
                console.log("TypeComposerAnalyze buildStart");
            },
            transformIndexHtml(html) {
                return html;
            },
            generateBundle(options, bundle) {
            },
            writeBundle(options, bundle) {
            },
            async config(config, { command }) {
                // await project.load_node_modules_dependencys();
                console.log("TypeComposerAnalyze config:", command);

                return config;
            },
            async load(id) {
                // if (id.includes('\x00')) {
                //     Debuger.warn(`load invalid module ID: ${id}`);
                //     return null;
                // } else if (id == "virtual:translation") {
                //     return await TranslationController.load(project);
                // }
                // console.log("TypeComposerAnalyze load:", id);
                return null;
            },
            async resolveId(id, importer) {
                // console.log("TypeComposerAnalyze resolveId:", id, importer);
                // if (id.includes('\x00')) {
                //     Debuger.warn(`resolveId invalid module ID: ${id}`);
                //     return null;
                // } else if (id.startsWith('@/')) {
                //     return this.resolve(id, importer, { skipSelf: true }).then(resolved => {
                //         if (resolved) {
                //             // console.log("✅ Resolved:", id, "→", resolved.id);
                //             return resolved.id;
                //         }
                //     });
                // }
                // else if (id == "virtual:translation") {
                //     return id;
                // }
            },
            async handleHotUpdate({ file, server }) {

            },
            async transform(code, id) {
                if (id.includes('\x00')) {
                    // Debuger.warn(`transform invalid module ID: ${id}`);
                    return null;
                } else if (id == "virtual:translation") {
                    return code;
                }
                if (!id.includes("node_modules")) {
                    return plugin.compile(code, id);
                }
            },
            async buildEnd(config) {
            }
        };
    }

}
