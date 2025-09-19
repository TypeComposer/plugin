import { existsSync, readdirSync, copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { build, type Plugin, type ResolvedConfig } from 'vite'
import { resolve } from 'node:path';
import { ProjectBuild } from '../transpilator/ProjectBuild'
import { Debuger } from '../Debug/Log'
import { SiteMaps } from './sitemaps';
import { SSR } from './ssr';

export namespace TypeComposerBuildPre {


    export function plugin(project: ProjectBuild): Plugin {
        // let config: ResolvedConfig | undefined = undefined;
        // let indexjs: string | undefined = undefined;
        const RE = /<script\b[^>]*\s(?:tc-test)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?[^>]*>[\s\S]*?<\/script>/gi

        return {
            name: 'typecomposer-pluginr-plugin:pwa',
            enforce: 'pre',
            apply: 'build',
           transformIndexHtml(html) {
            return html.replace(RE, '')
            },
            // configResolved(_config) {
            //     config = _config
            // },
            // async generateBundle(n, bundle) {
            //     for (const [fileName, asset] of Object.entries(bundle)) {
            //         if (asset.type == 'chunk')
            //             indexjs = fileName
            //     }
            // },
            // resolveId(id, importer) {
            //     if (id.includes('\x00')) {
            //         Debuger.log(`transform invalid module ID: ${id}`);
            //         return null;
            //     }
            //     return null
            // },
            // async transform(code, id, options) {
            //     if (id.includes('\x00')) {
            //         Debuger.log(`transform invalid module ID: ${id}`);
            //         return null;
            //     }
            //     return null
            // },
            // closeBundle: {
            //     sequential: true,
            //     order: 'post',
            //     async handler() {

            //     },
            // },
            // async buildEnd(error) {
            //     if (error)
            //         throw error
            // },
        }
    }

}

export namespace TypeComposerBuildPost {


    async function copyFileToDirectory(sourceFile: string, targetDir: string) {
        const fileName = sourceFile.split('/').pop(); // Obtém o nome do arquivo
        if (fileName) {
            const targetPath = resolve(targetDir, fileName); // Cria o caminho de destino
            if (!existsSync(targetPath))
                mkdirSync(targetDir, { recursive: true });
            try {
                copyFileSync(sourceFile, targetPath); // Copia o arquivo
            } catch (err) {
                // @ts-ignore
                console.error(`Erro ao copiar o arquivo: ${err.message}`);
            }
        }
    }

    async function deleteFolder(folderPath: string) {
        try {
            rmSync(folderPath, { recursive: true });
        } catch (err) {
            // @ts-ignore
            console.error(`Erro ao deletar a pasta: ${err.message}`);
        }
    }

    export function plugin(project: ProjectBuild): Plugin {
        let indexFileName: string = "";
        return {
            name: 'typecomposer-plugin-post',
            enforce: 'post', // Certifica-se de que o plugin será executado no final
            apply: 'build', // Apenas durante o build,
            // Manipula o HTML gerado
            async transformIndexHtml(html) {
                SSR.html = html;
                //return html.replace(/(src|href)=["']\/([^"']+)["']/g, '$1="$2"');
            },
            async generateBundle(_, bundle) {
                let indexFileName = ""
                for (const [fileName, chunk] of Object.entries(bundle)) {
                    if (fileName.endsWith('.js')) {
                        indexFileName = fileName;
                        break;
                    }
                }
                await SSR.build(project, indexFileName);
            },
            // Após o build principal, inicia o build dos arquivos na pasta `service`
            async closeBundle() {
                if (project.options.serviceWorker) {
                    const serviceDir = resolve(project.projectDir, project.options.serviceWorker == "auto" ? 'service' : project.options.serviceWorker);
                    if (existsSync(serviceDir)) {
                        const serviceFiles =
                            readdirSync(serviceDir)
                                .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
                                .map((file) => resolve(serviceDir, file));
                        for await (const serviceFile of serviceFiles) {
                            if (serviceFile) {
                                // @ts-ignore
                                const fileName = serviceFile.split('/').pop().replace(/\.(ts|js)$/, '');
                                const tempDir = resolve(project.outputDir, `temp/${fileName}`);
                                await build({
                                    configFile: false, // Não utiliza a configuração principal
                                    build: {
                                        lib: {
                                            entry: serviceFile,
                                            name: fileName,
                                            formats: ['es'],
                                            fileName: () => `${fileName}.js`,
                                        },
                                        rollupOptions: {
                                            input: resolve(serviceDir, serviceFile),
                                            output: {
                                                dir: tempDir, // Diretório de saída
                                                entryFileNames: `[name].js`, // Nome do arquivo de saída
                                                format: 'es', // Pode ajustar o formato se necessário
                                            },
                                            external: [], // Exclui pacotes externos
                                            plugins: [
                                                {
                                                    name: 'ignore-public-folder',
                                                    resolveId(source) {
                                                        // Ignorar arquivos na pasta `public`
                                                        if (source.startsWith('/')) {
                                                            return null; // Não incluir arquivos públicos
                                                        }
                                                        return null;
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                });
                                copyFileToDirectory(resolve(tempDir, `${fileName}.js`), resolve(project.outputDir, "service"));
                                //await moveSync(tempDir, outputDir, { overwrite: true });
                            }
                        }
                        deleteFolder(resolve(project.outputDir, 'temp'));
                    }
                }
                await SiteMaps.build(project);
            },

            async transform(code, id, options) {
                if (id.includes('\x00')) {
                    Debuger.log(`transform invalid module ID: ${id}`);
                    return null;
                }
                else if (ProjectBuild.isScriptFile(id)) {
                    return code.replace(/^import\s+["'](.+?\.html)["'];\s*$/gm, "").replace(/^import\s+["'](.+?\.template)["'];\s*$/gm, "").trim();
                }
            }
        };
    }
}