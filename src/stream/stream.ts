import type { Streamable, Op, FuncOp } from "./types";

/**
 * A class for performing a series of operations on a synchronous and iterable source of data.
 * It aims to have a similar set of features as baseline Rust iterator and outperform the native
 * JavaScript array methods when chained together.
 */
export class ArrayStream<Input> {
    private input: IterableIterator<Input>;
    constructor(
        input: Streamable<Input>,
        private ops: Op[] = []
    ) {
        this.input = ArrayStream.makeIterator(input);
    }

    /**
     * Take an array or iterator and return an iterator.
     */
    private static makeIterator<Stream>(
        input: Streamable<Stream>
    ): IterableIterator<Stream> {
        if (Array.isArray(input)) {
            return input[Symbol.iterator]();
        }

        return input;
    }

    /**
     * Add a map operation to the iterator that will be resolved when the iterator is finalized.
     * A map operation takes an iterator of type A and returns an iterator of type B. A map function
     * is different from forEach in that it should be pure and not have side effects.
     */
    public map<End>(fn: (input: Input) => End): ArrayStream<End> {
        this.ops.push({
            type: "map",
            op: fn as FuncOp["op"],
        });
        return this as unknown as ArrayStream<End>;
    }

    /**
     * Add a filter operation to the iterator that will be resolved when the iterator is finalized.
     * A filter operation takes an iterator of type A and returns an iterator of type A but removes
     * all items that do not return true from the filter function.
     */
    public filter(fn: (input: Input) => boolean): ArrayStream<Input> {
        this.ops.push({
            type: "filter",
            op: fn as FuncOp["op"],
        });
        return this;
    }

    /**
     * Add a forEach operation to the iterator that will be resolved when the iterator is finalized.
     * A forEach operation takes an iterator of type A and returns nothing. A forEach function should
     * be impure and cause side effects.
     */
    public forEach(fn: (input: Input) => void): ArrayStream<Input> {
        this.ops.push({
            type: "foreach",
            op: fn as FuncOp["op"],
        });
        return this;
    }

    /**
     * A forEach operation that is used for debugging purposes.
     */
    public inspect(fn: (input: Input) => void): ArrayStream<Input> {
        this.ops.push({
            type: "foreach",
            op: fn as FuncOp["op"],
        });
        return this;
    }

    /**
     * Add a filterMap operation to the iterator that will be resolved when the iterator is finalized.
     * A filterMap operation takes an iterator of type A and returns an iterator of type B but also removes
     * any items that return null, false, or undefined from the filterMap function.
     */
    public filterMap<End>(
        fn: (input: Input) => End | null | false | undefined
    ): ArrayStream<End> {
        this.ops.push({
            type: "filterMap",
            op: fn as FuncOp["op"],
        });
        return this as unknown as ArrayStream<End>;
    }

    /**
     * Take the first n items from the iterator that will be resolved when the iterator is finalized.
     */
    public take(limit: number): ArrayStream<Input> {
        this.ops.push({
            type: "take",
            count: limit,
        });
        return this;
    }

    /**
     * Drop the first n items from the iterator that will be resolved when the iterator is finalized.
     */
    public skip(n: number): ArrayStream<Input> {
        this.ops.push({
            type: "skip",
            count: n,
        });
        return this;
    }

    // Methods that return a new iterator

    /**
     * Return a new iterator that will only include items which are divisible by N.
     */
    public stepBy(n: number): ArrayStream<Input> {
        const input = this.collect();
        function* stepByGenerator() {
            let iter = 0;
            for (const item of input) {
                if (iter % n === 0) {
                    yield item;
                }
                iter++;
            }
        }

        return new ArrayStream(stepByGenerator(), this.ops);
    }

    /**
     * Return a new iterator that appends the parameter stream to the current stream.
     */
    public chain<Stream>(
        stream: Streamable<Stream>
    ): ArrayStream<Input | Stream> {
        const input = this.collect();

        function* chainGenerator() {
            for (const item of input) {
                yield item;
            }

            for (const item of stream) {
                yield item;
            }
        }

        return new ArrayStream(chainGenerator(), []);
    }

    /**
     * Return a new iterator that will include an item between every value returned by the iterator.
     * The item can be a value of a function that returns the value.
     */
    public intersperse<Item>(
        fnOrItem: Item | (() => Item)
    ): ArrayStream<Input | Item> {
        const input = this.collect();
        const _input = ArrayStream.makeIterator(input);

        function* intersperseGenerator() {
            let count = 0;
            while (true) {
                const item = _input.next();
                yield item.value;

                if (
                    item.done ||
                    // Iterators created by arrays will have .done = true after they have gone through every item
                    // and not when they're on the last item - but intersperse puts them between items, not after each
                    // Therefore we have to add a special check for arrays since they will iterate specially
                    (Array.isArray(input) && count == input.length - 1)
                ) {
                    break;
                }

                const intersperseItem =
                    typeof fnOrItem === "function"
                        ? (fnOrItem as () => Item)()
                        : fnOrItem;
                yield intersperseItem;

                count++;
            }
        }

        return new ArrayStream(intersperseGenerator(), []);
    }

