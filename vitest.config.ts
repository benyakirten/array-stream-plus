import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["src/**/*.test.ts"],
        typecheck: {
            enabled: true,
            include: ["src/**/*.test.ts"],
        },
    },
});
