import { map, filter } from "itertools";

import { ArrayStream } from "../../src";

function testArrayStreamPerformance(
    lengthAmount: number,
    opCount: number
): number {
    const p1 = performance.now();

    const arr = Array.from({ length: lengthAmount }, (_, i) => i);
    const stream = new ArrayStream(arr);
    for (let i = 0; i < opCount; i++) {
        stream.map((x) => x + 1).filter((x) => x % 10 === 0);
    }
    stream.collect();

    return performance.now() - p1;
}

function testArrayPerformance(lengthAmount: number, opCount: number): number {
    const p1 = performance.now();

    let arr = Array.from({ length: lengthAmount }, (_, i) => i);
    for (let i = 0; i < opCount; i++) {
        arr = arr.map((x) => x + 1).filter((x) => x % 10 === 0);
    }

    return performance.now() - p1;
}

function testItertoolsPerformance(
    lengthAmount: number,
    opCount: number
): number {
    const p1 = performance.now();

    let arr = Array.from({ length: lengthAmount }, (_, i) => i);
    for (let i = 0; i < opCount; i++) {
        arr = map(arr, (x) => x + 1);
        arr = filter(arr, (x) => x % 10 === 0);
    }

    return performance.now() - p1;
}

export function* testPerformance(numReps: number) {
    const POWERS_OF_TEN = 7;
    const MAX_RECURSION_DEPTH_POWER_OF_TEN = 3;

    const streamPerformance: number[][] = Array.from(
        { length: POWERS_OF_TEN },
        () => Array.from({ length: POWERS_OF_TEN }, () => 0)
    );
    const arrayPerformance: number[][] = Array.from(
        { length: POWERS_OF_TEN },
        () => Array.from({ length: POWERS_OF_TEN }, () => 0)
    );
    const itertoolsPerformance: number[][] = Array.from(
        { length: POWERS_OF_TEN },
        () => Array.from({ length: POWERS_OF_TEN }, () => 0)
    );

    // If the browser supports iterator helpers, we use them for .map and .filter
    // However, they count as recursion so we limit the depth to 1000 (10^3)
    const hasIterHelpers = "map" in Iterator.prototype;
    for (let i = 0; i < numReps; i++) {
        for (let j = 0; j < POWERS_OF_TEN; j++) {
            for (
                let k = 0;
                k < (hasIterHelpers ? 3 : MAX_RECURSION_DEPTH_POWER_OF_TEN);
                k++
            ) {
                const len = 10 ** j;
                const ops = 10 ** k;
                const streamPerformanceValue = testArrayStreamPerformance(
                    len,
                    ops
                );
                const arrayPerformanceValue = testArrayPerformance(len, ops);
                const itertoolsPerformanceValue = testItertoolsPerformance(
                    len,
                    ops
                );

                streamPerformance[j][k] =
                    (streamPerformance[j][k] * i + streamPerformanceValue) /
                    (i + 1);
                arrayPerformance[j][k] =
                    (arrayPerformance[j][k] * i + arrayPerformanceValue) /
                    (i + 1);
                itertoolsPerformance[j][k] =
                    (itertoolsPerformance[j][k] * i +
                        itertoolsPerformanceValue) /
                    (i + 1);
            }
        }
        yield [streamPerformance, arrayPerformance, itertoolsPerformance];
    }
}
