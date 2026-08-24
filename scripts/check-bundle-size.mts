import { readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";

const outputDirectory = new URL("../dist/", import.meta.url).pathname;
const limits = new Map([
  [".html", 300 * 1024],
  [".js", 800 * 1024],
  [".css", 250 * 1024]
]);

const failures: string[] = [];
for (const name of await readdir(outputDirectory)) {
  const limit = limits.get(extname(name));
  if (!limit) continue;
  const bytes = (await stat(join(outputDirectory, name))).size;
  if (bytes > limit) failures.push(`${name}: ${bytes} bytes exceeds ${limit}`);
}

if (failures.length) throw new Error(`Bundle size budget exceeded:\n${failures.join("\n")}`);
