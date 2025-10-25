import { GetAccessorDeclaration, MethodDeclaration, PropertyDeclaration, SetAccessorDeclaration } from "ts-morph";
import { FileInfo } from "../Interfaces";
import { ProjectBuild } from "../ProjectBuild";

export namespace InjectBuild {
  export async function analyze(fileInfo: FileInfo, project: ProjectBuild): Promise<void> {
    const classes = fileInfo.sourceFile.getClasses();
    for (const cls of classes) {
      const members = cls.getMembers();

      for (const member of members) {
        if (member instanceof MethodDeclaration || member instanceof PropertyDeclaration || member instanceof GetAccessorDeclaration || member instanceof SetAccessorDeclaration) {
          const decorators = member.getDecorators();
          if (decorators.length > 0) {
            for (const decorator of decorators) {
              if (decorator.getName() === "Inject" && project.isDecoratorTypeComposer(decorator)) {
                const memberName = member.getName();
                const type = member.getType().getText().replace(/^.*\./, "");
                const injectionLine = `${memberName} = TypeComposer.inject(${type});`;
                member.replaceWithText(injectionLine);
                break;
              }
            }
          }
        }
      }
    }
  }
}
