import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

export default {
    input: "src/index.ts",
    output: {
        file: "dist/index.js",
        format: "esm",
        sourcemap: true,
    },
    plugins: [
        typescript({
            tsconfig: "./tsconfig.json",
            declaration: true,
            declarationDir: "dist/types",
            exclude: ["benchmark/**", "**/*.test.ts"],
        }),
        terser(),
    ],
};
