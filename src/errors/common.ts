export function processError(e: unknown, prefix: string): string {
    if (e instanceof Error) {
        return `${prefix}: ${e.message}`;
    } else if (typeof e === "string") {
        return `${prefix}: ${e}`;
    } else if (e !== null && typeof e === "object") {
        return `${prefix}: ${e.toString()}`;
    } else {
        return `${prefix}: ${JSON.stringify(e)}`;
    }
}
