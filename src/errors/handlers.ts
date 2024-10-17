import type { ErrorHandler } from "../types";
import { processError } from "./common";

export type BreakerOutput<T> = T;
/**
 * Error handler that breaks the execution of the pipeline on the first error.
 * Compiling the data will return the data as is. This is similar to not having
 * any error handling if you wish to do the error handling externally.
 *
 * The Breaker handler is the default error handler for the `ArrayStream` and `AsyncArrayStream` classes.
 * ```ts
 * const stream = new ArrayStream([1,2,3,4,5], new Breaker())
 *   .map((x) => {
 *     if (x === 3) {
 *       throw new Error("test error");
 *     }
 *     return x;
 *   })
 *
 * try {
 *   return [stream.collect(), null];
 * } catch (e) {
 *   return [null, e];
 * }
 * ```
 */
export class Breaker<Input>
    implements ErrorHandler<Input, BreakerOutput<unknown>>
{
    /**
     * Rethrows an error with more context when an error occurs during an iteration, i.e.
     * ```ts
     * function* gen() {
     *   yield 1;
     *   throw new Error("test error");
     * }
     *
     * const stream = new ArrayStream(gen, new Breaker()).collect();
     * // throws: Error occurred at item at index 1 in iterator: test error
     * ```
     */
    registerCycleError(error: unknown, index: number) {
        const prefix = `Error occurred at item at index ${index} in iterator`;
        const errMessage = processError(error, prefix);
        throw new Error(errMessage);
    }

    /**
     * Rethrows an error with more context when an error occurs during an operation, i.e.
     * ```ts
     * const stream = new ArrayStream([1,2,3,4,5], new Breaker())
     *   .map((x) => {
     *     if (x === 3) {
     *      throw new Error("test error");
     *     }
     *     return x;
     *   })
     *   .collect()
     * // throws: Error occurred while performing map on 3 at index 2 in iterator: test error
     * ```
     */
    registerOpError(error: unknown, index: number, item: Input, op: string) {
        const prefix = `Error occurred while performing ${op} on ${item} at index ${index} in iterator`;
        const errMessage = processError(error, prefix);
        throw new Error(errMessage);
    }

    /**
     * The Breaker error handler will return the data with no modifications, i.e.
     *
     * ```ts
     * const stream = new ArrayStream([1,2,3,4,5], new Breaker()).collect();
     * console.log(stream) // [1,2,3,4,5]
     * ```
     */
    compile<Data>(data: Data): BreakerOutput<Data> {
        return data;
    }
}
export type SettlerOutput<T> = { data: T; errors: string[] };

/**
 * Error handler that collects all errors during the pipeline execution.
 * Compiling the data will return the data along with the errors.
 * ```ts
 * function* gen() {
 *   yield 1;
 *   throw new Error("test error");
 *   yield 3;
 * }
 *
 * const stream = new ArrayStream(gen, new Settler())
 *   .map(x => {
 *     if (x === 3) {
 *       throw new Error("test error");
 *     }
 *     return x;
 *   })
 *   .collect();
 * // {
 * //   data: [1],
 * //   errors: [
 * //     "Error occurred at item at index 1 in iterator: test error",
 * //     "Error occurred while performing map on 3 at index 2 in iterator: test error"
 * //   ]
 * // }
 * ```
 */
export class Settler<Input>
    implements ErrorHandler<Input, SettlerOutput<unknown>>
{
    errors: string[] = [];

    /**
     * Collects an error and adds more context when an error occurs during an iteration, i.e.
     * ```ts
     * function* gen() {
     *   yield 1;
     *   throw new Error("test error");
     * }
     *
     * const stream = new ArrayStream(gen, new Settler()).collect();
     * // {
     * //   data: [1],
     * //   errors: [
     * //     "Error occurred at item at index 1 in iterator: test error",
     * //   ]
     * // }
     * ```
     */
    registerCycleError(error: unknown, index: number) {
        const prefix = `Error occurred at item at index ${index} in iterator`;
        const err = processError(error, prefix);
        this.errors.push(err);
    }

    /**
     * Collects an error and adds more context when an error occurs during an operation, i.e.
     * ```ts
     * const stream = new ArrayStream([1,2,3], new Settler())
     *   .map(x => {
     *     if (x === 3) {
     *       throw new Error("test error");
     *     }
     *     return x;
     *   })
     *   .collect();
     * // {
     * //   data: [1,2],
     * //   errors: [
     * //     "Error occurred while performing map on 3 at index 2 in iterator: test error"
     * //   ]
     * // }
     * ```
     */
    registerOpError(error: unknown, index: number, item: Input, op: string) {
        const prefix = `Error occurred while performing ${op} on ${item} at index ${index} in iterator`;
        const err = processError(error, prefix);
        this.errors.push(err);
    }

    /**
     * Compiles the data into an object containing the data and an array of errors, i.e.
     */
    compile<Data>(data: Data): SettlerOutput<Data> {
        return { data, errors: this.errors };
    }
}

/**
 * Error handler that ignores all errors during the pipeline execution and discards the values, i.e.
 * ```ts
 * function* gen() {
 *   yield 1;
 *   throw new Error("test error");
 *   yield 3;
 * }
 *
 * const stream = new ArrayStream(gen, new Settler())
 *   .map(x => {
 *     if (x === 3) {
 *       throw new Error("test error");
 *     }
 *     return x;
 *   })
 *   .collect();
 * // [1]
 * ```
 */
export class Ignorer implements ErrorHandler<unknown, BreakerOutput<unknown>> {
    /**
     * Ignores the error when an error occurs during iteration.
     */
    registerCycleError() {
        // noop
    }

    /**
     * Ignores the error when an error occurs during an operation.
     */
    registerOpError() {
        // noop
    }

    /**
     * Returns the data that was able to be compiled as is.
     */
    compile<Data>(data: Data): Data {
        return data;
    }
}
