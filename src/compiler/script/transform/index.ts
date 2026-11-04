import { ProjectBuild } from "../../../plugin/transpilator/ProjectBuild";
import { FileInfoScript } from "../../../typings";
import { RegisterComponents } from "./register-components";
import { InjectTemplates } from "./inject-templates";
import { TransformTsx } from "./transform-tsx";
import { ComponentTransformer } from "./transform-component";
import { TransformService } from "./transform-service";



export class ScriptTransform {

    private readonly registerComponents: RegisterComponents;
    private readonly injectTemplates: InjectTemplates;
    private readonly transformTsx: TransformTsx;
    private readonly componentTransformer: ComponentTransformer;


    constructor(readonly project: ProjectBuild) {
        this.registerComponents = new RegisterComponents(project);
        this.injectTemplates = new InjectTemplates(project);
        this.transformTsx = new TransformTsx(project);
        this.componentTransformer = new ComponentTransformer();
    }


    public async transformFileInfo(_id: string, fileInfo: FileInfoScript, _code: string): Promise<string | null | undefined> {
        await this.registerComponents.register(fileInfo);
        await this.injectTemplates.inject(fileInfo);
        await this.componentTransformer.transformer(fileInfo);
        await TransformService.transform(fileInfo, this.project);
        await this.transformTsx.transform(fileInfo);
        return fileInfo.sourceFile.getFullText();
    }
}