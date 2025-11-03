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
                const args = decorator.getArguments();
                const argTexts = args.map(arg => arg.getText());
                if (argTexts.length === 0) {
                  argTexts.push("0");
                }
                argTexts.push('this');
                const type = member.getType().getText().replace(/^.*\./, "");
                if (argTexts[0] === "InjectedType.PARENT") {
                  const injectionLine = `get ${memberName}() { return TypeComposer.inject(${type}, ${argTexts.join(", ")}, '${memberName}'); }`;
                  member.replaceWithText(injectionLine);
                  break;
                }
                const injectionLine = `${memberName} = TypeComposer.inject(${type}, ${argTexts.join(", ")});`;
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
