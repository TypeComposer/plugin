import { FileInfoScript } from "../../plugin/transpilator/Interfaces";
import { ProjectBuild } from "../../plugin/transpilator/ProjectBuild";
import { RegisterComponents } from "./register-components";



export async function transformFileInfo(project: ProjectBuild, fileInfo: FileInfoScript) {
    console.log("TypeComposerRuntime transformFileInfo:", fileInfo.path);
    await RegisterComponents.register(fileInfo, project);
}