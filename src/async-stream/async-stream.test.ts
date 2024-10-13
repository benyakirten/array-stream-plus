import { describe, it, expect, vi } from "vitest";

import { AsyncArrayStream } from "./async-stream";

describe("AsyncArrayStream", () => {
    describe("ops", () => {
        describe("map", () => {
            it("should map values from one shape to another", async () => {
                const got = await new AsyncArrayStream([1, 2, 3])
                    .map(async (x) => x * 2)
                    .collect();
                expect(got).toEqual([2, 4, 6]);
            });

            it("should funciton correctly with a synchronous map function", async () => {
                const got = await new AsyncArrayStream([1, 2, 3])
                    .map((x) => x * 2)
                    .collect();
                expect(got).toEqual([2, 4, 6]);
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
        });

        describe("skip", () => {
            it("should skip the first n items", async () => {
                const input = [1, 2, 3, 4, 5];
                const stream = new AsyncArrayStream(input).skip(2);
                const result = await stream.collect();
                expect(result).toEqual([3, 4, 5]);
            });
        });

        describe("step", () => {
            it("should yield every nth item", async () => {
                const input = [1, 2, 3, 4, 5, 6];
                const got = await new AsyncArrayStream(input)
                    .stepBy(2)
                    .collect();
                expect(got).toEqual([1, 3, 5]);
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
        });

        describe("reduceRight", () => {
            it("should reduceRight items starting from the end of the iterator", async () => {
                const input = ["a", "b", "c"];
                const stream = new AsyncArrayStream(input);
                const result = await stream.reduceRight(
                    async (acc, x) => acc + x,
                    ""
                );
                expect(result).toBe("cba");
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

                // TODO: Find out why all of the iterator is exhausted
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

                // TODO: Find out why all of the iterator is exhausted
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
        });

        describe("findLastIndex", () => {
            it("should find the index of the item starting from the last index in the array", async () => {
                const input = [1, 2, 3, 2];
                const stream = new AsyncArrayStream(input);
                const result = await stream.findLastIndex(async (x) => x === 2);
                expect(result).toBe(3);
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
});
