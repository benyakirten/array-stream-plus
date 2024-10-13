[![Unit Test](https://github.com/benyakirten/array-stream/actions/workflows/unit_test.yml/badge.svg)](https://github.com/benyakirten/array-stream/actions/workflows/unit_test.yml)
![](https://img.badgesize.io/benyakirten/array-stream-plus/main/compiled.js?compression=gzip)

# Array Stream Plus

## The Array Stream

Tired of how few methods are available for JavaScript arrays? Missing Rust iterators or Elixir enumerables and streams? Want a package with no dependencies and a small footprint. It's 1.5kb gzipped and minified (and it's tree shakeable too!). If you're wondering why NPM is saying more, it's for the source map and types, which you hopefully won't be shipping to clients.

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
    .reduce((acc, next) => acc + next, 0);

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

Also now available is the asynchronous array stream. It has the additional feature of letting users use a promise generator for the iterator, i.e.

```ts
let pageToken: string | null = null;
async function generatePromise(): Promise<Item[] | null> {
    const response = (await fetch("my-external-api", {
        page_size: 50,
        page_token: pageToken,
    })) as { ok: boolean; items: Item[]; page_token: string };
    if (response.ok) {
        pageToken = response.page_token;
        return response.items;
    }
    return null;
}

let items: Item[] = [];
const stream = new AsyncArrayStream({ promise: generatePromise });

document.querySelector(".load-more").addEventListener("click", async () => {
    const next = await stream.read().next();
    if (!next.done && next.value) {
        items = items.concat(next.value);
        renderList(items);
    }
});
```

More complete docs can be seen on the [GitHub Pages](https://benyakirten.github.io/array-stream-plus/).

## Benchmarks

A writeup of benchmarks is available [here](./BENCHMARK.md). The conclusion: use native array methods if you like functional programming and care about performance.

## Contributing

I would be overjoyed if anyone wanted to contribute! Please check out the [Contribution Guide](./CONTRIBUTING.md) to get started.

## Changelog

### 0.2.2

-   Add doc publishing to CI
-   Update/add doc strings

### 0.2.1

-   Fix package publishing CI
-   Fix 0.1.12 to 0.2.0 in changelog and add async stream example in readme

### 0.2.0

-   Add async array stream

### 0.1.1

-   Fix some details in the readme and the uploaded binary on GitHub

### 0.1.0

-   Add array stream
