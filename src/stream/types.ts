export type Op = {
    type: "map" | "filter" | "foreach" | "filterMap";
    op: (input: unknown) => unknown;
};
export type ItemResult<T> =
    | {
          value: T;
          filtered: false;
      }
    | {
          filtered: true;
      };

export type Streamable<Input> = Input[] | IterableIterator<Input>;
