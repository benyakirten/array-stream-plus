import { afterEach, vi } from "vitest";

const PerformanceMock = {
    now: vi.fn(),
};

afterEach(() => {
    PerformanceMock.now.mockReset();
});

vi.stubGlobal("performance", PerformanceMock);
