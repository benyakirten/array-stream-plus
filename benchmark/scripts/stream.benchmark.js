// node_modules/itertools/dist/index.js
function* ifilter(iterable, predicate) {
  for (const value of iterable) {
    if (predicate(value)) {
      yield value;
    }
  }
}
function* imap(iterable, mapper) {
  for (const value of iterable) {
    yield mapper(value);
  }
}
function filter(iterable, predicate) {
  return Array.from(ifilter(iterable, predicate));
}
function map(iterable, mapper) {
  return Array.from(imap(iterable, mapper));
}
var SENTINEL = Symbol();

// src/errors/common.ts
function processError(e, prefix) {
  if (e instanceof Error) {
    return `${prefix}: ${e.message}`;
  } else if (typeof e === "string") {
    return `${prefix}: ${e}`;
  } else if (e !== null && typeof e === "object") {
    return `${prefix}: ${e.toString()}`;
  } else {
    return `${prefix}: ${JSON.stringify(e)}`;
  }
}

// src/errors/handlers.ts
class Breaker {
  registerCycleError(error, index) {
    const prefix = `Error occurred at item at index ${index} in iterator`;
    const errMessage = processError(error, prefix);
    throw new Error(errMessage);
  }
  registerOpError(error, index, item, op) {
    const prefix = `Error occurred while performing ${op} on ${item} at index ${index} in iterator`;
    const errMessage = processError(error, prefix);
    throw new Error(errMessage);
  }
  compile(data) {
    return data;
  }
}

