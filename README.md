[![Unit Test](https://github.com/benyakirten/array-stream/actions/workflows/unit_test.yml/badge.svg)](https://github.com/benyakirten/array-stream/actions/workflows/unit_test.yml)

# Array Stream Plus

## Introduction

Tired of how few methods are available for JavaScript arrays? Missing Rust iterators or Elixir enumerables and streams? Want a package with no dependencies and a small footprint? Test

```ts
function* gen(start: number) {
    let position = start;
    while (true) {
        yield position++;
    }
}

const result = new ArrayStream(gen())
    .filterMap((i) => (i % 2 === 0 ? i ** 2 : null))
    // 0, 4, 16, 36, 64, 100 ...
    .take(5)
    // 0, 4, 16, 36, 64
    .reduce((acc, next) => acc + next);

console.log(result); // 120
```

```ts
const result = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    .map((x) => ({ value: x }))
    .filter(({ value }) => value <= 3)
    .enumerate()
    .flatMap(([idx, { value }]) => ({ idx, value, next: value + 1 }))
    .collect();

console.log(result); // [{ idx: 0, value: 1, next: 2 }, { idx: 1, value: 2, next: 3 }, { idx: 2, value: 3, next: 4 }]
```

## Benchmarks

A writeup of benchmarks is available [here](./BENCHMARK.md). The conclusion: use native array methods if you like functional programming and care about performance.

## Contributing

I would be overjoyed if anyone wanted to contribute! Please check out the [Contribution Guide](./CONTRIBUTING.md) to get started.
