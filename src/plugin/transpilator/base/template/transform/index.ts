import { Project, ScriptKind, Node, JsxElement, JsxSelfClosingElement, JsxOpeningElement, JsxChild, Expression, JsxFragment } from "ts-morph";

export namespace TransformStream {
  /** Normaliza nomes de atributos (ex.: class -> className) */
  function normalizeAttrName(name: string): string {
    if (name === "class") return "className";
    return name;
  }

  function cssToJson(css: string) {
    if (!css) return "{}";
    const obj = css
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .reduce((acc, rule) => {
        const [k, v] = rule.split(":").map((s) => s && s.trim());
        if (k && v) acc[k] = v;
        return acc;
      }, {} as Record<string, string>);
    const entries = Object.entries(obj).map(([k, v]) => {
      const keyStr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `${keyStr}: ${JSON.stringify(v)}`;
    });
    return `{ ${entries.join(", ")} }`;
  }

  /** ---- JSX -> TypeComposer ---- */

  function jsxAttrsToProps(opening: JsxOpeningElement | JsxSelfClosingElement): { propsCode: string; spreads: string[] } {
    const attrs = opening.getAttributes();
    const kv: string[] = [];
    const spreads: string[] = [];

    for (const a of attrs) {
      if (Node.isJsxAttribute(a)) {
        const rawName = a.getNameNode().getText();
        const name = normalizeAttrName(rawName);
        const init = a.getInitializer();

        if (!init) {
          kv.push(`${JSON.stringify(name)}: true`);
          continue;
        }

        if (Node.isStringLiteral(init)) {
          if (name === "style") kv.push(`${JSON.stringify(name)}: ${cssToJson(init.getLiteralText())}`);
          else kv.push(`${JSON.stringify(name)}: ${JSON.stringify(init.getLiteralText())}`);
        } else if (Node.isJsxExpression(init)) {
          const expr = init.getExpression();
          if (!expr) continue;
          kv.push(`${JSON.stringify(name)}: ${exprToCode(expr)}`);
        } else {
          kv.push(`${JSON.stringify(name)}: ${init.getText()}`);
        }
      } else if (Node.isJsxSpreadAttribute(a)) {
        spreads.push(a.getExpression().getText());
      }
    }

    let propsCode = "{}";
    if (spreads.length === 0 && kv.length === 0) propsCode = "{}";
    else if (spreads.length === 0) propsCode = `{ ${kv.join(", ")} }`;
    else {
      const parts = ["{}"].concat(spreads).concat(kv.length ? [`{ ${kv.join(", ")} }`] : []);
      propsCode = `Object.assign(${parts.join(", ")})`;
    }

    return { propsCode, spreads };
  }

  function jsxSelfClosingToCreateElement(el: JsxSelfClosingElement): string {
    const tag = el.getTagNameNode().getText();
    const { propsCode } = jsxAttrsToProps(el);
    const isLower = /^[a-z]/.test(tag);
    const tagArg = (isLower ? JSON.stringify(tag) : tag) || "fragment";
    return `TypeComposer.createElement(${tagArg}, ${propsCode})`;
  }

  function jsxOpeningToHeader(el: JsxOpeningElement): { tagArg: string; propsCode: string } {
    const tag = el.getTagNameNode().getText();
    const isLower = /^[a-z]/.test(tag);
    const tagArg = isLower ? JSON.stringify(tag) : tag;
    const { propsCode } = jsxAttrsToProps(el);
    return { tagArg, propsCode };
  }

  function jsxElementToCreateElement(el: JsxElement): string {
    const { tagArg, propsCode } = jsxOpeningToHeader(el.getOpeningElement());
    const childrenArgs = jsxChildrenToArgs(el.getJsxChildren());
    return `TypeComposer.createElement(${tagArg}, ${propsCode}${childrenArgs.length ? ", " + childrenArgs.join(", ") : ""})`;
  }

  function getFragmentJsxChildren(frag: JsxFragment): JsxChild[] {
    return frag.getJsxChildren();
  }

