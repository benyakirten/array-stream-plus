export interface ErrorHandler<Output> {
    register(error: Error): Behavior;
    compile(): Output;
}

export enum Behavior {
    CONTINUE = "CONTINUE",
    STOP = "STOP",
}
