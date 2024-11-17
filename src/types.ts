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
    | { [Symbol.asyncIterator]: () => AsyncIterableIterator<Input> }
    | Input[]
    | AsyncIterableIterator<Input>
    | { promise: () => Promise<Input | null> }
    | IterableIterator<Input>;

export type Streamable<Input> =
    | { [Symbol.iterator]: () => IterableIterator<Input> }
    | Input[]
    | IterableIterator<Input>;

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
        item: Input | undefined,
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

/**
 * Options to configure the stream, which are as follows:
 * 1. `useIteratorHelpersIfAvailable`, which allows iterator helpers
 * (https://github.com/tc39/proposal-iterator-helpers) if they
 * are available.
 */
export type SynchronousStreamOptions = {
    /**
     * If true, iterator helpers (i.e. `map`, `filter`, etc.) will be used if they are available.
     * A full list can be found at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/drop.
     * If false, the stream will use the default implementation, which will aggregate a list
     * of operations for `map`, `filter`, etc. and apply them when iteration has begun.
     * For operations such as `drop`, `take`, etc., the default implementation will return
     * a new instance of the array stream, while the iterator helpers will modify the current
     * iterator in place.
     *
     * Iterator helpers are more performant than the default implementation. However,
     * iterator helpers cause recursion which cannot be resolved until the iterator is exhausted.
     * This means that an array stream will reach a maximum recursion depth based on your browser,
     * depending on the number of operations. For most browsers, this in the range of tens of
     * thousands, but if you either have a low recursion depth ceiling or need to perform a large
     * amount of operations, you may want to disable this option.
     *
     * Another reason to not use iterator helpers is they limit the ability to determine errors.
     * With the default implementation, error handlers will be able to determine errors within
     * the operation and examine the item before transformation by a map/filter/etc. operation.
     * However, because iterator helpers do not have access to the base item before the operation,
     * the error handler will be limited.
     *
     * The full proposal is available [here](https://github.com/tc39/proposal-iterator-helpers),
     * which, as of writing this, has been been approved but has not yet been incorporated
     * in the ecmascript standard.
     *
     * Current support is widely available in Chrome, the latest in Firefox, Bun, Node and Deno, and
     * not in Safari. More details on browser support can be found at [caniuse](https://caniuse.com/?search=iterator.map).
     *
     * NOTE: This option only applies to synchronous streams. Asynchronous streams do not have any options to specify
     * as of now, though there is a [proposal](https://github.com/tc39/proposal-async-iterator-helpers) for it.
     */
    useIteratorHelpersIfAvailable: boolean;
};
