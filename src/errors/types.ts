// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class ErrorHandler<Input, Output = any> {
    abstract registerCycleError(error: unknown, index: number): void;
    abstract registerOpError(
        error: unknown,
        index: number,
        item: Input,
        op: string
    ): void;
    abstract compile<Data>(data: Data): Output;

    processError(e: unknown): Error {
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
}
