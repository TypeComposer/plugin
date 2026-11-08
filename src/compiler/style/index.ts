import { TypeComposerPlugin, ChangeEvent } from "../../typings";
import { TypeComposerUtils } from "../../utils";
import { ProjectBuild } from "../base/ProjectBuild";
import { StyleAnalyzer } from "./analyze";
import { StyleTransform } from "./transform";

export function StyletPlugin(project: ProjectBuild): TypeComposerPlugin {
    const analyzer = new StyleAnalyzer(project);
    const transform = new StyleTransform(project);

    return {
        name: "typecomposer-style",
        project,
        isApplicable: TypeComposerUtils.isStyleFile,
        analyze: async (id) => {
            return {
                id,
                code: "",
            } as any;
        },
        transform: transform.transform.bind(transform),
        resolveId: async (id: string, importer: string) => { },
        buildStart: async () => {
            // await analyzer.buildStart();
            // await transform.buildStart();
        },
        watchChange: async (id: string, change: { event: ChangeEvent }) => {
            await analyzer.watchChange(id, change);
        }
    };
}