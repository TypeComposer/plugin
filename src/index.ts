import { Plugin } from "vite";
import { ProjectBuild } from "./plugin/transpilator/ProjectBuild";
import { Debuger } from "./plugin/Debug/Log";
import { TypeComposer } from "./plugin/transpilator/typecomposer";
import { TypeComposerBuildPost, TypeComposerBuildPre } from "./plugin/build";

type ElementStyle =
  | "button"
  | "div"
  | "span"
  | "input"
  | "a"
  | "label"
  | "select"
  | "textarea"
  | "form"
  | "img"
  | "header"
  | "footer"
  | "nav"
  | "section"
  | "article"
  | "aside"
  | "main"
  | "figure"
  | "figcaption"
  | "table"
  | "thead"
  | "tbody"
  | "tr"
  | "td"
  | "th"
  | "ul"
  | "ol"
  | "li"
  | "dl"
  | "dt"
  | "dd"
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

export interface Options {
  // pwa?: TypeComposerPWA.PWDOptions;
  debugger?: boolean;
  library?: boolean;
  router?: "auto" | "manual";
  translation?: {
    defaultLanguage: Required<string>;
    computed?: boolean;
    /** folder default 'src/translation' */
    folder: string;
  };
  /**
   * assetsDir: assets directory
   * to disable assetsDir is neseariol pass undefined
   * @default 'src/assets'
   * */
  assetsDir?: string | undefined;
  serviceWorker?: "auto" | string;
  otimize?: boolean;
  /**
   * svgBuild: build svg
   * @default true
   */
  svgBuild?: boolean;
  /**
   * SSR support
   * @default false
   */
  ssr?: boolean;
  /**
   * Enable HMR (Hot Module Replacement)
   * @default false
   */
  metaHot?: boolean;
  /**
   * Styles configuration
   */
  styles?:
    | {
        exclude?: ElementStyle[] | "all";
        include?: ElementStyle[] | "all";
      }
    | false;
}

/**
 * TypeComposer Vite Plugin
 * @param options Options for configuring the plugin
 * @default { assetsDir: 'src/assets', otimize: true, styles: { include: 'all' } }
 * @returns PluginOption
 */
export default function typeComposer(options: Options = { assetsDir: "src/assets", otimize: true, styles: { include: "all" } }): Plugin[] {
  // const { pwa } = options;
  Debuger.isDebug = options.debugger || false;
  Debuger.warn("Activate TypeComposer debugger");
  const project = new ProjectBuild(options);
  const plugins: any[] = [
    TypeComposer.plugin(project),
    //TypeComposerSVG.plugin(),
    TypeComposerBuildPre.plugin(project),
    TypeComposerBuildPost.plugin(project),
  ];
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
