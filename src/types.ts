import type { Breaker, Settler } from "./errors/handlers";

export type AsyncOp = {
    type: "map" | "filter" | "foreach" | "filterMap";
    op: MaybeAsyncFn<unknown, unknown>;
};

export type Op = {
    type: "map" | "filter" | "foreach" | "filterMap";
    op: (input: unknown) => unknown;
};

export type AsyncStreamable<Input> =
    | Input[]
    | AsyncIterableIterator<Input>
    | { promise: () => Promise<Input | null> };

export type Streamable<Input> = Input[] | IterableIterator<Input>;

export type MaybeAsyncFn<Input, Output> = (
    input: Input
) => Promise<Output> | Output;

export type ItemResult<T> =
    | {
          value: T;
          filtered: false;
      }
    | {
          filtered: true;
      };

export type HandlerReturnType<H, T, Data> =
    H extends Breaker<T>
        ? Data
        : H extends Settler<T>
          ? { data: Data; errors: Error[] }
          : never;

export type NarrowHandlerType<Handler, Input, End> =
    Handler extends ErrorHandler<Input, infer Output>
        ? ErrorHandler<End, Output>
        : never;

export interface ErrorHandler<Input, Output> {
    registerCycleError(error: unknown, index: number): void;
    registerOpError(
        error: unknown,
        index: number,
        item: Input,
        op: string
    ): void;
    compile<Data>(data: Data): Output;
}
