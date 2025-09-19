// import { existsSync, readFileSync, writeFileSync } from 'node:fs';
// import type { Plugin, ResolvedConfig } from 'vite'
// import { sw } from './serviceWorker';
// import { PWAManifest } from './types';
// import { register } from './register';
// import { Debuger } from '../Debug/Log';


// export namespace TypeComposerPWA {

//     export interface PWDOptions {
//         manifest: Required<PWAManifest>;
//         ignoreFiles?: string[];
//         enableServiceWorker?: boolean;
//         enableBackgroundSync?: boolean;
//         enablePeriodicSync?: boolean;
//         enablePushNotifications?: boolean;
//         enableOfflineSupport?: boolean;
//         enableDisplayOverride?: boolean;
//         enableEdgeSidePanel?: boolean;
//         enableFileHandlers?: boolean;
//         enableHandleLinks?: boolean;
//         enableProtocolHandlers?: boolean;
//         enableShareTarget?: boolean;
//         enableShortcuts?: boolean;
//         enableWidgets?: boolean;
//     }


//     async function injectServiceWorker(config: ResolvedConfig, options: PWDOptions, indexjs: string) {
//         if (existsSync(`${config.build.outDir}/index.html`)) {
//             {
//                 let html = readFileSync(`${config.build.outDir}/index.html`, 'utf-8')
//                 const registerSw = register(options, indexjs);
//                 html = html.replace('</head>',
//                     `<link rel="manifest" href="/manifest.webmanifest" />
//         ${options.enableServiceWorker ? `<script type="module" src="/${registerSw.fileName}"></script>` : ''}
//         </head>`
//                 )
//                 writeFileSync(`${config.build.outDir}/index.html`, html)
//                 if (options.enableServiceWorker) {
//                     writeFileSync(`${config.build.outDir}/${registerSw.fileName}`, registerSw.code)
//                     // create service worker
//                     const file = sw(config, options);
//                     writeFileSync(`${config.build.outDir}/${file.fileName}`, file.code)
//                 }
//             }
//         }
//     }

//     export function autoManifest(config: ResolvedConfig): PWAManifest | undefined {
//         return undefined
//     }

//     export function plugin(options: PWDOptions): Plugin {
//         let config: ResolvedConfig | undefined = undefined
//         let indexjs: string | undefined = undefined
//         const transformIndexHtmlHandler = (html: string) => {
//             // const { options, useImportRegister } = ctx
//             // if (options.disable)
//             //   return html

//             // // if virtual register is requested, do not inject.
//             // if (options.injectRegister === 'auto')
//             //   options.injectRegister = useImportRegister ? null : 'script'

//             // return injectServiceWorker(html, options, false)
//         }

//         return {
//             name: 'typecompose:pwa',
//             enforce: 'post',
//             apply: 'build',
//             transformIndexHtml: {
//                 order: 'post',
//                 handler(html) {
//                     return transformIndexHtmlHandler(html)
//                 },
//                 enforce: 'post', // deprecated since Vite 4
//                 async transform(html) { // deprecated since Vite 4
//                     return transformIndexHtmlHandler(html)
//                 },
//             },
//             configResolved(_config) {
//                 config = _config
//                 //if (options.manifest === 'auto')
//                 //    options.manifest = autoManifest(config)
//             },
//             generateBundle(n, bundle) {
//                 for (const key in bundle) {
//                     if (bundle[key].type == 'chunk')
//                         indexjs = bundle[key].fileName
//                 }
//             },
//             closeBundle: {
//                 sequential: true,
//                 order: 'post',
//                 async handler() {
//                     if (options.manifest && config && indexjs) {
//                         writeFileSync(`${config.build.outDir}/manifest.webmanifest`, JSON.stringify(options.manifest))
//                         await injectServiceWorker(config, options, indexjs);
//                         Debuger.log('closeBundle');
//                     }
//                     else
//                         Debuger.warn('no manifest');
//                 },
//             },
//             async buildEnd(error) {
//                 if (error)
//                     throw error
//             },
//         }
//     }
// }