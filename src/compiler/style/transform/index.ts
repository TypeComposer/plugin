import { FileInfo } from "../../../typings";
import { ProjectBuild } from "../../base/ProjectBuild";
import { Debuger } from "../../../plugin/Debug/Log";

export class StyleTransform {
  public static pathName: string = "public/style.scss";
  public static readonly identifier: string = "virtual:stylebase";
  public static readonly tagPrefix: string = "tc-style";

  constructor(readonly project: ProjectBuild) { }

  private removeComent(input: string): string {
    return input.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "").trim();
  }

  private extractAndRemoveThisBlock(input: string, tag: string): string {
    try {
      // Captura um seletor que contém :host (com ou sem parênteses) até a chave '{'
      // group 2 = seletor (ex.: ':host.open .select-list')
      // group 3 = conteúdo do bloco entre '{' e '}' (não ganancioso)
      const hostRegex = /(^|\s*)(:host(?:\([^)]*\))?(?:[^\{]*))\{([\s\S]*?)\}/g;

      let match;
      const extractedBlocks: { block: string; root: boolean }[] = [];
      let cleanedText = input;

      while ((match = hostRegex.exec(input)) !== null) {
        const fullMatch = match[0];
        const selectorPart = match[2].trim(); // tudo antes da '{'
        const blockContent = match[3];

        // Normalize :host(...) -> tag + inner (removendo parênteses)
        // Ex.: :host(.open)    -> tag.open
        //       :host(:not(.x)) -> tag:not(.x)
        let modifiedSelector = selectorPart.replace(/:host\(([^)]+)\)/g, (_m, inner) => {
          // inner already contains leading punctuation (., :, [ etc) for most cases
          return tag + inner;
        });

        // Replace remaining :host (with possible suffix like .open) -> tag + suffix
        // This handles :host.open and :host.open.up
        modifiedSelector = modifiedSelector.replace(/:host([^\s{]*)/g, (_m, suffix) => {
          return tag + suffix;
        });

        const modifiedBlock = `${modifiedSelector} {${blockContent}}`;

        // Determina se esse bloco era o bloco raiz do host (se seletorPart for apenas ':host' ou ':host(...)')
        const isHostRoot = /^:host(?:\([^)]*\))?$/i.test(selectorPart);

        extractedBlocks.push({ block: modifiedBlock.trim(), root: isHostRoot });
        cleanedText = cleanedText.replace(fullMatch, "");
      }

      cleanedText = cleanedText.trim();
      const root = extractedBlocks.find((e) => e.root);
      if (root && cleanedText) {
        // injeta o CSS restante dentro do bloco root encontrado
        const lastBraceIndex = root.block.lastIndexOf("}");
        if (lastBraceIndex !== -1) {
          const beforeBrace = root.block.substring(0, lastBraceIndex);
          const afterBrace = root.block.substring(lastBraceIndex);
          root.block = `${beforeBrace}\n\t${cleanedText.trim()}\n${afterBrace}`;
        }
      } else if (cleanedText) {
        // se não havia bloco root, cria um novo bloco com o resto do CSS
        extractedBlocks.push({ block: `${tag} {\n\t${cleanedText.trim()}\n}`, root: true });
      }

      return extractedBlocks
        .map((e) => e.block)
        .join("\n\n")
        .trim();
    } catch (error) {
      console.log("e:", error);
      return input;
    }
  }


  public async transform(id: string, _fileInfo: FileInfo, code: string,): Promise<string> {
    const fileCache = this.project.getStyle(id) || { code: "", className: "", timestamp: 0 };
    if (fileCache.className && code && fileCache.link) {
      const classInfo = this.project.getFileInfo(fileCache.link)?.classes.find((c) => c.className == fileCache.className);
      if (classInfo) {
        const baseTag = classInfo.registerOptions.tag || fileCache.className;
        const tag = `[${StyleTransform.tagPrefix}~="${baseTag}"]`;
        const text = this.extractAndRemoveThisBlock(this.removeComent(code), tag);
        Debuger.log("StyleBuild.transform: [", `\n${text}\n`, "] model:", { isLibMode: this.project.isLibMode, isBuilding: this.project.isBuilding });
        code = text;
      }
    }
    this.project.putStyle(id, fileCache);
    return code;
  }
}
