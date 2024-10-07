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

// src/stream.ts
class ArrayStream {
  ops;
  input;
  constructor(input, ops = []) {
    this.ops = ops;
    this.input = ArrayStream.makeIterator(input);
  }
  static makeIterator(input) {
    if (Array.isArray(input)) {
      return input[Symbol.iterator]();
    }
    return input;
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
  inspect(fn) {
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
  take(limit) {
    this.ops.push({
      type: "take",
      count: limit
    });
    return this;
  }
  skip(n) {
    this.ops.push({
      type: "skip",
      count: n
    });
    return this;
  }
  stepBy(n) {
    const input = this.collect();
    function* stepByGenerator() {
      let iter = 0;
      for (const item of input) {
        if (iter % n === 0) {
          yield item;
        }
        iter++;
      }
    }
    return new ArrayStream(stepByGenerator(), this.ops);
  }
  chain(stream) {
    const input = this.collect();
    function* chainGenerator() {
      for (const item of input) {
        yield item;
      }
      for (const item of stream) {
        yield item;
      }
    }
    return new ArrayStream(chainGenerator(), []);
  }
  intersperse(fnOrItem) {
    const input = this.collect();
    const _input = ArrayStream.makeIterator(input);
    function* intersperseGenerator() {
      let count = 0;
      while (true) {
        const item = _input.next();
        yield item.value;
        if (item.done || Array.isArray(input) && count == input.length - 1) {
          break;
        }
        const intersperseItem = typeof fnOrItem === "function" ? fnOrItem() : fnOrItem;
        yield intersperseItem;
        count++;
      }
    }
    return new ArrayStream(intersperseGenerator(), []);
  }
  zip(stream) {
    const input = this.collect();
    function* zipGenerator() {
      const streamIter = ArrayStream.makeIterator(stream);
      for (const item of input) {
        const streamItem = streamIter.next();
        if (streamItem.done) {
          break;
        }
        yield [item, streamItem.value];
      }
    }
    return new ArrayStream(zipGenerator(), []);
  }
  enumerate() {
    const input = this.collect();
    function* enumerateGenerator() {
      for (let i = 0;i < input.length; i++) {
        yield [i, input[i]];
      }
    }
    return new ArrayStream(enumerateGenerator(), []);
  }
  flatMap(fn) {
    const input = this.collect();
    function* flatMapGenerator() {
      for (const item of input) {
        const result = fn(item);
        for (const r of result) {
          yield r;
        }
      }
    }
    return new ArrayStream(flatMapGenerator(), []);
  }
  fuse() {
    const input = this.collect();
    function* fuseGenerator() {
      for (const item of input) {
        if (item === undefined || item === null) {
          break;
        }
        yield item;
      }
    }
    return new ArrayStream(fuseGenerator(), []);
  }
  count() {
    return this.collect().length;
  }
  nth(n) {
    const items = this.collect();
    if (n < items.length) {
      return items[n];
    }
    return null;
  }
  reduce(op, initialValue) {
    const intermediate = this.collect();
    let result = initialValue;
    for (const item of intermediate) {
      result = op(result, item);
    }
    return result;
  }
  reduceRight(op, initialValue) {
    const intermediate = this.collect();
    let result = initialValue;
    for (let i = intermediate.length - 1;i >= 0; i--) {
      const item = intermediate[i];
      result = op(result, item);
    }
    return result;
  }
  flat(d) {
    return this.collect().flat(d);
  }
  any(fn) {
    for (const item of this.collect()) {
      if (fn(item)) {
        return true;
      }
    }
    return false;
  }
  all(fn) {
    for (const item of this.collect()) {
      if (!fn(item)) {
        return false;
      }
    }
    return true;
  }
  find(fn) {
    for (const item of this.collect()) {
      if (fn(item)) {
        return item;
      }
    }
    return null;
  }
  findIndex(fn) {
    const items = this.collect();
    for (let i = 0;i < items.length; i++) {
      if (fn(items[i])) {
        return i;
      }
    }
    return -1;
  }
  findLast(fn) {
    const items = this.collect();
    for (let i = items.length - 1;i >= 0; i--) {
      if (fn(items[i])) {
        return items[i];
      }
    }
    return null;
  }
  findLastIndex(fn) {
    const items = this.collect();
    for (let i = items.length - 1;i >= 0; i--) {
      if (fn(items[i])) {
        return i;
      }
    }
    return -1;
  }
  includes(item) {
    const items = this.collect();
    for (let i = 0;i < items.length; i++) {
      if (items[i] === item) {
        return true;
      }
    }
    return false;
  }
  partition(fn) {
    const input = this.collect();
    const left = [];
    const right = [];
    for (const item of input) {
      if (fn(item)) {
        left.push(item);
      } else {
        right.push(item);
      }
    }
    return [left, right];
  }
  collect() {
    const intermediate = [];
    let count = 0;
    outer_loop:
      for (const input of this.input) {
        let item = input;
        let result;
        for (let i = 0;i < this.ops.length; i++) {
          const op = this.ops[i];
          switch (op.type) {
            case "skip":
              for (let i2 = 0;i2 < op.count - 1; i2++) {
                this.input.next();
              }
              this.ops.splice(i, 1);
              continue outer_loop;
            case "take":
              if (count >= op.count) {
                return new ArrayStream(intermediate, this.ops.slice(i + 2)).collect();
              }
              break;
            case "filter":
              if (op.op(item) === false) {
                continue outer_loop;
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
                continue outer_loop;
              }
              item = result;
              break;
            default:
              break;
          }
        }
        intermediate.push(item);
        count++;
      }
    return intermediate;
  }
}

// benchmark/stream.benchmark.ts
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
  const POWER_OF_TEN = 7;
  const streamPerformance = Array.from({ length: POWER_OF_TEN }, () => Array.from({ length: POWER_OF_TEN }, () => 0));
  const arrayPerformance = Array.from({ length: POWER_OF_TEN }, () => Array.from({ length: POWER_OF_TEN }, () => 0));
  const itertoolsPerformance = Array.from({ length: POWER_OF_TEN }, () => Array.from({ length: POWER_OF_TEN }, () => 0));
  for (let i = 0;i < numReps; i++) {
    for (let j = 0;j < POWER_OF_TEN; j++) {
      for (let k = 0;k < POWER_OF_TEN; k++) {
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
globalThis.testPerformance = testPerformance;
