import path, { basename } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { ChangeEvent, FileInfo } from "../../../typings";
import { ProjectBuild } from "../../base/ProjectBuild";
import { Router } from "../../../plugin/transpilator/base/RouterController";

export class InjectRouter {

  constructor(private project: ProjectBuild) { }

  static isRouterFile(file: string): boolean {
    file = file.toLocaleLowerCase();
    return file === "router.ts" || file === "router.js";
  }

  static async findRouterTsFiles(directory: string): Promise<string[]> {
    if (!directory || !statSync(directory).isDirectory()) {
      console.warn(`Invalid directory provided to findRouterTsFiles: ${directory}`);
      return [];
    }
    const routerTsFiles: string[] = [];
    function searchRecursively(dir: string) {
      const files = readdirSync(dir);
      files.forEach((file: string) => {
        const filePath = path.join(dir, file);
        const isDirectory = statSync(filePath).isDirectory();
        if (isDirectory) {
          searchRecursively(filePath);
        } else if (InjectRouter.isRouterFile(file)) {
          routerTsFiles.push(filePath);
        }
      });
    }
    searchRecursively(directory);
    return routerTsFiles;
  }

  async watchChange(id: string, change: { event: ChangeEvent }) {
    if (this.project.options.router === "manual") return;
    if ((id.endsWith(".ts") || id.endsWith(".js")) && InjectRouter.isRouterFile(basename(id))) {
      if (change.event == "update") return;
      if (change.event == "delete") {
        this.project.routerPath = "";
      } else {
        const routers = await InjectRouter.findRouterTsFiles(this.project.projectDir);
        if (routers.length > 0) {
          this.project.routerPath = routers[0];
        } else {
          this.project.routerPath = "";
        }
      }
      this.project.invalidateModule(this.project.mainPath);
    }
  }

  async inject(fileInfo: FileInfo) {
    if (this.project.options.router === "manual") return;
    const pathName = fileInfo.path;
    const fileName = path.basename(pathName).toLocaleLowerCase();
    if (InjectRouter.isRouterFile(fileName)) {
      Router.watchChange(pathName, { event: "update" }, this.project);
    }
  }

  public async transform(fileInfo: FileInfo) {
    if (this.project.options.router === "manual" || !this.project.routerPath) return;
    if (this.project.isMainFile(fileInfo)) {
      fileInfo.sourceFile.addStatements(`import "${this.project.routerPath}";`);
    }
  }
}
