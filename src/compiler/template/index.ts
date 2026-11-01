import { utimesSync } from "node:fs";
import { ProjectBuild } from "../../plugin/transpilator/ProjectBuild";
import { TypeComposerPluginOptions } from "../../typings";
import { basename, dirname, extname } from "node:path";


export namespace TypeComposerTemplate {

    const files = new Map<string, { path: string; className: string }>();


    /**
     * TypeCompose plugin function for project analysis and transformation during pre-build.
     * This plugin is responsible for analyzing the project and applying transformations
     * necessary to ensure that the code is compatible with browsers.
     *
     * @param project - Object that represents the project to be built.
     * @returns A plugin that analyzes and transforms the code during pre-build.
     */
    export function plugin(project: ProjectBuild): TypeComposerPluginOptions {
        return {
            name: 'typecomposer-template',
            async watchChange(id, change) {
                const pathComponent = files.get(id);
                if (change.event == "delete") {
                    if (pathComponent) {
                        files.delete(id);
                        const now = new Date();
                        utimesSync(id, now, now);
                    }
                } else if (change.event == "create") {
                    const pathFolder = dirname(id);
                    const fileName = basename(id, extname(id));
                    const sourceFiles = project.getFilesInfos(pathFolder).filter((e) => e.classes.length > 0 && e.classes.find((c) => c.className == fileName));
                    for (const sourceFile of sourceFiles) {
                        const classInfo = sourceFile.classes.find((e) => e.className == fileName);
                        if (classInfo) {
                            files.set(id, { path: sourceFile.path, className: fileName });
                            const now = new Date();
                            utimesSync(sourceFile.path, now, now);
                        }
                    }
                }
            },
        }
    }
}
