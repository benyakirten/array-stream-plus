export function processError(e: unknown): Error {
    if (e instanceof Error) {
        return e;
    } else if (typeof e === "string") {
        return new Error(e);
    } else if (e !== null && typeof e === "object") {
        return new Error(e.toString());
    } else {
        return new Error(JSON.stringify(e));
    }
}
