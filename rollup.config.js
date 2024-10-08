import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

export default {
    input: "src/index.ts", // Entry file
    output: {
        file: "dist/bundle.min.js", // Output file
        format: "esm", // Output format (ES module)
        sourcemap: true, // Optional: generate sourcemaps
    },
    plugins: [
        typescript({
            tsconfig: "./tsconfig.json", // Use your tsconfig.json
            declaration: true, // Generates .d.ts files
            declarationDir: "dist/types", // Where to output declaration files
        }),
        terser(), // Minify the output
    ],
};
