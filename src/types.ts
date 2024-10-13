export type AsyncOp = {
    type: "map" | "filter" | "foreach" | "filterMap";
    op: MaybeAsyncFn<unknown, unknown>;
};
export type AsyncStreamable<Input> =
    | Input[]
    | AsyncIterableIterator<Input>
    | { promise: () => Promise<Input | null> };
export type MaybeAsyncFn<Input, Output> = (
    input: Input
) => Promise<Output> | Output;

export type Op = {
    type: "map" | "filter" | "foreach" | "filterMap";
    op: (input: unknown) => unknown;
};
export type Streamable<Input> = Input[] | IterableIterator<Input>;

export type ItemResult<T> =
    | {
          value: T;
          filtered: false;
      }
    | {
          filtered: true;
      };
