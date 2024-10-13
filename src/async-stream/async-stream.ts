import type {
    AsyncStreamable,
    AsyncOp,
    ItemResult,
    MaybeAsyncFn,
} from "../types";

export class AsyncArrayStream<Input> {
    private input: AsyncIterableIterator<Input>;
    constructor(
        input: AsyncStreamable<Input>,
        private ops: AsyncOp[] = []
    ) {
        this.input = AsyncArrayStream.makeIterator(input);
    }

    /**
     * Take an array or iterator and return an iterator.
     */
    private static makeIterator<Stream>(
        input: AsyncStreamable<Stream>
    ): AsyncIterableIterator<Stream> {
        if ("promise" in input) {
            const promiseGenerator = input.promise;
            async function* gen() {
                while (true) {
                    yield await promiseGenerator();
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
     * A map operation takes an iterator of type A and returns an iterator of type B. A map function
     * is different from forEach in that it should be pure and not have side effects.
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
     * A filter operation takes an iterator of type A and returns an iterator of type A but removes
     * all items that do not return true from the filter function.
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
     * A forEach operation takes an iterator of type A and returns nothing. A forEach function should
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
     * A filterMap operation takes an iterator of type A and returns an iterator of type B but also removes
     * any items that return null, false, or undefined from the filterMap function.
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

    /**
     * Take the first n items from the iterator that will be resolved when the iterator is finalized.
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

        return new AsyncArrayStream(newGenerator(), []);
    }

    /**
     * Wrap the current iterator to return the first n items from the iterator.
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

        return new AsyncArrayStream(newGenerator(), []);
    }

    // Methods that return a new iterator

    /**
     * Return a new iterator that will only include items which are divisible by N.
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

        return new AsyncArrayStream(stepByGenerator(), []);
    }

    /**
     * Return a new iterator that appends the parameter stream to the current stream.
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

        return new AsyncArrayStream(chainGenerator(), []);
    }

    /**
     * Return a new iterator that will include an item between every value returned by the iterator.
     * The item can be a value of a function that returns the value.
     */
    public intersperse<Item>(
        fnOrItem: Item | (() => Promise<Item> | Item)
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
                        ? await (fnOrItem as MaybeAsyncFn<void, Item>)()
                        : fnOrItem;
                yield intersperseItem;
            }
        }
        return new AsyncArrayStream(intersperseGenerator(), []);
    }

    /**
     * Return a new iterator that will yield the cartesian product of the current iterator and the new one.
     * If you don't know what that is, it yields a tuple of an item from both data sources. It will be exhausted as soon
     * as either data source is exhausted.
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

        return new AsyncArrayStream(zipGenerator(), []);
    }

    /**
     * Returns an iterator that will yield its items accompanied by an index.
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

        return new AsyncArrayStream(enumerateGenerator(), []);
    }

    // TODO: Find a more efficient way to implement this than to collect the iterator
    /**
     * Returns an iterator that will yield individual items created from the application of the function.
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

        return new AsyncArrayStream(flatMapGenerator(), []);
    }

    /**
     * Returns an iterator that will exhaust as soon as the iterator yields a null or undefined value.
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

        return new AsyncArrayStream(fuseGenerator(), []);
    }

    // Methods that collect the iterator
    /**
     * Consume the iterator and return however many items it contains.
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
     * Consume the iterator and return the item at the nth index (or null if it doesn't exist).
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
     * Consume the iterator and collect all items into the chosen data structure starting from the first item.
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
     * Consume the iterator and collect all items into the chosen data structure starting from the last item.
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
     * Consume the iterator and collect all items into an array flattened to the specified depth.
     */
    public async flat<End, D extends number = 1>(
        d?: D
    ): Promise<FlatArray<End, D>[]> {
        const result = await this.collect();
        return result.flat(d) as FlatArray<End, D>[];
    }

    /**
     * Consume the iterator and return a boolean if any item causes the function to return true.
     * It is short circuiting and will return as any item returns true;
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
     * It is short circuiting and will return as any item returns false;
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
     * The second array will contain all items that cause the function to return false.
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

    public async collect(): Promise<Input[]> {
        const result: Input[] = [];
        for await (const item of this.read()) {
            result.push(item);
        }

        return result;
    }

    public async *read(): AsyncIterableIterator<Input> {
        for await (const input of this.input) {
            const item = await this.applyTransformations(input);
            if (item.filtered) {
                continue;
            }

            yield item.value;
        }
    }

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
