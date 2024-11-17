import { Breaker } from "../errors/handlers";
import type {
    AsyncStreamable,
    AsyncOp,
    ItemResult,
    MaybeAsyncFn,
    ErrorHandler,
    NarrowHandlerType,
    HandlerReturnType,
    RequiredHandler,
} from "../types";

/**
 * A class that contains an asynchronous iterator and a set of operations to imitate Rust iterators.
 * Operations (map, filter, etc.) are not executed until the iterator is consumed. It can be used with
 * any async or syncronous iterable. It can also work with a function that returns a promise that resolves
 * to an item or null (to signal that the iterator is exhausted).
 *
 * An example of how this might be used with a fetch request with the promise generator.
 * ```ts
 * let pageToken: string | null = null;
 * async function generatePromise(): Promise<Item[] | null> {
 *   const response = await fetch("my-external-api", { page_size: 50, page_token: pageToken }) as { ok: boolean, items: Item[], page_token: string };
 *   if (response.ok) {
 *      pageToken = response.page_token;
 *      return response.items;
 *   }
 *   return null;
 * }
 *
 * let items: Item[] = [];
 * const stream = new AsyncArrayStream({ promise: generatePromise });
 *
 * document.querySelector(".load-more").addEventListener("click", async () => {
 *    const next = await stream.read().next();
 *    if (!next.done && next.value) {
 *       items = items.concat(next.value);
 *       renderList(items)
 *    }
 * })
 * ```
 */
export class AsyncArrayStream<
    Input,
    Handler extends ErrorHandler<Input, unknown> = Breaker<Input>,
