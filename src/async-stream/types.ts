export type AsyncOp = AsyncFuncOp | AsyncNumericOp;

export type AsyncNumericOp = {
    type: "take" | "skip";
    count: number;
};

export type AsyncFuncOp = {
    type: "map" | "filter" | "foreach" | "filterMap";
    op: (input: unknown) => Promise<unknown> | unknown;
};
export type AsyncFn<T> = (input: unknown) => Promise<T> | T;

export type AsyncStreamable<Input> = Input[] | AsyncIterableIterator<Input>;
