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
});
