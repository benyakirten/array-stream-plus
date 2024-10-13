import type {
    AsyncStreamable,
    AsyncOp,
    ItemResult,
    MaybeAsyncFn,
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
export class AsyncArrayStream<Input> {
    private input: AsyncIterableIterator<Input>;
    private ops: AsyncOp[] = [];

    /**
     * Input can be an array, an async iterable or a promise generator. If the promise generator returns
     * `null` when the function si called, the iterator will be considered exhausted.
     */
    constructor(input: AsyncStreamable<Input>) {
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
        } else if (Array.isArray(input)) {
            const inputClone = structuredClone(input);
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
     * A map function is different from forEach in that it should be pure and not have side effects.
     */
    public map<End>(fn: MaybeAsyncFn<Input, End>): AsyncArrayStream<End> {
        this.ops.push({
            type: "map",
            op: fn as AsyncOp["op"],
        });
        return this as unknown as AsyncArrayStream<End>;
    }

    /**
     * Add a filter operation to the iterator that will be resolved when the iterator is finalized.
     * A filter operation should be pure and return a boolean (or Promise<boolean>) if the .
     */
    public filter(fn: MaybeAsyncFn<Input, boolean>): AsyncArrayStream<Input> {
        this.ops.push({
            type: "filter",
            op: fn as AsyncOp["op"],
        });
        return this;
    }

    /**
     * Add a forEach operation to the iterator that will be resolved when the iterator is finalized.
     * A forEach operation takes an iterator of type A and returns void or Promise<void>. A forEach function should
     * be impure and cause side effects.
     */
    public forEach(
        fn: MaybeAsyncFn<Input, void | unknown>
    ): AsyncArrayStream<Input> {
        this.ops.push({
            type: "foreach",
            op: fn as AsyncOp["op"],
        });
        return this;
    }

    /**
     * Add a forEach operation to the operations, useful for signaling debugging. Defaults to logging the item.
     */
    public inspect(
        fn: MaybeAsyncFn<Input, unknown> = (item) => console.log(item)
    ): AsyncArrayStream<Input> {
        this.ops.push({
            type: "foreach",
            op: fn as AsyncOp["op"],
        });
        return this;
    }

    /**
     * Add a filterMap operation to the iterator that will be resolved when the iterator is finalized.
     * A filterMap operation takes an item of type A and returns B | null | undefined | false
     * (or a Promise that resolves to any of these values). Any type except B will cause the item
     * to be filtered out. A filterMap functions is typically pure.
     */
    public filterMap<End>(
        fn: MaybeAsyncFn<Input, End | null | false | undefined>
    ): AsyncArrayStream<End> {
        this.ops.push({
            type: "filterMap",
            op: fn as AsyncOp["op"],
        });
        return this as unknown as AsyncArrayStream<End>;
    }

    // Methods that return a new iterator

    /**
     * Return a new iterator that will only include the first n items from the iterator, i.e.
     * ```ts
     * async function* gen() {
     *   let count = 0;
     *   while (true) {
     *    yield count++;
     *   }
     * }
     * const stream = await new AsyncArrayStream(gen).take(5).collect();
     * // stream = [0, 1, 2, 3, 4]
     * ```
     */
    public take(n: number): AsyncArrayStream<Input> {
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

        return new AsyncArrayStream(newGenerator());
    }

    /**
     * Return a new iterator that will discard the first n items from the iterator, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([0, 1, 2, 3, 4]).skip(2).collect();
     * // stream = [2, 3, 4]
     * ```
     */
    public skip(n: number): AsyncArrayStream<Input> {
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

        return new AsyncArrayStream(newGenerator());
    }

    /**
     * Return a new iterator that will only include items whose index is divisible by n, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([0, 1, 2, 3, 4]).stepBy(2).collect();
     * // stream = [0, 2, 4]
     * ```
     */
    public stepBy(n: number): AsyncArrayStream<Input> {
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

        return new AsyncArrayStream(stepByGenerator());
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
    ): AsyncArrayStream<Input | Stream> {
        const gen = this.read();
        const streamGen = AsyncArrayStream.makeIterator(stream);

        async function* chainGenerator() {
            yield* gen;
            yield* streamGen;
        }

        return new AsyncArrayStream(chainGenerator());
    }

    /**
     * Return a new iterator that will include an item between every value returned by the iterator.
     * The item can be a value or a function that returns the value (or a Promise<Value>), i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([0, 1, 2, 3, 4]).intersperse(5).collect();
     * // stream = [0, 5, 1, 5, 2, 5, 3, 5, 4]
     * ```
     */
    public intersperse<Item>(
        fnOrItem: Item | ((item: Input) => Promise<Item> | Item)
    ): AsyncArrayStream<Input | Item> {
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
        return new AsyncArrayStream(intersperseGenerator());
    }

    /**
     * Return a new iterator that will yield the cartesian product of the current iterator and the new one.
     * The new iterator yields a tuple of an item from both data sources. It will be exhausted as soon
     * as either data source is exhausted, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([0, 1, 2, 3]).zip([5, 6, 7, 8, 9]).collect();
     * // stream = [[0, 5], [1, 6], [2, 7], [3, 8]]
     * // NOTE: [4, 9] is not included since the first iterator is exhausted first.
     * ```
     */
    public zip<Stream>(
        stream: AsyncStreamable<Stream>
    ): AsyncArrayStream<[Input, Stream]> {
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

        return new AsyncArrayStream(zipGenerator());
    }

    /**
     * Returns an iterator that will yield a tuple with the index and the item from the iterator, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300).enumerate().collect();
     * // stream = [[0, 100], [1, 200], [2, 300]]
     * ```
     */
    public enumerate(): AsyncArrayStream<[number, Input]> {
        const iter = this.read();
        async function* enumerateGenerator() {
            let count = 0;
            for await (const item of iter) {
                yield [count, item] as [number, Input];
                count++;
            }
        }

        return new AsyncArrayStream(enumerateGenerator());
    }

    /**
     * Returns an iterator where every item is mapped to an array of items, each of which is yielded individually, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300).flatMap((item) => [item, item + 1]).collect();
     * // stream = [100, 101, 200, 201, 300, 301]
     * ```
     */
    public flatMap<End>(fn: MaybeAsyncFn<Input, End[]>): AsyncArrayStream<End> {
        const iter = this.read();
        async function* flatMapGenerator() {
            for await (const item of iter) {
                const result = await fn(item);
                for (const r of result) {
                    yield r;
                }
            }
        }

        return new AsyncArrayStream(flatMapGenerator());
    }

    /**
     * Returns an iterator that will exhaust as soon as the iterator yields a null or undefined value, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300, null, 400]).fuse().collect();
     * // stream = [100, 200, 300]
     * ```
     */
    public fuse(): AsyncArrayStream<Input> {
        const gen = this.read();
        async function* fuseGenerator() {
            for await (const item of gen) {
                if (item === undefined || item === null) {
                    break;
                }

                yield item;
            }
        }

        return new AsyncArrayStream(fuseGenerator());
    }

    // Methods that collect the iterator
    /**
     * Consume the iterator and return however many items it contains, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300).count();
     * // stream = 3
     * ```
     */
    public async count(): Promise<number> {
        let count = 0;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _item of this.input) {
            count++;
        }

        return count;
    }

    /**
     * Consume the iterator and return the item at the nth index (or null if it doesn't exist), i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300).nth(1);
     * // stream = 200
     * ```
     */
    public async nth(n: number): Promise<Input | null> {
        let count = 0;
        for await (const item of this.read()) {
            if (count == n) {
                return item;
            }

            count++;
        }

        return null;
    }

    /**
     * Consume the iterator and collect all items into the chosen data structure starting from the first item, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([100, 200, 300).reduce((acc, next) => acc + next, 0);
     * // stream = 600
     * ```
     */
    public async reduce<End>(
        op: (acc: End, next: Input) => End | Promise<End>,
        initialValue: End
    ): Promise<End> {
        let result = initialValue;
        for await (const item of this.read()) {
            result = await op(result, item as unknown as Input);
        }
        return result;
    }

    /**
     * Consume the iterator and collect all items into the chosen data structure starting from the last item, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream(["a", "b", "c"]).reduceRight((acc, next) => acc + next, "");
     * // stream = "cba"
     * ```
     */
    public async reduceRight<End>(
        op: (acc: End, next: Input) => End | Promise<End>,
        initialValue: End
    ): Promise<End> {
        const intermediate = await this.collect();

        let result = initialValue;
        for (let i = intermediate.length - 1; i >= 0; i--) {
            const item = intermediate[i];
            result = await op(result, item as unknown as Input);
        }
        return result;
    }

    /**
     * Consume the iterator and collect all items into an array flattened to the specified depth, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([[1, 2], [3, [4, 5]], [5, [6, [7, 8]]]]).flat(2);
     * // stream = [1, 2, 3, 4, 5, 5, 6, [7, 8]]
     * ```
     */
    public async flat<End, D extends number = 1>(
        d?: D
    ): Promise<FlatArray<End, D>[]> {
        const result = await this.collect();
        return result.flat(d) as FlatArray<End, D>[];
    }

    /**
     * Consume the iterator and return a boolean if any item causes the function to return true.
     * It is short circuiting and will return after any item returns true, i.e.
     * ```ts
     * const hasEven = await new AsyncArrayStream([1, 2, 3, 4, 5]).any((item) => item % 2 === 0);
     * console.log(hasEven) // true
     * ```
     */
    public async any(fn: MaybeAsyncFn<Input, boolean>): Promise<boolean> {
        for await (const item of this.read()) {
            if (await fn(item)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Consume the iterator and return a boolean if all the items cause the function to return true.
     * It is short circuiting and will return after any item returns false.
     */
    public async all(fn: MaybeAsyncFn<Input, boolean>): Promise<boolean> {
        for await (const item of this.read()) {
            if (!(await fn(item))) {
                return false;
            }
        }

        return true;
    }

    /**
     * Consume the iterator and return the first item that causes the function to return true.
     * It is short circuiting and will return after any item returns true.
     */
    public async find(fn: MaybeAsyncFn<Input, boolean>): Promise<Input | null> {
        for await (const item of this.read()) {
            if (await fn(item)) {
                return item;
            }
        }

        return null;
    }

    /**
     * Consume the iterator and return the index of the first item in the array that causes the function to return true.
     * It is short circuiting and will return after any item returns true.
     */
    public async findIndex(fn: MaybeAsyncFn<Input, boolean>): Promise<number> {
        let count = 0;
        for await (const item of this.read()) {
            if (await fn(item)) {
                return count;
            }

            count++;
        }

        return -1;
    }

    /**
     * Consume the iterator and return the first item from the end of the array that causes the function to return true.
     * It is short circuiting and will return after any item returns true.
     */
    public async findLast(
        fn: MaybeAsyncFn<Input, boolean>
    ): Promise<Input | null> {
        const items = await this.collect();
        for (let i = items.length - 1; i >= 0; i--) {
            if (await fn(items[i])) {
                return items[i];
            }
        }

        return null;
    }

    /*
     * Consume the iterator and return the index of the first item from the end of the array that causes the function to return true.
     * It is short circuiting and will return after any item returns true.
     */
    public async findLastIndex(
        fn: MaybeAsyncFn<Input, boolean>
    ): Promise<number> {
        const items = await this.collect();
        for (let i = items.length - 1; i >= 0; i--) {
            if (await fn(items[i])) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Consume the iterator and return if any item is equal to the input.
     * This is short circuiting and will return after any item is equal to the input.
     * NOTE: This will not work correctly for reference values.
     */
    public async includes(item: Input): Promise<boolean> {
        for await (const i of this.read()) {
            if (i === item) {
                return true;
            }
        }
        return false;
    }

    /**
     * Consume the iterator and return a tuple of two arrays.
     * The first array will contain all items that cause the function to return true.
     * The second array will contain all items that cause the function to return false, i.e.
     * ```ts
     * const stream = await new AsyncArrayStream([1, 2, 3, 4, 5]).partition((item) => item % 2 === 0);
     * // stream = [[2, 4], [1, 3, 5]]
     * ```
     */
    public async partition(
        fn: MaybeAsyncFn<Input, boolean>
    ): Promise<[Input[], Input[]]> {
        const left: Input[] = [];
        const right: Input[] = [];

        for await (const item of this.read()) {
            if (await fn(item)) {
                left.push(item);
            } else {
                right.push(item);
            }
        }

        return [left, right];
    }

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
     */
    public async collect(): Promise<Input[]> {
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
        for await (const input of this.input) {
            const item = await this.applyTransformations(input);
            if (item.filtered) {
                continue;
            }

            yield item.value;
        }
    }

    /**
     * Helper method to apply all op functions to an item.
     */
    private async applyTransformations(
        item: Input
    ): Promise<ItemResult<Input>> {
        let result;
        for (const op of this.ops) {
            switch (op.type) {
                case "filter":
                    if ((await op.op(item)) === false) {
                        return { filtered: true };
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
                        return { filtered: true };
                    }
                    item = result as Input;
                    break;
                default:
                    break;
            }
        }

        return { value: item, filtered: false };
    }
}
