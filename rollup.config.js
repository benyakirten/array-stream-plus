import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import gzipPlugin from "rollup-plugin-gzip";

export default [
    {
        input: "src/index.ts",
        output: {
            file: "dist/index.js",
            format: "esm",
        },
        plugins: [
            typescript({
                tsconfig: "./tsconfig.json",
                declaration: true,
                declarationDir: "dist/types",
                exclude: ["benchmark/**", "**/*.test.ts", "vitest.config.ts"],
            }),
        ],
    },
    {
        input: "src/index.ts",
        output: {
            file: "compiled.js",
            format: "esm",
        },
        plugins: [
            typescript({
                tsconfig: "./tsconfig.json",
                declaration: false,
                exclude: ["benchmark/**", "**/*.test.ts", "vitest.config.ts"],
            }),
            terser(),
            gzipPlugin(),
        ],
    },
];
