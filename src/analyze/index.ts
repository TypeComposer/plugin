import { ProjectBuild } from '../plugin/transpilator/ProjectBuild';
import { TypeComposerPluginOptions } from '../typings';
import { TypeComposerUtils } from '../utils';
import { ScriptAnalyzer } from './script/script-analyzer';


export namespace TypeComposerAnalyze {


    /**
     * TypeCompose plugin function for project analysis and transformation during pre-build.
     * This plugin is responsible for analyzing the project and applying transformations
     * necessary to ensure that the code is compatible with browsers.
     *
     * @param project - Object that represents the project to be built.
     * @returns A plugin that analyzes and transforms the code during pre-build.
     */
    export function plugin(project: ProjectBuild): TypeComposerPluginOptions {
        const scriptAnalyzer = new ScriptAnalyzer(project);
        return {
            name: 'typescript-elements-analyze',
            async analyze(_code: string, id: string) {
                if (TypeComposerUtils.isScriptFile(id)) {
                    const result = scriptAnalyzer.analyzeFile(id);
                    TypeComposerUtils.printFileInfo(result!);
                    return result;
                }
            },
        }
    }
}
