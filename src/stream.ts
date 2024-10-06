type Op = FuncOp | NumericOp;

type NumericOp = {
    type: "take";
    count: number;
};

type FuncOp = {
    type: "map" | "filter";
    op: (input: unknown) => unknown;
};

/**
 * A class for performing a series of operations on a synchronous and iterable source of data.
 * It aims to have a similar set of features as baseline Rust iterator and outperform the native
 * JavaScript array methods when chained together. This is for users who want to chain array methods
 * while not taking a performance hit.
 */
export class ArrayStream<Input> {
    private input: IterableIterator<Input>;
    constructor(
        input: Input[] | IterableIterator<Input>,
        private ops: Op[] = []
    ) {
        if (Array.isArray(input)) {
            this.input = input[Symbol.iterator]();
        } else {
            this.input = input;
        }
    }

    public map<End>(fn: (input: Input) => End): ArrayStream<End> {
        this.ops.push({
            type: "map",
            op: fn as FuncOp["op"],
        });
        return this as unknown as ArrayStream<End>;
    }

    public filter(fn: (input: Input) => boolean): ArrayStream<Input> {
        this.ops.push({
            type: "filter",
            op: fn as FuncOp["op"],
        });
        return this;
    }

    public take(limit: number): ArrayStream<Input> {
        this.ops.push({
            type: "take",
            count: limit,
        });
        return this;
    }

    public skip(n: number): ArrayStream<Input> {
        // Can we do this inside of the iteration loop (i.e. collect?)
        const intermediate = this.collect();
        const iter = intermediate[Symbol.iterator]();
        for (let i = 0; i < n; i++) {
            console.log(iter.next().value);
        }
        return new ArrayStream(iter, this.ops);
    }

    // Methods that collect the iterator
    public count(): number {
        return this.collect().length;
    }

    public nth(n: number): Input | null {
        const items = this.collect();
        if (n < items.length) {
            return items[n];
        }

        return null;
    }

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

    public reduce<End>(
        op: (next: Input, acc: End) => End,
        initialValue: End
    ): End {
        const intermediate = this.collect();

        let result = initialValue;
        for (const item of intermediate) {
            result = op(item as unknown as Input, result);
        }
        return result;
    }

    public collect(): Input[] {
        const intermediate: unknown[] = [];
        let count: number = 0;

        outer_loop: for (const input of this.input) {
            let item = input;

            for (let i = 0; i < this.ops.length; i++) {
                const op = this.ops[i];

                switch (op.type) {
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

// TODO: Add an asynchronous version
