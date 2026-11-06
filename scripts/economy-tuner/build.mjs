// Bundles the game's economy for Node into .cache/economy.mjs: the `@` alias resolved, tunable constants made settable,
// and Vite's import.meta.glob (locale loading, unused here) stubbed out
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { makeTunable, tunableFile } from "./tunables.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const BUNDLE = fileURLToPath(new URL("./.cache/economy.mjs", import.meta.url));

export async function build() {
  const bundle = await rolldown({
    input: fileURLToPath(new URL("./runner.ts", import.meta.url)),
    platform: "node",
    resolve: { alias: { "@": `${ROOT}src` } },
    logLevel: "silent",
    plugins: [
      {
        name: "economy-tuner",
        transform(code, id) {
          const file = tunableFile(id);
          if (file) return makeTunable(code, file);
          if (code.includes("import.meta.glob"))
            return code.replace(/import\.meta\.glob(<[^>]*>)?\(/g, "((..._) => ({}))(");
        }
      }
    ]
  });
  await bundle.write({ file: BUNDLE, format: "esm" });
  await bundle.close();
  return BUNDLE;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await build());
