import { ErrorHandler } from "./types";

/**
 * Error handler that breaks the execution of the pipeline on the first error.
 * Compiling the data will return the data as is.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Breaker<Input> extends ErrorHandler<Input, any> {
    registerCycleError(error: unknown, index: number) {
        const errMessage = `Error occurred at ${index}th item in iterator: ${this.processError(error).message}`;
        throw new Error(errMessage);
    }

    registerOpError(error: unknown, index: number, item: Input, op: string) {
        let errMessage = `Error occurred while performing ${op} on ${item} at ${index}th item in iterator: `;
        errMessage += this.processError(error).message;
        throw new Error(errMessage);
    }
    compile<Data>(data: Data): Data {
        return data;
    }
}