  function jsxChildrenToArgs(children: JsxChild[]): string[] {
    const out: string[] = [];
    console.log("🔵 jsxChildrenToArgs:", children.length);

    for (const ch of children) {
      if (Node.isJsxText(ch)) {
        const text = ch.getText().replace(/\s+/g, " ");
        const trimmed = text.trim();
        if (trimmed) out.push(JSON.stringify(trimmed));
      } else if (Node.isJsxExpression(ch)) {
        const expr = ch.getExpression();
        if (expr) out.push(exprToCode(expr));
      } else if (Node.isJsxElement(ch)) {
        out.push(jsxElementToCreateElement(ch));
      } else if (Node.isJsxSelfClosingElement(ch)) {
        out.push(jsxSelfClosingToCreateElement(ch));
      } else if (Node.isJsxFragment(ch)) {
        const inner = jsxChildrenToArgs(getFragmentJsxChildren(ch));
        if (inner.length) out.push(`TypeComposer.createElement("fragment", {}, ${inner.join(", ")})`);
      }
    }
    return out;
  }

  /** ---- EXPRESSÕES: recursivo, convertendo JSX onde aparecer ---- */

  function exprListToCode(args: readonly Expression[]): string {
    return args.map((a) => exprToCode(a)).join(", ");
  }

  function exprToCode(expr: Expression): string {
    // JSX direto como expressão
    if (Node.isJsxElement(expr as any)) return jsxElementToCreateElement(expr as any as JsxElement);
    if (Node.isJsxSelfClosingElement(expr as any)) return jsxSelfClosingToCreateElement(expr as any as JsxSelfClosingElement);
    if (Node.isJsxFragment(expr as any)) {
      const args = jsxChildrenToArgs(getFragmentJsxChildren(expr as any as JsxFragment));
      return args.length ? `TypeComposer.createElement("fragment", {}, ${args.join(", ")})` : `null`;
    }

    // Literais/objetos/arrays/identificadores
    if (Node.isStringLiteral(expr) || Node.isNoSubstitutionTemplateLiteral(expr)) return JSON.stringify(expr.getLiteralText());
    if (Node.isNumericLiteral(expr)) return expr.getText();
    if (Node.isTrueLiteral(expr) || Node.isFalseLiteral(expr) || Node.isNullLiteral(expr)) return expr.getText();
    if (Node.isArrayLiteralExpression(expr)) return `[${expr.getElements().map(exprToCode).join(", ")}]`;
    if (Node.isObjectLiteralExpression(expr)) {
      const pairs = expr
        .getProperties()
        .map((p) => {
          if (Node.isPropertyAssignment(p)) {
            const keyNode = p.getNameNode();
            const key = keyNode.getText();
            const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
            const init = p.getInitializerOrThrow();
            return `${safeKey}: ${exprToCode(init)}`;
          }
          if (Node.isShorthandPropertyAssignment(p)) {
            const k = p.getName();
            return `${k}: ${k}`;
          }
          if (Node.isSpreadAssignment(p)) {
            return `__SPREAD__:${p.getExpression().getText()}`;
          }
          return "";
        })
        .filter(Boolean) as string[];

      const hasSpread = pairs.some((s) => s.startsWith("__SPREAD__:"));
      if (!hasSpread) return `{ ${pairs.join(", ")} }`;
      const parts: string[] = ["{}"];
      for (const part of pairs) {
        if (part.startsWith("__SPREAD__:")) parts.push(part.replace("__SPREAD__:", ""));
        else parts.push(`{ ${part} }`);
      }
      return `Object.assign(${parts.join(", ")})`;
    }
    if (Node.isIdentifier(expr)) return expr.getText();

    // Parênteses
    if (Node.isParenthesizedExpression(expr)) {
      return `(${exprToCode(expr.getExpression())})`;
    }

    // Condicional (ternário)
    if (Node.isConditionalExpression(expr)) {
      const cond = exprToCode(expr.getCondition());
      const whenTrue = exprToCode(expr.getWhenTrue());
      const whenFalse = exprToCode(expr.getWhenFalse());
      return `${cond} ? ${whenTrue} : ${whenFalse}`;
    }

    // Binário / lógico (inclui &&, ||, +, etc.)
    if (Node.isBinaryExpression(expr)) {
      const left = exprToCode(expr.getLeft());
      const op = expr.getOperatorToken().getText();
      const right = exprToCode(expr.getRight());
      return `${left} ${op} ${right}`;
    }

    // Template string com interpolações
    if (Node.isTemplateExpression(expr)) {
      const head = expr.getHead().getLiteralText();
      const spans = expr.getTemplateSpans().map((span) => {
        const e = exprToCode(span.getExpression());
        const lit = span.getLiteral().getLiteralText();
        return `\${${e}}${lit}`;
      });
      return "`" + head + spans.join("") + "`";
    }

    // Arrow function (corpo expressão OU bloco)
    if (Node.isArrowFunction(expr)) {
      const params = expr
        .getParameters()
        .map((p) => p.getText())
        .join(", ");
      const body = expr.getBody();
      if (Node.isBlock(body)) {
        const statements = body.getStatements().map((s) => {
          // converte "return <JSX/>" para "return TypeComposer.createElement(...)"
          if (Node.isReturnStatement(s)) {
            const ret = s.getExpression();
            if (ret) return `return ${exprToCode(ret)};`;
          }
          // fallback: mantém como está
          return s.getText();
        });
        return `(${params}) => {\n${statements.join("\n")}\n}`;
      } else {
        return `(${params}) => ${exprToCode(body as Expression)}`;
      }
    }

    // Chamada de função (com genéricos e spreads)
    if (Node.isCallExpression(expr)) {
      const callee = expr.getExpression().getText();
      const typeArgs = expr.getTypeArguments();
      const typeArgsTxt = typeArgs.length ? `<${typeArgs.map((t) => t.getText()).join(", ")}>` : "";
      const args = expr.getArguments().map((a) => {
        // SpreadElement é um Expression em ts-morph; checamos via getKindName()
        if ((a as any).getKindName?.() === "SpreadElement" && (a as any).getExpression) {
          return `...${exprToCode((a as any).getExpression())}`;
        }
        return exprToCode(a as Expression);
      });
      return `${callee}${typeArgsTxt}(${args.join(", ")})`;
    }

    // New, Await, NonNull, AsExpression etc. — mantém estrutura e processa filhos principais
    if (Node.isNewExpression(expr)) {
      const ctor = expr.getExpression().getText();
      const args = expr.getArguments()?.map((a) => exprToCode(a as Expression)) ?? [];
      return `new ${ctor}(${args.join(", ")})`;
    }
    if (Node.isAwaitExpression(expr)) return `await ${exprToCode(expr.getExpression())}`;
    if (Node.isNonNullExpression(expr)) return `${exprToCode(expr.getExpression())}!`;
    if (Node.isAsExpression(expr)) return `${exprToCode(expr.getExpression())} as ${expr?.getTypeNode()?.getText()}`;

    // fallback: mantém o texto
    return expr.getText();
  }

