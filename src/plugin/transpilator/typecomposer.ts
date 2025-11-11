import { Plugin, ViteDevServer, } from 'vite';
import { ProjectBuild } from './ProjectBuild';
import { ChangeEvent } from './Interfaces';
import { Debuger } from '../Debug/Log';
import { TranslationController } from './base/TranslationController';
import { existsSync } from 'fs';
import { join, resolve } from 'path';


export namespace TypeComposer {

    /**
     * TypeCompose plugin function for project analysis and transformation during pre-build.
     * This plugin is responsible for analyzing the project and applying transformations
     * necessary to ensure that the code is compatible with browsers.
     *
     * @param project - Object that represents the project to be built.
     * @returns A plugin that analyzes and transforms the code during pre-build.
     */
    export function plugin(project: ProjectBuild): Plugin {
        return {
            name: 'typescript-elements',
            enforce: 'pre',
            watchChange(id: string, change: { event: ChangeEvent }) {
                project.watchChange(id, change);
            },
            configureServer(server: ViteDevServer) {
                project.server = server;
                server.pluginContainer.resolveId

            },
            async buildStart() {
                project.viteResolve = async (id: string, importer?: string) => {
                    const resolved = await this.resolve(id, importer, { skipSelf: true });
                    return resolved?.id ?? null;
                };
                await project.buildStart();
            },
            transformIndexHtml(html) {
                return html;
            },
            generateBundle(options, bundle) {
            },
            writeBundle(options, bundle) {
            },
            async config(config, { command }) {
                await project.load_node_modules_dependencys();

                return config;
            },
            async configResolved(config) {
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
                if (config.command === "build") {
                    config.build.rollupOptions ??= {};
                    config.build.rollupOptions.external = config.build.rollupOptions.external || ['typecomposer'];
                }
            },
            async load(id) {
                if (id.includes('\x00')) {
                    Debuger.warn(`load invalid module ID: ${id}`);
                    return null;
                } else if (id == "virtual:translation") {
                    return await TranslationController.load(project);
                }
                return null;
            },
            async resolveId(id, importer) {
                if (id.includes('\x00')) {
                    Debuger.warn(`resolveId invalid module ID: ${id}`);
                    return null;
                } else if (id.startsWith('@/')) {
                    return this.resolve(id, importer, { skipSelf: true }).then(resolved => {
                        if (resolved) {
                            // console.log("✅ Resolved:", id, "→", resolved.id);
                            return resolved.id;
                        }
                    });
                }
                else if (id == "virtual:translation") {
                    return id;
                }
            },
            async handleHotUpdate({ file, server }) {
                if (file.includes('\x00')) {
                    Debuger.warn(`handleHotUpdate invalid module ID: ${file}`);
                    return;
                } else if (file && TranslationController.isFileTranslation(file, project.translationPath)) {
                    server?.ws.send({
                        type: 'custom',
                        event: 'virtual-translation-update',
                        data: await TranslationController.load(project)
                    });
                    return [server.moduleGraph.getModuleById('virtual:translation')!];
                }
            },
            async transform(code, id) {
                if (id.includes('\x00')) {
                    Debuger.warn(`transform invalid module ID: ${id}`);
                    return null;
                } else if (id == "virtual:translation") {
                    return code;
                }
                if (!id.includes("node_modules")) {
                    return await project.transform(code, id, this);
                }
            },
            async buildEnd(config) {
            }
        };
    }

}
