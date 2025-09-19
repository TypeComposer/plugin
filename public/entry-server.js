import express from "express";
import { Window, HTMLElement } from "happy-dom";

const window = new Window();
const document = window.document;
globalThis.window = window;
globalThis.document = document;
globalThis.HTMLElement = HTMLElement;
globalThis.customElements = window.customElements;
const originalDefine = globalThis.customElements.define;
// over no customElements.define
globalThis.customElements.define = (name, constructor, options) => {
  return originalDefine.call(globalThis.customElements, name, constructor, options);
}
globalThis.window = window;
globalThis.Element = window.Element;
globalThis.HTMLButtonElement = window.HTMLButtonElement;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
globalThis.HTMLSelectElement = window.HTMLSelectElement;
globalThis.HTMLFormElement = window.HTMLFormElement;
globalThis.HTMLCanvasElement = window.HTMLCanvasElement;
globalThis.HTMLImageElement = window.HTMLImageElement;
globalThis.HTMLVideoElement = window.HTMLVideoElement;
globalThis.HTMLAudioElement = window.HTMLAudioElement;
globalThis.HTMLIFrameElement = window.HTMLIFrameElement;
globalThis.HTMLScriptElement = window.HTMLScriptElement;
globalThis.HTMLLinkElement = window.HTMLLinkElement;
globalThis.HTMLStyleElement = window.HTMLStyleElement;
globalThis.HTMLHeadElement = window.HTMLHeadElement;
globalThis.HTMLBodyElement = window.HTMLBodyElement;
globalThis.HTMLTitleElement = window.HTMLTitleElement;
globalThis.HTMLMetaElement = window.HTMLMetaElement;
globalThis.HTMLBaseElement = window.HTMLBaseElement;
globalThis.HTMLTableElement = window.HTMLTableElement;
globalThis.HTMLTableRowElement = window.HTMLTableRowElement;
globalThis.HTMLTableCellElement = window.HTMLTableCellElement;
globalThis.HTMLTableSectionElement = window.HTMLTableSectionElement;
globalThis.HTMLTableHeaderCellElement = window.HTMLTableHeaderCellElement;
globalThis.HTMLTableFooterCellElement = window.HTMLTableFooterCellElement;
globalThis.HTMLTableCaptionElement = window.HTMLTableCaptionElement;
globalThis.HTMLDetailsElement = window.HTMLDetailsElement;
globalThis.HTMLSummaryElement = window.HTMLSummaryElement;
globalThis.HTMLDialogElement = window.HTMLDialogElement;
globalThis.HTMLProgressElement = window.HTMLProgressElement;
globalThis.HTMLMeterElement = window.HTMLMeterElement;
globalThis.HTMLTemplateElement = window.HTMLTemplateElement;
globalThis.HTMLSlotElement = window.HTMLSlotElement;
globalThis.HTMLCanvasElement = window.HTMLCanvasElement;
globalThis.HTMLPictureElement = window.HTMLPictureElement;
globalThis.HTMLSourceElement = window.HTMLSourceElement;
globalThis.HTMLTrackElement = window.HTMLTrackElement;
globalThis.HTMLParamElement = window.HTMLParamElement;
globalThis.HTMLObjectElement = window.HTMLObjectElement;
globalThis.HTMLEmbedElement = window.HTMLEmbedElement;
globalThis.HTMLMapElement = window.HTMLMapElement;
globalThis.HTMLAreaElement = window.HTMLAreaElement;
globalThis.HTMLFieldSetElement = window.HTMLFieldSetElement;
globalThis.HTMLLegendElement = window.HTMLLegendElement;
globalThis.HTMLDListElement = window.HTMLDListElement;
globalThis.HTMLUListElement = window.HTMLUListElement;
globalThis.HTMLOListElement = window.HTMLOListElement;
globalThis.HTMLDivElement = window.HTMLDivElement;
globalThis.HTMLSpanElement = window.HTMLSpanElement;
globalThis.HTMLAnchorElement = window.HTMLAnchorElement;
globalThis.HTMLBRElement = window.HTMLBRElement;
globalThis.HTMLHRElement = window.HTMLHRElement;
globalThis.HTMLParagraphElement = window.HTMLParagraphElement;
globalThis.HTMLHeadingElement = window.HTMLHeadingElement;
globalThis.HTMLPreElement = window.HTMLPreElement;
globalThis.HTMLQuoteElement = window.HTMLQuoteElement;
globalThis.HTMLBlockquoteElement = window.HTMLBlockquoteElement;
globalThis.HTMLAddressElement = window.HTMLAddressElement;
globalThis.HTMLAbbrElement = window.HTMLAbbrElement;
globalThis.HTMLAcronymElement = window.HTMLAcronymElement;
globalThis.HTMLBElement = window.HTMLBElement;
globalThis.HTMLBaseFontElement = window.HTMLBaseFontElement;
globalThis.Window = window.Window;
globalThis.Document = window.Document;
globalThis.Node = window.Node;
globalThis.Element = window.Element;
globalThis.HTMLCollection = window.HTMLCollection;
globalThis.SVGElement = window.SVGElement;
globalThis.SVGSVGElement = window.SVGSVGElement;
globalThis.SVGPathElement = window.SVGPathElement;
globalThis.SVGRectElement = window.SVGRectElement;
globalThis.SVGCircleElement = window.SVGCircleElement;
globalThis.SVGEllipseElement = window.SVGEllipseElement;
globalThis.localStorage = {
  getItem: (key) => {
    return null;
  },
  setItem: (key, value) => {
    console.log("setItem", key, value);
  },
  removeItem: (key) => {
    console.log("removeItem", key);
  }
};

import { dirname, join} from 'node:path';
import { fileURLToPath } from 'node:url';
import fs, { readFileSync } from 'node:fs';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
let scriptPath = "";
let indexHtml = "";

const app = express();
app.use(express.static("dist"));
app.use("/assets", express.static("dist/assets"));
async function renderComponentToHtml() {
  return document.body.innerHTML.replaceAll("base-button-element", "button");
}

app.get( '**', express.static(serverDistFolder,{ index: false} ));

app.get("**", async (req, res) => {
  const url = req.url;
  window.location.url = url;
  window.history.pushState({}, "", url);
  const html = await renderComponentToHtml();
  res.send(indexHtml.replace("</body>", `${html}</body>`));
});



async function initSSR() {
    const assetsPath = join(serverDistFolder, 'assets');
    indexHtml = readFileSync(join(serverDistFolder, 'index.html'), 'utf-8');
    fs.readdir(assetsPath, async (err, files) => {
        if (err) {
          console.error('Error reading assets directory:', err);
          return;
        }
        for  (const file of files) {
          if (file.endsWith('.js')) {
            scriptPath = join("assets", file);
          break;
          }
        }
        await import(`./${scriptPath}`).then((module) => {
        console.log("🚀 SSR server running at http://localhost:3010");
        console.log("Module loaded: success");
      }).catch((error) => {
        console.error("Error loading module:", error);
      }); 
  });
}

app.listen(3010, initSSR);