  /** ---- Entrada principal ---- */

  export function convertTsxToTypeComposer(tsx: string): string {
    const project = new Project();
    const sf = project.createSourceFile("in-memory.tsx", tsx, { overwrite: true, scriptKind: ScriptKind.TSX });

    const jsxRoots = sf.getDescendants().filter((n) => Node.isJsxElement(n) || Node.isJsxSelfClosingElement(n) || Node.isJsxFragment(n));
    if (jsxRoots.length === 0) return "";

    const root = jsxRoots[0];
    if (Node.isJsxElement(root)) return jsxElementToCreateElement(root);
    if (Node.isJsxSelfClosingElement(root)) return jsxSelfClosingToCreateElement(root);
    if (Node.isJsxFragment(root)) {
      console.log("🔵 Fragment root found");
      const args = jsxChildrenToArgs(getFragmentJsxChildren(root));
      console.log("🔵 Fragment args:", args);
      return args.length ? `TypeComposer.createElement("fragment", {}, ${args.join(", ")})` : "";
    }
    return "";
  }

  export function convertTsxFileToExportedFunction(tsx: string, exportName = "renderView", outFile = "renderView.ts"): string {
    const project = new Project();
    const source = project.createSourceFile(outFile, "", { overwrite: true, scriptKind: ScriptKind.TS });
    const body = convertTsxToTypeComposer(tsx) || `TypeComposer.createElement("div", {})`;

    source.addStatements([`// Arquivo gerado automaticamente`, `export function ${exportName}() {`, `  return ${body};`, `}`]);

    return source.getFullText();
  }
}
