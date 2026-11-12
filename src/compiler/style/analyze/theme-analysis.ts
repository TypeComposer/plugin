
import path, { basename } from 'node:path';
// import { readdirSync, statSync } from 'node:fs';
import { ChangeEvent, FileTheme } from '../../../typings';
import { ProjectBuild } from '../../base/ProjectBuild';
import { readdirSync, statSync } from 'node:fs';


export class ThemeAnalysis {


    static files: FileTheme[] = [];

    constructor() {
        ThemeAnalysis.clearFileTheme();
    }


    private static isThemeFile(file: string): boolean {
        return this.getFileName(file) != undefined;
    }

    private static getFileName(file: string): string | undefined {
        const regex_scss = /^theme-(.*?)\.scss$/;
        const regex_css = /^theme-(.*?)\.css$/;

        const result_1 = file.match(regex_css);
        if (result_1) {
            return result_1[1];
        }
        const result_2 = file.match(regex_scss);
        if (result_2) {
            return result_2[1];
        }
        return undefined;
    }

    private static putFileTheme(pathName: string, name: string) {
        if (ThemeAnalysis.files.find(e => e.name == name) == undefined)
            ThemeAnalysis.files.push({ name, path: pathName });
    }



    private static clearFileTheme() {
        ThemeAnalysis.files.length = 0;
    }

    private static getFiles(): FileTheme[] {
        return ThemeAnalysis.files;
    }

    public static async findFiles(directory: string) {
        this.clearFileTheme();
        const searchRecursively = (dir: string) => {
            const files = readdirSync(dir);
            files.forEach((file: string) => {
                const filePath = path.join(dir, file);
                const isDirectory = statSync(filePath).isDirectory();
                if (isDirectory) {
                    searchRecursively(filePath);
                } else if (this.isThemeFile(file)) {
                    this.putFileTheme(filePath, this.getFileName(file) as string);
                }
            });
        }
        searchRecursively(directory);
    }



    public async watchChange(id: string, change: { event: ChangeEvent }, project: ProjectBuild) {
        if (change.event != "update" && (id.endsWith('.scss') || id.endsWith('.css')) && ThemeAnalysis.isThemeFile(basename(id))) {
            const fileTheme = ThemeAnalysis.getFiles().find(e => e.path == id);
            if (change.event == "delete") {
                if (fileTheme) {
                    ThemeAnalysis.getFiles().splice(ThemeAnalysis.getFiles().indexOf(fileTheme), 1);
                }
            }
            else {
                if (fileTheme == undefined) {
                    ThemeAnalysis.putFileTheme(id, ThemeAnalysis.getFileName(basename(id)) as string);
                }
            }
        }
    }
}