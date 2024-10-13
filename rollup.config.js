import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

export default [
    {
        input: "src/stream/stream.ts",
        output: {
            file: "dist/stream.min.js",
            format: "esm",
            sourcemap: true,
        },
        plugins: [
            typescript({
                tsconfig: "./tsconfig.json",
                declaration: true,
                declarationDir: "dist/types",
            }),
            terser(),
        ],
    },
    {
        input: "src/async-stream/async-stream.ts",
        output: {
            file: "dist/async-stream.min.js",
            format: "esm",
            sourcemap: true,
        },
        plugins: [
            typescript({
                tsconfig: "./tsconfig.json",
                declaration: true,
                declarationDir: "dist/types",
            }),
            terser(),
        ],
    },
];
