import esbuild from "esbuild";
import process from "process";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { createRequire } from "module";

const __require = createRequire(import.meta.url);

// esbuild plugin: loads .aff and .dic files from dictionary-en as plain text strings,
// bypassing the package's `exports` field restriction.
const dictionaryPlugin = {
  name: "dictionary-text-loader",
  setup(build) {
    build.onResolve({ filter: /dictionary-en\/index\.(aff|dic)$/ }, (args) => {
      const dictMain = __require.resolve("dictionary-en");
      const dictDir = dirname(dictMain);
      const filename = args.path.endsWith(".aff") ? "index.aff" : "index.dic";
      return { path: join(dictDir, filename), namespace: "dict-text" };
    });

    build.onLoad({ filter: /.*/, namespace: "dict-text" }, (args) => ({
      contents: readFileSync(args.path, "utf-8"),
      loader: "text",
    }));
  },
};

const prod = process.argv[2] === "production";

const buildOptions = {
  entryPoints: ["main.ts"],
  bundle: true,
  plugins: [dictionaryPlugin],
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
};

if (prod) {
  esbuild.build(buildOptions).catch(() => process.exit(1));
} else {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
}
