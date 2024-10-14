export interface ErrorHandler<Input, Report, Output> {
    registerCycleError(error: Error, index: number): Behavior;
    registerOpError(
        error: Error,
        index: number,
        item: Input,
        op: string
    ): Behavior;
    report(): Report;
    compile<Data>(data: Data): Output;
}

export type Behavior = "continue" | "break";
