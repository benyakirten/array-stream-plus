import { describe, it, expect, vi, assertType } from "vitest";

import { AsyncArrayStream } from "./async-stream";
import {
    Ignorer,
    Settler,
    Breaker,
    type SettlerOutput,
} from "../errors/handlers";

describe("AsyncArrayStream", () => {
    describe("ops", () => {
        describe("map", () => {
            it("should map values from one shape to another", async () => {
                const got = await new AsyncArrayStream([1, 2, 3])
                    .map(async (x) => x * 2)
                    .collect();
                expect(got).toEqual([2, 4, 6]);
            });

            it("should function correctly with a synchronous map function", async () => {
                const got = await new AsyncArrayStream([1, 2, 3])
                    .map((x) => x * 2)
                    .collect();
                expect(got).toEqual([2, 4, 6]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = new AsyncArrayStream([1, 2, 3]);
                assertType<AsyncArrayStream<number, Breaker<number>>>(
                    breakerStream
                );

                const breakerStream2 = breakerStream.map((x) => ({
                    x: String.fromCharCode(x + 65),
                }));
                assertType<
                    AsyncArrayStream<{ x: string }, Breaker<{ x: string }>>
                >(breakerStream2);

                const breakerStreamData = await breakerStream2.collect();
                assertType<{ x: string }[]>(breakerStreamData);
                expect(breakerStreamData).toEqual([
                    { x: "B" },
                    { x: "C" },
                    { x: "D" },
                ]);

                const ignorerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Ignorer()
                );
                assertType<AsyncArrayStream<number, Ignorer>>(ignorerStream);

                const ignorerStream2 = ignorerStream.map((x) =>
                    String.fromCharCode(x + 65)
                );
                assertType<AsyncArrayStream<string, Ignorer>>(ignorerStream2);

                const ignorerStreamData = await ignorerStream2.collect();
                assertType<string[]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual(["B", "C", "D"]);

                const settlerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Settler()
                );
                assertType<AsyncArrayStream<number, Settler<number>>>(
                    settlerStream
                );

                const settlerStream2 = settlerStream.map((x) =>
                    String.fromCharCode(x + 65)
                );
                assertType<AsyncArrayStream<string, Settler<string>>>(
                    settlerStream2
                );

                const settlerStreamData = await settlerStream2.collect();
                assertType<SettlerOutput<string[]>>(settlerStreamData);
                expect(settlerStreamData).toEqual({
                    data: ["B", "C", "D"],
                    errors: [],
                });
            });
        });

        describe("filter", () => {
            it("should filter out values that return false in the filter function", async () => {
                const input = [1, 2, 3, 4];
                const got = await new AsyncArrayStream(input)
                    .filter(async (x) => x % 2 === 0)
                    .collect();
                expect(got).toEqual([2, 4]);
            });

            it("should work correctly with a synchronous filter function", async () => {
                const input = [1, 2, 3, 4];
                const got = await new AsyncArrayStream(input)
                    .filter((x) => x % 2 === 0)
                    .collect();
                expect(got).toEqual([2, 4]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = new AsyncArrayStream([1, 2, 3]).filter(
                    (x) => x % 2 === 0
                );
                assertType<AsyncArrayStream<number, Breaker<number>>>(
                    breakerStream
                );
                const breakerStreamData = await breakerStream.collect();
                assertType<number[]>(breakerStreamData);
                expect(breakerStreamData).toEqual([2]);

                const ignorerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Ignorer()
                ).filter((x) => x % 2 === 0);
                assertType<AsyncArrayStream<number, Ignorer>>(ignorerStream);
                const ignorerStreamData = await ignorerStream.collect();
                assertType<number[]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual([2]);

                const settlerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Settler()
                ).filter((x) => x % 2 === 0);
                assertType<AsyncArrayStream<number, Settler<number>>>(
                    settlerStream
                );

                const settlerStreamData = await settlerStream.collect();
                assertType<SettlerOutput<number[]>>(settlerStreamData);
                expect(settlerStreamData).toEqual({
                    data: [2],
                    errors: [],
                });
            });
        });

        describe("forEach", () => {
            it("should apply a function without mutating the original function", async () => {
                const input = [1, 2, 3];
                let sum = 0;
                const got = await new AsyncArrayStream(input)
                    .forEach(async (x) => {
                        sum += x;
                    })
                    .collect();
                expect(sum).toBe(6);
                expect(got).toEqual([1, 2, 3]);
            });

            it("should work correctly with a synchronous function", async () => {
                const input = [1, 2, 3];
                let sum = 0;
                const got = await new AsyncArrayStream(input)
                    .forEach((x) => {
                        sum += x;
                    })
                    .collect();
                expect(sum).toBe(6);
                expect(got).toEqual([1, 2, 3]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = new AsyncArrayStream([1, 2, 3]).forEach(
                    (x) => x % 2 === 0
                );
                assertType<AsyncArrayStream<number, Breaker<number>>>(
                    breakerStream
                );
                const breakerStreamData = await breakerStream.collect();
                assertType<number[]>(breakerStreamData);
                expect(breakerStreamData).toEqual([1, 2, 3]);

                const ignorerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Ignorer()
                ).forEach((x) => x % 2 === 0);
                assertType<AsyncArrayStream<number, Ignorer>>(ignorerStream);
                const ignorerStreamData = await ignorerStream.collect();
                assertType<number[]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual([1, 2, 3]);

                const settlerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Settler()
                ).forEach((x) => x % 2 === 0);
                assertType<AsyncArrayStream<number, Settler<number>>>(
                    settlerStream
                );
                const settlerStreamData = await settlerStream.collect();
                assertType<SettlerOutput<number[]>>(settlerStreamData);
                expect(settlerStreamData).toEqual({
                    data: [1, 2, 3],
                    errors: [],
                });
            });
        });

        describe("filterMap", () => {
            it("should map an item and filter out the result if it is null, undefined or false", async () => {
                const input = [1, 2, 3];
                const got = await new AsyncArrayStream(input)
                    .filterMap(async (x) => (x % 2 === 0 ? x * 2 : null))
                    .collect();
                expect(got).toEqual([4]);
            });

            it("should work correctly with a synchronous function", async () => {
                const input = [1, 2, 3];
                const got = await new AsyncArrayStream(input)
                    .filterMap((x) => (x % 2 === 0 ? x * 2 : null))
                    .collect();
                expect(got).toEqual([4]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = new AsyncArrayStream([1, 2, 3]).filterMap(
                    (x) => (x % 2 === 0 ? String.fromCharCode(x + 65) : null)
                );
                assertType<AsyncArrayStream<string, Breaker<string>>>(
                    breakerStream
                );
                const breakerStreamData = await breakerStream.collect();
                assertType<string[]>(breakerStreamData);
                expect(breakerStreamData).toEqual(["C"]);

                const ignorerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Ignorer()
                ).filterMap((x) =>
                    x % 2 === 0 ? String.fromCharCode(x + 65) : null
                );
                assertType<AsyncArrayStream<string, Ignorer>>(ignorerStream);
                const ignorerStreamData = await ignorerStream.collect();
                assertType<string[]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual(["C"]);

                const settlerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Settler()
                ).filterMap((x) =>
                    x % 2 === 0 ? String.fromCharCode(x + 65) : null
                );
                assertType<AsyncArrayStream<string, Settler<string>>>(
                    settlerStream
                );
                const settlerStreamData = await settlerStream.collect();
                assertType<SettlerOutput<string[]>>(settlerStreamData);
                expect(settlerStreamData).toEqual({
                    data: ["C"],
                    errors: [],
                });
            });
        });

        it("should work correctly with multiple ops", async () => {
            const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const spy = vi.fn();
            const got = await new AsyncArrayStream(input)
                // 2, 4, 6, 8, 10
                .filter(async (x) => x % 2 === 0)
                // 4, 8, 12, 16, 20
                .map(async (x) => x * 2)
                .forEach((x) => spy(x))
                // 120
                .filterMap(async (x) => (x % 3 === 0 ? x * 10 : false))
                .collect();

            expect(got).toEqual([120]);
            expect(spy).toHaveBeenCalledTimes(5);
            for (const i of [4, 8, 12, 16, 20]) {
                expect(spy).toHaveBeenCalledWith(i);
            }
        });
    });

    describe("iterator adapters", () => {
        describe("take", () => {
            it("should take the first n items", async () => {
                const input = [1, 2, 3, 4, 5];
                const got = await new AsyncArrayStream(input).take(3).collect();
                expect(got).toEqual([1, 2, 3]);
            });

            it("should not apply operators twice", async () => {
                const input = [1, 2, 3, 4, 5];
                const spy = vi.fn();
                const spy2 = vi.fn();
                const got = await new AsyncArrayStream(input)
                    .forEach((x) => spy(x))
                    .take(3)
                    .forEach((x) => spy2(x))
                    .collect();
                expect(got).toEqual([1, 2, 3]);
                expect(spy).toHaveBeenCalledTimes(3);
                expect(spy2).toHaveBeenCalledTimes(3);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                async function* gen() {
                    let count = 0;
                    while (true) {
                        yield count++;
                    }
                }

                const breakerStream = new AsyncArrayStream(gen()).take(2);
                assertType<AsyncArrayStream<number, Breaker<number>>>(
                    breakerStream
                );
                const breakerStreamData = await breakerStream.collect();
                assertType<number[]>(breakerStreamData);
                expect(breakerStreamData).toEqual([0, 1]);

                const ignorerStream = new AsyncArrayStream(
                    gen(),
                    new Ignorer()
                ).take(2);
                assertType<AsyncArrayStream<number, Ignorer>>(ignorerStream);
                const ignorerStreamData = await ignorerStream.collect();
                assertType<number[]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual([0, 1]);

                const settlerStream = new AsyncArrayStream(
                    gen(),
                    new Settler()
                ).take(2);
                assertType<AsyncArrayStream<number, Settler<number>>>(
                    settlerStream
                );
                const settlerStreamData = await settlerStream.collect();
                assertType<SettlerOutput<number[]>>(settlerStreamData);
                expect(settlerStreamData).toEqual({
                    data: [0, 1],
                    errors: [],
                });
            });
        });

        describe("skip", () => {
            it("should skip the first n items", async () => {
                const input = [1, 2, 3, 4, 5];
                const stream = new AsyncArrayStream(input).skip(2);
                const result = await stream.collect();
                expect(result).toEqual([3, 4, 5]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                async function* gen() {
                    let count = 0;
                    while (true) {
                        yield count++;
                    }
                }

                const breakerStream = new AsyncArrayStream(gen()).skip(2);
                assertType<AsyncArrayStream<number, Breaker<number>>>(
                    breakerStream
                );
                const breakerStreamData = await breakerStream.take(2).collect();
                assertType<number[]>(breakerStreamData);
                expect(breakerStreamData).toEqual([2, 3]);

                const ignorerStream = new AsyncArrayStream(
                    gen(),
                    new Ignorer()
                ).skip(2);
                assertType<AsyncArrayStream<number, Ignorer>>(ignorerStream);
                const ignorerStreamData = await ignorerStream.take(2).collect();
                assertType<number[]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual([2, 3]);

                const settlerStream = new AsyncArrayStream(
                    gen(),
                    new Settler()
                ).skip(2);
                assertType<AsyncArrayStream<number, Settler<number>>>(
                    settlerStream
                );
                const settlerStreamData = await settlerStream.take(2).collect();
                assertType<SettlerOutput<number[]>>(settlerStreamData);
                expect(settlerStreamData).toEqual({
                    data: [2, 3],
                    errors: [],
                });
            });
        });

        describe("stepBy", () => {
            it("should yield every nth item", async () => {
                const input = [1, 2, 3, 4, 5, 6];
                const got = await new AsyncArrayStream(input)
                    .stepBy(2)
                    .collect();
                expect(got).toEqual([1, 3, 5]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                async function* gen() {
                    let count = 0;
                    while (true) {
                        yield count++;
                    }
                }

                const breakerStream = new AsyncArrayStream(gen()).stepBy(2);
                assertType<AsyncArrayStream<number, Breaker<number>>>(
                    breakerStream
                );
                const breakerStreamData = await breakerStream.take(2).collect();
                assertType<number[]>(breakerStreamData);
                expect(breakerStreamData).toEqual([0, 2]);

                const ignorerStream = new AsyncArrayStream(
                    gen(),
                    new Ignorer()
                ).stepBy(2);
                assertType<AsyncArrayStream<number, Ignorer>>(ignorerStream);
                const ignorerStreamData = await ignorerStream.take(2).collect();
                assertType<number[]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual([0, 2]);

                const settlerStream = new AsyncArrayStream(
                    gen(),
                    new Settler()
                ).stepBy(2);
                assertType<AsyncArrayStream<number, Settler<number>>>(
                    settlerStream
                );
                const settlerStreamData = await settlerStream.take(2).collect();
                assertType<SettlerOutput<number[]>>(settlerStreamData);
                expect(settlerStreamData).toEqual({
                    data: [0, 2],
                    errors: [],
                });
            });
        });

        describe("chain", () => {
            it("should chain two streams", async () => {
                const input1 = [1, 2, 3];
                const input2 = [4, 5, 6];
                const stream = new AsyncArrayStream(input1).chain(input2);
                const result = await stream.collect();
                expect(result).toEqual([1, 2, 3, 4, 5, 6]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = new AsyncArrayStream([1, 2, 3]).chain([
                    "A",
                    "B",
                    "C",
                ]);
                assertType<
                    AsyncArrayStream<number | string, Breaker<number | string>>
                >(breakerStream);
                const breakerStreamData = await breakerStream.collect();
                assertType<(number | string)[]>(breakerStreamData);
                expect(breakerStreamData).toEqual([1, 2, 3, "A", "B", "C"]);

                const ignorerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Ignorer()
                ).chain(["A", "B", "C"]);
                assertType<AsyncArrayStream<number | string, Ignorer>>(
                    ignorerStream
                );
                const ignorerStreamData = await ignorerStream.collect();
                assertType<(number | string)[]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual([1, 2, 3, "A", "B", "C"]);

                const settlerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Settler()
                ).chain(["A", "B", "C"]);
                assertType<
                    AsyncArrayStream<number | string, Settler<number | string>>
                >(settlerStream);
                const settlerStreamData = await settlerStream.collect();
                assertType<SettlerOutput<(number | string)[]>>(
                    settlerStreamData
                );
                expect(settlerStreamData).toEqual({
                    data: [1, 2, 3, "A", "B", "C"],
                    errors: [],
                });
            });
        });

        describe("intersperse", () => {
            it("should intersperse items", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input).intersperse(() =>
                    Promise.resolve(0)
                );
                const result = await stream.collect();
                expect(result).toEqual([1, 0, 2, 0, 3]);
            });

            it("should work with a function", async () => {
                let i = 0;
                const stream = new AsyncArrayStream([1, 2, 3]).intersperse(
                    async () => i++
                );
                const result = await stream.collect();
                expect(result).toEqual([1, 0, 2, 1, 3]);
            });

            it("should call the function with the item to intersperse if it is a function", async () => {
                const stream = new AsyncArrayStream([1, 2, 3]).intersperse(
                    async (x) => x + 100
                );
                const result = await stream.collect();
                expect(result).toEqual([1, 101, 2, 102, 3]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = new AsyncArrayStream([
                    1, 2, 3,
                ]).intersperse((x) => String.fromCharCode(x + 64));
                assertType<
                    AsyncArrayStream<number | string, Breaker<number | string>>
                >(breakerStream);
                const breakerStreamData = await breakerStream.collect();
                assertType<(number | string)[]>(breakerStreamData);
                expect(breakerStreamData).toEqual([1, "A", 2, "B", 3]);

                const ignorerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Ignorer()
                ).intersperse((x) => String.fromCharCode(x + 64));
                assertType<AsyncArrayStream<number | string, Ignorer>>(
                    ignorerStream
                );
                const ignorerStreamData = await ignorerStream.collect();
                assertType<(number | string)[]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual([1, "A", 2, "B", 3]);

                const settlerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Settler()
                ).intersperse((x) => String.fromCharCode(x + 64));
                assertType<
                    AsyncArrayStream<number | string, Settler<number | string>>
                >(settlerStream);
                const settlerStreamData = await settlerStream.collect();
                assertType<SettlerOutput<(number | string)[]>>(
                    settlerStreamData
                );
                expect(settlerStreamData).toEqual({
                    data: [1, "A", 2, "B", 3],
                    errors: [],
                });
            });
        });

        describe("zip", () => {
            it("should adapt the iterator to yield a tuple of items from the two iterators", async () => {
                const input1 = [100, 200, 300];
                const input2 = ["a", "b", "c"];
                const stream = new AsyncArrayStream(input1).zip(input2);
                const result = await stream.collect();
                expect(result).toEqual([
                    [100, "a"],
                    [200, "b"],
                    [300, "c"],
                ]);
            });

            it("should stop when either iterator is exhausted", async () => {
                const input1 = [100, 200];
                const input2 = ["a", "b", "c"];
                const stream = new AsyncArrayStream(input1).zip(input2);
                const result = await stream.collect();
                expect(result).toEqual([
                    [100, "a"],
                    [200, "b"],
                ]);

                const stream2 = new AsyncArrayStream(input2).zip(input1);
                const result2 = await stream2.collect();
                expect(result2).toEqual([
                    ["a", 100],
                    ["b", 200],
                ]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = new AsyncArrayStream([1, 2, 3]).zip([
                    "A",
                    "B",
                    "C",
                ]);
                assertType<
                    AsyncArrayStream<
                        [number, string],
                        Breaker<[number, string]>
                    >
                >(breakerStream);
                const breakerStreamData = await breakerStream.collect();
                assertType<[number, string][]>(breakerStreamData);
                expect(breakerStreamData).toEqual([
                    [1, "A"],
                    [2, "B"],
                    [3, "C"],
                ]);

                const ignorerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Ignorer()
                ).zip(["A", "B", "C"]);
                assertType<AsyncArrayStream<[number, string], Ignorer>>(
                    ignorerStream
                );
                const ignorerStreamData = await ignorerStream.collect();
                assertType<[number, string][]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual([
                    [1, "A"],
                    [2, "B"],
                    [3, "C"],
                ]);

                const settlerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Settler()
                ).zip(["A", "B", "C"]);
                assertType<
                    AsyncArrayStream<
                        [number, string],
                        Settler<[number, string]>
                    >
                >(settlerStream);
                const settlerStreamData = await settlerStream.collect();
                assertType<SettlerOutput<[number, string][]>>(
                    settlerStreamData
                );
                expect(settlerStreamData).toEqual({
                    data: [
                        [1, "A"],
                        [2, "B"],
                        [3, "C"],
                    ],
                    errors: [],
                });
            });
        });

        describe("enumerate", () => {
            it("should adapt the iterator to yield a tuple of the index and the item", async () => {
                const input = ["a", "b", "c"];
                const stream = new AsyncArrayStream(input).enumerate();
                const result = await stream.collect();
                expect(result).toEqual([
                    [0, "a"],
                    [1, "b"],
                    [2, "c"],
                ]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = new AsyncArrayStream([
                    "A",
                    "B",
                    "C",
                ]).enumerate();
                assertType<
                    AsyncArrayStream<
                        [number, string],
                        Breaker<[number, string]>
                    >
                >(breakerStream);
                const breakerStreamData = await breakerStream.collect();
                assertType<[number, string][]>(breakerStreamData);
                expect(breakerStreamData).toEqual([
                    [0, "A"],
                    [1, "B"],
                    [2, "C"],
                ]);

                const ignorerStream = new AsyncArrayStream(
                    ["A", "B", "C"],
                    new Ignorer()
                ).enumerate();
                assertType<AsyncArrayStream<[number, string], Ignorer>>(
                    ignorerStream
                );
                const ignorerStreamData = await ignorerStream.collect();
                assertType<[number, string][]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual([
                    [0, "A"],
                    [1, "B"],
                    [2, "C"],
                ]);

                const settlerStream = new AsyncArrayStream(
                    ["A", "B", "C"],
                    new Settler()
                ).enumerate();
                assertType<
                    AsyncArrayStream<
                        [number, string],
                        Settler<[number, string]>
                    >
                >(settlerStream);
                const settlerStreamData = await settlerStream.collect();
                assertType<SettlerOutput<[number, string][]>>(
                    settlerStreamData
                );
                expect(settlerStreamData).toEqual({
                    data: [
                        [0, "A"],
                        [1, "B"],
                        [2, "C"],
                    ],
                    errors: [],
                });
            });
        });

        describe("flatMap", () => {
            it("should map the items to an array then flatten it", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input).flatMap(
                    async (x) => [x, x + 100]
                );
                const result = await stream.collect();
                expect(result).toEqual([1, 101, 2, 102, 3, 103]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = new AsyncArrayStream([1, 2, 3]).flatMap(
                    (x) => [x, x + 100]
                );
                assertType<AsyncArrayStream<number, Breaker<number>>>(
                    breakerStream
                );
                const breakerStreamData = await breakerStream.collect();
                assertType<number[]>(breakerStreamData);
                expect(breakerStreamData).toEqual([1, 101, 2, 102, 3, 103]);

                const ignorerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Ignorer()
                ).flatMap((x) => [x, x + 100]);
                assertType<AsyncArrayStream<number, Ignorer>>(ignorerStream);
                const ignorerStreamData = await ignorerStream.collect();
                assertType<number[]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual([1, 101, 2, 102, 3, 103]);

                const settlerStream = new AsyncArrayStream(
                    [1, 2, 3],
                    new Settler()
                ).flatMap((x) => [x, x + 100]);
                assertType<AsyncArrayStream<number, Settler<number>>>(
                    settlerStream
                );
                const settlerStreamData = await settlerStream.collect();
                assertType<SettlerOutput<number[]>>(settlerStreamData);
                expect(settlerStreamData).toEqual({
                    data: [1, 101, 2, 102, 3, 103],
                    errors: [],
                });
            });
        });

        describe("fuse", () => {
            it("should end iteration as soon as an item is null", async () => {
                const input = [1, 2, null, 3, 4];
                const stream = new AsyncArrayStream(input).fuse();
                const result = await stream.collect();
                expect(result).toEqual([1, 2]);
            });

            it("should respect maps before the fuse", async () => {
                const input = [1, 2, 3, 4, 5];
                const stream = new AsyncArrayStream(input)
                    .map(async (x) => (x === 3 ? null : x * 2))
                    .fuse();
                const result = await stream.collect();
                expect(result).toEqual([2, 4]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = new AsyncArrayStream([
                    1,
                    2,
                    3,
                    null,
                    5,
                ]).fuse();
                assertType<
                    AsyncArrayStream<
                        Required<number | null>,
                        Breaker<Required<number | null>>
                    >
                >(breakerStream);
                const breakerStreamData = await breakerStream.collect();
                assertType<Required<number | null>[]>(breakerStreamData);
                expect(breakerStreamData).toEqual([1, 2, 3]);

                const ignorerStream = new AsyncArrayStream(
                    [1, 2, 3, null, 5],
                    new Ignorer()
                ).fuse();
                assertType<AsyncArrayStream<Required<number | null>, Ignorer>>(
                    ignorerStream
                );
                const ignorerStreamData = await ignorerStream.collect();
                assertType<Required<number | null>[]>(ignorerStreamData);
                expect(ignorerStreamData).toEqual([1, 2, 3]);

                const settlerStream = new AsyncArrayStream(
                    [1, 2, 3, null, 5],
                    new Settler()
                ).fuse();
                assertType<
                    AsyncArrayStream<
                        Required<number | null>,
                        Settler<Required<number | null>>
                    >
                >(settlerStream);
                const settlerStreamData = await settlerStream.collect();
                assertType<SettlerOutput<Required<number | null>[]>>(
                    settlerStreamData
                );
                expect(settlerStreamData).toEqual({
                    data: [1, 2, 3],
                    errors: [],
                });
            });
        });
    });

    describe("finalizers", () => {
        describe("count", () => {
            it("should count items", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.count();
                expect(result).toBe(3);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = await new AsyncArrayStream([
                    1, 2, 3,
                ]).count();
                assertType<number>(breakerStream);
                expect(breakerStream).toEqual(3);

                const ignorerStream = await new AsyncArrayStream(
                    [1, 2, 3],
                    new Ignorer()
                ).count();
                assertType<number>(ignorerStream);
                expect(ignorerStream).toEqual(3);

                const settlerStream = await new AsyncArrayStream(
                    [1, 2, 3],
                    new Settler()
                ).count();
                assertType<SettlerOutput<number>>(settlerStream);
                expect(settlerStream).toEqual({ data: 3, errors: [] });
            });
        });

        describe("nth", () => {
            it("should find nth item", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.nth(1);
                expect(result).toBe(2);
            });

            it("should return null if the iterator is exhausted before getting to the nth item", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.nth(3);
                expect(result).toBe(null);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const breakerStream = await new AsyncArrayStream([1, 2, 3]).nth(
                    2
                );
                assertType<number | null>(breakerStream);
                expect(breakerStream).toEqual(3);

                const ignorerStream = await new AsyncArrayStream(
                    [1, 2, 3],
                    new Ignorer()
                ).nth(2);
                assertType<number | null>(ignorerStream);
                expect(ignorerStream).toEqual(3);

                const settlerStream = await new AsyncArrayStream(
                    [1, 2, 3],
                    new Settler()
                ).nth(2);
                assertType<SettlerOutput<number | null>>(settlerStream);
                expect(settlerStream).toEqual({ data: 3, errors: [] });
            });
        });

        describe("reduce", () => {
            it("should reduce the items using the deisgnated reducer", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.reduce(
                    async (acc, x) => acc + x,
                    0
                );
                expect(result).toBe(6);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const stream = await new AsyncArrayStream(["a", "b", "c"])
                    .map((x) => ({ x }))
                    .reduce(
                        (acc, next) => {
                            acc.x += next.x;
                            return acc;
                        },
                        { x: "" }
                    );
                assertType<{ x: string }>(stream);
                expect(stream).toEqual({ x: "abc" });

                const stream2 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Ignorer()
                ).reduce((acc, next) => acc + next, "");
                assertType<string>(stream2);
                expect(stream2).toEqual("abc");

                const stream3 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Settler()
                ).reduce((acc, next) => acc + next, "");
                assertType<{ data: string; errors: string[] }>(stream3);
                expect(stream3).toEqual({
                    data: "abc",
                    errors: [],
                });
            });
        });

        describe("reduceRight", () => {
            it("should reduce items starting from the end of the iterator", async () => {
                const input = ["a", "b", "c"];
                const stream = new AsyncArrayStream(input);
                const result = await stream.reduceRight(
                    async (acc, x) => acc + x,
                    ""
                );
                expect(result).toBe("cba");
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const stream = await new AsyncArrayStream(["a", "b", "c"])
                    .map((x) => ({ x }))
                    .reduceRight(
                        (acc, next) => {
                            acc.x += next.x;
                            return acc;
                        },
                        { x: "" }
                    );
                assertType<{ x: string }>(stream);
                expect(stream).toEqual({ x: "cba" });

                const stream2 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Ignorer()
                ).reduceRight((acc, next) => acc + next, "");
                assertType<string>(stream2);
                expect(stream2).toEqual("cba");

                const stream3 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Settler()
                ).reduceRight((acc, next) => acc + next, "");
                assertType<{ data: string; errors: string[] }>(stream3);
                expect(stream3).toEqual({
                    data: "cba",
                    errors: [],
                });
            });
        });

        describe("flat", () => {
            it("should flatten the items to the designated depth", async () => {
                const input = [
                    [1, 2],
                    [3, [4, 5]],
                    [6, [7, [8, 9]]],
                ];
                const stream = new AsyncArrayStream(input);
                const result = await stream.flat(2);
                expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, [8, 9]]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const arr = [1, [2, [3, 4, 5, 6, 7, 8, 9]]];
                const stream = await new AsyncArrayStream(arr).flat();
                assertType<FlatArray<typeof arr, 1>[]>(stream);
                expect(stream).toEqual([1, 2, [3, 4, 5, 6, 7, 8, 9]]);

                const stream2 = await new AsyncArrayStream(
                    arr,
                    new Ignorer()
                ).flat();
                assertType<FlatArray<typeof arr, 1>[]>(stream2);
                expect(stream2).toEqual([1, 2, [3, 4, 5, 6, 7, 8, 9]]);

                const stream3 = await new AsyncArrayStream(
                    arr,
                    new Settler()
                ).flat();
                assertType<{
                    data: FlatArray<typeof arr, 1>[];
                    errors: string[];
                }>(stream3);
                expect(stream3).toEqual({
                    data: [1, 2, [3, 4, 5, 6, 7, 8, 9]],
                    errors: [],
                });
            });
        });

        describe("any", () => {
            it("should check if any item matches", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.any(async (x) => x > 2);
                expect(result).toBe(true);
            });

            it("should only test items until the first item that matches", async () => {
                const input = [1, 2, 3, 4, 5];
                const spy = vi.fn();
                const stream = new AsyncArrayStream(input);
                const result = await stream
                    .forEach(spy)
                    .any(async (x) => x === 2);
                expect(result).toBe(true);
                expect(spy).toHaveBeenCalledTimes(2);

                expect(spy).toHaveBeenCalledWith(1);
                expect(spy).toHaveBeenCalledWith(2);
            });

            it("should return the correct type based on the error handler", async () => {
                const stream = await new AsyncArrayStream([
                    1, 2, 3, 4, 5, 6, 7, 8, 9,
                ])
                    .map((x) => ({ x }))
                    .any((x) => x.x % 2 === 0);
                assertType<boolean>(stream);
                expect(stream).toEqual(true);

                const stream2 = await new AsyncArrayStream(
                    [1, 2, 3, 4, 5, 6, 7, 8, 9],
                    new Ignorer()
                ).any((x) => x % 2 === 0);
                assertType<boolean>(stream2);
                expect(stream2).toEqual(true);

                const stream3 = await new AsyncArrayStream(
                    [1, 2, 3, 4, 5, 6, 7, 8, 9],
                    new Settler()
                ).any((x) => x % 2 === 0);
                assertType<{ data: boolean; errors: string[] }>(stream3);
                expect(stream3).toEqual({
                    data: true,
                    errors: [],
                });
            });
        });

        describe("all", () => {
            it("should check if all items match", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.all(async (x) => x > 0);
                expect(result).toBe(true);
            });

            it("should only test items until the first item that does not match", async () => {
                const input = [1, 2, 3, 4, 5];
                const spy = vi.fn();
                const stream = new AsyncArrayStream(input);
                const result = await stream
                    .forEach(spy)
                    .all(async (x) => x < 2);
                expect(result).toBe(false);
                expect(spy).toHaveBeenCalledTimes(2);

                expect(spy).toHaveBeenCalledWith(1);
                expect(spy).toHaveBeenCalledWith(2);
            });

            it("should return the correct type based on the error handler", async () => {
                const stream = await new AsyncArrayStream([
                    1, 2, 3, 4, 5, 6, 7, 8, 9,
                ])
                    .map((x) => ({ x }))
                    .all((x) => x.x % 2 === 0);
                assertType<boolean>(stream);
                expect(stream).toEqual(false);

                const stream2 = await new AsyncArrayStream(
                    [1, 2, 3, 4, 5, 6, 7, 8, 9],
                    new Ignorer()
                ).all((x) => x % 2 === 0);
                assertType<boolean>(stream2);
                expect(stream2).toEqual(false);

                const stream3 = await new AsyncArrayStream(
                    [1, 2, 3, 4, 5, 6, 7, 8, 9],
                    new Settler()
                ).all((x) => x % 2 === 0);
                assertType<{ data: boolean; errors: string[] }>(stream3);
                expect(stream3).toEqual({
                    data: false,
                    errors: [],
                });
            });
        });

        describe("find", () => {
            it("should find an item", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.find(async (x) => x === 2);
                expect(result).toBe(2);
            });

            it("should return null if the item is not found", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.find(async (x) => x === 4);
                expect(result).toBe(null);
            });

            it("should only test items until the first item that matches", async () => {
                const input = [1, 2, 3, 4, 5];
                const spy = vi.fn();
                const stream = new AsyncArrayStream(input);
                const result = await stream
                    .forEach(spy)
                    .find(async (x) => x === 2);
                expect(result).toBe(2);
                expect(spy).toHaveBeenCalledTimes(2);

                expect(spy).toHaveBeenCalledWith(1);
                expect(spy).toHaveBeenCalledWith(2);
            });

            it("should return the correct type based on the error handler", async () => {
                const stream = await new AsyncArrayStream(["a", "b", "c"])
                    .map((x) => ({ x }))
                    .find((x) => x.x === "b");
                assertType<{ x: string } | null>(stream);
                expect(stream).toEqual({ x: "b" });

                const stream2 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Ignorer()
                ).find((x) => x === "b");
                assertType<string | null>(stream2);
                expect(stream2).toEqual("b");

                const stream3 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Settler()
                ).find((x) => x === "b");
                assertType<{ data: string | null; errors: string[] }>(stream3);
                expect(stream3).toEqual({
                    data: "b",
                    errors: [],
                });
            });
        });

        describe("findIndex", () => {
            it("should find the index of an item", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.findIndex(async (x) => x === 2);
                expect(result).toBe(1);
            });

            it("should return -1 if the item is not found", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.findIndex(async (x) => x === 4);
                expect(result).toBe(-1);
            });

            it("should only test items until the first item that matches", async () => {
                const input = [1, 2, 3, 4, 5];
                const spy = vi.fn();
                const stream = new AsyncArrayStream(input);
                const result = await stream
                    .forEach(spy)
                    .findIndex(async (x) => x === 2);
                expect(result).toBe(1);
                expect(spy).toHaveBeenCalledTimes(2);

                expect(spy).toHaveBeenCalledWith(1);
                expect(spy).toHaveBeenCalledWith(2);
            });
        });

        describe("findLast", () => {
            it("should find the item starting from the end", async () => {
                const input = [1, 2, 3, 4];
                const spy = vi.fn();
                const stream = new AsyncArrayStream(input);
                const result = await stream.findLast(async (x) => {
                    spy(x);
                    return x === 3;
                });

                expect(result).toEqual(3);
                expect(spy).toHaveBeenCalledTimes(2);
                expect(spy).toHaveBeenCalledWith(4);
                expect(spy).toHaveBeenCalledWith(3);
            });

            it("should return null if the item is not found", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.findLast(async (x) => x === 4);
                expect(result).toBe(null);
            });

            it("should only test items until the first item that matches", async () => {
                const input = [1, 2, 3, 4, 5];
                const findLastSpy = vi.fn();
                const stream = new AsyncArrayStream(input);
                const result = await stream.findLast(async (x) => {
                    findLastSpy(x);
                    return x === 4;
                });
                expect(result).toBe(4);
                expect(findLastSpy).toHaveBeenCalledTimes(2);

                expect(findLastSpy).toHaveBeenCalledWith(5);
                expect(findLastSpy).toHaveBeenCalledWith(4);
            });

            it("should return the correct type based on the error handler", async () => {
                const stream = await new AsyncArrayStream(["a", "b", "c"])
                    .map((x) => ({ x }))
                    .findLast((x) => x.x === "b");
                assertType<{ x: string } | null>(stream);
                expect(stream).toEqual({ x: "b" });

                const stream2 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Ignorer()
                ).findLast((x) => x === "b");
                assertType<string | null>(stream2);
                expect(stream2).toEqual("b");

                const stream3 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Settler()
                ).findLast((x) => x === "b");
                assertType<{ data: string | null; errors: string[] }>(stream3);
                expect(stream3).toEqual({
                    data: "b",
                    errors: [],
                });
            });
        });

        describe("findLastIndex", () => {
            it("should find the index of the item starting from the last index in the array", async () => {
                const input = [1, 2, 3, 2];
                const stream = new AsyncArrayStream(input);
                const result = await stream.findLastIndex(async (x) => x === 2);
                expect(result).toBe(3);
            });

            it("should return -1 if the item is not found", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.findLastIndex(async (x) => x === 4);
                expect(result).toBe(-1);
            });

            it("should only test items until the first item that matches", async () => {
                const input = [1, 2, 3, 4, 5];
                const findLastIndexSpy = vi.fn();
                const stream = new AsyncArrayStream(input);
                const result = await stream.findLastIndex(async (x) => {
                    findLastIndexSpy(x);
                    return x === 4;
                });
                expect(result).toBe(3);
                expect(findLastIndexSpy).toHaveBeenCalledTimes(2);

                expect(findLastIndexSpy).toHaveBeenCalledWith(5);
                expect(findLastIndexSpy).toHaveBeenCalledWith(4);
            });

            it("should return the correct type based on the error handler", async () => {
                const stream = await new AsyncArrayStream(["a", "b", "c"])
                    .map((x) => ({ x }))
                    .findLastIndex((x) => x.x === "b");
                assertType<number>(stream);
                expect(stream).toEqual(1);

                const stream2 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Ignorer()
                ).findLastIndex((x) => x === "b");
                assertType<number>(stream2);
                expect(stream2).toEqual(1);

                const stream3 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Settler()
                ).findLastIndex((x) => x === "b");
                assertType<{ data: number; errors: string[] }>(stream3);
                expect(stream3).toEqual({
                    data: 1,
                    errors: [],
                });
            });
        });

        describe("includes", () => {
            it("should return true if the item is found in the yielded items", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.includes(2);
                expect(result).toBe(true);
            });

            it("should return false if the item is not found in yielded items", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.includes(4);
                expect(result).toBe(false);
            });

            it("should return the correct type based on the error handler", async () => {
                const stream = await new AsyncArrayStream(["a", "b", "c"])
                    .map((x) => x.charCodeAt(0))
                    .includes("b".charCodeAt(0));
                assertType<boolean>(stream);
                expect(stream).toEqual(true);

                const stream2 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Ignorer()
                ).includes("b");
                assertType<boolean>(stream2);
                expect(stream2).toEqual(true);

                const stream3 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Settler()
                ).includes("b");
                assertType<{ data: boolean; errors: string[] }>(stream3);
                expect(stream3).toEqual({
                    data: true,
                    errors: [],
                });
            });
        });

        describe("partition", () => {
            it("should exhaust the iterator and partition items to the left if the function returns true and to the right if the funciton returns false", async () => {
                const input = [1, 2, 3, 4];
                const stream = new AsyncArrayStream(input);
                const [left, right] = await stream.partition(
                    (x) => x % 2 === 0
                );
                expect(left).toEqual([2, 4]);
                expect(right).toEqual([1, 3]);

                const rest = await stream.collect();
                expect(rest).toEqual([]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const stream = await new AsyncArrayStream([
                    1, 2, 3, 4, 5, 6, 7, 8, 9,
                ])
                    .map((x) => ({ x }))
                    .partition((x) => x.x % 2 === 0);
                assertType<[{ x: number }[], { x: number }[]]>(stream);
                expect(stream).toEqual([
                    [{ x: 2 }, { x: 4 }, { x: 6 }, { x: 8 }],
                    [{ x: 1 }, { x: 3 }, { x: 5 }, { x: 7 }, { x: 9 }],
                ]);

                const stream2 = await new AsyncArrayStream(
                    [1, 2, 3, 4, 5, 6, 7, 8, 9],
                    new Ignorer()
                ).partition((x) => x % 2 === 0);
                assertType<[number[], number[]]>(stream2);
                expect(stream2).toEqual([
                    [2, 4, 6, 8],
                    [1, 3, 5, 7, 9],
                ]);

                const stream3 = await new AsyncArrayStream(
                    [1, 2, 3, 4, 5, 6, 7, 8, 9],
                    new Settler()
                ).partition((x) => x % 2 === 0);
                assertType<{ data: [number[], number[]]; errors: string[] }>(
                    stream3
                );
                expect(stream3).toEqual({
                    data: [
                        [2, 4, 6, 8],
                        [1, 3, 5, 7, 9],
                    ],
                    errors: [],
                });
            });
        });

        describe("collect", () => {
            it("should exhaust the iterator collect items into an array", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.collect();
                expect(result).toEqual([1, 2, 3]);

                const rest = await stream.collect();
                expect(rest).toEqual([]);
            });

            it("should correctly change the type of the stream based on the error handler", async () => {
                const stream = await new AsyncArrayStream(["a", "b", "c"])
                    .map((x) => ({ x }))
                    .collect();
                assertType<{ x: string }[]>(stream);
                expect(stream).toEqual([{ x: "a" }, { x: "b" }, { x: "c" }]);

                const stream2 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Ignorer()
                ).collect();
                assertType<string[]>(stream2);
                expect(stream2).toEqual(["a", "b", "c"]);

                const stream3 = await new AsyncArrayStream(
                    ["a", "b", "c"],
                    new Settler()
                ).collect();
                assertType<{ data: string[]; errors: string[] }>(stream3);
                expect(stream3).toEqual({
                    data: ["a", "b", "c"],
                    errors: [],
                });
            });
        });
    });

    describe("next", () => {
        it("should yield the next item in the iterator", async () => {
            const input = [1, 2, 3];
            const stream = new AsyncArrayStream(input);

            let result = await stream.read().next();
            expect(result).toEqual({ done: false, value: 1 });

            result = await stream.read().next();
            expect(result).toEqual({ done: false, value: 2 });

            result = await stream.read().next();
            expect(result).toEqual({ done: false, value: 3 });

            result = await stream.read().next();
            expect(result).toEqual({ done: true, value: undefined });
        });
    });

    it("should be able to process a promise generator that exhausts when it returns null or a promise that resolves to null", async () => {
        type MockResponse = { ok: boolean; resp?: string };
        const spy = vi.fn();
        spy.mockResolvedValueOnce({ ok: true, resp: "First response" });
        spy.mockResolvedValueOnce({ ok: true, resp: "Second response" });
        spy.mockResolvedValueOnce(null);

        const mapper = (x: MockResponse) =>
            Promise.resolve(x.resp ?? "No response");
        const stream = new AsyncArrayStream<MockResponse>({
            promise: spy,
        }).map(mapper);

        const result = await stream.collect();
        expect(result).toEqual(["First response", "Second response"]);
    });

    it("should be able to process multiple ops from an infinite generator", async () => {
        async function* gen() {
            let i = 0;
            while (true) {
                yield i++;
            }
        }

        const got = await new AsyncArrayStream(gen())
            // 2, 4, 6, 8, ...
            .map(async (x) => x * 2)
            // 6, 12, 18, 24, ...
            .filter(async (x) => x % 3 === 0)
            // [0, 0], [1, 6], [2, 12], [3, 18], ...
            .enumerate()
            // [3, 18], [4, 24], ...
            .skip(3)
            // [3, 18], [4, 24], [5, 30], [6, 36], [7, 42]
            .take(5)
            // [3, 18, 4, 24, 5, 30, 6, 36, 7, 42]
            .flatMap(async ([x, y]) => [x, y])
            .collect();

        expect(got).toEqual([3, 18, 4, 24, 5, 30, 6, 36, 7, 42]);
    });

    describe("error handling", () => {
        it("should rethrow the errors with more context if errors arise during iteration and the handler is Breaker", async () => {
            async function* gen() {
                yield 1;
                yield 2;
                throw new Error("Error");
            }

            const stream = new AsyncArrayStream(gen(), new Breaker());
            const iter = stream.read();
            await expect(async () => {
                await iter.next();
                await iter.next();
                await iter.next();
            }).rejects.toThrowError(
                "Error occurred at item at index 2 in iterator: Error"
            );
        });

        it("should rethrow the errors with more context if errors arise during operations and the handler is Breaker", async () => {
            const stream = new AsyncArrayStream([1, 2, 3], new Breaker()).map(
                (x) => {
                    if (x === 2) {
                        throw new Error("Error");
                    }
                    return x;
                }
            );

            const iter = stream.read();
            await expect(async () => {
                await iter.next();
                await iter.next();
                await iter.next();
            }).rejects.toThrowError(
                "Error occurred at item at index 1 in iterator: Error occurred while performing map on 2 at index 1 in iterator: Error"
            );
        });

        it("should ignore the errors if the handler is Ignorer", async () => {
            async function* gen() {
                yield 1;
                yield 2;
                throw new Error("Error");
            }

            const stream = new AsyncArrayStream(gen(), new Ignorer());
            const iter = stream.read();

            await iter.next();
            await iter.next();
            await iter.next();

            const stream2 = new AsyncArrayStream([1, 2, 3], new Ignorer()).map(
                () => {
                    throw new Error("Surprise!");
                }
            );
            await stream2.collect();
        });

        it("should collect the errors during iteration if the handler is Settler", async () => {
            async function* gen() {
                yield 1;
                yield 2;
                throw new Error("Cycle Error");
            }

            const settler = new Settler();
            const stream = new AsyncArrayStream(gen(), settler).map((x) => {
                if (x === 2) {
                    throw new Error("Op Error");
                }
                return x * 2;
            });
            const data = await stream.collect();
            expect(settler.errors).toEqual([
                "Error occurred while performing map on 2 at index 1 in iterator: Op Error",
                "Error occurred at item at index 2 in iterator: Cycle Error",
            ]);

            expect(data).toEqual({
                data: [2],
                errors: [
                    "Error occurred while performing map on 2 at index 1 in iterator: Op Error",
                    "Error occurred at item at index 2 in iterator: Cycle Error",
                ],
            });
        });
    });
});
