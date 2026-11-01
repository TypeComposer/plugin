import { FileInfo } from '../plugin/transpilator/Interfaces';
import { ProjectBuild } from '../plugin/transpilator/ProjectBuild';
import { TypeComposerPluginOptions } from '../typings';
import { transformFileInfo } from './script';


export namespace TypeComposerRuntime {

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
            name: 'typescript-elements-runtime',
            async run(fileInfo: FileInfo) {
                switch (fileInfo.type) {
                    case "script":
                        await transformFileInfo(project, fileInfo);
                        break;
                    case "style":
                        // Implement the logic for handling style files
                        break;
                    case "template":
                        // Implement the logic for handling template files
                        break;
                }
                // Return the transformed code or any other relevant result
                return fileInfo.sourceFile.getFullText();
            },
        }
    }
}
