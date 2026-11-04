import { ClassDeclaration } from 'ts-morph';
import { ClassInfo, FileInfo } from '../../../typings';

export class ComponentTransformer {


    public async transformer(fileInfo: FileInfo) {
        for await (const classInfo of fileInfo.classes) {
            if (!classInfo.isComponent) continue;
            this.injectContructor(classInfo);
            this.injectOnCreateMethod(classInfo);
        }
    }

    private getParentConstructor(classDeclaration: ClassDeclaration) {
        const baseClass = classDeclaration.getBaseClass();
        if (baseClass) {
            const parentConstructor = baseClass.getConstructors()[0];
            const superCalls = parentConstructor.getStatements().filter(statement =>
                statement.getText().startsWith("super")
            );
            const superText = superCalls.length > 0 ? superCalls[0].getText() : "super(props)";
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

    private injectContructor(classInfo: ClassInfo) {
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
                    statements: ['super(props);', tag, `Component.initComponent(this, ${classDeclaration.getName()});`]
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


    private injectOnCreateMethod(classInfo: ClassInfo) {
        const classDeclaration: ClassDeclaration = classInfo.classDeclaration;
        if (!classDeclaration || (!classInfo.hasTemplate && !classDeclaration.getMethod("template"))) return;
        const onCreateMethod = classDeclaration.getMethod("onCreate");
        if (!onCreateMethod) {
            classDeclaration.addMethod({
                name: "onCreate",
                isAsync: false,
                isStatic: false,
                statements: ['TypeComposer.injectTemplate(this);'],
                parameters: [],
            });
        }
        else {
            onCreateMethod.insertStatements(0, 'TypeComposer.injectTemplate(this);\n');
        }
    }

}