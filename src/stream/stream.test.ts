import { expect, describe, assertType, it } from "vitest";

import { ArrayStream } from "./stream";
import { Breaker, Ignorer, Settler } from "../errors/handlers";

describe("ArrayStream", () => {
    // Test functions using both the iterator helpers and the default iteration methods
    function makeArrayArrayStreams<T>(
        items: T[]
    ): ArrayStream<T, Breaker<T>>[] {
        return [
            new ArrayStream(items, new Breaker(), {
                useIteratorHelpersIfAvailable: true,
            }),
            new ArrayStream(items, new Breaker(), {
                useIteratorHelpersIfAvailable: false,
            }),
        ];
    }

    function makeGeneratorArrayStreams<T>(
        gen: () => IterableIterator<T>
    ): ArrayStream<T, Breaker<T>>[] {
        return [
            new ArrayStream(gen(), new Breaker(), {
                useIteratorHelpersIfAvailable: true,
            }),
            new ArrayStream(gen(), new Breaker(), {
                useIteratorHelpersIfAvailable: false,
            }),
        ];
    }

    // Operations
    describe("foreach", () => {
        it("should call the function for each item in the stream", () => {
            for (const stream of makeArrayArrayStreams([1, 2, 3])) {
                let i = 0;
                const got = stream
                    .forEach(() => {
                        i++;
                    })
                    .collect();

                expect(i).toEqual(3);
                expect(got).toEqual([1, 2, 3]);
            }
        });
    });

    describe("inspect", () => {
        it("should call the function for each item in the stream", () => {
            for (const stream of makeArrayArrayStreams([1, 2, 3])) {
                let i = 0;
                const got = stream
                    .inspect(() => {
                        i++;
                    })
                    .collect();

                expect(i).toEqual(3);
                expect(got).toEqual([1, 2, 3]);
            }
        });
    });

    describe("map", () => {
        it("should correctly change the type of the array stream", () => {
            const stream1 = new ArrayStream([1, 2, 3]);
            assertType<ArrayStream<number, Breaker<number>>>(stream1);

            const mappedStream1 = stream1.map((x) => x.toString());
            assertType<ArrayStream<string, Breaker<string>>>(mappedStream1);

            const stream2 = new ArrayStream([1, 2, 3], new Ignorer());
            assertType<ArrayStream<number, Ignorer>>(stream2);

            const mappedStream2 = stream2.map((x) => ({ [x]: x }));
            assertType<ArrayStream<Record<number, number>, Ignorer>>(
                mappedStream2
            );

            const stream3 = new ArrayStream([1, 2, 3], new Settler());
            assertType<ArrayStream<number, Settler<number>>>(stream3);

            const mappedStream3 = stream3.map((x) => [x.toString()]);
            assertType<ArrayStream<string[], Settler<string[]>>>(mappedStream3);
        });
    });

    describe("filterMap", () => {
        it("should filter out items that return null, false, or undefined and transform the others", () => {
            for (const stream of makeArrayArrayStreams([1, 2, 3, 4, 5, 6])) {
                const got = stream
                    .filterMap((x) => (x % 2 === 0 ? x * 2 : null))
                    .collect();

                expect(got).toEqual([4, 8, 12]);
            }
        });

        it("should correctly change the type of the array stream", () => {
            const stream1 = new ArrayStream([1, 2, 3]);
            assertType<ArrayStream<number, Breaker<number>>>(stream1);

            const mappedStream1 = stream1.filterMap((x) => x.toString());
            assertType<ArrayStream<string, Breaker<string>>>(mappedStream1);

            const stream2 = new ArrayStream([1, 2, 3], new Ignorer());
            assertType<ArrayStream<number, Ignorer>>(stream2);

            const mappedStream2 = stream2.filterMap((x) => ({ [x]: x }));
            assertType<ArrayStream<Record<number, number>, Ignorer>>(
                mappedStream2
            );

            const stream3 = new ArrayStream([1, 2, 3], new Settler());
            assertType<ArrayStream<number, Settler<number>>>(stream3);

            const mappedStream3 = stream3.filterMap((x) => [x.toString()]);
            assertType<ArrayStream<string[], Settler<string[]>>>(mappedStream3);
        });
    });

    // Iterator adapters

    describe("stepBy", () => {
        it("should return every nth item", () => {
            const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
                .stepBy(3)
                .collect();

            expect(got).toEqual([1, 4, 7, 10]);
        });

        it("should respect other operations", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
            ])) {
                const got = stream
                    // 2, 4, 6, 8, 10, 12, 14, 16
                    .filter((x) => x % 2 === 0)
                    // 2, 6, 10, 14
                    .stepBy(2)
                    // 2, 6
                    .take(2)
                    .collect();

                expect(got).toEqual([2, 6]);
            }
        });

        it("should return the correct type based on the error handler", () => {
            const stream1 = new ArrayStream([1, 2, 3]).stepBy(2);
            assertType<ArrayStream<number, Breaker<number>>>(stream1);

            const stream2 = new ArrayStream([1, 2, 3], new Ignorer()).stepBy(2);
            assertType<ArrayStream<number, Ignorer>>(stream2);

            const stream3 = new ArrayStream([1, 2, 3], new Settler()).stepBy(2);
            assertType<ArrayStream<number, Settler<number>>>(stream3);
        });
    });

    describe("skip", () => {
        it("should skip the next n items of the array", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
            ])) {
                const got = stream.skip(3).collect();
                expect(got).toEqual([4, 5, 6, 7, 8, 9, 10]);
            }
        });

        it("should be able to work with other operations", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
                19, 20, 21, 22,
            ])) {
                const got = stream
                    // 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22
                    .filter((x) => x % 2 === 0)
                    // 2, 6, 10, 14, 18, 22
                    .stepBy(2)
                    // 14, 18, 22
                    .skip(3)
                    // 18, 22
                    .take(2)
                    .map((x) => ({ x }))
                    .collect();

                expect(got).toEqual([{ x: 14 }, { x: 18 }]);
            }
        });

        it("should return the correct type based on the error handler", () => {
            const stream1 = new ArrayStream([1, 2, 3]).skip(2);
            assertType<ArrayStream<number, Breaker<number>>>(stream1);

            const stream2 = new ArrayStream([1, 2, 3], new Ignorer()).skip(2);
            assertType<ArrayStream<number, Ignorer>>(stream2);

            const stream3 = new ArrayStream([1, 2, 3], new Settler()).skip(2);
            assertType<ArrayStream<number, Settler<number>>>(stream3);
        });

        it("should return the same values as drop", () => {
            function* gen() {
                yield 1;
                yield 2;
                yield 3;
            }

            const streamDrop = new ArrayStream(gen()).drop(2);
            const streamSkip = new ArrayStream(gen()).skip(2);

            expect(streamSkip).toEqual(streamDrop);
        });
    });

    describe("take", () => {
        it("should return only as many items as designated", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
            ])) {
                const got = stream.take(3).collect();
                expect(got).toEqual([1, 2, 3]);
            }
        });

        it("should return all items if the limit is higher than the number of items", () => {
            for (const stream of makeArrayArrayStreams([1, 2])) {
                const got = stream.take(3).collect();
                expect(got).toEqual([1, 2]);
            }
        });

        it("should take 0 items if the limit is 0", () => {
            for (const stream of makeArrayArrayStreams([1, 2, 3])) {
                const got = stream.take(0).collect();
                expect(got).toEqual([]);
            }
        });

        it("should respect filters that have been previously applied in counting the items to take", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
            ])) {
                const got = stream
                    .filter((x) => x % 2 === 0)
                    .take(3)
                    .collect();
                expect(got).toEqual([2, 4, 6]);
            }
        });

        it("should take a fixed number of items from a generator that will generate infinite items", () => {
            function* generate() {
                let i = 0;
                while (true) {
                    yield i++;
                }
            }

            for (const stream of makeGeneratorArrayStreams(generate)) {
                const got = stream.take(5).collect();
                expect(got).toEqual([0, 1, 2, 3, 4]);
            }
        });

        it("should continue to perform operations as expected after the limit has been reached", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
            ])) {
                const got = stream
                    .filter((x) => x % 2 === 0)
                    .take(5)
                    .map((x) => ({ value: x * 2 }))
                    .take(3)
                    .collect();
                expect(got).toEqual([
                    { value: 4 },
                    { value: 8 },
                    { value: 12 },
                ]);
            }
        });

        it("should return the correct type based on the error handler", () => {
            const stream1 = new ArrayStream([1, 2, 3]).take(2);
            assertType<ArrayStream<number, Breaker<number>>>(stream1);

            const stream2 = new ArrayStream([1, 2, 3], new Ignorer()).take(2);
            assertType<ArrayStream<number, Ignorer>>(stream2);

            const stream3 = new ArrayStream([1, 2, 3], new Settler()).take(2);
            assertType<ArrayStream<number, Settler<number>>>(stream3);
        });
    });

    describe("chain", () => {
        it("should append one stream to the end of the other", () => {
            const got = new ArrayStream([1, 2, 3]).chain([4, 5, 6]).collect();
            expect(got).toEqual([1, 2, 3, 4, 5, 6]);
        });

        it("should work with other operations", () => {
            for (const stream of makeArrayArrayStreams([1, 2, 3])) {
                const got = stream
                    .filter((x) => x % 2 === 0)
                    .chain([4, 5, 6])
                    .collect();

                expect(got).toEqual([2, 4, 5, 6]);
            }
        });

        it("should return the correct type based on the error handler", () => {
            const stream1 = new ArrayStream([1, 2, 3]).chain(["a", "b", "c"]);
            assertType<ArrayStream<number | string, Breaker<number | string>>>(
                stream1
            );

            const stream2 = new ArrayStream([1, 2, 3], new Ignorer()).chain([
                "a",
                "b",
                "c",
            ]);
            assertType<ArrayStream<number | string, Ignorer>>(stream2);

            const stream3 = new ArrayStream([1, 2, 3], new Settler()).chain([
                "a",
                "b",
                "c",
            ]);
            assertType<ArrayStream<number | string, Settler<number | string>>>(
                stream3
            );
        });
    });

    describe("zip", () => {
        it("should combine two streams into a single stream of tuples", () => {
            const got = new ArrayStream([1, 2, 3]).zip([4, 5, 6]).collect();

            expect(got).toEqual([
                [1, 4],
                [2, 5],
                [3, 6],
            ]);
        });

        it("should work with other operations", () => {
            for (const stream of makeArrayArrayStreams([1, 2, 3])) {
                const got = stream
                    .map((x) => ({ x }))
                    .zip([4, 5, 6])
                    .collect();

                expect(got).toEqual([
                    [{ x: 1 }, 4],
                    [{ x: 2 }, 5],
                    [{ x: 3 }, 6],
                ]);
            }
        });

        it("should stop when the initial stream ends", () => {
            for (const stream of makeArrayArrayStreams([1, 2, 3])) {
                const got = stream
                    .filter((x) => x % 2 === 0)
                    .zip([4, 5, 6])
                    .collect();

                expect(got).toEqual([[2, 4]]);
            }
        });

        it("should stop when the new stream ends", () => {
            const got = new ArrayStream([1, 2, 3]).zip([4, 5]).collect();
            expect(got).toEqual([
                [1, 4],
                [2, 5],
            ]);
        });

        it("should work with infinite generators", () => {
            function* generate() {
                let i = 0;
                while (true) {
                    yield i++;
                }
            }

            const got = new ArrayStream([1, 2, 3]).zip(generate()).collect();
            expect(got).toEqual([
                [1, 0],
                [2, 1],
                [3, 2],
            ]);
        });

        it("should return the correct type based on the error handler", () => {
            const stream1 = new ArrayStream([1, 2, 3]).zip(["a", "b", "c"]);
            assertType<
                ArrayStream<[number, string], Breaker<[number, string]>>
            >(stream1);

            const stream2 = new ArrayStream([1, 2, 3], new Ignorer()).zip([
                "a",
                "b",
                "c",
            ]);
            assertType<ArrayStream<[number, string], Ignorer>>(stream2);

            const stream3 = new ArrayStream([1, 2, 3], new Settler()).zip([
                "a",
                "b",
                "c",
            ]);
            assertType<
                ArrayStream<[number, string], Settler<[number, string]>>
            >(stream3);
        });
    });

    describe("intersperse", () => {
        it("should intersperse a value between each item if it is not a function", () => {
            const got = new ArrayStream([1, 2, 3]).intersperse(0).collect();
            expect(got).toEqual([1, 0, 2, 0, 3]);
        });

        it("should call the function and intersperse it between each item if it is a function", () => {
            let i = 0;
            const got = new ArrayStream([1, 2, 3])
                .intersperse(() => {
                    return i++;
                })
                .collect();

            expect(got).toEqual([1, 0, 2, 1, 3]);
            expect(i).toEqual(2);
        });

        it("should call the funciton with the iterated item if it is a function", () => {
            const got = new ArrayStream([1, 2, 3])
                .intersperse((x) => x + 100)
                .collect();

            expect(got).toEqual([1, 101, 2, 102, 3]);
        });

        it("should work correctly with other operations", () => {
            for (const stream of makeArrayArrayStreams([1, 2, 3, 4])) {
                const got = stream
                    .filter((x) => x % 2 === 0)
                    .intersperse(0)
                    .collect();

                expect(got).toEqual([2, 0, 4]);
            }
        });

        it("should work with infinite generators", () => {
            function* generate() {
                let i = 0;
                while (true) {
                    yield i++;
                }
            }

            for (const stream of makeGeneratorArrayStreams(generate)) {
                const got = stream.intersperse(100).take(5).collect();
                expect(got).toEqual([0, 100, 1, 100, 2]);
            }
        });

        it("should return the correct type based on the error handler", () => {
            const stream1 = new ArrayStream([1, 2, 3]).intersperse(() => "a");
            assertType<ArrayStream<number | string, Breaker<number | string>>>(
                stream1
            );

            const stream2 = new ArrayStream(
                [1, 2, 3],
                new Ignorer()
            ).intersperse(() => "a");
            assertType<ArrayStream<number | string, Ignorer>>(stream2);

            const stream3 = new ArrayStream(
                [1, 2, 3],
                new Settler()
            ).intersperse(() => "a");
            assertType<ArrayStream<number | string, Settler<number | string>>>(
                stream3
            );
        });
    });

    describe("enumerate", () => {
        it("should return a stream of tuples with the index and the item", () => {
            const got = new ArrayStream([100, 200, 300]).enumerate().collect();
            expect(got).toEqual([
                [0, 100],
                [1, 200],
                [2, 300],
            ]);
        });

        it("should work with other operations", () => {
            for (const stream of makeArrayArrayStreams([100, 200, 300])) {
                const got = stream
                    .filter((x) => x > 100)
                    .enumerate()
                    .collect();

                expect(got).toEqual([
                    [0, 200],
                    [1, 300],
                ]);
            }
        });

        it("should work with infinite streams before a take operation has been performed", () => {
            function* generate() {
                let i = 0;
                while (true) {
                    yield i++;
                }
            }

            for (const stream of makeGeneratorArrayStreams(generate)) {
                const got = stream.enumerate().take(3).collect();
                expect(got).toEqual([
                    [0, 0],
                    [1, 1],
                    [2, 2],
                ]);
            }
        });

        it("should return the correct type based on the error handler", () => {
            const stream1 = new ArrayStream(["a", "b", "c"]).enumerate();
            assertType<
                ArrayStream<[number, string], Breaker<[number, string]>>
            >(stream1);

            const stream2 = new ArrayStream(
                ["a", "b", "c"],
                new Ignorer()
            ).enumerate();
            assertType<ArrayStream<[number, string], Ignorer>>(stream2);

            const stream3 = new ArrayStream(
                ["a", "b", "c"],
                new Settler()
            ).enumerate();
            assertType<
                ArrayStream<[number, string], Settler<[number, string]>>
            >(stream3);
        });
    });

    describe("flatMap", () => {
        it("should take every item and apply the function to it, then flatten the results", () => {
            for (const stream of makeArrayArrayStreams([1, 2, 3])) {
                const got = stream.flatMap((x) => [x, x * 2]).collect();

                expect(got).toEqual([1, 2, 2, 4, 3, 6]);
            }
        });

        it("should work with other operators", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9,
            ])) {
                const got = stream
                    // 2, 4, 6, 8
                    .filter((x) => x % 2 === 0)
                    // 2, 102, 202, 4, 104, 204, 6, 106, 206, 8, 108, 208
                    .flatMap((x) => [x, x + 100, x + 200])
                    // 2, 102, 202, 4, 104
                    .take(5)
                    .collect();

                expect(got).toEqual([2, 102, 202, 4, 104]);
            }
        });

        it("should work with infinite streams", () => {
            function* generate() {
                let i = 0;
                while (true) {
                    yield i++;
                }
            }

            for (const stream of makeGeneratorArrayStreams(generate)) {
                const got = stream
                    .flatMap((x) => [x, x * 2])
                    .take(5)
                    .collect();

                expect(got).toEqual([0, 0, 1, 2, 2]);
            }
        });

        it("should return the correct type based on the error handler", () => {
            const stream1 = new ArrayStream([1, 2, 3]).flatMap((x) => [
                x,
                x + 100,
            ]);
            assertType<ArrayStream<number, Breaker<number>>>(stream1);

            const stream2 = new ArrayStream([1, 2, 3], new Ignorer()).flatMap(
                (x) => [x, x + 100]
            );
            assertType<ArrayStream<number, Ignorer>>(stream2);

            const stream3 = new ArrayStream([1, 2, 3], new Settler()).flatMap(
                (x) => [x, x + 100]
            );
            assertType<ArrayStream<number, Settler<number>>>(stream3);
        });
    });

    describe("fuse", () => {
        it("should create an iterator that ends after the first null or undefined", () => {
            const got = new ArrayStream([1, 2, 3, null, 4, 5, 6])
                .fuse()
                .collect();
            expect(got).toEqual([1, 2, 3]);
        });

        it("should work with other operations", () => {
            for (const stream of makeArrayArrayStreams([
                1,
                2,
                3,
                4,
                5,
                6,
                null,
                7,
                8,
                9,
            ])) {
                const got = stream
                    .filter((x) => (x === null ? true : x % 2 === 0))
                    .fuse()
                    .take(2)
                    .collect();

                expect(got).toEqual([2, 4]);
            }
        });

        it("should work with infinite generator", () => {
            function* generate() {
                let i = 0;
                while (true) {
                    yield i++;
                }
            }

            for (const stream of makeGeneratorArrayStreams(generate)) {
                const got = stream
                    .map((i) => (i == 3 ? null : i))
                    .fuse()
                    .collect();
                expect(got).toEqual([0, 1, 2]);
            }
        });

        it("should return the correct type based on the error handler", () => {
            const stream1 = new ArrayStream([1, 2, 3, null, 5]).fuse();
            assertType<
                ArrayStream<
                    Required<number | null>,
                    Breaker<Required<number | null>>
                >
            >(stream1);

            const stream2 = new ArrayStream(
                [1, 2, 3, null, 5],
                new Ignorer()
            ).fuse();
            assertType<ArrayStream<Required<number | null>, Ignorer>>(stream2);

            const stream3 = new ArrayStream(
                [1, 2, 3, null, 5],
                new Settler()
            ).fuse();
            assertType<
                ArrayStream<
                    Required<number | null>,
                    Settler<Required<number | null>>
                >
            >(stream3);
        });
    });

    // Finalizer
    describe("count", () => {
        it("should count the remaining items after all operations have been performed", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14,
            ])) {
                const got = stream
                    // 2, 4, 6, 8, 10, 12, 14
                    .filter((x) => x % 2 === 0)
                    // 2, 4, 6, 8, 10, 12
                    .take(6)
                    // 6, 12
                    .filter((x) => x % 3 === 0)
                    .count();

                expect(got).toEqual(2);
            }
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9])
                .map((x) => ({ x }))
                .count();
            assertType<number | null>(stream);
            expect(stream).toEqual(9);

            const stream2 = new ArrayStream(
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                new Ignorer()
            ).count();
            assertType<number | null>(stream2);
            expect(stream2).toEqual(9);

            const stream3 = new ArrayStream(
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                new Settler()
            ).count();
            assertType<{ data: number | null; errors: string[] }>(stream3);
            expect(stream3).toEqual({
                data: 9,
                errors: [],
            });
        });
    });

    describe("nth", () => {
        it("should return the nth item after all operations have been performed if it exists", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14,
            ])) {
                const got = stream
                    .filter((x) => x % 2 === 0)
                    .take(6)
                    .map((x) => ({ value: x * 2 }))
                    .nth(2);

                expect(got).not.toBeNull();
                expect(got).toEqual({ value: 12 });
            }
        });

        it("should return null if the nth item does not exist", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14,
            ])) {
                const got = stream
                    .filter((x) => x % 2 === 0)
                    .take(6)
                    .map((x) => ({ value: x * 2 }))
                    .nth(100);

                expect(got).toBeNull();
            }
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9])
                .map((x) => ({ x }))
                .nth(2);
            assertType<{ x: number } | null>(stream);
            expect(stream).toEqual({ x: 3 });

            const stream2 = new ArrayStream(
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                new Ignorer()
            ).nth(2);
            assertType<number | null>(stream2);
            expect(stream2).toEqual(3);

            const stream3 = new ArrayStream(
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                new Settler()
            ).nth(2);
            assertType<{ data: number | null; errors: string[] }>(stream3);
            expect(stream3).toEqual({
                data: 3,
                errors: [],
            });
        });
    });

    describe("flat", () => {
        it("should flatten the array to the specified depth", () => {
            const got = new ArrayStream([1, [2, [3, [4, 5]]]]).flat(2);
            expect(got).toEqual([1, 2, 3, [4, 5]]);
        });

        it("should have the correct return type depending on the error handler", () => {
            const arr = [1, [2, [3, 4, 5, 6, 7, 8, 9]]];
            const stream = new ArrayStream(arr).flat();
            assertType<FlatArray<typeof arr, 1>[]>(stream);
            expect(stream).toEqual([1, 2, [3, 4, 5, 6, 7, 8, 9]]);

            const stream2 = new ArrayStream(arr, new Ignorer()).flat();
            assertType<FlatArray<typeof arr, 1>[]>(stream2);
            expect(stream2).toEqual([1, 2, [3, 4, 5, 6, 7, 8, 9]]);

            const stream3 = new ArrayStream(arr, new Settler()).flat();
            assertType<{ data: FlatArray<typeof arr, 1>[]; errors: string[] }>(
                stream3
            );
            expect(stream3).toEqual({
                data: [1, 2, [3, 4, 5, 6, 7, 8, 9]],
                errors: [],
            });
        });
    });

    describe("partition", () => {
        it("should split the array into two based on the predicate", () => {
            const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9]).partition(
                (x) => x % 2 === 0
            );

            expect(got).toEqual([
                [2, 4, 6, 8],
                [1, 3, 5, 7, 9],
            ]);
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9])
                .map((x) => ({ x }))
                .partition((x) => x.x % 2 === 0);
            assertType<[{ x: number }[], { x: number }[]]>(stream);
            expect(stream).toEqual([
                [{ x: 2 }, { x: 4 }, { x: 6 }, { x: 8 }],
                [{ x: 1 }, { x: 3 }, { x: 5 }, { x: 7 }, { x: 9 }],
            ]);

            const stream2 = new ArrayStream(
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                new Ignorer()
            ).partition((x) => x % 2 === 0);
            assertType<[number[], number[]]>(stream2);
            expect(stream2).toEqual([
                [2, 4, 6, 8],
                [1, 3, 5, 7, 9],
            ]);

            const stream3 = new ArrayStream(
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

    describe("any", () => {
        it("should return true and exit early if the predicate is true for any item", () => {
            let i = 0;
            const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9])
                .map((x) => ({ x }))
                .any((x) => {
                    i++;
                    return x.x === 5;
                });

            expect(got).toBe(true);
            expect(i).toBe(5);
        });

        it("should return false if the predicate is false for all items", () => {
            let i = 0;
            const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9]).any(
                (x) => {
                    i++;
                    return x === -1;
                }
            );

            expect(got).toBe(false);
            expect(i).toBe(9);
        });

        it("should only exhaust until the needed item if they are not greedy", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9,
            ])) {
                const gotIndex = stream.any((x) => x === 5);
                const rest = stream.collect();

                // Iterator has exhausted up to 5 so it will then iterate through 6, 7, 8 then 9
                expect(gotIndex).toBe(true);
                expect(rest).toEqual([6, 7, 8, 9]);
            }
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9])
                .map((x) => ({ x }))
                .any((x) => x.x % 2 === 0);
            assertType<boolean>(stream);
            expect(stream).toEqual(true);

            const stream2 = new ArrayStream(
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                new Ignorer()
            ).any((x) => x % 2 === 0);
            assertType<boolean>(stream2);
            expect(stream2).toEqual(true);

            const stream3 = new ArrayStream(
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                new Settler()
            ).any((x) => x % 2 === 0);
            assertType<{ data: boolean; errors: string[] }>(stream3);
            expect(stream3).toEqual({
                data: true,
                errors: [],
            });
        });

        it("should return the same values as some", () => {
            function* gen() {
                yield 1;
                yield 2;
                yield 3;
            }

            const streamSome = new ArrayStream(gen()).some((x) => x > 4);
            const streamAny = new ArrayStream(gen()).any((x) => x > 4);

            expect(streamSome).toEqual(streamAny);
        });
    });

    describe("all", () => {
        it("should return true if the predicate is true for all items", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9,
            ])) {
                let i = 0;
                const got = stream.all((x) => {
                    i++;
                    return x > 0;
                });

                expect(got).toBe(true);
                expect(i).toBe(9);
            }
        });

        it("should return false and exit early if the predicate is false for any item", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9,
            ])) {
                let i = 0;
                const got = stream.all((x) => {
                    i++;
                    return x !== 5;
                });

                expect(got).toBe(false);
                expect(i).toBe(5);
            }
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9])
                .map((x) => ({ x }))
                .all((x) => x.x % 2 === 0);
            assertType<boolean>(stream);
            expect(stream).toEqual(false);

            const stream2 = new ArrayStream(
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                new Ignorer()
            ).all((x) => x % 2 === 0);
            assertType<boolean>(stream2);
            expect(stream2).toEqual(false);

            const stream3 = new ArrayStream(
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                new Settler()
            ).all((x) => x % 2 === 0);
            assertType<{ data: boolean; errors: string[] }>(stream3);
            expect(stream3).toEqual({
                data: false,
                errors: [],
            });
        });

        it("should return the same values as every", () => {
            function* gen() {
                yield 1;
                yield 2;
                yield 3;
            }

            const streamEvery = new ArrayStream(gen()).every((x) => x > 0);
            const streamAll = new ArrayStream(gen()).all((x) => x > 0);

            expect(streamEvery).toEqual(streamAll);
        });
    });

    describe("find", () => {
        it("should return the first item that matches the predicate", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9,
            ])) {
                let i = 0;
                const got = stream.find((x) => {
                    i++;
                    return x === 5;
                });

                expect(got).toBe(5);
                expect(i).toBe(5);
            }
        });

        it("should return null if no item matches the predicate", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9,
            ])) {
                let i = 0;
                const got = stream.find((x) => {
                    i++;
                    return x === -1;
                });

                expect(got).toBeNull();
                expect(i).toBe(9);
            }
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream(["a", "b", "c"])
                .map((x) => ({ x }))
                .find((x) => x.x === "b");
            assertType<{ x: string } | null>(stream);
            expect(stream).toEqual({ x: "b" });

            const stream2 = new ArrayStream(
                ["a", "b", "c"],
                new Ignorer()
            ).find((x) => x === "b");
            assertType<string | null>(stream2);
            expect(stream2).toEqual("b");

            const stream3 = new ArrayStream(
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
        it("should return the index of the first item that matches the predicate", () => {
            let i = 0;
            const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9]).findIndex(
                (x) => {
                    i++;
                    return x === 5;
                }
            );

            expect(got).toBe(4);
            expect(i).toBe(5);
        });

        it("should return -1 if no item matches the predicate", () => {
            let i = 0;
            const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9]).findIndex(
                (x) => {
                    i++;
                    return x === -1;
                }
            );

            expect(got).toBe(-1);
            expect(i).toBe(9);
        });

        it("should only exhaust until the needed item if they are not greedy", () => {
            const stream = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9]);

            const gotIndex = stream.findIndex((x) => x === 5);
            const rest = stream.collect();

            // Iterator has exhausted up to 5 so it will then iterate through 6, 7, 8 then 9
            expect(gotIndex).toEqual(4);
            expect(rest).toEqual([6, 7, 8, 9]);
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9])
                .map((x) => ({ x }))
                .findIndex((x) => x.x % 2 === 0);
            assertType<number>(stream);
            expect(stream).toEqual(1);

            const stream2 = new ArrayStream(
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                new Ignorer()
            ).findIndex((x) => x % 2 === 0);
            assertType<number>(stream2);
            expect(stream2).toEqual(1);

            const stream3 = new ArrayStream(
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                new Settler()
            ).findIndex((x) => x % 2 === 0);
            assertType<{ data: number; errors: string[] }>(stream3);
            expect(stream3).toEqual({
                data: 1,
                errors: [],
            });
        });
    });

    describe("findLast", () => {
        it("should return the last item that matches the predicate starting from the end", () => {
            let i = 0;
            const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9]).findLast(
                (x) => {
                    i++;
                    return x === 5;
                }
            );

            expect(got).toBe(5);
            expect(i).toBe(5);
        });

        it("should return null if no item matches the predicate", () => {
            let i = 0;
            const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9]).findLast(
                (x) => {
                    i++;
                    return x === -1;
                }
            );

            expect(got).toBeNull();
            expect(i).toBe(9);
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream(["a", "b", "c"])
                .map((x) => ({ x }))
                .findLast((x) => x.x === "b");
            assertType<{ x: string } | null>(stream);
            expect(stream).toEqual({ x: "b" });

            const stream2 = new ArrayStream(
                ["a", "b", "c"],
                new Ignorer()
            ).findLast((x) => x === "b");
            assertType<string | null>(stream2);
            expect(stream2).toEqual("b");

            const stream3 = new ArrayStream(
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
        it("should return the index of the last item that matches the predicate strting from the end", () => {
            let i = 0;
            const got = new ArrayStream([
                1, 2, 3, 4, 5, 6, 7, 8, 9,
            ]).findLastIndex((x) => {
                i++;
                return x === 5;
            });

            expect(got).toBe(4);
            expect(i).toBe(5);
        });

        it("should return -1 if no item matches the predicate", () => {
            let i = 0;
            const got = new ArrayStream([
                1, 2, 3, 4, 5, 6, 7, 8, 9,
            ]).findLastIndex((x) => {
                i++;
                return x === -1;
            });

            expect(got).toBe(-1);
            expect(i).toBe(9);
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream(["a", "b", "c"])
                .map((x) => ({ x }))
                .findLastIndex((x) => x.x === "b");
            assertType<number>(stream);
            expect(stream).toEqual(1);

            const stream2 = new ArrayStream(
                ["a", "b", "c"],
                new Ignorer()
            ).findLastIndex((x) => x === "b");
            assertType<number>(stream2);
            expect(stream2).toEqual(1);

            const stream3 = new ArrayStream(
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
        it("should return with the same shallow value as the predicate", () => {
            const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9]).includes(
                5
            );
            expect(got).toBe(true);
        });

        it("should return false if the value is not in the array", () => {
            const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9]).includes(
                -1
            );
            expect(got).toBe(false);
        });

        it("should not work for reference values", () => {
            const got = new ArrayStream([
                { a: 1 },
                { a: 2 },
                { a: 3 },
            ]).includes({
                a: 2,
            });
            expect(got).toBe(false);
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream(["a", "b", "c"])
                .map((x) => x.charCodeAt(0))
                .includes("b".charCodeAt(0));
            assertType<boolean>(stream);
            expect(stream).toEqual(true);

            const stream2 = new ArrayStream(
                ["a", "b", "c"],
                new Ignorer()
            ).includes("b");
            assertType<boolean>(stream2);
            expect(stream2).toEqual(true);

            const stream3 = new ArrayStream(
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

    describe("reduce", () => {
        it("should reduce the remaining items after all operations have been performed", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14,
            ])) {
                const got = stream
                    .map((x) => ({ value: x * 2 }))
                    .reduce(
                        (acc, next) => ({ total: next.value + acc.total }),
                        {
                            total: 0,
                        }
                    );

                expect(got).toEqual({ total: 162 });
            }
        });

        it("should take into account other operations such as take and filter", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14,
            ])) {
                const got = stream
                    .filter((x) => x % 2 === 0)
                    .take(6)
                    .map((x) => ({ value: x * 2 }))
                    .reduce(
                        (acc, next) => ({ total: next.value + acc.total }),
                        {
                            total: 0,
                        }
                    );

                expect(got).toEqual({ total: 84 });
            }
        });

        it("should reduce the array from start to end", () => {
            for (const stream of makeArrayArrayStreams([
                { val: 1 },
                { val: 2 },
                { val: 3 },
                { val: 4 },
            ])) {
                const got = stream.reduce<{ val: number }[]>((acc, next) => {
                    if (acc.length === 2) {
                        return acc;
                    }
                    acc.push(next);
                    return acc;
                }, []);

                expect(got).toEqual([{ val: 1 }, { val: 2 }]);
            }
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream(["a", "b", "c"])
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

            const stream2 = new ArrayStream(
                ["a", "b", "c"],
                new Ignorer()
            ).reduce((acc, next) => acc + next, "");
            assertType<string>(stream2);
            expect(stream2).toEqual("abc");

            const stream3 = new ArrayStream(
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
        it("should reduce the array from right to left", () => {
            const got = new ArrayStream([
                { val: 1 },
                { val: 2 },
                { val: 3 },
                { val: 4 },
            ]).reduceRight<{ val: number }[]>((acc, next) => {
                if (acc.length === 2) {
                    return acc;
                }
                acc.push(next);
                return acc;
            }, []);

            expect(got).toEqual([{ val: 4 }, { val: 3 }]);
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream(["a", "b", "c"])
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

            const stream2 = new ArrayStream(
                ["a", "b", "c"],
                new Ignorer()
            ).reduceRight((acc, next) => acc + next, "");
            assertType<string>(stream2);
            expect(stream2).toEqual("cba");

            const stream3 = new ArrayStream(
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

    describe("collect", () => {
        it("should exhaust the iterator and collect the data into an array", () => {
            for (const stream of makeArrayArrayStreams([
                1, 2, 3, 4, 5, 6, 7, 8, 9,
            ])) {
                const got = stream.collect();
                expect(got).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
            }
        });

        it("should have the correct return type depending on the error handler", () => {
            const stream = new ArrayStream(["a", "b", "c"])
                .map((x) => ({ x }))
                .collect();
            assertType<{ x: string }[]>(stream);
            expect(stream).toEqual([{ x: "a" }, { x: "b" }, { x: "c" }]);

            const stream2 = new ArrayStream(
                ["a", "b", "c"],
                new Ignorer()
            ).collect();
            assertType<string[]>(stream2);
            expect(stream2).toEqual(["a", "b", "c"]);

            const stream3 = new ArrayStream(
                ["a", "b", "c"],
                new Settler()
            ).collect();
            assertType<{ data: string[]; errors: string[] }>(stream3);
            expect(stream3).toEqual({
                data: ["a", "b", "c"],
                errors: [],
            });
        });

        it("should return the same values as toArray", () => {
            function* gen() {
                yield 1;
                yield 2;
                yield 3;
            }

            const streamToArray = new ArrayStream(gen()).toArray();
            const streamCollect = new ArrayStream(gen()).collect();

            expect(streamToArray).toEqual(streamCollect);
        });
    });

    describe("read", () => {
        it("should return an iterator through the stream's contents", () => {
            const input = [1, 2, 3];
            const stream = new ArrayStream(input);

            let result = stream.read().next();
            expect(result).toEqual({ done: false, value: 1 });

            result = stream.read().next();
            expect(result).toEqual({ done: false, value: 2 });

            result = stream.read().next();
            expect(result).toEqual({ done: false, value: 3 });

            result = stream.read().next();
            expect(result).toEqual({ done: true, value: undefined });
        });

        it("should rethrow the errors with more context if errors arise during iteration and the handler is Breaker", () => {
            function* gen() {
                yield 1;
                yield 2;
                throw new Error("Error");
            }

            const stream = new ArrayStream(gen(), new Breaker());
            const iter = stream.read();
            expect(() => {
                iter.next();
                iter.next();
                iter.next();
            }).toThrowError(
                "Error occurred at item at index 2 in iterator: Error"
            );
        });

        it("should rethrow the errors with more context if errors arise during operations and the handler is Breaker", () => {
            const stream = new ArrayStream([1, 2, 3], new Breaker(), {
                useIteratorHelpersIfAvailable: false,
            }).map((x) => {
                if (x === 2) {
                    throw new Error("Error");
                }
                return x;
            });

            const iter = stream.read();
            expect(() => {
                iter.next();
                iter.next();
                iter.next();
            }).toThrowError(
                "Error occurred at item at index 1 in iterator: Error occurred while performing map on 2 at index 1 in iterator: Error"
            );
        });

        it("should ignore the errors if the handler is Ignorer", () => {
            function* gen() {
                yield 1;
                yield 2;
                throw new Error("Error");
            }

            const stream = new ArrayStream(gen(), new Ignorer());
            const iter = stream.read();
            expect(() => {
                iter.next();
                iter.next();
                iter.next();
            }).not.toThrow();

            const stream2 = new ArrayStream([1, 2, 3], new Ignorer()).map(
                () => {
                    throw new Error("Surprise!");
                }
            );
            expect(() => stream2.collect()).not.toThrow();
        });

        it("should collect the errors during iteration if the handler is Settler", () => {
            function* gen() {
                yield 1;
                yield 2;
                throw new Error("Cycle Error");
            }

            const settler = new Settler();
            const stream = new ArrayStream(gen(), settler, {
                useIteratorHelpersIfAvailable: false,
            }).map((x) => {
                if (x === 2) {
                    throw new Error("Op Error");
                }
                return x * 2;
            });
            const data = stream.collect();
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
