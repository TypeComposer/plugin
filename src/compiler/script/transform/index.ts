import { ProjectBuild } from "../../../plugin/transpilator/ProjectBuild";
import { FileInfoScript } from "../../../typings";
import { RegisterComponents } from "./register-components";
import { InjectTemplates } from "./inject-templates";
import { TransformTsx } from "./transform-tsx";



export class ScriptTransform {

    private readonly registerComponents: RegisterComponents;
    private readonly injectTemplates: InjectTemplates;
    private readonly transformTsx: TransformTsx;


    constructor(readonly project: ProjectBuild) {
        this.registerComponents = new RegisterComponents(project);
        this.injectTemplates = new InjectTemplates(project);
        this.transformTsx = new TransformTsx(project);
    }


    public async transformFileInfo(_id: string, fileInfo: FileInfoScript, _code: string): Promise<string | null | undefined> {
        console.log("Transforming file:", _id);
        await this.registerComponents.register(fileInfo);
        await this.injectTemplates.inject(fileInfo);
        await this.transformTsx.transform(fileInfo);
        return fileInfo.sourceFile.getFullText();
    }
}