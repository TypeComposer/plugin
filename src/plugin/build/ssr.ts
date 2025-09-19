import { Node, SyntaxKind, SourceFile, ObjectLiteralExpression } from "ts-morph";
import { ProjectBuild } from "../transpilator/ProjectBuild";
import path from "node:path";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";



export namespace SSR {


	export let html = ""


	export async function build(project: ProjectBuild, indexFileName: string) {
		if (!project.options.ssr) return;
		const entryFile = path.join(project.nodeModulesDir, "typecomposer-plugin", "public", "entry-server.js");
		const entryFileDist = path.join(project.outputDir, "entry-server.js");
		copyFileSync(entryFile, entryFileDist);
		console.log("\n\x1b[90mdist/\x1b[0m\x1b[31mentry-server.js\x1b[0m")
		html = "";
	}

}