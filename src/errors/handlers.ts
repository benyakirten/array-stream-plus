import type { ErrorHandler } from "../types";
import { processError } from "./common";

/**
 * Error handler that breaks the execution of the pipeline on the first error.
 * Compiling the data will return the data as is.
 */
type BreakerOutput<T> = T;
export class Breaker<Input>
    implements ErrorHandler<Input, BreakerOutput<unknown>>
{
    registerCycleError(error: unknown, index: number) {
        const errMessage = `Error occurred at ${index}th item in iterator: ${processError(error).message}`;
        throw new Error(errMessage);
    }

    registerOpError(error: unknown, index: number, item: Input, op: string) {
        let errMessage = `Error occurred while performing ${op} on ${item} at ${index}th item in iterator: `;
        errMessage += processError(error).message;
        throw new Error(errMessage);
    }
    compile<Data>(data: Data): BreakerOutput<Data> {
        return data;
    }
}

/**
 * Error handler that collects all errors during the pipeline execution.
 * Compiling the data will return the data along with the errors.
 */
type SettlerOutput<T> = { data: T; errors: Error[] };
export class Settler<Input>
    implements ErrorHandler<Input, SettlerOutput<unknown>>
{
    errors: Error[] = [];

    registerCycleError(error: unknown, index: number) {
        const errMessage = `Error occurred at ${index}th item in iterator: ${processError(error).message}`;
        this.errors.push(new Error(errMessage));
    }

    registerOpError(error: unknown, index: number, item: Input, op: string) {
        const errMessage = `Error occurred while performing ${op} on ${item} at ${index}th item in iterator: ${processError(error).message}`;
        this.errors.push(new Error(errMessage));
    }
    compile<Data>(data: Data): SettlerOutput<Data> {
        return { data, errors: this.errors };
    }
}

/**
 * Error handler that ignores all errors during the pipeline execution.
 */
export class Ignorer implements ErrorHandler<unknown, BreakerOutput<unknown>> {
    registerCycleError() {
        // noop
    }

    registerOpError() {
        // noop
    }
    compile<Data>(data: Data): Data {
        return data;
    }
}
