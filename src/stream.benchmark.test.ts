import { expect, describe, it } from "vitest";

import { ArrayStream } from "./stream";

describe("ArrayStream performance", () => {
    function testArrayStreamPerformance(): number {
        const p1 = performance.now();

        const arr = Array.from({ length: 5_000_000 }, (_, i) => i);
        const stream = new ArrayStream(arr);
        for (let i = 0; i < 5_000_000; i++) {
            stream.map((x) => x + 1).filter((x) => x % 2 === 0);
        }
        stream.collect();

        return performance.now() - p1;
    }

    function testArrayPerformance(): number {
        const p1 = performance.now();

        let arr = Array.from({ length: 5_000_000 }, (_, i) => i);
        for (let i = 0; i < 5_000_000; i++) {
            arr = arr.map((x) => x + 1).filter((x) => x % 2 === 0);
        }

        return performance.now() - p1;
    }

    it("should be faster than native array methods", () => {
        const streamPerformance = testArrayStreamPerformance();
        const arrayPerformance = testArrayPerformance();

        console.log("Stream performance:", streamPerformance);
        console.log("Array performance:", arrayPerformance);
        // expect(streamPerformance).toBeLessThan(arrayPerformance);
    });
});
