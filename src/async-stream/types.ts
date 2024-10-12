export type AsyncOp = AsyncFuncOp;

export type AsyncFuncOp = {
    type: "map" | "filter" | "foreach" | "filterMap";
    op: AsyncFn<unknown>;
};
export type AsyncFn<T> = (input: unknown) => Promise<T> | T;

export type AsyncStreamable<Input> = Input[] | AsyncIterableIterator<Input>;
