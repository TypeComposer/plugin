import { ProjectBuild } from "../../../plugin/transpilator/ProjectBuild";
import { ChangeEvent, FileInfoScript } from "../../../typings";
import { RegisterComponents } from "./register-components";
import { InjectTemplates } from "./inject-templates";
import { TransformTsx } from "./transform-tsx";
import { ComponentTransformer } from "./transform-component";
import { TransformService } from "./transform-service";
import { InjectRouter } from "./inject-router";



export class ScriptTransform {

    private readonly registerComponents: RegisterComponents;
    private readonly injectTemplates: InjectTemplates;
    private readonly transformTsx: TransformTsx;
    private readonly componentTransformer: ComponentTransformer;
    private readonly injectRouter: InjectRouter;


    constructor(readonly project: ProjectBuild) {
        this.registerComponents = new RegisterComponents(project);
        this.injectTemplates = new InjectTemplates(project);
        this.transformTsx = new TransformTsx(project);
        this.componentTransformer = new ComponentTransformer();
        this.injectRouter = new InjectRouter(project);
    }

    public async buildStart() { }

    public async transformFileInfo(_id: string, fileInfo: FileInfoScript, _code: string): Promise<string | null | undefined> {
        await this.registerComponents.register(fileInfo);
        await this.injectTemplates.inject(fileInfo);
        await this.injectRouter.transform(fileInfo);
        await this.componentTransformer.transformer(fileInfo);
        await TransformService.transform(fileInfo, this.project);
        await this.transformTsx.transform(fileInfo);
        return fileInfo.sourceFile.getFullText();
    }

    public async watchChange(id: string, change: { event: ChangeEvent }) {
        console.log(`ScriptTransform watchChange: ${id}, event: ${change.event}`);
        await this.injectRouter.watchChange(id, change);
    }

    public async watchFileChange(id: string, change: { event: ChangeEvent }) {
    }
}