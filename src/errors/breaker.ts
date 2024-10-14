import type { Behavior, ErrorHandler } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Breaker<Input> implements ErrorHandler<Input, void, any> {
    error: Error = new Error("No error registered");

    registerCycleError(error: Error): Behavior {
        this.error = error;
        return "break";
    }

    registerOpError(error: Error): Behavior {
        this.error = error;
        return "break";
    }
    report(): void {
        throw this.error;
    }
    compile<Data>(data: Data): Data {
        return data;
    }
}
