import type { AsyncStreamable, AsyncOp, AsyncFuncOp, AsyncFn } from "./types";

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
        if (Array.isArray(input)) {
            const inputClone = structuredClone(input);
            async function* gen() {
                for (const item of inputClone) {
                    yield item;
                }
            }
            return gen();
        }

        return input;
    }

    /**
     * Add a map operation to the iterator that will be resolved when the iterator is finalized.
     * A map operation takes an iterator of type A and returns an iterator of type B. A map function
     * is different from forEach in that it should be pure and not have side effects.
     */
    public map<End>(fn: AsyncFn<End>): AsyncArrayStream<End> {
        this.ops.push({
            type: "map",
            op: fn as AsyncFuncOp["op"],
        });
        return this as unknown as AsyncArrayStream<End>;
    }

    /**
     * Add a filter operation to the iterator that will be resolved when the iterator is finalized.
     * A filter operation takes an iterator of type A and returns an iterator of type A but removes
     * all items that do not return true from the filter function.
     */
    public filter(fn: AsyncFn<boolean>): AsyncArrayStream<Input> {
        this.ops.push({
            type: "filter",
            op: fn as AsyncFuncOp["op"],
        });
        return this;
    }

    /**
     * Add a forEach operation to the iterator that will be resolved when the iterator is finalized.
     * A forEach operation takes an iterator of type A and returns nothing. A forEach function should
     * be impure and cause side effects.
     */
    public forEach(fn: AsyncFn<void | unknown>): AsyncArrayStream<Input> {
        this.ops.push({
            type: "foreach",
            op: fn as AsyncFuncOp["op"],
        });
        return this;
    }

    /**
     * A forEach operation that is used for debugging purposes.
     */
    public inspect(fn: AsyncFn<void | unknown>): AsyncArrayStream<Input> {
        this.ops.push({
            type: "foreach",
            op: fn as AsyncFuncOp["op"],
        });
        return this;
    }

    /**
     * Add a filterMap operation to the iterator that will be resolved when the iterator is finalized.
     * A filterMap operation takes an iterator of type A and returns an iterator of type B but also removes
     * any items that return null, false, or undefined from the filterMap function.
     */
    public filterMap<End>(
        fn: (input: Input) => AsyncFn<End | null | false | undefined>
    ): AsyncArrayStream<End> {
        this.ops.push({
            type: "filterMap",
            op: fn as AsyncFuncOp["op"],
        });
        return this as unknown as AsyncArrayStream<End>;
    }

    /**
     * Take the first n items from the iterator that will be resolved when the iterator is finalized.
     */
    public take(limit: number): AsyncArrayStream<Input[]> {
        const gen = this.input;
        async function* newGenerator() {
            let count = 0;
            let collection: Input[] = [];
            for await (const item of gen) {
                if (count >= limit) {
                    yield collection;
                    collection = [];
                    count = 0;
                } else {
                    collection.push(item);
                    count++;
                }
            }

            yield collection;
        }

        return new AsyncArrayStream(newGenerator(), this.ops);
    }

    /**
     * Wrap the current iterator to return the first n items from the iterator.
     */
    public skip(n: number): AsyncArrayStream<Input> {
        const gen = this.input;
        async function* newGenerator() {
            let count = 0;

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const _item of gen) {
                if (count >= n) {
                    break;
                }
                count++;
            }

            yield* gen;
        }

        this.input = newGenerator();
        return this;
    }

    // Methods that return a new iterator

    /**
     * Return a new iterator that will only include items which are divisible by N.
     */
    public stepBy(n: number): AsyncArrayStream<Input> {
        const gen = this.input;
        async function* stepByGenerator() {
            let iter = 0;
            for await (const item of gen) {
                if (iter % n === 0) {
                    yield item;
                }
                iter++;
            }
        }

        return new AsyncArrayStream(stepByGenerator(), this.ops);
    }

    /**
     * Return a new iterator that appends the parameter stream to the current stream.
     */
    public chain<Stream>(
        stream: AsyncStreamable<Stream>
    ): AsyncArrayStream<Input | Stream> {
        const gen = this.input;
        const streamGen = AsyncArrayStream.makeIterator(stream);

        async function* chainGenerator() {
            while (true) {
                const item = await gen.next();
                if (item.done) {
                    break;
                }
                yield item.value;

                const streamItem = await streamGen.next();
                if (streamItem.done) {
                    break;
                }
            }
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
        const gen = this.input;

        async function* intersperseGenerator() {
            while (true) {
                const item = await gen.next();
                yield item.value;

                if (item.done) {
                    break;
                }

                const intersperseItem =
                    typeof fnOrItem === "function"
                        ? await (fnOrItem as () => Item)()
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
        const gen = this.input;
        const streamGen = AsyncArrayStream.makeIterator(stream);

        async function* zipGenerator() {
            while (true) {
                const nextItem = await gen.next();
                yield nextItem.value;
                if (nextItem.done) {
                    break;
                }

                const nextStreamItem = await streamGen.next();
                yield nextStreamItem.value;
                if (nextStreamItem.done) {
                    break;
                }
            }
        }

        return new AsyncArrayStream(zipGenerator(), []);
    }

    /**
     * Returns an iterator that will yield its items accompanied by an index.
     */
    public enumerate(): AsyncArrayStream<[number, Input]> {
        const gen = this.input;
        async function* enumerateGenerator() {
            let count = 0;
            for await (const item of gen) {
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
    public flatMap<End>(
        fn: (input: Input) => End[] | Promise<End[]>
    ): AsyncArrayStream<End> {
        const gen = this.input;
        async function* flatMapGenerator() {
            for await (const item of gen) {
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
        const gen = this.input;
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
        for await (const item of this.input) {
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
        op: (acc: End, next: Input) => End,
        initialValue: End
    ): End {
        let result = initialValue;
        for await (const item of this.input) {
            result = op(result, item as unknown as Input);
        }
        return result;
    }

    /**
     * Consume the iterator and collect all items into the chosen data structure starting from the last item.
     */
    public async reduceRight<End>(
        op: (acc: End, next: Input) => End,
        initialValue: End
    ): End {
        const intermediate = this.collect();

        let result = initialValue;
        for (let i = intermediate.length - 1; i >= 0; i--) {
            const item = intermediate[i];
            result = op(result, item as unknown as Input);
        }
        return result;
    }

    /**
     * Consume the iterator and collect all items into an array flattened to the specified depth.
     */
    public flat<End, D extends number = 1>(d?: D): FlatArray<End, D>[] {
        return this.collect().flat(d) as FlatArray<End, D>[];
    }

    /**
     * Consume the iterator and return a boolean if any item causes the function to return true.
     * It is short circuiting and will return as any item returns true;
     */
    public any(fn: (item: Input) => boolean): boolean {
        for (const item of this.collect()) {
            if (fn(item)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Consume the iterator and return a boolean if all the items cause the function to return true.
     * It is short circuiting and will return as any item returns false;
     */
    public all(fn: (item: Input) => boolean): boolean {
        for (const item of this.collect()) {
            if (!fn(item)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Consume the iterator and return the first item that causes the function to return true.
     */
    public find(fn: (item: Input) => boolean): Input | null {
        for (const item of this.collect()) {
            if (fn(item)) {
                return item;
            }
        }

        return null;
    }

    /**
     * Consume the iterator and return the index of the first item in the array that causes the function to return true.
     */
    public findIndex(fn: (item: Input) => boolean): number {
        const items = this.collect();
        for (let i = 0; i < items.length; i++) {
            if (fn(items[i])) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Consume the iterator and return the first item from the end of the array that causes the function to return true.
     */
    public findLast(fn: (item: Input) => boolean): Input | null {
        const items = this.collect();
        for (let i = items.length - 1; i >= 0; i--) {
            if (fn(items[i])) {
                return items[i];
            }
        }

        return null;
    }

    /*
     * Consume the iterator and return the index of the first item from the end of the array that causes the function to return true.
     */
    public findLastIndex(fn: (item: Input) => boolean): number {
        const items = this.collect();
        for (let i = items.length - 1; i >= 0; i--) {
            if (fn(items[i])) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Consume the iterator and return if any item is equal to the input.
     * NOTE: This will not work correctly for reference values.
     */
    public includes(item: Input): boolean {
        const items = this.collect();
        for (let i = 0; i < items.length; i++) {
            if (items[i] === item) {
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
    public partition(fn: (input: Input) => boolean): [Input[], Input[]] {
        const input = this.collect();
        const left: Input[] = [];
        const right: Input[] = [];

        for (const item of input) {
            if (fn(item)) {
                left.push(item);
            } else {
                right.push(item);
            }
        }

        return [left, right];
    }

    public async *read(): AsyncIterableIterator<Input> {
        item_loop: for await (const item of this.input) {
            let _item = item;
            for (const op of this.ops) {
                let result;
                switch (op.type) {
                    case "filter":
                        if (!(await op.op(item))) {
                            continue item_loop;
                        }
                        break;
                    case "map":
                        // @ts-expect-error: This is a valid operation
                        _item = await op.op(_item);
                        break;
                    case "foreach":
                        await op.op(_item);
                        break;
                    case "filterMap":
                        result = await op.op(_item);
                        if (
                            result === null ||
                            result === false ||
                            result === undefined
                        ) {
                            continue item_loop;
                        }
                        // @ts-expect-error: This is a valid operation
                        _item = result;
                        break;
                    default:
                        break;
                }
            }
            yield _item;
        }
    }
}
