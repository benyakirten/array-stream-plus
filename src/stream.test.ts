import { expect, describe, test } from "vitest";

import { ArrayStream } from "./stream";

describe("ArrayStream", () => {
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
});
