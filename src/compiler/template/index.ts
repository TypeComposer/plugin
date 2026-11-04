import { basename, dirname, extname } from "node:path";
import { ProjectBuild } from "../../plugin/transpilator/ProjectBuild";
import { ChangeEvent, FileInfoTemplate, TypeComposerPlugin } from "../../typings";
import { TypeComposerUtils } from "../../utils";
import { TemplateAnalyze } from "./analyze";
import { utimesSync } from "node:fs";

export function TemplatePlugin(project: ProjectBuild): TypeComposerPlugin {
    const analyzer = new TemplateAnalyze();

    return {
        name: 'typecomposer-template',
        project,
        isApplicable: TypeComposerUtils.isTemplateFile,
        analyze: async (id: string) => {
            return {
                id,
                code: "",
            } as any;
        },
        // @ts-ignore
        transform: async (id: string, fileInfo: FileInfoTemplate, code: string) => {
            console.log("Transforming template file:", id);
            return " ";
        },
        buildStart: async () => { },
        resolveId: async (id: string, importer: string) => {
            // Implement the resolveId logic here
            return null; // Return the resolved ID or null if not found
        },
        watchChange: async (id: string, change: { event: ChangeEvent }) => {
            const pathFolder = dirname(id);
            const fileName = basename(id, extname(id));
            const sourceFile = project.getFilesInfos(pathFolder).find((e) => e.classes.length > 0 && e.classes.find((c) => c.className == fileName))
            if (change.event == "delete") {
                project.deleteTemplate(id);
            }
            if (change.event == "delete" || change.event == "create") {
                if (sourceFile) {
                    const now = new Date();
                    utimesSync(sourceFile.path, now, now);
                }
            }
        }
    };
}
