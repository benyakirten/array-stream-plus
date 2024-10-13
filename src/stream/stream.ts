import type { Streamable, Op, ItemResult } from "../types";

/**
 * A class for performing a series of operations on a synchronous and iterable source of data.
 * It aims to have a similar set of features as baseline Rust iterator.
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
            op: fn as Op["op"],
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
            op: fn as Op["op"],
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
            op: fn as Op["op"],
        });
        return this;
    }

    /**
     * A forEach operation that is used for debugging purposes.
     */
    public inspect(
        fn: (input: Input) => void = (item) => console.log(item)
    ): ArrayStream<Input> {
        this.ops.push({
            type: "foreach",
            op: fn as Op["op"],
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
            op: fn as Op["op"],
        });
        return this as unknown as ArrayStream<End>;
    }

    // Methods that return a new iterator

    /**
     * Take the first n items from the iterator that will be resolved when the iterator is finalized.
     */
    public take(n: number): ArrayStream<Input> {
        const iter = this.read();
        function* takeGenerator() {
            for (let i = 0; i < n; i++) {
                const item = iter.next();
                if (item.done) {
                    break;
                }
                yield item.value;
            }
        }

        return new ArrayStream(takeGenerator(), []);
    }

    /**
     * Returns a new iterator that will skip the first n items from the iterator.
     */
    public skip(n: number): ArrayStream<Input> {
        const iter = this.read();
        function* skipGenerator() {
            let count = 0;
            while (count < n) {
                const item = iter.next();
                if (item.done) {
                    break;
                }
                count++;
            }
            yield* iter;
        }

        return new ArrayStream(skipGenerator(), []);
    }

    /**
     * Return a new iterator that will only include items which are divisible by N.
     */
    public stepBy(n: number): ArrayStream<Input> {
        const iter = this.read();
        function* stepByGenerator() {
            let count = 0;
            for (const item of iter) {
                if (count % n === 0) {
                    yield item;
                }
                count++;
            }
        }

        return new ArrayStream(stepByGenerator(), []);
    }

    /**
     * Return a new iterator that appends the parameter stream to the current stream.
     */
    public chain<Stream>(
        stream: Streamable<Stream>
    ): ArrayStream<Input | Stream> {
        const iter = this.read();

        function* chainGenerator() {
            yield* iter;
            yield* stream;
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
        const iter = this.read();
        function* intersperseGenerator() {
            let item: IteratorResult<Input> | null = null;
            while (true) {
                const current = item || iter.next();
                if (current.done) {
                    break;
                }

                yield current.value;

                item = iter.next();
                if (item.done) {
                    break;
                }

                const intersperseItem =
                    typeof fnOrItem === "function"
                        ? (fnOrItem as () => Item)()
                        : fnOrItem;
                yield intersperseItem;
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
        const iter = this.read();
        const streamIter = ArrayStream.makeIterator(stream);
        function* zipGenerator() {
            for (const item of iter) {
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
        const iter = this.read();
        function* enumerateGenerator() {
            let count = 0;
            for (const item of iter) {
                yield [count, item] as [number, Input];
                count++;
            }
        }

        return new ArrayStream(enumerateGenerator(), []);
    }

    /**
     * Returns an iterator that will yield individual items created from the application of the function.
     */
    public flatMap<End>(fn: (input: Input) => End[]): ArrayStream<End> {
        const iter = this.read();
        function* flatMapGenerator() {
            for (const item of iter) {
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
        const iter = this.read();
        function* fuseGenerator() {
            for (const item of iter) {
                if (item === undefined || item === null) {
                    break;
                }

                yield item;
            }
        }

        return new ArrayStream(fuseGenerator(), []);
    }

    // Finalizer methods
    /**
     * Consume the iteraor and return however many items it contains.
     */
    public count(): number {
        return this.collect().length;
    }

    /**
     * Consume the iterator up to the nth item and returns it.
     * Returns null if the iterator is exhausted before reaching n.
     */
    public nth(n: number): Input | null {
        let count = 0;
        for (const item of this.read()) {
            if (count === n) {
                return item;
            }
            count++;
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
        let result = initialValue;
        for (const item of this.read()) {
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
     * Iterate through the iterator and return find the first item where the functionr eturns true.
     * It is short circuiting and will only consume the iterator up to the first item that returns true.
     */
    public any(fn: (item: Input) => boolean): boolean {
        for (const item of this.read()) {
            if (fn(item)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Consume the iterator and return a boolean if all the items cause the function to return true.
     * Short circuits and returns false on the first item that returns false. In this case,
     * the iterator will not consume all items.
     */
    public all(fn: (item: Input) => boolean): boolean {
        for (const item of this.read()) {
            if (!fn(item)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Consume the iterator and return the first item that causes the function to return true.
     * This method can be used on an infinite generator but will never return if the item is never found.
     * The function short circuits on the first item that returns true and will not consume the rest of the iterator.
     */
    public find(fn: (item: Input) => boolean): Input | null {
        for (const item of this.read()) {
            if (fn(item)) {
                return item;
            }
        }

        return null;
    }

    /**
     *  and return the index of the first item in the array that causes the function to return true.
     * This method can be used on an infinite generator but will never return if the item is never found.
     * The function short circuits on the first item that returns true and will not consume the rest of the iterator.
     */
    public findIndex(fn: (item: Input) => boolean): number {
        let count = 0;
        for (const item of this.read()) {
            if (fn(item)) {
                return count;
            }

            count++;
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
        for (const i of this.read()) {
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
    public partition(fn: (input: Input) => boolean): [Input[], Input[]] {
        const left: Input[] = [];
        const right: Input[] = [];

        for (const item of this.read()) {
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
        return [...this.read()];
    }

    private *read() {
        for (const input of this.input) {
            const item = this.applyTransformations(input);
            if (item.filtered) {
                continue;
            }

            yield item.value;
        }
    }

    /**
     * A helper function that will apply all operation items to an iterator.
     */
    private applyTransformations(item: Input): ItemResult<Input> {
        let result;
        for (const op of this.ops) {
            switch (op.type) {
                case "filter":
                    if (op.op(item) === false) {
                        return { filtered: true };
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
