import { ProjectBuild } from "../../plugin/transpilator/ProjectBuild";
import { TypeComposerPlugin, ChangeEvent } from "../../typings";
import { TypeComposerUtils } from "../../utils";
import { ScriptAnalyzer } from "./analyze";
import { ScriptTransform } from "./transform";

export function ScriptPlugin(project: ProjectBuild): TypeComposerPlugin {
    const analyzer = new ScriptAnalyzer(project);
    const transform = new ScriptTransform(project);

    return {
        name: "typecomposer-script",
        project,
        isApplicable: TypeComposerUtils.isScriptFile,

        analyze: analyzer.analyzeFile.bind(analyzer),
        transform: transform.transformFileInfo.bind(transform),
        resolveId: async (id: string, importer: string) => { },
        buildStart: async () => {
            await analyzer.buildStart();
            await transform.buildStart();
        },
        watchChange: async (id: string, change: { event: ChangeEvent }) => {
            await transform.watchChange(id, change);
        }
    };
}