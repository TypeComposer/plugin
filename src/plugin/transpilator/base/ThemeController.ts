
import path, { basename } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { ChangeEvent, FileTheme } from '../Interfaces';
import { ProjectBuild } from '../ProjectBuild';


export namespace Theme {


    const files: FileTheme[] = [];

    export function isThemeFile(file: string): boolean {
        return getFileName(file) != undefined;
    }

    function getFileName(file: string): string | undefined {
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

    export function putFileTheme(pathName: string, name: string) {
        if (files.find(e => e.name == name) == undefined)
            files.push({ name, path: pathName });
    }


    export function clearFileTheme() {
        files.length = 0;
    }

    export function getFiles(): FileTheme[] {
        return files;
    }

    export async function findFiles(directory: string) {
        clearFileTheme();
        function searchRecursively(dir: string) {
            const files = readdirSync(dir);
            files.forEach((file: string) => {
                const filePath = path.join(dir, file);
                const isDirectory = statSync(filePath).isDirectory();
                if (isDirectory) {
                    searchRecursively(filePath);
                } else if (isThemeFile(file)) {
                    putFileTheme(filePath, getFileName(file) as string);
                }
            });
        }
        searchRecursively(directory);
    }


    export async function watchChange(id: string, change: { event: ChangeEvent }, project: ProjectBuild) {
        if (change.event != "update" && (id.endsWith('.scss') || id.endsWith('.css')) && Theme.isThemeFile(basename(id))) {
            const fileTheme = Theme.getFiles().find(e => e.path == id);
            if (change.event == "delete") {
                if (fileTheme) {
                    Theme.getFiles().splice(Theme.getFiles().indexOf(fileTheme), 1);
                }
            }
            else {
                if (fileTheme == undefined) {
                    Theme.putFileTheme(id, getFileName(basename(id)) as string);
                }
            }
        }
    }
}