    /**
     * Return a new iterator that will yield the cartesian product of the current iterator and the new one.
     * If you don't know what that is, it yields a tuple of an item from both data sources. It will be exhausted as soon
     * as either data source is exhausted.
     */
    public zip<Stream>(
        stream: Streamable<Stream>
    ): ArrayStream<[Input, Stream]> {
        const input = this.collect();

        function* zipGenerator() {
            const streamIter = ArrayStream.makeIterator(stream);
            for (const item of input) {
                const streamItem = streamIter.next();
                if (streamItem.done) {
                    break;
                }

                yield [item, streamItem.value] as [Input, Stream];
            }
        }

        return new ArrayStream(zipGenerator(), []);
    }

    /**
     * Returns an iterator that will yield its items accompanied by an index.
     */
    public enumerate(): ArrayStream<[number, Input]> {
        const input = this.collect();
        function* enumerateGenerator() {
            for (let i = 0; i < input.length; i++) {
                yield [i, input[i]] as [number, Input];
            }
        }

        return new ArrayStream(enumerateGenerator(), []);
    }

    // TODO: Find a more efficient way to implement this than to collect the iterator
    /**
     * Returns an iterator that will yield individual items created from the application of the function.
     */
    public flatMap<End>(fn: (input: Input) => End[]): ArrayStream<End> {
        const input = this.collect();
        function* flatMapGenerator() {
            for (const item of input) {
                const result = fn(item);
                for (const r of result) {
                    yield r;
                }
            }
        }

        return new ArrayStream(flatMapGenerator(), []);
    }

    /**
     * Returns an iterator that will exhaust as soon as the iterator yields a null or undefined value.
     */
    public fuse(): ArrayStream<Input> {
        const input = this.collect();
        function* fuseGenerator() {
            for (const item of input) {
                if (item === undefined || item === null) {
                    break;
                }

                yield item;
            }
        }

        return new ArrayStream(fuseGenerator(), []);
    }

    // Methods that collect the iterator
    /**
     * Consume the iteartor and return however many items it contains.
     */
    public count(): number {
        return this.collect().length;
    }

    /**
     * Consume the iterator and return the item at the nth index (or null if it doesn't exist).
     */
    public nth(n: number): Input | null {
        const items = this.collect();
        if (n < items.length) {
            return items[n];
        }

        return null;
    }

    /**
     * Consume the iterator and collect all items into the chosen data structure starting from the first item.
     */
    public reduce<End>(
        op: (acc: End, next: Input) => End,
        initialValue: End
    ): End {
        const intermediate = this.collect();

        let result = initialValue;
        for (const item of intermediate) {
            result = op(result, item as unknown as Input);
        }
        return result;
    }

    /**
     * Consume the iterator and collect all items into the chosen data structure starting from the last item.
     */
    public reduceRight<End>(
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

    /**
     * Consume the iterator and run all operations against all items.
     */
    public collect(): Input[] {
        const intermediate: unknown[] = [];
        let count: number = 0;

        outer_loop: for (const input of this.input) {
            let item = input;
            let result;

            for (let i = 0; i < this.ops.length; i++) {
                const op = this.ops[i];

                switch (op.type) {
                    case "skip":
                        // Though this doesn't make much sense for the inner loop,
                        // the other solution I had would have it run through all iterations
                        // then skip items. This seemed the most efficient.
                        // TODO: Consider how to put this in a better place while maintaining efficiency
                        for (let i = 0; i < op.count - 1; i++) {
                            this.input.next();
                        }
                        this.ops.splice(i, 1);
                        continue outer_loop;
                    case "take":
                        if (count >= op.count) {
                            return new ArrayStream(
                                intermediate,
                                // i is 0-indexed and we want to skip ahead
                                this.ops.slice(i + 2)
                            ).collect() as Input[];
                        }
                        break;
                    case "filter":
                        if (op.op(item) === false) {
                            continue outer_loop;
                        }
                        break;
                    case "map":
                        item = op.op(item) as Input;
                        break;
                    case "foreach":
                        op.op(item);
                        break;
                    case "filterMap":
                        result = op.op(item);
                        if (
                            result === null ||
                            result === false ||
                            result === undefined
                        ) {
                            continue outer_loop;
                        }
                        item = result as Input;
                        break;
                    default:
                        break;
                }
            }

            intermediate.push(item);
            count++;
        }

        return intermediate as Input[];
    }
}