// src/stream/stream.ts
class ArrayStream {
  handler;
  input;
  ops = [];
  constructor(input, handler = new Breaker) {
    this.handler = handler;
    this.input = ArrayStream.makeIterator(input);
  }
  static makeIterator(input) {
    if (Array.isArray(input)) {
      return input[Symbol.iterator]();
    }
    return input;
  }
  map(fn) {
    if ("map" in this.input) {
      this.input = this.input.map(fn);
      return this;
    }
    this.ops.push({
      type: "map",
      op: fn
    });
    return this;
  }
  filter(fn) {
    if ("filter" in this.input) {
      this.input = this.input.filter(fn);
      return this;
    }
    this.ops.push({
      type: "filter",
      op: fn
    });
    return this;
  }
  forEach(fn) {
    if ("forEach" in this.input) {
      this.input = this.input.forEach(fn);
      return this;
    }
    this.ops.push({
      type: "foreach",
      op: fn
    });
    return this;
  }
  inspect(fn = (item) => console.log(item)) {
    return this.forEach(fn);
  }
  filterMap(fn) {
    this.ops.push({
      type: "filterMap",
      op: fn
    });
    return this;
  }
  take(n) {
    const iter = this.read();
    function* takeGenerator() {
      for (let i = 0;i < n; i++) {
        const item = iter.next();
        if (item.done) {
          break;
        }
        yield item.value;
      }
    }
    return new ArrayStream(takeGenerator(), this.handler);
  }
  drop = this.skip;
  skip(n) {
    const iter = this.read();
    if ("drop" in iter) {
      return new ArrayStream(iter.drop(n), this.handler);
    }
    function* skipGenerator() {
      let count = 0;
      while (count < n) {
        const item = iter.next();
        if (item.done) {
          break;
        }
        count++;
      }
      yield* iter;
    }
    return new ArrayStream(skipGenerator(), this.handler);
  }
  stepBy(n) {
    const iter = this.read();
    function* stepByGenerator() {
      let count = 0;
      for (const item of iter) {
        if (count % n === 0) {
          yield item;
        }
        count++;
      }
    }
    return new ArrayStream(stepByGenerator(), this.handler);
  }
  chain(stream) {
    const iter = this.read();
    function* chainGenerator() {
      yield* iter;
      yield* stream;
    }
    return new ArrayStream(chainGenerator(), this.handler);
  }
  intersperse(fnOrItem) {
    const iter = this.read();
    function* intersperseGenerator() {
      let item = null;
      while (true) {
        const current = item || iter.next();
        if (current.done) {
          break;
        }
        yield current.value;
        item = iter.next();
        if (item.done) {
          break;
        }
        const intersperseItem = typeof fnOrItem === "function" ? fnOrItem(current.value) : fnOrItem;
        yield intersperseItem;
      }
    }
    return new ArrayStream(intersperseGenerator(), this.handler);
  }
  zip(stream) {
    const iter = this.read();
    const streamIter = ArrayStream.makeIterator(stream);
    function* zipGenerator() {
      for (const item of iter) {
        const streamItem = streamIter.next();
        if (streamItem.done) {
          break;
        }
        yield [item, streamItem.value];
      }
    }
    return new ArrayStream(zipGenerator(), this.handler);
  }
  enumerate() {
    const iter = this.read();
    function* enumerateGenerator() {
      let count = 0;
      for (const item of iter) {
        yield [count, item];
        count++;
      }
    }
    return new ArrayStream(enumerateGenerator(), this.handler);
  }
  flatMap(fn) {
    const iter = this.read();
    if ("flatMap" in iter) {
      return new ArrayStream(iter.flatMap(fn), this.handler);
    }
    function* flatMapGenerator() {
      for (const item of iter) {
        const result = fn(item);
        for (const r of result) {
          yield r;
        }
      }
    }
    return new ArrayStream(flatMapGenerator(), this.handler);
  }
  fuse() {
    const iter = this.read();
    function* fuseGenerator() {
      for (const item of iter) {
        if (item === undefined || item === null) {
          break;
        }
        yield item;
      }
    }
    return new ArrayStream(fuseGenerator(), this.handler);
  }
  count() {
    const len = [...this.read()].length;
    return this.handler.compile(len);
  }
  nth(n) {
    let count = 0;
    for (const item of this.read()) {
      if (count === n) {
        return this.handler.compile(item);
      }
      count++;
    }
    return this.handler.compile(null);
  }
  reduce(op, initialValue) {
    if ("reduce" in this.read()) {
      const reduced = this.read().reduce(op, initialValue);
      return this.handler.compile(reduced);
    }
    let result = initialValue;
    let count = 0;
    for (const item of this.read()) {
      try {
        result = op(result, item);
      } catch (e) {
        this.handler.registerOpError(e, count, item, "reduce");
      }
      count++;
    }
    return this.handler.compile(result);
  }
  reduceRight(op, initialValue) {
    const intermediate = [...this.read()];
    let result = initialValue;
    for (let i = intermediate.length - 1;i >= 0; i--) {
      const item = intermediate[i];
      try {
        result = op(result, item);
      } catch (e) {
        this.handler.registerOpError(e, i, item, "reduceRight");
      }
    }
    return this.handler.compile(result);
  }
  flat(d) {
    const flattened = [...this.read()].flat(d);
    return this.handler.compile(flattened);
  }
  some = this.any;
  any(fn) {
    const iter = this.read();
    if ("some" in iter) {
      return this.handler.compile(iter.some(fn));
    }
    for (const item of this.read()) {
      if (fn(item)) {
        return this.handler.compile(true);
      }
    }
    return this.handler.compile(false);
  }
  every = this.all;
  all(fn) {
    if ("every" in this.read()) {
      return this.handler.compile(this.read().every(fn));
    }
    for (const item of this.read()) {
      if (!fn(item)) {
        return this.handler.compile(false);
      }
    }
    return this.handler.compile(true);
  }
  find(fn) {
    const iter = this.read();
    if ("find" in iter) {
      const found = iter.find(fn) ?? null;
      return this.handler.compile(found);
    }
    for (const item of this.read()) {
      if (fn(item)) {
        return this.handler.compile(item);
      }
    }
    return this.handler.compile(null);
  }
  findIndex(fn) {
    let count = 0;
    for (const item of this.read()) {
      if (fn(item)) {
        return this.handler.compile(count);
      }
      count++;
    }
    return -1;
  }
  findLast(fn) {
    const items = [...this.read()];
    for (let i = items.length - 1;i >= 0; i--) {
      if (fn(items[i])) {
        return this.handler.compile(items[i]);
      }
    }
    return this.handler.compile(null);
  }
  findLastIndex(fn) {
    const items = [...this.read()];
    for (let i = items.length - 1;i >= 0; i--) {
      if (fn(items[i])) {
        return this.handler.compile(i);
      }
    }
    return this.handler.compile(-1);
  }
  includes(item) {
    for (const i of this.read()) {
      if (i === item) {
        return this.handler.compile(true);
      }
    }
    return this.handler.compile(false);
  }
  partition(fn) {
    const left = [];
    const right = [];
    for (const item of this.read()) {
      if (fn(item)) {
        left.push(item);
      } else {
        right.push(item);
      }
    }
    const data = [left, right];
    return this.handler.compile(data);
  }
  toArray = this.collect;
  collect() {
    if ("toArray" in this.read()) {
      return this.handler.compile(this.read().toArray());
    }
    const items = [...this.read()];
    return this.handler.compile(items);
  }
  *read() {
    let index = 0;
    let item;
    while (true) {
      try {
        const next = this.input.next();
        if (next.done) {
          break;
        }
        item = this.applyTransformations(next.value, index);
        if (item.outcome !== "success") {
          index++;
          continue;
        }
        yield item.value;
      } catch (e) {
        this.handler.registerCycleError(e, index);
      }
      index++;
    }
  }
  applyTransformations(item, index) {
    let result;
    for (const op of this.ops) {
      try {
        switch (op.type) {
          case "filter":
            if (op.op(item) === false) {
              return { outcome: "filtered" };
            }
            break;
          case "map":
            item = op.op(item);
            break;
          case "foreach":
            op.op(item);
            break;
          case "filterMap":
            result = op.op(item);
            if (result === null || result === false || result === undefined) {
              return { outcome: "filtered" };
            }
            item = result;
            break;
          default:
            break;
        }
      } catch (e) {
        this.handler.registerOpError(e, index, item, op.type);
        return { outcome: "errored" };
      }
    }
    return { value: item, outcome: "success" };
  }
}
// src/async-stream/async-stream.ts
class AsyncArrayStream {
  handler;
  input;
  ops = [];
  constructor(input, handler = new Breaker) {
    this.handler = handler;
    this.input = AsyncArrayStream.makeIterator(input);
  }
  static makeIterator(input) {
    if ("promise" in input) {
      const promiseGenerator = input.promise;
      async function* gen() {
        while (true) {
          const item = await promiseGenerator();
          if (item === null || item === undefined) {
            break;
          }
          yield item;
        }
      }
      return gen();
    } else if (Array.isArray(input)) {
      const inputClone = structuredClone(input);
      async function* gen() {
        for (const item of inputClone) {
          yield item;
        }
      }
      return gen();
    } else {
      return input;
    }
  }
  map(fn) {
    this.ops.push({
      type: "map",
      op: fn
    });
    return this;
  }
  filter(fn) {
    this.ops.push({
      type: "filter",
      op: fn
    });
    return this;
  }
  forEach(fn) {
    this.ops.push({
      type: "foreach",
      op: fn
    });
    return this;
  }
  inspect(fn = (item) => console.log(item)) {
    this.ops.push({
      type: "foreach",
      op: fn
    });
    return this;
  }
  filterMap(fn) {
    this.ops.push({
      type: "filterMap",
      op: fn
    });
    return this;
  }
  take(n) {
    const gen = this.read();
    async function* newGenerator() {
      for (let i = 0;i < n; i++) {
        const item = await gen.next();
        if (item.done) {
          break;
        }
        yield item.value;
      }
    }
    return new AsyncArrayStream(newGenerator(), this.handler);
  }
  drop = this.skip;
  skip(n) {
    const gen = this.read();
    async function* newGenerator() {
      for (let i = 0;i < n; i++) {
        const item = await gen.next();
        if (item.done) {
          return;
        }
      }
      yield* gen;
    }
    return new AsyncArrayStream(newGenerator(), this.handler);
  }
  stepBy(n) {
    const gen = this.read();
    async function* stepByGenerator() {
      let iter = 0;
      for await (const item of gen) {
        if (iter % n === 0) {
          yield item;
        }
        iter++;
      }
    }
    return new AsyncArrayStream(stepByGenerator(), this.handler);
  }
  chain(stream) {
    const gen = this.read();
    const streamGen = AsyncArrayStream.makeIterator(stream);
    async function* chainGenerator() {
      yield* gen;
      yield* streamGen;
    }
    return new AsyncArrayStream(chainGenerator(), this.handler);
  }
  intersperse(fnOrItem) {
    const iter = this.input;
    async function* intersperseGenerator() {
      let item = null;
      while (true) {
        const current = item || await iter.next();
        if (current.done) {
          break;
        }
        yield current.value;
        item = await iter.next();
        if (item.done) {
          break;
        }
        const intersperseItem = typeof fnOrItem === "function" ? await fnOrItem(current.value) : fnOrItem;
        yield intersperseItem;
      }
    }
    return new AsyncArrayStream(intersperseGenerator(), this.handler);
  }
  zip(stream) {
    const iter = this.read();
    const streamIter = AsyncArrayStream.makeIterator(stream);
    async function* zipGenerator() {
      for await (const item of iter) {
        const streamItem = await streamIter.next();
        if (streamItem.done) {
          break;
        }
        yield [item, streamItem.value];
      }
    }
    return new AsyncArrayStream(zipGenerator(), this.handler);
  }
  enumerate() {
    const iter = this.read();
    async function* enumerateGenerator() {
      let count = 0;
      for await (const item of iter) {
        yield [count, item];
        count++;
      }
    }
    return new AsyncArrayStream(enumerateGenerator(), this.handler);
  }
  flatMap(fn) {
    const iter = this.read();
    async function* flatMapGenerator() {
      for await (const item of iter) {
        const result = await fn(item);
        for (const r of result) {
          yield r;
        }
      }
    }
    return new AsyncArrayStream(flatMapGenerator(), this.handler);
  }
  fuse() {
    const gen = this.read();
    async function* fuseGenerator() {
      for await (const item of gen) {
        if (item === undefined || item === null) {
          break;
        }
        yield item;
      }
    }
    return new AsyncArrayStream(fuseGenerator(), this.handler);
  }
  async count() {
    const arr = await this.toUncompiledArray();
    return this.handler.compile(arr.length);
  }
  async nth(n) {
    let index = 0;
    for await (const item of this.read()) {
      if (index == n) {
        return this.handler.compile(item);
      }
      index++;
    }
    return this.handler.compile(null);
  }
  async reduce(op, initialValue) {
    let result = initialValue;
    let index = 0;
    for await (const item of this.read()) {
      try {
        result = await op(result, item);
      } catch (e) {
        this.handler.registerOpError(e, index, item, "reduce");
      }
      index++;
    }
    return this.handler.compile(result);
  }
  async reduceRight(op, initialValue) {
    const intermediate = await this.toUncompiledArray();
    let result = initialValue;
    for (let i = intermediate.length - 1;i >= 0; i--) {
      const item = intermediate[i];
      try {
        result = await op(result, item);
      } catch (e) {
        this.handler.registerOpError(e, i, item, "reduceRight");
      }
    }
    return this.handler.compile(result);
  }
  async flat(d) {
    const result = await this.toUncompiledArray();
    const flattened = result.flat(d);
    return this.handler.compile(flattened);
  }
  async any(fn) {
    for await (const item of this.read()) {
      if (await fn(item)) {
        return this.handler.compile(true);
      }
    }
    return this.handler.compile(false);
  }
  every = this.all;
  async all(fn) {
    for await (const item of this.read()) {
      if (!await fn(item)) {
        return this.handler.compile(false);
      }
    }
    return this.handler.compile(true);
  }
  async find(fn) {
    for await (const item of this.read()) {
      if (await fn(item)) {
        return this.handler.compile(item);
      }
    }
    return this.handler.compile(null);
  }
  async findIndex(fn) {
    let count = 0;
    for await (const item of this.read()) {
      if (await fn(item)) {
        return this.handler.compile(count);
      }
      count++;
    }
    return this.handler.compile(-1);
  }
  async findLast(fn) {
    const items = await this.toUncompiledArray();
    for (let i = items.length - 1;i >= 0; i--) {
      if (await fn(items[i])) {
        return this.handler.compile(items[i]);
      }
    }
    return this.handler.compile(null);
  }
  async findLastIndex(fn) {
    const items = await this.toUncompiledArray();
    for (let i = items.length - 1;i >= 0; i--) {
      if (await fn(items[i])) {
        return this.handler.compile(i);
      }
    }
    return this.handler.compile(-1);
  }
  async includes(item) {
    for await (const i of this.read()) {
      if (i === item) {
        return this.handler.compile(true);
      }
    }
    return this.handler.compile(false);
  }
  async partition(fn) {
    const left = [];
    const right = [];
    for await (const item of this.read()) {
      if (await fn(item)) {
        left.push(item);
      } else {
        right.push(item);
      }
    }
    return this.handler.compile([left, right]);
  }
  toArray = this.collect;
  async collect() {
    const result = await this.toUncompiledArray();
    return this.handler.compile(result);
  }
  async toUncompiledArray() {
    const result = [];
    for await (const item of this.read()) {
      result.push(item);
    }
    return result;
  }
  async* read() {
    let index = 0;
    let item;
    while (true) {
      try {
        const next = await this.input.next();
        if (next.done) {
          break;
        }
        item = await this.applyTransformations(next.value, index);
        if (item.outcome !== "success") {
          index++;
          continue;
        }
        yield item.value;
      } catch (e) {
        this.handler.registerCycleError(e, index);
      }
      index++;
    }
  }
  async applyTransformations(item, index) {
    let result;
    for (const op of this.ops) {
      try {
        switch (op.type) {
          case "filter":
            if (await op.op(item) === false) {
              return { outcome: "filtered" };
            }
            break;
          case "map":
            item = await op.op(item);
            break;
          case "foreach":
            await op.op(item);
            break;
          case "filterMap":
            result = await op.op(item);
            if (result === null || result === false || result === undefined) {
              return { outcome: "filtered" };
            }
            item = result;
            break;
          default:
            break;
        }
      } catch (e) {
        this.handler.registerOpError(e, index, item, op.type);
        return { outcome: "errored" };
      }
    }
    return { value: item, outcome: "success" };
  }
}
// benchmark/scripts/stream.benchmark.ts
function testArrayStreamPerformance(lengthAmount, opCount) {
  const p1 = performance.now();
  const arr = Array.from({ length: lengthAmount }, (_, i) => i);
  const stream = new ArrayStream(arr);
  for (let i = 0;i < opCount; i++) {
    stream.map((x) => x + 1).filter((x) => x % 10 === 0);
  }
  stream.collect();
  return performance.now() - p1;
}
function testArrayPerformance(lengthAmount, opCount) {
  const p1 = performance.now();
  let arr = Array.from({ length: lengthAmount }, (_, i) => i);
  for (let i = 0;i < opCount; i++) {
    arr = arr.map((x) => x + 1).filter((x) => x % 10 === 0);
  }
  return performance.now() - p1;
}
function testItertoolsPerformance(lengthAmount, opCount) {
  const p1 = performance.now();
  let arr = Array.from({ length: lengthAmount }, (_, i) => i);
  for (let i = 0;i < opCount; i++) {
    arr = map(arr, (x) => x + 1);
    arr = filter(arr, (x) => x % 10 === 0);
  }
  return performance.now() - p1;
}
function* testPerformance(numReps) {
  const POWERS_OF_TEN = 7;
  const MAX_RECURSION_DEPTH_POWER_OF_TEN = 3;
  const streamPerformance = Array.from({ length: POWERS_OF_TEN }, () => Array.from({ length: POWERS_OF_TEN }, () => 0));
  const arrayPerformance = Array.from({ length: POWERS_OF_TEN }, () => Array.from({ length: POWERS_OF_TEN }, () => 0));
  const itertoolsPerformance = Array.from({ length: POWERS_OF_TEN }, () => Array.from({ length: POWERS_OF_TEN }, () => 0));
  const hasIterHelpers = "map" in Iterator.prototype;
  for (let i = 0;i < numReps; i++) {
    for (let j = 0;j < POWERS_OF_TEN; j++) {
      for (let k = 0;k < (hasIterHelpers ? 3 : MAX_RECURSION_DEPTH_POWER_OF_TEN); k++) {
        const len = 10 ** j;
        const ops = 10 ** k;
        const streamPerformanceValue = testArrayStreamPerformance(len, ops);
        const arrayPerformanceValue = testArrayPerformance(len, ops);
        const itertoolsPerformanceValue = testItertoolsPerformance(len, ops);
        streamPerformance[j][k] = (streamPerformance[j][k] * i + streamPerformanceValue) / (i + 1);
        arrayPerformance[j][k] = (arrayPerformance[j][k] * i + arrayPerformanceValue) / (i + 1);
        itertoolsPerformance[j][k] = (itertoolsPerformance[j][k] * i + itertoolsPerformanceValue) / (i + 1);
      }
    }
    yield [streamPerformance, arrayPerformance, itertoolsPerformance];
  }
}
export {
  testPerformance
};
