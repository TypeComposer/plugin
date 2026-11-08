import { ChangeEvent, FileInfoScript } from "../../../typings";
import { RegisterComponents } from "./register-components";
import { InjectTemplates } from "./inject-templates";
import { TransformTsx } from "./transform-tsx";
import { ComponentTransformer } from "./transform-component";
import { TransformService } from "./transform-service";
import { InjectRouter } from "./inject-router";
import { ProjectBuild } from "../../base/ProjectBuild";
import { InjectStyle } from "./inject-style";
import { TransformRef } from "./transform-ref";



export class ScriptTransform {

    private readonly registerComponents: RegisterComponents;
    private readonly injectTemplates: InjectTemplates;
    private readonly transformTsx: TransformTsx;
    private readonly componentTransformer: ComponentTransformer;
    private readonly injectRouter: InjectRouter;
    private readonly injectStyle: InjectStyle;
    private readonly transformRef: TransformRef;


    constructor(readonly project: ProjectBuild) {
        this.registerComponents = new RegisterComponents(project);
        this.injectTemplates = new InjectTemplates(project);
        this.transformTsx = new TransformTsx(project);
        this.componentTransformer = new ComponentTransformer();
        this.injectRouter = new InjectRouter(project);
        this.injectStyle = new InjectStyle(project);
        this.transformRef = new TransformRef(project);
    }

    public async buildStart() { }

    public async transformFileInfo(_id: string, fileInfo: FileInfoScript, _code: string): Promise<string | null | undefined> {
        await this.registerComponents.register(fileInfo);
        await this.injectTemplates.inject(fileInfo);
        await this.injectRouter.transform(fileInfo);
        await this.componentTransformer.transformer(fileInfo);
        await this.injectStyle.inject(fileInfo);
        await TransformService.transform(fileInfo, this.project);
        await this.transformTsx.transform(fileInfo);
        await this.transformRef.transform(fileInfo);
        return fileInfo.sourceFile.getFullText();
    }

    public async watchChange(id: string, change: { event: ChangeEvent }) {
        console.log(`ScriptTransform watchChange: ${id}, event: ${change.event}`);
        await this.injectRouter.watchChange(id, change);
    }

    public async watchFileChange(id: string, change: { event: ChangeEvent }) {
    }
}