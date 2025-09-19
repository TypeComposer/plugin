

export namespace Debuger {

    export let isDebug = true;
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
    };
    const color = {log: "\x1b[32m", error: "\x1b[31m", warn: "\x1b[33m", info: "\x1b[34m"}



    function debug(type: "log" | "error" | "warn" | "info", message: string, ...optional: any[]){
        if (isDebug && message) {
            if (optional.length > 0 || message.replaceAll("\n","").trim().length > 0) {
                originalConsole[type](`${color[type]}●\x1b[0m ${message}`, ...optional);
                return;
            }
            originalConsole[type](message, ...optional);
        }
   }

    export function log(message: string, ...optional: any[]) {
        debug("log", message, ...optional);
    }

    export function error(message: string, ...optional: any[]) {
        debug("error", message, ...optional);
    }

    export function warn(message: string, ...optional: any[]) {
        debug("warn", message, ...optional);
    }

    export function info(message: string, ...optional: any[]) {
        debug("info", message, ...optional);
    }
}

