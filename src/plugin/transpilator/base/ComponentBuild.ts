import { ClassDeclaration } from 'ts-morph';
import { ClassInfo, FileInfo } from '../Interfaces';

export class ComponentBuild {


    public static async build(fileInfo: FileInfo, code: string): Promise<any> {
        return code;
    }

    public static async analyze(fileInfo: FileInfo) {
        for await (const classInfo of fileInfo.classes) {
            ComponentBuild.injectContructor(classInfo);
        }
    }

    private static getParentConstructor(classDeclaration: ClassDeclaration) {
        const baseClass = classDeclaration.getBaseClass();
        if (baseClass) {
            const parentConstructor = baseClass.getConstructors()[0];
            const superCalls = parentConstructor.getStatements().filter(statement =>
                statement.getText().startsWith("super")
            );
            const superText = superCalls.length > 0 ? superCalls[0].getText() : "super()";
            return {
                parameters: parentConstructor.getParameters().map(param => ({
                    name: param.getName(), type:
                        param.getType().getText()
                })), super: superText
            };
        } else {
            return null;
        }
    }

    private static injectContructor(classInfo: ClassInfo) {
        const classDeclaration: ClassDeclaration = classInfo.classDeclaration;
        const constructors = classDeclaration.getConstructors();
        const tag = (classInfo.elementTag && classInfo.registerOptions.tag && classInfo.isExportedStyle) ? `this.extendedStyle.add("${classInfo.registerOptions.tag}");\n` : ''
        if (constructors.length === 0) {
            const data = this.getParentConstructor(classDeclaration);
            if (data) {
                classDeclaration.addConstructor({
                    parameters: data.parameters,
                    statements: [data.super, tag, `Component.initComponent(this, ${classDeclaration.getName()});`]
                });

            } else {
                classDeclaration.addConstructor({
                    parameters: [{ name: 'props', type: 'any' }],
                    statements: ['super(props);', tag ,`Component.initComponent(this, ${classDeclaration.getName()});`]
                });
            }
        } else {
            const constructor = constructors[0];
            const superCallStatementIndex = constructor.getStatements().findIndex(statement => statement.getText().startsWith('super'));
            if (superCallStatementIndex !== -1) {
                constructor.insertStatements(superCallStatementIndex + 1, `${tag}Component.initComponent(this, ${classDeclaration.getName()});`);
            }
        }
    }

}