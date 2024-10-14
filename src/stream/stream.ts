import { Breaker, Settler } from "../errors/handlers";
import type {
    Streamable,
    Op,
    ItemResult,
    HandlerReturnType,
    NarrowHandlerType,
} from "../types";

/**
 * A class for performing a series of operations on a synchronous and iterable source of data.
 * It aims to have a similar set of features as baseline Rust iterator. It is lazy and will only
 * iterate and perform operations when a finalizer method is called.
 *
 * ```ts
 * function* range(start: number, end: number = -1, step: number = 1) {
 *    let count = start;
 *    while (count < end || end === -1) {
 *       yield count;
 *       count += step;
 *    }
 * }
 * const stream = new ArrayStream(range(10))
 *   // 20, 30, 40, 50, ...
 *   .filterMap((item) => (item % 5 === 0 ? item ** 2 : null))
 *   // 20, 30, 40, 50, 60
 *   .take(5)
 *   .reduce((acc, next) => acc + next, 0);
 *
 * console.log(stream); // 200
 * ```
 */
export class ArrayStream<
    Input,
    Handler extends Breaker<Input> | Settler<Input>,
> {
    private input: IterableIterator<Input>;
    private ops: Op[] = [];
    /**
     * ArrayStream can be initialized with an array or a generator function, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5]);
     * ```
     * or
     * ```ts
     * function *gen(min: number, max: number) {
     *   while (true) {
     *      yield Math.floor(Math.random() * (max - min + 1)) + min;
     *   }
     * }
     * const stream = new ArrayStream(gen(1, 100));
     * ```
     */
    constructor(
        input: Streamable<Input>,
        private readonly handler: Handler = new Breaker<Input>() as Handler
    ) {
        this.input = ArrayStream.makeIterator(input);
    }

    /**
     * Helper function to standardize the input to an iterator.
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
     * is different from forEach in that it should be pure and not have side effects, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .map((item) => item * 2)
     *   .collect();
     * console.log(stream); // [2, 4, 6, 8, 10]
     * ```
     */
    public map<End>(
        fn: (input: Input) => End
    ): ArrayStream<End, NarrowHandlerType<Handler, Input, End>> {
        this.ops.push({
            type: "map",
            op: fn as Op["op"],
        });

        // @ts-expect-error: TypeScript gonna typescript
        return this;
    }

    /**
     * Add a filter operation to the iterator that will be resolved when the iterator is finalized.
     * A filter operation takes an iterator of type A and returns an iterator of type A but removes
     * all items that do not return true from the filter function, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .filter((item) => item % 2 === 0)
     *   .collect();
     * console.log(stream); // [2, 4]
     * ```
     */
    public filter(fn: (input: Input) => boolean): ArrayStream<Input, Handler> {
        this.ops.push({
            type: "filter",
            op: fn as Op["op"],
        });

        return this;
    }

    /**
     * Add a forEach operation to the iterator that will be resolved when the iterator is finalized.
     * A forEach operation takes an iterator of type A and returns nothing. A forEach function should
     * be impure and cause side effects, i.e.
     * ```ts
     * let sum = 0;
     * const sum2 = new ArrayStream([1, 2, 3, 4, 5])
     *   .forEach((item) => sum += item)
     *   .reduce((acc, next) => acc + next, 0);
     * console.log(sum === sum2); // true
     * ```
     */
    public forEach(fn: (input: Input) => void): ArrayStream<Input, Handler> {
        this.ops.push({
            type: "foreach",
            op: fn as Op["op"],
        });

        return this;
    }

    /**
     * A forEach operation that is used for debugging purposes which defaults to console.log.
     * ```ts
     * new ArrayStream([1, 2, 3, 4, 5])
     *   .inspect()
     *   .collect();
     * // 1-5 will be logged
     * ```
     */
    public inspect(
        fn: (input: Input) => void = (item) => console.log(item)
    ): ArrayStream<Input, Handler> {
        this.ops.push({
            type: "foreach",
            op: fn as Op["op"],
        });

        return this;
    }

    /**
     * Add a filterMap operation to the iterator that will be resolved when the iterator is finalized.
     * A filterMap operation takes an iterator of type A and returns an iterator of type B but also removes
     * any items that return null, false, or undefined, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .filterMap((item) => (item % 2 === 0 ? item * 2 : null))
     *   .collect();
     * console.log(stream); // [4, 8]
     * ```
     */
    public filterMap<End>(
        fn: (input: Input) => End | null | false | undefined
    ): ArrayStream<
        End,
        Handler extends Breaker<Input> ? Breaker<End> : Settler<End>
    > {
        this.ops.push({
            type: "filterMap",
            op: fn as Op["op"],
        });

        // @ts-expect-error: TypeScript gonna typescript
        return this;
    }

    // Methods that return a new iterator

    /**
     * Take the first n items from the iterator that will be resolved when the iterator is finalized, i.e.
     * ```ts
     * function *gen() {
     *   let count = 0;
     *   while (true) {
     *     yield count++;
     *   }
     * }
     * const stream = new ArrayStream(gen())
     *   .take(3)
     *   .collect();
     * console.log(stream); // [1, 2, 3]
     * ```
     */
    public take(n: number): ArrayStream<Input, Handler> {
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

        return new ArrayStream(takeGenerator(), this.handler);
    }

    /**
     * Returns a new iterator that will skip the first n items from the iterator, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .skip(2)
     *   .collect();
     * console.log(stream); // [3, 4, 5]
     * ```
     */
    public skip(n: number): ArrayStream<Input, Handler> {
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

        return new ArrayStream(skipGenerator(), this.handler);
    }

    /**
     * Return a new iterator that will only include items whose indexes are divisible by N, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .stepBy(2)
     *   .collect();
     * console.log(stream); // [1, 3, 5]
     */
    public stepBy(n: number): ArrayStream<Input, Handler> {
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

        return new ArrayStream(stepByGenerator(), this.handler);
    }

    /**
     * Return a new iterator that appends the parameter stream to the current stream, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .chain([6, 7, 8, 9, 10])
     *   .collect();
     * console.log(stream); // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
     */
    public chain<Stream>(
        stream: Streamable<Stream>
    ): ArrayStream<
        Input | Stream,
        NarrowHandlerType<Handler, Input, Input | Stream>
    > {
        const iter = this.read();

        function* chainGenerator() {
            yield* iter;
            yield* stream;
        }

        // @ts-expect-error: TypeScript gonna typescript
        return new ArrayStream(chainGenerator(), this.handler);
    }

    /**
     * Return a new iterator that will include an item between every value returned by the iterator.
     * The item can be a value of a function that returns the value, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .intersperse(0)
     *   .collect();
     * console.log(stream); // [1, 0, 2, 0, 3, 0, 4, 0, 5]
     * ```
     * or
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .intersperse((x) => x * 5)
     *   .collect();
     * console.log(stream); // [1, 5, 2, 10, 3, 15, 4, 20, 5]
     * ```
     */
    public intersperse<Item>(
        fnOrItem: Item | ((item: Input) => Item)
    ): ArrayStream<
        Input | Item,
        NarrowHandlerType<Handler, Input, Input | Item>
    > {
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
                        ? (fnOrItem as (item: Input) => Item)(current.value)
                        : fnOrItem;
                yield intersperseItem;
            }
        }

        // @ts-expect-error: TypeScript gonna typescript
        return new ArrayStream(intersperseGenerator(), this.handler);
    }

    /**
     * Return a new iterator that will yield the tuple of items from both data sources
     * It will be exhausted as soon as either data source is exhausted, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *  .zip([6, 7, 8, 9, 10])
     *  .collect();
     * console.log(stream); // [[1, 6], [2, 7], [3, 8], [4, 9], [5, 10]]
     * ```
     */
    public zip<Stream>(
        stream: Streamable<Stream>
    ): ArrayStream<
        [Input, Stream],
        NarrowHandlerType<Handler, Input, [Input, Stream]>
    > {
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

        // @ts-expect-error: TypeScript gonna typescript
        return new ArrayStream(zipGenerator(), this.handler);
    }

    /**
     * Returns an iterator that will yield a tuple of the iterated item accompanied by an index, i.e.
     * ```ts
     * const stream = new ArrayStream([100, 200, 300, 400, 500])
     *  .enumerate()
     *  .collect();
     * console.log(stream); // [[0, 100], [1, 200], [2, 300], [3, 400], [4, 500]]
     */
    public enumerate(): ArrayStream<
        [number, Input],
        NarrowHandlerType<Handler, Input, [number, Input]>
    > {
        const iter = this.read();
        function* enumerateGenerator() {
            let count = 0;
            for (const item of iter) {
                yield [count, item] as [number, Input];
                count++;
            }
        }
        // @ts-expect-error: TypeScript gonna typescript
        return new ArrayStream(enumerateGenerator(), this.handler);
    }

    /**
     * Returns an iterator that will apply a function that will map the iterated item to an array
     * then flatten it, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .flatMap((item) => [item, item + 100])
     *   .collect();
     * console.log(stream); // [1, 101, 2, 102, 3, 103, 4, 104, 5, 105]
     */
    public flatMap<End>(
        fn: (input: Input) => End[]
    ): ArrayStream<
        End,
        Handler extends Breaker<Input> ? Breaker<End> : Settler<End>
    > {
        const iter = this.read();
        function* flatMapGenerator() {
            for (const item of iter) {
                const result = fn(item);
                for (const r of result) {
                    yield r;
                }
            }
        }

        // @ts-expect-error: TypeScript gonna typescript
        return new ArrayStream(flatMapGenerator(), this.handler);
    }

    /**
     * Returns an iterator that will exhaust as soon as the iterator yields a null or undefined value, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5, null, 6, 7, 8, 9, 10])
     *   .fuse()
     *   .collect();
     * console.log(stream); // [1, 2, 3, 4, 5]
     */
    public fuse(): ArrayStream<Input, Handler> {
        const iter = this.read();
        function* fuseGenerator() {
            for (const item of iter) {
                if (item === undefined || item === null) {
                    break;
                }

                yield item;
            }
        }

        // @ts-expect-error: TypeScript gonna typescript
        return new ArrayStream(fuseGenerator(), this.handler);
    }

    // Finalizer methods
    /**
     * Consume the iteraor and return however many items it contains, i.e.
     * ```ts
     * const stream = new ArrayStream(["a", "b", "c"])
     *   .count();
     * console.log(stream); // 3
     */
    public count(): number {
        return this.collect().length;
    }

    /**
     * Consume the iterator up to the nth item and returns it.
     * Returns null if the iterator is exhausted before reaching n, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *  .nth(2);
     * console.log(stream); // 3
     * ```
     * or
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .nth(10);
     * console.log(stream); // null
     * ```
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
     * Consume the iterator and collect all items into the chosen data structure starting
     * from the first item, i.e.
     * ```ts
     * const stream = new ArrayStream(["a", "b", "c", "d", "e"])
     *   .reduce((acc, next) => acc + next, "");
     * console.log(stream); // "abcde"
     * ```
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
     * Consume the iterator and collect all items into the chosen data structure starting from the last item, i.e.
     * ```ts
     * const stream = new ArrayStream(["a", "b", "c", "d", "e"])
     *   .reduceRight((acc, next) => acc + next, "");
     * console.log(stream); // "edcba"
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
     * Consume the iterator and collect all items into an array flattened to the specified depth,
     * i.e.
     * ```ts
     * const stream = new ArrayStream([[1, 2], [3, [4, 5]], [5, [6, [7, 8]]]]).flat(2);
     * // stream = [1, 2, 3, 4, 5, 5, 6, [7, 8]]
     * ```
     */
    public flat<End, D extends number = 1>(d?: D): FlatArray<End, D>[] {
        return this.collect().flat(d) as FlatArray<End, D>[];
    }

    /**
     * Iterate through the iterator and return find the first item where the function returns true.
     * It is short circuiting, i.e.
     * ```ts
     * const hasEven = new ArrayStream([1, 2, 3, 4, 5])
     *   .any((item) => item % 2 === 0);
     * console.log(hasEven) // true
     * ```
     * or
     * ```ts
     * const hasEven = new ArrayStream([1, 3, 5, 7, 9])
     *    .any((item) => item % 2 === 0);
     * console.log(hasEven) // false
     * ```
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
     * Short circuits and returns false on the first item that returns false, i.e.
     * ```ts
     * const allEven = new ArrayStream([2, 4, 6, 8, 10])
     *   .all((item) => item % 2 === 0);
     * console.log(allEven) // true
     * ```
     * or
     * ```ts
     * const allEven = new ArrayStream([2, 4, 6, 8, 9])
     *   .all((item) => item % 2 === 0);
     * console.log(allEven) // false
     * ```
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
     * If the item is not found, it will return `null`. This method can be used on an infinite
     * generator but will never return if the item is never found. The function short circuits
     * on the first item that returns true and will not consume the rest of the iterator, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .find((item) => item % 2 === 0);
     * console.log(stream); // 2
     * ```
     * or
     * ```ts
     * const stream = new ArrayStream([1, 3, 5, 7, 9])
     *   .find((item) => item % 2 === 0);
     * console.log(stream); // null
     * ```
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
     * Consume the iterator and return the index of first item that causes the function to
     * return true. If the item is not found, it will return `-1`. This method can be used
     * on an infinite generator but will never return if the item is never found.
     * The function short circuits on the first item that returns true and will not consume
     * the rest of the iterator, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5])
     *   .findIndex((item) => item % 2 === 0);
     * console.log(stream); // 1
     * ```
     * or
     * ```ts
     * const stream = new ArrayStream([1, 3, 5, 7, 9])
     *   .findIndex((item) => item % 2 === 0);
     * console.log(stream); // -1
     * ```
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
     * Consume the iterator and return the first item that causes the function to
     * return true starting from the last item in the iteraotr. If the item is not
     * found, it will return `null`. This method cannot be used on an infinite
     * generator because it needs to consume the entire iterator to start from the end.
     * The function does not short circuit and will consume the entire iterator, i.e.
     * ```ts
     * const null = new ArrayStream([1, 2, 3, 4, 5])
     *   .findLast((item) => item % 2 === 0);
     * console.log(null); // 4
     * ```
     * or
     * ```ts
     * const item = new ArrayStream([1, 3, 5, 7, 9])
     *   .findLast((item) => item % 2 === 0);
     * console.log(item); // null
     * ```
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

    /**
     * Consume the iterator and return the index of the first item that causes the function to
     * return true starting from the last item in the iteraotr. If the item is not
     * found, it will return `null`. This method cannot be used on an infinite
     * generator because it needs to consume the entire iterator to start from the end.
     * The function does not short circuit and will consume the entire iterator, i.e.
     * ```ts
     * const position = new ArrayStream([1, 2, 3, 4, 5])
     *   .findLastIndex((item) => item % 2 === 0);
     * console.log(position); // 4
     * ```
     * or
     * ```ts
     * const position = new ArrayStream([1, 3, 5, 7, 9])
     *   .findLastIndex((item) => item % 2 === 0);
     * console.log(position); // -1
     * ```
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
     * This is short circuiting and will return after any item is equal to the input.
     * NOTE: This will not work correctly for reference values, i.e.
     * ```ts
     * const hasTwo = new ArrayStream([1, 2, 3, 4, 5])
     *   .includes(2);
     * console.log(hasTwo); // true
     * ```
     * but this will not work:
     * ```ts
     * const obj = { a: 1 };
     * const hasObj = new ArrayStream([{ a: 1 }, { a: 2 }])
     *   .includes(obj);
     * console.log(hasObj); // false
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
     * Consume the iterator and return a tuple of two arrays, the left being
     * those that caused the function to return `true`, and the right the others, i.e.
     * ```ts
     * const [left, right] = new ArrayStream([1, 2, 3, 4, 5])
     *   .partition((item) => item % 2 === 0);
     * console.log(left); // [2, 4]
     * console.log(right); // [1, 3, 5]
     * ```
     */
    public partition(
        fn: (input: Input) => boolean
    ): HandlerReturnType<typeof this.handler, Input, [Input[], Input[]]> {
        const left: Input[] = [];
        const right: Input[] = [];

        for (const item of this.read()) {
            if (fn(item)) {
                left.push(item);
            } else {
                right.push(item);
            }
        }

        const data = [left, right] as [Input[], Input[]];

        // @ts-expect-error: TypeScript gonna typescript
        return this.handler.compile(data);
    }

    /**
     * Consume the iterator and return the items in an array. It is identical in functionality
     * to a reduce method with an array that pushes the items, i.e.
     * ```ts
     * const stream = new ArrayStream([1, 2, 3, 4, 5]).collect();
     * // stream = [1, 2, 3, 4, 5]
     *
     * const stream2 = new ArrayStream([1,2,3,4,5]).reduce((acc, next) => {
     *   acc.push(next);
     *   return acc;
     * }, []);
     * // stream2 = [1, 2, 3, 4, 5]
     */
    public collect(): Input[] {
        return [...this.read()];
    }

    /**
     * Use this method to manually consume the iterator.
     */
    public *read(): Generator<Input, void, unknown> {
        let index = 0;
        let item: ItemResult<Input>;
        while (true) {
            try {
                const next = this.input.next();
                if (next.done) {
                    break;
                }

                item = this.applyTransformations(next.value, index);
                if (item.filtered) {
                    continue;
                }

                yield item.value;
                index++;
            } catch (e) {
                this.handler.registerCycleError(e, index);
            }
        }
    }

    /**
     * A helper function that will apply all operation items to an iterator.
     */
    private applyTransformations(
        item: Input,
        index: number
    ): ItemResult<Input> {
        let result;
        for (const op of this.ops) {
            try {
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
            } catch (e) {
                this.handler.registerOpError(e, index, item, op.type);
            }
        }

        return { value: item, filtered: false };
    }
}

const val = new ArrayStream([1, 2, 3, 4, 5], new Settler<number>()).partition(
    (item) => item % 2 === 0
);
console.log(val);
const val2 = new ArrayStream([1, 2, 3, 4, 5], new Breaker<number>()).partition(
    (item) => item % 2 === 0
);
console.log(val2);