> {
    private input: AsyncIterableIterator<Input>;
    private ops: AsyncOp[] = [];

    /**
     * Input can be an array, an async iterable or a promise generator. If the promise generator returns
     * `null` when the function is called, the iterator will be considered exhausted.
     */
    constructor(
        input: AsyncStreamable<Input>,
        private readonly handler: Handler = new Breaker<Input>() as Handler
    ) {
        this.input = AsyncArrayStream.makeIterator(input);
    }

    /**
     * Helper function for standardizing the API for the possible input types
     * into an AsyncIterableIterator<Stream>.
     */
    private static makeIterator<Stream>(
        input: AsyncStreamable<Stream>
    ): AsyncIterableIterator<Stream> {
        if ("promise" in input) {
            const promiseGenerator = input.promise;
            async function* gen() {
                while (true) {
                    const item = await promiseGenerator();
                    if (item === null || item === undefined) {
                        break;
                    }

                    yield item;
                }
            }
            return gen();
        } else if (Symbol.asyncIterator in input) {
            return input[Symbol.asyncIterator]();
        } else if (Symbol.iterator in input) {
            const inputClone = input[Symbol.iterator]();
            async function* gen() {
                for (const item of inputClone) {
                    yield item;
                }
            }
            return gen();
        } else if (Array.isArray(input)) {
            const inputClone = [...input];
            async function* gen() {
                for (const item of inputClone) {
                    yield item;
                }
            }
            return gen();
        } else {
            return input;
        }
    }

    /**
     * Add a map operation to the iterator that will be resolved when the iterator is finalized.
     * A map operation takes an item of type A and returns an item of type B (or Promise<B>).
     * A map function is different from forEach in that it should be pure and not have side effects, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([1, 2, 3, 4, 5])
     *   .map((item) => item * 2)
     *   .collect();
     * console.log(stream); // [2, 4, 6, 8, 10]
     * ```
     *
     * NOTE: Map functions change the type of the iterator, but if you call the function without
     * reassigning the variable or chaining methods, then the type will
     * be incorrect, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     * stream.map(item => String.fromCharCode(item + 65));
     * ```
     * then the type of stream will be `ArrayStream<number, Breaker<number>>` instead of
     * `ArrayStream<string, Breaker<string>>`. Instead, do one of these two:
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .map(item => String.fromCharCode(item + 65));
     * ```
     * or
     * ```ts
     * let stream = new ArrayStream([1, 2, 3, 4, 5]);
     * stream = stream.map(item => String.fromCharCode(item + 65));
     * ```
     */
    public map<End>(
        fn: MaybeAsyncFn<Input, End>
    ): AsyncArrayStream<End, NarrowHandlerType<Handler, Input, End>> {
        this.ops.push({
            type: "map",
            op: fn as AsyncOp["op"],
        });

        // @ts-expect-error: The handler is narrowed to the new type
        return this;
    }

    /**
     * Add a filter operation to the iterator that will be resolved when the iterator is finalized.
     * A filter operation should be pure and return a boolean (or Promise<boolean>) corresponding
     * to whether the item should be retained or filtered out, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([1, 2, 3, 4, 5])
     *   .filter((item) => item % 2 === 0)
     *   .collect();
     * console.log(stream); // [2, 4]
     * ```
     */
    public filter(
        fn: MaybeAsyncFn<Input, boolean>
    ): AsyncArrayStream<Input, Handler> {
        this.ops.push({
            type: "filter",
            op: fn as AsyncOp["op"],
        });

        return this;
    }

    /**
     * Add a forEach operation to the iterator that will be resolved when the iterator is finalized.
     * A forEach operation takes an iterator of type A and returns void or Promise<void>. A forEach
     * function should be impure and cause side effects.
     * ```ts
     * let sum = 0;
     * const sum2 = await new AsyncArrayStream([1, 2, 3, 4, 5])
     *   .forEach((item) => sum += item)
     *   .reduce((acc, next) => acc + next, 0);
     * console.log(sum === sum2); // true
     * ```
     */
    public forEach(
        fn: MaybeAsyncFn<Input, void | unknown>
    ): AsyncArrayStream<Input, Handler> {
        this.ops.push({
            type: "foreach",
            op: fn as AsyncOp["op"],
        });

        return this;
    }

    /**
     * Add a forEach operation to the operations, useful for signaling debugging. Defaults to logging the item, i.e.
     * ```ts
     * await new AsyncArrayStream([1, 2, 3, 4, 5])
     *   .inspect()
     *   .collect();
     * // 1-5 will be logged
     * ```
     */
    public inspect(
        fn: MaybeAsyncFn<Input, unknown> = (item) => console.log(item)
    ): AsyncArrayStream<Input, Handler> {
        this.ops.push({
            type: "foreach",
            op: fn as AsyncOp["op"],
        });
        return this;
    }

    /**
     * Add a filterMap operation to the iterator that will be resolved when the iterator is
     * finalized. A filterMap operation takes an item of type A and returns
     * `B | null | undefined | false` (or a `Promise` that resolves to any of these values).
     * Any type except B will cause the item to be filtered out. A filterMap functions is
     * typically pure, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([0, 1, 2, 3, 4])
     *   .filterMap((item) => item % 2 === 0 ? item ** 2 : null)
     *   .collect();
     * // stream = [0, 4, 16]
     * ```
     *
     * NOTE: Map functions change the type of the iterator, but if you call the function without
     * reassigning the variable or chaining methods, then the type will
     * be incorrect, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     * stream.map(item => String.fromCharCode(item + 65));
     * ```
     * then the type of stream will be `ArrayStream<number, Breaker<number>>` instead of
     * `ArrayStream<string, Breaker<string>>`. Instead, do one of these two:
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .map(item => String.fromCharCode(item + 65));
     * ```
     * or
     * ```ts
     * let stream = new ArrayStream([1, 2, 3, 4, 5]);
     * stream = stream.map(item => String.fromCharCode(item + 65));
     * ```
     */
    public filterMap<End>(
        fn: MaybeAsyncFn<Input, End | null | false | undefined>
    ): AsyncArrayStream<End, NarrowHandlerType<Handler, Input, End>> {
        this.ops.push({
            type: "filterMap",
            op: fn as AsyncOp["op"],
        });

        // @ts-expect-error: The handler is narrowed to the new type
        return this;
    }

    // Methods that return a new iterator

    /**
     * Return a new iterator that will only include the first n items from the iterator, i.e.
     * ```ts
     * async function* gen() {
     *   let count = 0;
     *   while (true) {
     *     yield count++;
     *   }
     * }
     * const stream = await new AsyncArrayStream(gen).take(5).collect();
     * // stream = [0, 1, 2, 3, 4]
     * ```
     */
    public take(n: number): AsyncArrayStream<Input, Handler> {
        const gen = this.read();
        async function* newGenerator() {
            for (let i = 0; i < n; i++) {
                const item = await gen.next();
                if (item.done) {
                    break;
                }
                yield item.value;
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return new AsyncArrayStream(newGenerator(), this.handler);
    }

    /**
     * Alias for `skip`, which will discard the first n items from the iterator, c.f.
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/drop
     */
    public drop = this.skip;

    /**
     * Return a new iterator that will discard the first n items from the iterator, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([0, 1, 2, 3, 4]).skip(2).collect();
     * // stream = [2, 3, 4]
     * ```
     */
    public skip(n: number): AsyncArrayStream<Input, Handler> {
        const gen = this.read();
        async function* newGenerator() {
            for (let i = 0; i < n; i++) {
                const item = await gen.next();
                if (item.done) {
                    return;
                }
            }

            yield* gen;
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return new AsyncArrayStream(newGenerator(), this.handler);
    }

    /**
     * Return a new iterator that will only include items whose index is divisible by n, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([0, 1, 2, 3, 4]).stepBy(2).collect();
     * // stream = [0, 2, 4]
     * ```
     */
    public stepBy(n: number): AsyncArrayStream<Input, Handler> {
        const gen = this.read();
        async function* stepByGenerator() {
            let iter = 0;
            for await (const item of gen) {
                if (iter % n === 0) {
                    yield item;
                }
                iter++;
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return new AsyncArrayStream(stepByGenerator(), this.handler);
    }

    /**
     * Return a new iterator that appends the parameter stream to the current stream, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([0, 1, 2, 3, 4]).chain([5, 6, 7, 8, 9]).collect();
     * // stream = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
     * ```
     */
    public chain<Stream>(
        stream: AsyncStreamable<Stream>
    ): AsyncArrayStream<
        Input | Stream,
        NarrowHandlerType<Handler, Input, Input | Stream>
    > {
        const gen = this.read();
        const streamGen = AsyncArrayStream.makeIterator(stream);

        async function* chainGenerator() {
            yield* gen;
            yield* streamGen;
        }

        // @ts-expect-error: The handler is narrowed to the new
        return new AsyncArrayStream(chainGenerator(), this.handler);
    }

    /**
     * Return a new iterator that will include an item between every value returned
     * by the iterator. The item can be a value or a function that, given the latest
     * iterated value, returns a value of type Value> (or a Promise<Value>), i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([0, 1, 2, 3, 4]).intersperse(5).collect();
     * // stream = [0, 5, 1, 5, 2, 5, 3, 5, 4]
     * ```
     * or
     * ```ts
     * const stream = await new AsyncArrayStream([0, 1, 2, 3, 4])
     *   .intersperse((item) => item + 100)
     *   .collect();
     * // stream = [0, 100, 1, 101, 2, 102, 3, 103, 4]
     */
    public intersperse<Item>(
        fnOrItem: Item | ((item: Input) => Promise<Item> | Item)
    ): AsyncArrayStream<
        Input | Item,
        NarrowHandlerType<Handler, Input, Input | Item>
    > {
        const iter = this.input;

        async function* intersperseGenerator() {
            let item: IteratorResult<Input> | null = null;
            while (true) {
                const current = item || (await iter.next());
                if (current.done) {
                    break;
                }

                yield current.value;

                item = await iter.next();
                if (item.done) {
                    break;
                }

                const intersperseItem =
                    typeof fnOrItem === "function"
                        ? await (fnOrItem as MaybeAsyncFn<Input, Item>)(
                              current.value
                          )
                        : fnOrItem;
                yield intersperseItem;
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return new AsyncArrayStream(intersperseGenerator(), this.handler);
    }

    /**
     * Return a new iterator that will yield the cartesian product of the current iterator
     * and the new one. The new iterator yields a tuple of an item from both data sources.
     * It will be exhausted as soon as either data source is exhausted, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([0, 1, 2, 3]).zip([5, 6, 7, 8, 9]).collect();
     * // stream = [[0, 5], [1, 6], [2, 7], [3, 8]]
     * // NOTE: [4, 9] is not included since the first iterator is exhausted first.
     * ```
     */
    public zip<Stream>(
        stream: AsyncStreamable<Stream>
    ): AsyncArrayStream<
        [Input, Stream],
        NarrowHandlerType<Handler, Input, [Input, Stream]>
    > {
        const iter = this.read();
        const streamIter = AsyncArrayStream.makeIterator(stream);

        async function* zipGenerator() {
            for await (const item of iter) {
                const streamItem = await streamIter.next();
                if (streamItem.done) {
                    break;
                }

                yield [item, streamItem.value] as [Input, Stream];
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return new AsyncArrayStream(zipGenerator(), this.handler);
    }

    /**
     * Returns an iterator that will yield a tuple with the index and the item
     * from the iterator, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300)
     *   .enumerate()
     *   .collect();
     * // stream = [[0, 100], [1, 200], [2, 300]]
     * ```
     */
    public enumerate(): AsyncArrayStream<
        [number, Input],
        NarrowHandlerType<Handler, Input, [number, Input]>
    > {
        const iter = this.read();
        async function* enumerateGenerator() {
            let count = 0;
            for await (const item of iter) {
                yield [count, item] as [number, Input];
                count++;
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return new AsyncArrayStream(enumerateGenerator(), this.handler);
    }

    /**
     * Returns an iterator where every item is mapped to an array of items,
     * each of which is yielded individually, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300)
     *   .flatMap((item) => [item, item + 1]).collect();
     * // stream = [100, 101, 200, 201, 300, 301]
     * ```
     */
    public flatMap<End>(
        fn: MaybeAsyncFn<Input, End[]>
    ): AsyncArrayStream<End, NarrowHandlerType<Handler, Input, End>> {
        const iter = this.read();
        async function* flatMapGenerator() {
            for await (const item of iter) {
                const result = await fn(item);
                for (const r of result) {
                    yield r;
                }
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return new AsyncArrayStream(flatMapGenerator(), this.handler);
    }

    /**
     * Returns an iterator that will exhaust as soon as the iterator yields a null or
     * undefined value, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300, null, 400]).fuse().collect();
     * // stream = [100, 200, 300]
     * ```
     */
    public fuse(): AsyncArrayStream<Required<Input>, RequiredHandler<Handler>> {
        const gen = this.read();
        async function* fuseGenerator() {
            for await (const item of gen) {
                if (item === undefined || item === null) {
                    break;
                }

                yield item;
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return new AsyncArrayStream(fuseGenerator(), this.handler);
    }

    /**
     * Removes duplicate items from the stream based on a provided callback function.
     * If no callback is provided, a shallow comparison is used, e.g..
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5, 1, 2, 3, 4, 5])
     *   .dedupe()
     *   .collect();
     * console.log(stream); // [1, 2, 3, 4, 5]
     * ```
     */
    public dedupe<T>(
        // @ts-expect-error: The default CB means that the type of T is Input
        cb: (item: Input) => Promise<T> | T = (item) => item
    ): AsyncArrayStream<Input, Handler> {
        const iter = this.read();
        async function* dedupeGenerator() {
            const seen = new Set<T>();
            for await (const item of iter) {
                const key = await cb(item);
                if (!seen.has(key)) {
                    seen.add(key);
                    yield item;
                }
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return new AsyncArrayStream(dedupeGenerator(), this.handler);
    }

    // Methods that collect the iterator
    /**
     * Consume the iterator and return however many items it contains, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300).count();
     * // stream = 3
     * ```
     */
    public async count(): Promise<
        HandlerReturnType<typeof this.handler, Input, number>
    > {
        const arr = await this.toUncompiledArray();
        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(arr.length);
    }

    /**
     * Consume the iterator and return the item at the nth index (or null if it doesn't exist), i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300).nth(1);
     * // stream = 200
     * ```
     */
    public async nth(
        n: number
    ): Promise<HandlerReturnType<typeof this.handler, Input, Input | null>> {
        let index = 0;
        for await (const item of this.read()) {
            if (index == n) {
                // @ts-expect-error: The handler is narrowed to the new type
                return this.handler.compile(item);
            }

            index++;
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(null);
    }

    /**
     * Consume the iterator and collect all items into the chosen data structure starting from the first item, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300)
     *   .reduce((acc, next) => acc + next, 0);
     * console.log(stream) // 600
     * ```
     */
    public async reduce<End>(
        op: (acc: End, next: Input) => End | Promise<End>,
        initialValue: End
    ): Promise<HandlerReturnType<typeof this.handler, Input, End>> {
        let result = initialValue;
        let index = 0;
        for await (const item of this.read()) {
            try {
                result = await op(result, item as unknown as Input);
            } catch (e) {
                this.handler.registerOpError(e, index, item, "reduce");
            }
            index++;
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(result);
    }

    /**
     * Consume the iterator and collect all items into the chosen data structure starting from the last item, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream(["a", "b", "c"])
     *   .reduceRight((acc, next) => acc + next, "");
     * console.log(stream) // "cba"
     * ```
     */
    public async reduceRight<End>(
        op: (acc: End, next: Input) => End | Promise<End>,
        initialValue: End
    ): Promise<HandlerReturnType<typeof this.handler, Input, End>> {
        const intermediate = await this.toUncompiledArray();

        let result = initialValue;
        for (let i = intermediate.length - 1; i >= 0; i--) {
            const item = intermediate[i];
            if (item === undefined) {
                continue;
            }
            try {
                result = await op(result, item as unknown as Input);
            } catch (e) {
                this.handler.registerOpError(e, i, item, "reduceRight");
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(result);
    }

    /**
     * Consume the iterator and collect all items into an array flattened to the specified depth, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([[1, 2], [3, [4, 5]], [5, [6, [7, 8]]]]).flat(2);
     * // stream = [1, 2, 3, 4, 5, 5, 6, [7, 8]]
     * ```
     */
    public async flat<D extends number = 1>(
        d?: D
    ): Promise<
        HandlerReturnType<typeof this.handler, Input, FlatArray<Input, D>[]>
    > {
        const result = await this.toUncompiledArray();
        const flattened = result.flat(d);
        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(flattened);
    }

    public some = this.any;

    /**
     * Consume the iterator and return a boolean if any item causes the function to return true.
     * It is short circuiting and will return after any item returns true, i.e.
     * ```ts
     * const hasEven = await new AsyncArrayStream([1, 2, 3, 4, 5])
     *   .any((item) => item % 2 === 0);
     * console.log(hasEven) // true
     * ```
     * or
     * ```ts
     * const hasEven = await new AsyncArrayStream([1, 3, 5])
     *   .any((item) => item % 2 === 0);
     * console.log(hasEven) // false
     * ```
     */
    public async any(
        fn: MaybeAsyncFn<Input, boolean>
    ): Promise<HandlerReturnType<typeof this.handler, Input, boolean>> {
        for await (const item of this.read()) {
            if (await fn(item)) {
                // @ts-expect-error: The handler is narrowed to the new type
                return this.handler.compile(true);
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(false);
    }

    /**
     * Alias for all, which will consume the iterator and return whether the predicate matches all items, c.f.
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/every
     */
    public every = this.all;

    /**
     * Consume the iterator and return a boolean if all the items cause the function to return true.
     * It is short circuiting and will return after any item returns false, i.e.
     * ```ts
     * const allEven = await new AsyncArrayStream([2, 4, 6, 8, 10])
     *   .all((item) => item % 2 === 0);
     * console.log(allEven) // true
     * ```
     * or
     * ```ts
     * const allEven = await new AsyncArrayStream([2, 4, 6, 8, 9])
     *   .all((item) => item % 2 === 0);
     * console.log(allEven) // false
     * ```
     */
    public async all(
        fn: MaybeAsyncFn<Input, boolean>
    ): Promise<HandlerReturnType<typeof this.handler, Input, boolean>> {
        for await (const item of this.read()) {
            if (!(await fn(item))) {
                // @ts-expect-error: The handler is narrowed to the new type
                return this.handler.compile(false);
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(true);
    }

    /**
     * Consume the iterator and return the first item that causes the function to return true.
     * If the item is not found, it will return `null`. This method can be used on an infinite
     * generator but will never return if the item is never found. The function short circuits
     * on the first item that returns true and will not consume the rest of the iterator, i.e.
     * ```ts
     * const item = await new AsyncArrayStream([1, 2, 3, 4, 5])
     *   .find((item) => item % 2 === 0);
     * console.log(item); // 2
     * ```
     * or
     * ```ts
     * const item = await new AsyncArrayStream([1, 3, 5, 7, 9])
     *   .find((item) => item % 2 === 0);
     * console.log(item); // null
     * ```
     */
    public async find(
        fn: MaybeAsyncFn<Input, boolean>
    ): Promise<HandlerReturnType<typeof this.handler, Input, Input | null>> {
        for await (const item of this.read()) {
            if (await fn(item)) {
                // @ts-expect-error: The handler is narrowed to the new type
                return this.handler.compile(item);
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(null);
    }

    /**
     * Consume the iterator and return the index of first item that causes the function to
     * return true. If the item is not found, it will return `-1`. This method can be used
     * on an infinite generator but will never return if the item is never found.
     * The function short circuits on the first item that returns true and will not consume
     * the rest of the iterator, i.e.
     * ```ts
     * const position = await new AsyncArrayStream([1, 2, 3, 4, 5])
     *   .findIndex((item) => item % 2 === 0);
     * console.log(position); // 1
     * ```
     * or
     * ```ts
     * const position = await new AsyncArrayStream([1, 3, 5, 7, 9])
     *   .findIndex((item) => item % 2 === 0);
     * console.log(position); // -1
     * ```
     */
    public async findIndex(
        fn: MaybeAsyncFn<Input, boolean>
    ): Promise<HandlerReturnType<typeof this.handler, Input, number>> {
        let count = 0;
        for await (const item of this.read()) {
            if (await fn(item)) {
                // @ts-expect-error: The handler is narrowed to the new type
                return this.handler.compile(count);
            }

            count++;
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(-1);
    }

    /**
     * Consume the iterator and return the first item that causes the function to
     * return true starting from the last item in the iteraotr. If the item is not
     * found, it will return `null`. This method cannot be used on an infinite
     * generator because it needs to consume the entire iterator to start from the end.
     * The function does not short circuit and will consume the entire iterator, i.e.
     * ```ts
     * const null = await new AsyncArrayStream([1, 2, 3, 4, 5])
     *   .findLast((item) => item % 2 === 0);
     * console.log(null); // 4
     * ```
     * or
     * ```ts
     * const item = await new AsyncArrayStream([1, 3, 5, 7, 9])
     *   .findLast((item) => item % 2 === 0);
     * console.log(item); // null
     * ```
     */
    public async findLast(
        fn: MaybeAsyncFn<Input, boolean>
    ): Promise<HandlerReturnType<typeof this.handler, Input, Input | null>> {
        const items = await this.toUncompiledArray();
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (item === undefined) {
                continue;
            }
            if (await fn(item)) {
                // @ts-expect-error: The handler is narrowed to the new type
                return this.handler.compile(item);
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(null);
    }

    /**
     * Consume the iterator and return the index of the first item that causes the function to
     * return true starting from the last item in the iteraotr. If the item is not
     * found, it will return `null`. This method cannot be used on an infinite
     * generator because it needs to consume the entire iterator to start from the end.
     * The function does not short circuit and will consume the entire iterator, i.e.
     * ```ts
     * const position = await new AsyncArrayStream([1, 2, 3, 4, 5])
     *   .findLastIndex((item) => item % 2 === 0);
     * console.log(position); // 4
     * ```
     * or
     * ```ts
     * const position = await new AsyncArrayStream([1, 3, 5, 7, 9])
     *   .findLastIndex((item) => item % 2 === 0);
     * console.log(position); // -1
     * ```
     */
    public async findLastIndex(
        fn: MaybeAsyncFn<Input, boolean>
    ): Promise<HandlerReturnType<typeof this.handler, Input, number>> {
        const items = await this.toUncompiledArray();
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (item === undefined) {
                continue;
            }
            if (await fn(item)) {
                // @ts-expect-error: The handler is narrowed to the new type
                return this.handler.compile(i);
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(-1);
    }

    /**
     * Consume the iterator and return if any item is equal to the input.
     * This is short circuiting and will return after any item is equal to the input.
     * NOTE: This will not work correctly for reference values, i.e.
     * ```ts
     * const hasTwo = await new AsyncArrayStream([1, 2, 3, 4, 5])
     *   .includes(2);
     * console.log(hasTwo); // true
     * ```
     * but this will not work:
     * ```ts
     * const obj = { a: 1 };
     * const hasObj = await new AsyncArrayStream([{ a: 1 }, { a: 2 }])
     *   .includes(obj);
     * console.log(hasObj); // false
     * ```
     */
    public async includes(
        item: Input
    ): Promise<HandlerReturnType<typeof this.handler, Input, boolean>> {
        for await (const i of this.read()) {
            if (i === item) {
                // @ts-expect-error: The handler is narrowed to the new type
                return this.handler.compile(true);
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(false);
    }

    /**
     * Consume the iterator and return a tuple of two arrays, the left being
     * those that caused the function to return `true`, and the right the others, i.e.
     * ```ts
     * const [left, right] = await new AsyncArrayStream([1, 2, 3, 4, 5])
     *   .partition((item) => item % 2 === 0);
     * console.log(left); // [2, 4]
     * console.log(right); // [1, 3, 5]
     * ```
     */
    public async partition(
        fn: MaybeAsyncFn<Input, boolean>
    ): Promise<
        HandlerReturnType<typeof this.handler, Input, [Input[], Input[]]>
    > {
        const left: Input[] = [];
        const right: Input[] = [];

        for await (const item of this.read()) {
            if (await fn(item)) {
                left.push(item);
            } else {
                right.push(item);
            }
        }

        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile([left, right]);
    }

    /**
     * Alias for collect, which will consume the iterator and return the items as an array, c.f.
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/toArray
     */
    public toArray = this.collect;

    /**
     * Consume the iterator and return the items in an array. It is
     * identical in functionality to a reduce method with an array that pushes the items, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([1, 2, 3, 4, 5]).collect();
     * // stream = [1, 2, 3, 4, 5]
     *
     * const stream2 = await new AsyncArrayStream([1,2,3,4,5]).reduce((acc, next) => {
     *   acc.push(next);
     *   return acc;
     * }, []);
     * // stream2 = [1, 2, 3, 4, 5]
     * ```
     */
    public async collect(): Promise<
        HandlerReturnType<typeof this.handler, Input, Input[]>
    > {
        const result = await this.toUncompiledArray();
        // @ts-expect-error: The handler is narrowed to the new type
        return this.handler.compile(result);
    }

    private async toUncompiledArray(): Promise<Input[]> {
        const result: Input[] = [];
        for await (const item of this.read()) {
            result.push(item);
        }

        return result;
    }

    /**
     * Use this method to manually consume the iterator.
     */
    public async *read(): AsyncIterableIterator<Input> {
        let index = 0;
        let item: ItemResult<Input>;
        while (true) {
            try {
                const next = await this.input.next();
                if (next.done) {
                    break;
                }

                item = await this.applyTransformations(next.value, index);
                if (item.outcome !== "success") {
                    index++;
                    continue;
                }

                yield item.value;
            } catch (e) {
                this.handler.registerCycleError(e, index);
            }

            index++;
        }
    }

    /**
     * Helper method to apply all op functions to an item.
     */
    private async applyTransformations(
        item: Input,
        index: number
    ): Promise<ItemResult<Input>> {
        let result;
        for (const op of this.ops) {
            try {
                switch (op.type) {
                    case "filter":
                        if ((await op.op(item)) === false) {
                            return { outcome: "filtered" };
                        }
                        break;
                    case "map":
                        item = (await op.op(item)) as Input;
                        break;
                    case "foreach":
                        await op.op(item);
                        break;
                    case "filterMap":
                        result = await op.op(item);
                        if (
                            result === null ||
                            result === false ||
                            result === undefined
                        ) {
                            return { outcome: "filtered" };
                        }
                        item = result as Input;
                        break;
                    default:
                        break;
                }
            } catch (e) {
                this.handler.registerOpError(e, index, item, op.type);
                return { outcome: "errored" };
            }
        }

        return { value: item, outcome: "success" };
    }
}
