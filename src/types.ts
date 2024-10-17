import type {
    Breaker,
    // BreakerOutput,
    Ignorer,
    Settler,
    SettlerOutput,
} from "./errors/handlers";

export type AsyncOp = {
    type: "map" | "filter" | "foreach" | "filterMap";
    op: MaybeAsyncFn<unknown, unknown>;
};

export type Op = {
    type: "map" | "filter" | "foreach" | "filterMap";
    op: (input: unknown) => unknown;
};

export type AsyncStreamable<Input> =
    | Input[]
    | AsyncIterableIterator<Input>
    | { promise: () => Promise<Input | null> };

export type Streamable<Input> = Input[] | IterableIterator<Input>;

export type MaybeAsyncFn<Input, Output> = (
    input: Input
) => Promise<Output> | Output;

export type ItemResult<T> =
    | {
          value: T;
          outcome: "success";
      }
    | {
          outcome: "filtered";
      }
    | { outcome: "errored" };

// TODO: Figure out how to make it work like this:
// Until we do so, people cannot create their own error handlers
// export type HandlerReturnType<Handler, Input, Data> =
//     Handler extends ErrorHandler<Input, infer Output> ? Output<Data> : never
export type HandlerReturnType<Handler, Input, Data> = Handler extends
    | Breaker<Input>
    | Ignorer
    ? Data
    : Handler extends Settler<Input>
      ? SettlerOutput<Data>
      : never;

// TODO: Figure out why this doesn't work
// This will break some types and make them be unknown/never
// export type NarrowHandlerType<Handler, Input, End> =
//    Handler extends ErrorHandler<Input, infer Output> ? ErrorHandler<End, Output> : never
export type NarrowHandlerType<Handler, Input, End> = Handler extends Ignorer
    ? Ignorer
    : Handler extends Breaker<Input>
      ? Breaker<End>
      : Handler extends Settler<Input>
        ? Settler<End>
        : never;

/**
 * The interface that an error handler must implement to be able to be used. It includes
 * three methods:
 * 1. registerCycleError: Used to register an error that has occurred while iterating through the generator
 * 2. registerOpError: Used to register an error if it occurs while performing on operation
 * 3. compile: After iterating through the array and performing operations, return the data in a different form.
 *
 * NOTE: Because I was having difficulties with TypeScript types, you might not get the correct types if you
 * want to implement your own error handlers, c.f. [Issue #27](https://github.com/benyakirten/array-stream-plus/issues/27).
 */
export interface ErrorHandler<Input, Output> {
    /**
     * Used to register an error that has occurred while iterating through the generator, i.e.
     * ```ts
     * function* gen() {
     *    yield 1;
     *    throw new Error("test error");
     * }
     * ```
     */
    registerCycleError(error: unknown, index: number): void;

    /**
     * Used to register an error if it occurs while performing on operation
     * an item yielded by the generator, i.e.
     * ```ts
     * function* gen() {
     *   yield 1;
     *   throw new Error("test error");
     * }
     * ```
     */
    registerOpError(
        error: unknown,
        index: number,
        item: Input,
        op: string
    ): void;

    /**
     * When compiling the final data, the handler might affect the final shape
     * of the data.
     */
    compile<Data>(data: Data): Output;
}

export type RequiredHandler<Handler> = Handler extends Ignorer
    ? Ignorer
    : Handler extends Breaker<infer Input | null>
      ? Breaker<Input>
      : Handler extends Settler<infer Input | null>
        ? Settler<Input>
        : never;

export type Constructor<T> = { new: () => T };
