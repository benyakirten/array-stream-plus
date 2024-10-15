import type {
    Breaker,
    BreakerOutput,
    Ignorer,
    Settler,
    SettlerOutput,
} from "./errors/handlers";

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

// TODO: Figure out how to make it work like this:
// Until we do so, people cannot create their own error handlers
// export type HandlerReturnType<Handler, Input, Data> =
//     Handler extends ErrorHandler<Input, infer Output> ? Output<Data> : never

export type HandlerReturnType<Handler, Input, Data> = Handler extends
    | Breaker<Input>
    | Ignorer
    ? BreakerOutput<Data>
    : Handler extends Settler<Input>
      ? SettlerOutput<Data>
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
