import { Plugin } from "vite";
import { Debuger } from "./plugin/Debug/Log";
import { TypeComposerProxy } from "./plugin/proxy";
import { TypeComposerVitePlugin } from "./plugin";
import { ProjectBuild } from "./compiler/base/ProjectBuild";
import { Options } from "./typings";



/**
 * TypeComposer Vite Plugin
 * @param options Options for configuring the plugin
 * @default { assetsDir: 'src/assets', otimize: true, styles: { include: 'all' } }
 * @returns PluginOption
 */
export default function typeComposer(options: Options = {
  translation: {
    defaulLocale: 'en', Locales: ['en'], translationPath: 'src/translations'
  }
  , assetsDir: "src/assets", otimize: true, styles: { include: "all" }
}): Plugin[] {
  // const { pwa } = options;
  Debuger.isDebug = options.debugger || false;
  Debuger.warn("Activate TypeComposer debugger");
  // const project = new ProjectBuild(options);
  const plugins: any[] = [
    TypeComposerVitePlugin.plugin(options),
    // TypeComposer.plugin(project),
    // //TypeComposerSVG.plugin(),
    // TypeComposerBuildPre.plugin(project),
    // TypeComposerBuildPost.plugin(project),
  ];
  // if (options.proxy !== false) {
  //   plugins.push(TypeComposerProxy.plugin(project));
  // }
  // if (pwa) {
  //     Debuger.log('activate pwa build');
  //     // @ts-ignore
  //     plugins.push(TypeComposerPWA.plugin(pwa));
  // }
  if (options.otimize) {
    Debuger.log("activate otimize build");
  }
  return plugins; // Retorna array como PluginOption único
}
