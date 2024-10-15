export function processError(e: unknown, prefix: string): Error {
    if (e instanceof Error) {
        return new Error(`${prefix}: ${e.message}`);
    } else if (typeof e === "string") {
        return new Error(`${prefix}: ${e}`);
    } else if (e !== null && typeof e === "object") {
        return new Error(`${prefix}: ${e.toString()}`);
    } else {
        return new Error(`${prefix}: ${JSON.stringify(e)}`);
    }
}
