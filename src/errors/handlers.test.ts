import { describe, it, expect } from "vitest";

import { Breaker, Settler } from "./handlers";

describe("Breaker", () => {
    it("should rethrow an error with more context when registerCycleError is called", () => {
        const breaker = new Breaker<string>();
        const error = new Error("test error");
        const index = 5;

        expect(() => breaker.registerCycleError(error, index)).toThrowError(
            `Error occurred at ${index}th item in iterator: test error`
        );
    });

    it("should rethrow an error with more context when registerOpError is called", () => {
        const breaker = new Breaker<string>();
        const error = new Error("test error");
        const index = 5;
        const item = "test item";
        const op = "test op";

        expect(() =>
            breaker.registerOpError(error, index, item, op)
        ).toThrowError(
            `Error occurred while performing ${op} on ${item} at ${index}th item in iterator: test error`
        );
    });

    it("should return the data as is when compile is called", () => {
        const breaker = new Breaker<string>();
        const data = "test data";

        expect(breaker.compile(data)).toEqual(data);
    });
});

describe("Settler", () => {
    it("should collect an error with more context when registerCycleError is called", () => {
        const settler = new Settler<string>();
        const error = new Error("test error");
        const index = 5;

        settler.registerCycleError(error, index);

        expect(settler.errors).toHaveLength(1);
        expect(settler.errors[0].message).toBe(
            `Error occurred at ${index}th item in iterator: test error`
        );
    });

    it("should collect an error with more context when registerOpError is called", () => {
        const settler = new Settler<string>();
        const error = new Error("test error");
        const index = 5;
        const item = "test item";
        const op = "test op";

        settler.registerOpError(error, index, item, op);

        expect(settler.errors).toHaveLength(1);
        expect(settler.errors[0].message).toBe(
            `Error occurred while performing ${op} on ${item} at ${index}th item in iterator: test error`
        );
    });

    it("should return the data along with collected errors when compile is called", () => {
        const settler = new Settler<string>();
        const data = "test data";
        const error = new Error("test error");
        const index = 5;

        settler.registerCycleError(error, index);
        settler.registerOpError(error, index, data, "test op");

        const result = settler.compile(data);

        expect(result.data).toEqual(data);
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0].message).toBe(
            `Error occurred at ${index}th item in iterator: test error`
        );
        expect(result.errors[1].message).toBe(
            `Error occurred while performing test op on ${data} at ${index}th item in iterator: test error`
        );
    });
});
