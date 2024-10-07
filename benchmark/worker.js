import { testPerformance } from "./scripts/stream.benchmark.js";

/**
 *
 * @param {MessageEvent<number>} e
 */
function handleMessage(e) {
    for (const iter of testPerformance(e.data)) {
        // eslint-disable-next-line no-undef
        postMessage(iter);
    }
}

// eslint-disable-next-line no-undef
onmessage = handleMessage;
