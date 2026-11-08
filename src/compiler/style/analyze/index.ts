import { basename, dirname, extname } from 'node:path';
import { ChangeEvent } from '../../../typings';
import { ProjectBuild } from '../../base/ProjectBuild';


export class StyleAnalyzer {


    constructor(private readonly project: ProjectBuild) { }


    async watchChange(id: string, change: { event: ChangeEvent }) {
        const pathFolder = dirname(id);
        const fileName = basename(id, extname(id));
        const sourceFile = this.project.getFilesInfos(pathFolder).find((e) => e.classes.length > 0 && e.classes.find((c) => c.className == fileName))
        if (change.event == "delete") {
            this.project.deleteTemplate(id);
        }
        if (sourceFile && (change.event == "delete" || change.event == "create")) {
            this.project.invalidateModule(sourceFile.path);
            console.log(`Invalidated module: ${sourceFile.path} due to ${change.event} event on ${id}`);
            // if (sourceFile) {
            //     const now = new Date();
            //     utimesSync(sourceFile.path, now, now);
            // }
        }
    }


    // public async analyze(id: string) {
    //     const fileInfo = this.project.getFileInfo(id);
    //     if (!fileInfo) return;
    //     for await (const classInfo of fileInfo.classes) {
    //         const componentName = classInfo.className;
    //         if (!componentName || !fileInfo.path) continue;
    //         classInfo.isExportedStyle = true;
    //         if (existsSync(join(fileInfo.pathFolder, componentName + ".css"))) {
    //             fileInfo.sourceFile.addImportDeclaration({
    //                 moduleSpecifier: `./${componentName}.css`,
    //                 namedImports: [],
    //                 defaultImport: undefined,
    //             });
    //             StyleTransform.files.set(join(fileInfo.pathFolder, componentName + ".css"), { path: fileInfo.path, tag: classInfo.registerOptions.tag, className: componentName });
    //         } else if (existsSync(join(fileInfo.pathFolder, componentName + ".scss"))) {
    //             fileInfo.sourceFile.addImportDeclaration({
    //                 moduleSpecifier: `./${componentName}.scss`,
    //                 namedImports: [],
    //                 defaultImport: undefined,
    //             });
    //             StyleTransform.files.set(join(fileInfo.pathFolder, componentName + ".scss"), { path: fileInfo.path, tag: classInfo.registerOptions.tag, className: componentName });
    //         } else if (existsSync(join(fileInfo.pathFolder, componentName + ".sass"))) {
    //             fileInfo.sourceFile.addImportDeclaration({
    //                 moduleSpecifier: `./${componentName}.sass`,
    //                 namedImports: [],
    //                 defaultImport: undefined,
    //             });
    //             StyleTransform.files.set(join(fileInfo.pathFolder, componentName + ".sass"), { path: fileInfo.path, tag: classInfo.registerOptions.tag, className: componentName });
    //         } else classInfo.isExportedStyle = false;
    //     }
    //     return fileInfo;
    // }
}
