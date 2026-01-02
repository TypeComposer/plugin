import type { Plugin } from 'vite';
import { ProjectBuild } from '../transpilator/ProjectBuild';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { Debuger } from '../Debug/Log';

type ProxyConfig = {
    target: string;
    secure?: boolean;
    changeOrigin?: boolean;
}

export namespace TypeComposerProxy {

    const configPath = 'proxy.config.json';

    export function plugin(project: ProjectBuild): Plugin {
        return {
            name: 'typecomposer-api-proxy',
            config(viteConfig) {
                try {
                    if (project.options.proxy !== false) {
                        const absolutePath = path.resolve(configPath);
                        const proxyConfig = JSON.parse(
                            readFileSync(absolutePath, 'utf-8')
                        );
                        Debuger.log(`Loaded proxy configuration from ${absolutePath}`);
                        viteConfig.server ??= {};
                        viteConfig.server.proxy ??= {};

                        for (const [context, options] of Object.entries<ProxyConfig>(proxyConfig)) {
                            const viteContext = context.replace(/\/\*\*$/, '');
                            viteConfig.server.proxy[viteContext] = {
                                target: options.target,
                                changeOrigin: options.changeOrigin ?? true,
                                secure: options.secure ?? false,
                            };
                        }
                    }
                } catch (error: any) {
                    console.error(`Error loading proxy configuration: ${error.message}`);
                }
            }
        };
    }

}