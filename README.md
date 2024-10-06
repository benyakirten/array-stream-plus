[![Unit Test](https://github.com/benyakirten/array-stream/actions/workflows/unit_test.yml/badge.svg)](https://github.com/benyakirten/array-stream/actions/workflows/unit_test.yml)

# Array Streams

## Introduction

Want a quick, easy and efficient

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
    .flatMap(({ value }) => ({ value, next: value + 1 }))
    .collect();

console.log(result); // [{ value: 1, next: 2 }, { value: 2, next: 3 }, { value: 3, next: 4 }]
```

## Why

1. It's more efficient than native array methods because it consolidates all the operations into one function. (TODO: Add benchmarks)
2. It has more features than array methods.

## Motivation

After spending time in Elixir and Rust then return to JavaScript, I miss some of the nicer features. One of the things that I miss most are the cool iterator and enumerable features of those languages, so I figured I should try to bring them to the frontend (or Node).

## Contributing

Please take a look at the contributing guide (coming soon)
