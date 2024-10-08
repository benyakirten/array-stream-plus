export type Op = FuncOp | NumericOp;

export type NumericOp = {
    type: "take" | "skip";
    count: number;
};

export type FuncOp = {
    type: "map" | "filter" | "foreach" | "filterMap";
    op: (input: unknown) => unknown;
};

export type Streamable<Input> = Input[] | IterableIterator<Input>;
