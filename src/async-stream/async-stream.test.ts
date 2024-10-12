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
            it("should zip two streams", async () => {
                const input1 = [1, 2, 3];
                const input2 = ["a", "b", "c"];
                const stream = new AsyncArrayStream(input1).zip(input2);
                const result = await stream.collect();
                expect(result).toEqual([
                    [1, "a"],
                    [2, "b"],
                    [3, "c"],
                ]);
            });
        });

        describe("enumerate", () => {
            it("should enumerate items", async () => {
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
            it("should flatMap items", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input).flatMap(
                    async (x) => [x, x * 2]
                );
                const result = await stream.collect();
                expect(result).toEqual([1, 2, 2, 4, 3, 6]);
            });
        });

        describe("fuse", () => {
            it("should fuse items", async () => {
                const input = [1, 2, null, 3, 4];
                const stream = new AsyncArrayStream(input).fuse();
                const result = await stream.collect();
                expect(result).toEqual([1, 2]);
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
        });

        describe("reduce", () => {
            it("should reduce items", async () => {
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
            it("should reduceRight items", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.reduceRight(
                    async (acc, x) => acc + x,
                    0
                );
                expect(result).toBe(6);
            });
        });

        describe("flat", () => {
            it("should flatten items", async () => {
                const input = [
                    [1, 2],
                    [3, 4],
                ];
                const stream = new AsyncArrayStream(input);
                const result = await stream.flat();
                expect(result).toEqual([1, 2, 3, 4]);
            });
        });

        describe("any", () => {
            it("should check if any item matches", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.any(async (x) => x > 2);
                expect(result).toBe(true);
            });
        });

        describe("all", () => {
            it("should check if all items match", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.all(async (x) => x > 0);
                expect(result).toBe(true);
            });
        });

        describe("find", () => {
            it("should find an item", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.find(async (x) => x === 2);
                expect(result).toBe(2);
            });
        });

        describe("findIndex", () => {
            it("should find the index of an item", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.findIndex(async (x) => x === 2);
                expect(result).toBe(1);
            });
        });

        describe("findLast", () => {
            it("should find the item starting from the end", async () => {
                const input = [1, 2, 3, 2];
                const stream = new AsyncArrayStream(input);
                const result = await stream.findLast(async (x) => x === 2);
                expect(result).toBe(2);
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
            it("should check if includes an item", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.includes(2);
                expect(result).toBe(true);
            });
        });

        describe("partition", () => {
            it("should partition items", async () => {
                const input = [1, 2, 3, 4];
                const stream = new AsyncArrayStream(input);
                const [left, right] = await stream.partition(
                    (x) => x % 2 === 0
                );
                expect(left).toEqual([2, 4]);
                expect(right).toEqual([1, 3]);
            });
        });

        describe("collect", () => {
            it("should collect items", async () => {
                const input = [1, 2, 3];
                const stream = new AsyncArrayStream(input);
                const result = await stream.collect();
                expect(result).toEqual([1, 2, 3]);
            });
        });
    });
});
