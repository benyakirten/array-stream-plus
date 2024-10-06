import { expect, describe, test } from "vitest";

import { ArrayStream } from "./stream";

describe("ArrayStream", () => {
    // Operations
    test("take should return only as many items as designated", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
            .take(3)
            .collect();
        expect(got).toEqual([1, 2, 3]);
    });

    test("take should return all items if the limit is higher than the number of items", () => {
        const got = new ArrayStream([1, 2]).take(3).collect();
        expect(got).toEqual([1, 2]);
    });

    test("take should take 0 items if the limit is 0", () => {
        const got = new ArrayStream([1, 2, 3]).take(0).collect();
        expect(got).toEqual([]);
    });

    test("take should respect filters that have been previously applied in counting the items to take", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
            .filter((x) => x % 2 === 0)
            .take(3)
            .collect();
        expect(got).toEqual([2, 4, 6]);
    });

    test("take should continue to perform operations as expected after the limit has been reached", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
            .filter((x) => x % 2 === 0)
            .take(5)
            .map((x) => ({ value: x * 2 }))
            .take(3)
            .collect();
        expect(got).toEqual([{ value: 4 }, { value: 8 }, { value: 12 }]);
    });

    test("foreach should call the function for each item in the stream", () => {
        let i = 0;
        const got = new ArrayStream([1, 2, 3])
            .forEach(() => {
                i++;
            })
            .collect();

        expect(i).toEqual(3);
        expect(got).toEqual([1, 2, 3]);
    });

    test("inspect should call the function for each item in the stream", () => {
        let i = 0;
        const got = new ArrayStream([1, 2, 3])
            .inspect(() => {
                i++;
            })
            .collect();

        expect(i).toEqual(3);
        expect(got).toEqual([1, 2, 3]);
    });

    test("filterMap should filter out items that return null, false, or undefined and transform the others", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6])
            .filterMap((x) => (x % 2 === 0 ? x * 2 : null))
            .collect();

        expect(got).toEqual([4, 8, 12]);
    });

    test("stepBy should return every nth item", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
            .stepBy(3)
            .collect();

        expect(got).toEqual([1, 4, 7, 10]);
    });

    test("stepBy should respect other operations", () => {
        const got = new ArrayStream([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
        ])
            // 2, 4, 6, 8, 10, 12, 14, 16
            .filter((x) => x % 2 === 0)
            // 2, 6, 10, 14
            .stepBy(2)
            // 2, 6
            .take(2)
            .collect();

        expect(got).toEqual([2, 6]);
    });

    test("skip should skip the next n items of the array", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
            .skip(3)
            .collect();

        expect(got).toEqual([4, 5, 6, 7, 8, 9, 10]);
    });

    test("skip should be able to work with other operations", () => {
        const got = new ArrayStream([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
            20, 21, 22,
        ])
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
    });

    // Methods that return a new iterator
    test("chain should append one stream to the end of the other", () => {
        const got = new ArrayStream([1, 2, 3]).chain([4, 5, 6]).collect();

        expect(got).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test("chain should work with other operations", () => {
        const got = new ArrayStream([1, 2, 3])
            .filter((x) => x % 2 === 0)
            .chain([4, 5, 6])
            .collect();

        expect(got).toEqual([2, 4, 5, 6]);
    });

    test("zip should combine two streams into a single stream of tuples", () => {
        const got = new ArrayStream([1, 2, 3]).zip([4, 5, 6]).collect();

        expect(got).toEqual([
            [1, 4],
            [2, 5],
            [3, 6],
        ]);
    });

    test("zip should work with other operations", () => {
        const got = new ArrayStream([1, 2, 3])
            .map((x) => ({ x }))
            .zip([4, 5, 6])
            .collect();

        expect(got).toEqual([
            [{ x: 1 }, 4],
            [{ x: 2 }, 5],
            [{ x: 3 }, 6],
        ]);
    });

    test("zip should stop when the initial stream ends", () => {
        const got = new ArrayStream([1, 2, 3])
            .filter((x) => x % 2 === 0)
            .zip([4, 5, 6])
            .collect();

        expect(got).toEqual([[2, 4]]);
    });

    test("zip should stop when the new stream ends", () => {
        const got = new ArrayStream([1, 2, 3]).zip([4, 5]).collect();
        expect(got).toEqual([
            [1, 4],
            [2, 5],
        ]);
    });

    test("intersperse should intersperse a value between each item if it is not a function", () => {
        const got = new ArrayStream([1, 2, 3]).intersperse(0).collect();
        expect(got).toEqual([1, 0, 2, 0, 3]);
    });

    test("intersperse should call the function and intersperse it between each item if it is a function", () => {
        let i = 0;
        const got = new ArrayStream([1, 2, 3])
            .intersperse(() => {
                return i++;
            })
            .collect();

        expect(got).toEqual([1, 0, 2, 1, 3]);
        expect(i).toEqual(2);
    });

    test("intersperse should work correctly with other operations", () => {
        const got = new ArrayStream([1, 2, 3, 4])
            .filter((x) => x % 2 === 0)
            .intersperse(0)
            .collect();

        expect(got).toEqual([2, 0, 4]);
    });

    test("enumerate should return a stream of tuples with the index and the item", () => {
        const got = new ArrayStream([100, 200, 300]).enumerate().collect();
        expect(got).toEqual([
            [0, 100],
            [1, 200],
            [2, 300],
        ]);
    });

    test("enumerate should work with other operations", () => {
        const got = new ArrayStream([100, 200, 300])
            .filter((x) => x > 100)
            .enumerate()
            .collect();

        expect(got).toEqual([
            [0, 200],
            [1, 300],
        ]);
    });

    test("flatMap should take every item and apply the function to it, then flatten the results", () => {
        const got = new ArrayStream([1, 2, 3])
            .flatMap((x) => [x, x * 2])
            .collect();

        expect(got).toEqual([1, 2, 2, 4, 3, 6]);
    });

    test("flatMap should work with other operators", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9])
            .filter((x) => x % 2 === 0)
            .flatMap((x) => [x, x * 2, x * 3])
            .take(5)
            .collect();

        expect(got).toEqual([2, 4, 6, 4, 8]);
    });

    test("fuse should create an iterator that ends after the first null or undefined", () => {
        const got = new ArrayStream([1, 2, 3, null, 4, 5, 6]).fuse().collect();
        expect(got).toEqual([1, 2, 3]);
    });

    test("fuse should work with other operations", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, null, 7, 8, 9])
            .filter((x) => (x === null ? true : x % 2 === 0))
            .fuse()
            .take(2)
            .collect();

        expect(got).toEqual([2, 4]);
    });

    // Collectors
    test("count should count the remaining items after all operations have been performed", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14])
            // 2, 4, 6, 8, 10, 12, 14
            .filter((x) => x % 2 === 0)
            // 2, 4, 6, 8, 10, 12
            .take(6)
            // 6, 12
            .filter((x) => x % 3 === 0)
            .count();

        expect(got).toEqual(2);
    });

    test("reduce should reduce the remaining items after all operations have been performed", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14])
            .map((x) => ({ value: x * 2 }))
            .reduce((next, acc) => ({ total: next.value + acc.total }), {
                total: 0,
            });

        expect(got).toEqual({ total: 162 });
    });

    test("reduce should take into account takes and filters", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14])
            .filter((x) => x % 2 === 0)
            .take(6)
            .map((x) => ({ value: x * 2 }))
            .reduce((next, acc) => ({ total: next.value + acc.total }), {
                total: 0,
            });

        expect(got).toEqual({ total: 84 });
    });

    test("nth should return the nth item after all operations have been performed if it exists", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14])
            .filter((x) => x % 2 === 0)
            .take(6)
            .map((x) => ({ value: x * 2 }))
            .nth(2);

        expect(got).not.toBeNull();
        expect(got).toEqual({ value: 12 });
    });

    test("nth should return null if the nth item does not exist", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14])
            .filter((x) => x % 2 === 0)
            .take(6)
            .map((x) => ({ value: x * 2 }))
            .nth(100);

        expect(got).toBeNull();
    });

    test("flat should flatten the array to the specified depth", () => {
        const got = new ArrayStream([1, [2, [3, [4, 5]]]]).flat(2);
        expect(got).toEqual([1, 2, 3, [4, 5]]);
    });

    test("partition should split the array into two based on the predicate", () => {
        const got = new ArrayStream([1, 2, 3, 4, 5, 6, 7, 8, 9]).partition(
            (x) => x % 2 === 0
        );

        expect(got).toEqual([
            [2, 4, 6, 8],
            [1, 3, 5, 7, 9],
        ]);
    });
});
