import { existsSync, readFileSync } from "node:fs";
import { ProjectBuild } from '../ProjectBuild';


export class SvgBuild {


    public static async transform(_code: string, id: string, _project: ProjectBuild) {
        if (!SvgBuild.isSvgFile(id) || !existsSync(id))
            return _code;
        const svgCode = readFileSync(id, 'utf-8');
        return `export default \`${svgCode}\`;`;
    }

    public static isSvgFile(filePath: string) {
        return filePath.endsWith('.svg');
    }

}