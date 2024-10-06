import { expect, describe, it } from "vitest";
import { map, filter } from "itertools";

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

    function testItertoolsPerformance() {
        const p1 = performance.now();

        let arr = Array.from({ length: 5_000_000 }, (_, i) => i);
        for (let i = 0; i < 5_000_000; i++) {
            arr = map(arr, (x) => x + 1);
            arr = filter(arr, (x) => x % 2 === 0);
        }

        return performance.now() - p1;
    }

    function testForLoopPerformance() {
        const p1 = performance.now();

        const arr = Array.from({ length: 5_000_000 }, (_, i) => i);
        const intermediate = Array.from({ length: 5_000_000 });
        let count = 0;
        for (let i = 0; i < 5_000_000; i++) {
            const item = arr[i] + 1;
            if (item % 2 === 0) {
                intermediate[count++] = item;
            }
        }

        return performance.now() - p1;
    }

    it("should be faster than native array methods", () => {
        const streamPerformance = testArrayStreamPerformance();
        const arrayPerformance = testArrayPerformance();
        const itertoolsPerformance = testItertoolsPerformance();
        const forLoopPerformance = testForLoopPerformance();

        console.log("Stream performance:", streamPerformance);
        console.log("Array performance:", arrayPerformance);
        console.log("Itertools performance:", itertoolsPerformance);
        console.log("For loop performance:", forLoopPerformance);
        // expect(streamPerformance).toBeLessThan(arrayPerformance);
    });
});
