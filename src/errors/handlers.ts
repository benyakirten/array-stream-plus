import { processError } from "./common";

/**
 * Error handler that breaks the execution of the pipeline on the first error.
 * Compiling the data will return the data as is.
 */
export class Breaker<Input> {
    registerCycleError(error: unknown, index: number) {
        const errMessage = `Error occurred at ${index}th item in iterator: ${processError(error).message}`;
        throw new Error(errMessage);
    }

    registerOpError(error: unknown, index: number, item: Input, op: string) {
        let errMessage = `Error occurred while performing ${op} on ${item} at ${index}th item in iterator: `;
        errMessage += processError(error).message;
        throw new Error(errMessage);
    }
    compile<Data>(data: Data): Data {
        return data;
    }
}

/**
 * Error handler that collects all errors during the pipeline execution.
 * Compiling the data will return the data along with the errors.
 */
export class Settler<Input> {
    errors: Error[] = [];

    registerCycleError(error: unknown, index: number) {
        const errMessage = `Error occurred at ${index}th item in iterator: ${processError(error).message}`;
        this.errors.push(new Error(errMessage));
    }

    registerOpError(error: unknown, index: number, item: Input, op: string) {
        const errMessage = `Error occurred while performing ${op} on ${item} at ${index}th item in iterator: ${processError(error).message}`;
        this.errors.push(new Error(errMessage));
    }
    compile<Data>(data: Data): { data: Data; errors: Error[] } {
        return { data, errors: this.errors };
    }
}

/**
 * Error handler that ignores all errors during the pipeline execution.
 */
export class Ignorer {
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
